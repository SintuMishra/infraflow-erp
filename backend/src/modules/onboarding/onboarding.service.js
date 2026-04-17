const bcrypt = require("bcryptjs");

const { pool, withTransaction } = require("../../config/db");
const env = require("../../config/env");
const {
  buildUsernameFromEmployeeCode,
  generateTemporaryPassword,
} = require("../../utils/loginCredentials.util");
const {
  hasColumn,
  tableExists,
} = require("../../utils/companyScope.util");
const { formatDateOnly } = require("../../utils/date.util");
const { createEmployeeRecord } = require("../employees/employees.service");
const { createUser } = require("../auth/auth.model");
const {
  getCompanyProfile,
  saveCompanyProfile,
} = require("../company_profile/company_profile.service");

const normalizeText = (value) => String(value || "").trim();
const normalizeNullableText = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};
const MANAGED_COMPANY_STATUS_FILTERS = new Set(["all", "active", "suspended"]);
const MANAGED_COMPANY_BILLING_STATUS_FILTERS = new Set([
  "all",
  "trial",
  "active",
  "overdue",
  "grace",
  "on_hold",
  "suspended",
  "closed",
]);

const isUniqueViolation = (error) => error?.code === "23505";

const isCompanyNameConflict = (error) =>
  isUniqueViolation(error) &&
  [
    "uq_companies_company_name_normalized",
    "companies_company_name_key",
  ].includes(error.constraint);

const isCompanyCodeConflict = (error) =>
  isUniqueViolation(error) &&
  error.constraint === "companies_company_code_key";

const runWithRetrySavepoint = async (db, attempt, work) => {
  if (!db) {
    return await work();
  }

  const savepointName = `onboarding_company_retry_${attempt + 1}`;
  await db.query(`SAVEPOINT ${savepointName}`);

  try {
    const result = await work();
    await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    return result;
  } catch (error) {
    await db.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    throw error;
  }
};

const buildCompanyCodeBase = (companyName) => {
  const normalized = normalizeText(companyName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "COMPANY";
};

const generateUniqueCompanyCode = async (companyName, db = pool) => {
  const baseCode = buildCompanyCodeBase(companyName).slice(0, 30);
  let suffix = 0;

  while (suffix < 1000) {
    const candidate =
      suffix === 0 ? baseCode : `${baseCode}_${String(suffix).padStart(2, "0")}`;

    const result = await db.query(
      `SELECT id FROM companies WHERE company_code = $1 LIMIT 1`,
      [candidate]
    );

    if (!result.rows[0]) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error("COMPANY_CODE_GENERATION_FAILED");
};

const ensureOnboardingFoundation = async () => {
  const companiesExists = await tableExists("companies");

  if (!companiesExists) {
    throw new Error("COMPANY_FOUNDATION_MISSING");
  }

  const employeesScoped = await hasColumn("employees", "company_id");
  const usersScoped = await hasColumn("users", "company_id");

  if (!employeesScoped || !usersScoped) {
    throw new Error("COMPANY_SCOPE_INCOMPLETE");
  }
};

const findCompanyByName = async (companyName, db = pool) => {
  const result = await db.query(
    `
    SELECT
      id,
      company_code AS "companyCode",
      company_name AS "companyName",
      is_active AS "isActive"
    FROM companies
    WHERE LOWER(BTRIM(company_name)) = LOWER(BTRIM($1))
    LIMIT 1
    `,
    [companyName]
  );

  return result.rows[0] || null;
};

const createCompany = async ({ companyName, companyCode }, db = pool) => {
  try {
    const result = await db.query(
      `
      INSERT INTO companies (
        company_code,
        company_name,
        is_active
      )
      VALUES ($1, $2, TRUE)
      RETURNING
        id,
        company_code AS "companyCode",
        company_name AS "companyName",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [companyCode, companyName]
    );

    return result.rows[0];
  } catch (error) {
    if (isCompanyNameConflict(error)) {
      throw new Error("COMPANY_ALREADY_EXISTS");
    }

    throw error;
  }
};

const getCompanyById = async (companyId, db = pool) => {
  const normalizedCompanyId = Number(companyId || 0) || null;

  if (!normalizedCompanyId) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      id,
      company_code AS "companyCode",
      company_name AS "companyName",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM companies
    WHERE id = $1
    LIMIT 1
    `,
    [normalizedCompanyId]
  );

  return result.rows[0] || null;
};

const bootstrapCompanyOwner = async ({
  companyName,
  branchName,
  companyProfile = {},
  ownerFullName,
  ownerMobileNumber,
  ownerDesignation,
  ownerJoiningDate,
  ownerDepartment = "Admin",
}) => {
  await ensureOnboardingFoundation();

  const normalizedCompanyName = normalizeText(companyName);
  const normalizedOwnerFullName = normalizeText(ownerFullName);
  const normalizedOwnerDesignation = normalizeText(ownerDesignation);

  if (!normalizedCompanyName || !normalizedOwnerFullName || !normalizedOwnerDesignation) {
    throw new Error("INVALID_ONBOARDING_PAYLOAD");
  }

  const normalizedJoiningDate = ownerJoiningDate
    ? formatDateOnly(ownerJoiningDate)
    : null;

  if (ownerJoiningDate && !normalizedJoiningDate) {
    throw new Error("INVALID_ONBOARDING_PAYLOAD");
  }

  return await withTransaction(async (db) => {
    const existingCompany = await findCompanyByName(normalizedCompanyName, db);

    if (existingCompany) {
      throw new Error("COMPANY_ALREADY_EXISTS");
    }

    let company = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const companyCode = await generateUniqueCompanyCode(normalizedCompanyName, db);

      try {
        company = await runWithRetrySavepoint(db, attempt, async () =>
          await createCompany(
            {
              companyName: normalizedCompanyName,
              companyCode,
            },
            db
          )
        );
        break;
      } catch (error) {
        if (error.message === "COMPANY_ALREADY_EXISTS") {
          throw error;
        }

        if (!isCompanyCodeConflict(error)) {
          throw error;
        }
      }
    }

    if (!company) {
      throw new Error("COMPANY_CODE_GENERATION_FAILED");
    }

    const profile = await saveCompanyProfile(
      {
        companyName: normalizedCompanyName,
        branchName: normalizeText(branchName) || null,
        ...companyProfile,
      },
      company.id,
      db
    );

    const ownerEmployee = await createEmployeeRecord(
      {
        fullName: normalizedOwnerFullName,
        mobileNumber: normalizeText(ownerMobileNumber) || null,
        department: normalizeText(ownerDepartment) || "Admin",
        designation: normalizedOwnerDesignation,
        joiningDate: normalizedJoiningDate,
        companyId: company.id,
      },
      db
    );

    const username = buildUsernameFromEmployeeCode(ownerEmployee.employeeCode);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const ownerUser = await createUser(
      {
        employeeId: ownerEmployee.id,
        username,
        passwordHash,
        role: "super_admin",
        companyId: company.id,
      },
      db
    );

    return {
      company,
      companyProfile: profile,
      owner: {
        employeeId: ownerEmployee.id,
        employeeCode: ownerEmployee.employeeCode,
        fullName: ownerEmployee.fullName,
        username: ownerUser.username,
        temporaryPassword,
        role: ownerUser.role,
        mustChangePassword: ownerUser.mustChangePassword,
      },
    };
  });
};

const listManagedCompanies = async ({
  search = "",
  includeInactive = false,
  status = "all",
  billingStatus = "all",
} = {}) => {
  await ensureOnboardingFoundation();

  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const profileHasCompany = await hasColumn("company_profile", "company_id");
  const billingControlsExists = await tableExists("company_billing_controls");
  const platformOwnerCompanyId =
    Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
      ? env.platformOwnerCompanyId
      : null;

  const filters = [];
  const values = [];
  let valueIndex = 1;

  const normalizedSearch = normalizeText(search).toLowerCase();
  const normalizedStatus = MANAGED_COMPANY_STATUS_FILTERS.has(
    String(status || "all").trim().toLowerCase()
  )
    ? String(status || "all").trim().toLowerCase()
    : "all";
  const normalizedBillingStatus = MANAGED_COMPANY_BILLING_STATUS_FILTERS.has(
    String(billingStatus || "all").trim().toLowerCase()
  )
    ? String(billingStatus || "all").trim().toLowerCase()
    : "all";
  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    const searchParam = `$${valueIndex++}`;
    filters.push(
      `(
        LOWER(c.company_name) LIKE ${searchParam}
        OR LOWER(c.company_code) LIKE ${searchParam}
        OR LOWER(COALESCE(cp.branch_name, '')) LIKE ${searchParam}
      )`
    );
  }

  if (normalizedStatus === "active") {
    filters.push("c.is_active = TRUE");
  } else if (normalizedStatus === "suspended") {
    filters.push("c.is_active = FALSE");
  } else if (!includeInactive) {
    filters.push("c.is_active = TRUE");
  }

  if (platformOwnerCompanyId) {
    values.push(platformOwnerCompanyId);
    const ownerParam = `$${valueIndex++}`;
    filters.push(`c.id <> ${ownerParam}`);
  }

  const billingJoin = billingControlsExists
    ? `
    LEFT JOIN company_billing_controls bc
      ON bc.company_id = c.id
    `
    : "";

  const billingSelect = billingControlsExists
    ? `
      bc.billing_status AS "billingStatus",
      bc.subscription_plan AS "subscriptionPlan",
      bc.billing_cycle AS "billingCycle",
      bc.custom_cycle_label AS "customCycleLabel",
      bc.custom_cycle_days AS "customCycleDays",
      bc.plan_amount AS "planAmount",
      bc.currency_code AS "currencyCode",
      bc.outstanding_amount AS "outstandingAmount",
      bc.next_due_date AS "nextDueDate",
      bc.grace_until_date AS "graceUntilDate",
      bc.last_payment_date AS "lastPaymentDate",
      bc.payment_reference AS "paymentReference",
      bc.payment_terms AS "paymentTerms",
      bc.internal_notes AS "internalNotes",
    `
    : `
      NULL::VARCHAR AS "billingStatus",
      NULL::VARCHAR AS "subscriptionPlan",
      NULL::VARCHAR AS "billingCycle",
      NULL::VARCHAR AS "customCycleLabel",
      NULL::INTEGER AS "customCycleDays",
      NULL::NUMERIC AS "planAmount",
      NULL::VARCHAR AS "currencyCode",
      NULL::NUMERIC AS "outstandingAmount",
      NULL::DATE AS "nextDueDate",
      NULL::DATE AS "graceUntilDate",
      NULL::DATE AS "lastPaymentDate",
      NULL::VARCHAR AS "paymentReference",
      NULL::TEXT AS "paymentTerms",
      NULL::TEXT AS "internalNotes",
    `;

  if (normalizedBillingStatus !== "all") {
    if (billingControlsExists) {
      values.push(normalizedBillingStatus);
      const billingStatusParam = `$${valueIndex++}`;
      filters.push(
        `LOWER(COALESCE(bc.billing_status, 'active')) = ${billingStatusParam}`
      );
    } else if (normalizedBillingStatus !== "active") {
      filters.push("1 = 0");
    }
  }

  const query = `
    SELECT
      c.id,
      c.company_code AS "companyCode",
      c.company_name AS "companyName",
      c.is_active AS "isActive",
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",
      cp.branch_name AS "branchName",
      cp.mobile AS "companyMobile",
      cp.email AS "companyEmail",
      cp.address_line1 AS "companyAddressLine1",
      cp.city AS "companyCity",
      cp.state_name AS "companyStateName",
      cp.state_code AS "companyStateCode",
      cp.pincode AS "companyPincode",
      cp.gstin AS "companyGstin",
      cp.pan AS "companyPan",
      ${billingSelect}
      owner.owner_full_name AS "ownerFullName",
      owner.owner_mobile_number AS "ownerMobileNumber",
      owner.owner_employee_code AS "ownerEmployeeCode",
      owner.owner_username AS "ownerUsername"
    FROM companies c
    ${billingJoin}
    LEFT JOIN LATERAL (
      SELECT
        company_profile.branch_name,
        company_profile.mobile,
        company_profile.email,
        company_profile.address_line1,
        company_profile.city,
        company_profile.state_name,
        company_profile.state_code,
        company_profile.pincode,
        company_profile.gstin,
        company_profile.pan
      FROM company_profile
      WHERE company_profile.is_active = TRUE
      ${profileHasCompany ? "AND company_profile.company_id = c.id" : ""}
      ORDER BY company_profile.id DESC
      LIMIT 1
    ) cp ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        e.full_name AS owner_full_name,
        e.mobile_number AS owner_mobile_number,
        e.employee_code AS owner_employee_code,
        u.username AS owner_username
      FROM users u
      INNER JOIN employees e ON e.id = u.employee_id
      WHERE u.role = 'super_admin'
      AND u.is_active = TRUE
      ${usersHasCompany ? "AND u.company_id = c.id" : ""}
      ${!usersHasCompany && employeesHasCompany ? "AND e.company_id = c.id" : ""}
      ORDER BY u.id ASC
      LIMIT 1
    ) owner ON TRUE
    ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY c.created_at DESC, c.id DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const updateManagedCompanyProfile = async ({
  companyId,
  companyName,
  branchName = "",
  companyEmail = "",
  companyMobile = "",
}) => {
  await ensureOnboardingFoundation();

  const normalizedCompanyId = Number(companyId || 0) || null;
  const normalizedCompanyName = normalizeText(companyName);
  const normalizedBranchName = normalizeText(branchName);
  const normalizedCompanyEmail = normalizeText(companyEmail);
  const normalizedCompanyMobile = normalizeText(companyMobile);

  if (!normalizedCompanyId || !normalizedCompanyName) {
    throw new Error("INVALID_MANAGED_COMPANY_UPDATE");
  }

  return await withTransaction(async (db) => {
    const existingCompany = await getCompanyById(normalizedCompanyId, db);

    if (!existingCompany) {
      throw new Error("COMPANY_NOT_FOUND");
    }

    try {
      await db.query(
        `
        UPDATE companies
        SET
          company_name = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [normalizedCompanyName, normalizedCompanyId]
      );
    } catch (error) {
      if (isCompanyNameConflict(error)) {
        throw new Error("COMPANY_ALREADY_EXISTS");
      }

      throw error;
    }

    const existingProfile = (await getCompanyProfile(normalizedCompanyId, db)) || {};

    const profile = await saveCompanyProfile(
      {
        ...existingProfile,
        companyName: normalizedCompanyName,
        branchName: normalizedBranchName,
        email: normalizedCompanyEmail,
        mobile: normalizedCompanyMobile,
      },
      normalizedCompanyId,
      db
    );

    const updatedCompany = await getCompanyById(normalizedCompanyId, db);

    return {
      company: updatedCompany,
      companyProfile: profile,
    };
  });
};

const setManagedCompanyAccessStatus = async ({
  companyId,
  isActive,
}) => {
  await ensureOnboardingFoundation();

  const normalizedCompanyId = Number(companyId || 0) || null;

  if (!normalizedCompanyId || typeof isActive !== "boolean") {
    throw new Error("INVALID_MANAGED_COMPANY_ACCESS");
  }

  const platformOwnerCompanyId =
    Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
      ? env.platformOwnerCompanyId
      : null;

  if (platformOwnerCompanyId && normalizedCompanyId === platformOwnerCompanyId && !isActive) {
    throw new Error("PLATFORM_OWNER_COMPANY_CANNOT_BE_DISABLED");
  }

  const result = await pool.query(
    `
    UPDATE companies
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING
      id,
      company_code AS "companyCode",
      company_name AS "companyName",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [isActive, normalizedCompanyId]
  );

  if (!result.rows[0]) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  return result.rows[0];
};

const normalizeBillingStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "active";
  }
  return normalized;
};

const normalizeBillingCycle = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "monthly";
  }
  return normalized;
};

const normalizeDateOnlyOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  return formatDateOnly(value);
};

const normalizeMoneyOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return NaN;
  }

  return Number(numericValue.toFixed(2));
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, "\"\"")}"`;

const generateBillingInvoiceNumber = async ({
  companyCode,
  invoiceDate,
  db = pool,
}) => {
  const normalizedCompanyCode = String(companyCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16) || "CLIENT";
  const normalizedInvoiceDate = normalizeDateOnlyOrNull(invoiceDate) || formatDateOnly(new Date());
  const periodKey = String(normalizedInvoiceDate).replace(/-/g, "").slice(0, 6);
  const prefix = `INV-${normalizedCompanyCode}-${periodKey}`;

  const result = await db.query(
    `
    SELECT invoice_number AS "invoiceNumber"
    FROM company_billing_invoices
    WHERE invoice_number LIKE $1
    ORDER BY invoice_number DESC
    LIMIT 1
    `,
    [`${prefix}-%`]
  );

  const lastInvoiceNumber = String(result.rows[0]?.invoiceNumber || "").trim();
  const lastSequence = Number(lastInvoiceNumber.split("-").pop() || 0) || 0;
  const nextSequence = String(lastSequence + 1).padStart(4, "0");
  return `${prefix}-${nextSequence}`;
};

const updateManagedCompanyBillingProfile = async ({
  companyId,
  billingStatus,
  subscriptionPlan,
  billingCycle,
  customCycleLabel,
  customCycleDays,
  planAmount,
  currencyCode,
  outstandingAmount,
  nextDueDate,
  graceUntilDate,
  lastPaymentDate,
  paymentReference,
  paymentTerms,
  internalNotes,
  updatedByUserId = null,
}) => {
  await ensureOnboardingFoundation();

  const normalizedCompanyId = Number(companyId || 0) || null;
  if (!normalizedCompanyId) {
    throw new Error("INVALID_MANAGED_COMPANY_BILLING_UPDATE");
  }

  const existingCompany = await getCompanyById(normalizedCompanyId);
  if (!existingCompany) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  const normalizedBillingStatus = normalizeBillingStatus(billingStatus);
  const normalizedBillingCycle = normalizeBillingCycle(billingCycle);
  const normalizedCurrencyCode = String(currencyCode || "INR")
    .trim()
    .toUpperCase();
  const normalizedCustomCycleLabel = normalizeNullableText(customCycleLabel);
  const normalizedCustomCycleDays =
    customCycleDays === null || customCycleDays === undefined || String(customCycleDays).trim() === ""
      ? null
      : Number(customCycleDays);
  const normalizedPlanAmount = normalizeMoneyOrNull(planAmount);
  const normalizedOutstandingAmount = normalizeMoneyOrNull(outstandingAmount);
  const normalizedNextDueDate = normalizeDateOnlyOrNull(nextDueDate);
  const normalizedGraceUntilDate = normalizeDateOnlyOrNull(graceUntilDate);
  const normalizedLastPaymentDate = normalizeDateOnlyOrNull(lastPaymentDate);

  if (Number.isNaN(normalizedPlanAmount) || Number.isNaN(normalizedOutstandingAmount)) {
    throw new Error("INVALID_BILLING_AMOUNT");
  }

  if (
    normalizedCustomCycleDays !== null &&
    (!Number.isInteger(normalizedCustomCycleDays) ||
      normalizedCustomCycleDays < 1 ||
      normalizedCustomCycleDays > 365)
  ) {
    throw new Error("INVALID_CUSTOM_BILLING_CYCLE");
  }

  if (
    normalizedNextDueDate &&
    normalizedGraceUntilDate &&
    normalizedGraceUntilDate < normalizedNextDueDate
  ) {
    throw new Error("INVALID_BILLING_GRACE_DATE");
  }

  const result = await pool.query(
    `
    INSERT INTO company_billing_controls (
      company_id,
      billing_status,
      subscription_plan,
      billing_cycle,
      custom_cycle_label,
      custom_cycle_days,
      plan_amount,
      currency_code,
      outstanding_amount,
      next_due_date,
      grace_until_date,
      last_payment_date,
      payment_reference,
      payment_terms,
      internal_notes,
      updated_by_user_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )
    ON CONFLICT (company_id)
    DO UPDATE SET
      billing_status = EXCLUDED.billing_status,
      subscription_plan = EXCLUDED.subscription_plan,
      billing_cycle = EXCLUDED.billing_cycle,
      custom_cycle_label = EXCLUDED.custom_cycle_label,
      custom_cycle_days = EXCLUDED.custom_cycle_days,
      plan_amount = EXCLUDED.plan_amount,
      currency_code = EXCLUDED.currency_code,
      outstanding_amount = EXCLUDED.outstanding_amount,
      next_due_date = EXCLUDED.next_due_date,
      grace_until_date = EXCLUDED.grace_until_date,
      last_payment_date = EXCLUDED.last_payment_date,
      payment_reference = EXCLUDED.payment_reference,
      payment_terms = EXCLUDED.payment_terms,
      internal_notes = EXCLUDED.internal_notes,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      company_id AS "companyId",
      billing_status AS "billingStatus",
      subscription_plan AS "subscriptionPlan",
      billing_cycle AS "billingCycle",
      custom_cycle_label AS "customCycleLabel",
      custom_cycle_days AS "customCycleDays",
      plan_amount AS "planAmount",
      currency_code AS "currencyCode",
      outstanding_amount AS "outstandingAmount",
      next_due_date AS "nextDueDate",
      grace_until_date AS "graceUntilDate",
      last_payment_date AS "lastPaymentDate",
      payment_reference AS "paymentReference",
      payment_terms AS "paymentTerms",
      internal_notes AS "internalNotes",
      updated_by_user_id AS "updatedByUserId",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      normalizedBillingStatus,
      normalizeNullableText(subscriptionPlan),
      normalizedBillingCycle,
      normalizedCustomCycleLabel,
      normalizedCustomCycleDays,
      normalizedPlanAmount,
      normalizedCurrencyCode,
      normalizedOutstandingAmount ?? 0,
      normalizedNextDueDate,
      normalizedGraceUntilDate,
      normalizedLastPaymentDate,
      normalizeNullableText(paymentReference),
      normalizeNullableText(paymentTerms),
      normalizeNullableText(internalNotes),
      Number(updatedByUserId || 0) || null,
    ]
  );

  return {
    company: existingCompany,
    billing: result.rows[0] || null,
  };
};

const listManagedCompanyBillingInvoices = async ({
  companyId,
  limit = 30,
}) => {
  await ensureOnboardingFoundation();

  if (!(await tableExists("company_billing_invoices"))) {
    return [];
  }

  const normalizedCompanyId = Number(companyId || 0) || null;
  if (!normalizedCompanyId) {
    throw new Error("INVALID_MANAGED_COMPANY_BILLING_INVOICE_OPERATION");
  }

  const queryLimit = Number(limit);
  const resolvedLimit =
    Number.isInteger(queryLimit) && queryLimit > 0
      ? Math.min(queryLimit, 100)
      : 30;

  const result = await pool.query(
    `
    SELECT
      id,
      company_id AS "companyId",
      invoice_number AS "invoiceNumber",
      invoice_date AS "invoiceDate",
      period_start_date AS "periodStartDate",
      period_end_date AS "periodEndDate",
      due_date AS "dueDate",
      currency_code AS "currencyCode",
      plan_amount AS "planAmount",
      outstanding_amount AS "outstandingAmount",
      total_amount AS "totalAmount",
      billing_status AS "billingStatus",
      billing_cycle AS "billingCycle",
      custom_cycle_label AS "customCycleLabel",
      custom_cycle_days AS "customCycleDays",
      subscription_plan AS "subscriptionPlan",
      payment_reference AS "paymentReference",
      payment_terms AS "paymentTerms",
      notes,
      generated_by_user_id AS "generatedByUserId",
      created_at AS "createdAt"
    FROM company_billing_invoices
    WHERE company_id = $1
    ORDER BY invoice_date DESC, id DESC
    LIMIT $2
    `,
    [normalizedCompanyId, resolvedLimit]
  );

  return result.rows;
};

const createManagedCompanyBillingInvoice = async ({
  companyId,
  invoiceDate,
  periodStartDate,
  periodEndDate,
  dueDate,
  subscriptionPlan,
  planAmount,
  outstandingAmount,
  currencyCode,
  notes,
  paymentReference,
  paymentTerms,
  generatedByUserId = null,
}) => {
  await ensureOnboardingFoundation();

  if (!(await tableExists("company_billing_invoices"))) {
    throw new Error("BILLING_INVOICE_FOUNDATION_MISSING");
  }

  const normalizedCompanyId = Number(companyId || 0) || null;
  if (!normalizedCompanyId) {
    throw new Error("INVALID_MANAGED_COMPANY_BILLING_INVOICE_OPERATION");
  }

  const company = await getCompanyById(normalizedCompanyId);
  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  const billingControlResult = await pool.query(
    `
    SELECT
      billing_status AS "billingStatus",
      billing_cycle AS "billingCycle",
      custom_cycle_label AS "customCycleLabel",
      custom_cycle_days AS "customCycleDays",
      subscription_plan AS "subscriptionPlan",
      plan_amount AS "planAmount",
      currency_code AS "currencyCode",
      outstanding_amount AS "outstandingAmount",
      payment_reference AS "paymentReference",
      payment_terms AS "paymentTerms",
      next_due_date AS "nextDueDate"
    FROM company_billing_controls
    WHERE company_id = $1
    LIMIT 1
    `,
    [normalizedCompanyId]
  );
  const billing = billingControlResult.rows[0] || null;

  const normalizedInvoiceDate = normalizeDateOnlyOrNull(invoiceDate) || formatDateOnly(new Date());
  const normalizedPeriodStartDate = normalizeDateOnlyOrNull(periodStartDate);
  const normalizedPeriodEndDate = normalizeDateOnlyOrNull(periodEndDate);
  const normalizedDueDate = normalizeDateOnlyOrNull(dueDate || billing?.nextDueDate);

  if (
    normalizedPeriodStartDate &&
    normalizedPeriodEndDate &&
    normalizedPeriodEndDate < normalizedPeriodStartDate
  ) {
    throw new Error("INVALID_BILLING_INVOICE_PERIOD");
  }

  const normalizedPlanAmount =
    normalizeMoneyOrNull(planAmount) ??
    normalizeMoneyOrNull(billing?.planAmount) ??
    0;
  const normalizedOutstandingAmount =
    normalizeMoneyOrNull(outstandingAmount) ??
    normalizeMoneyOrNull(billing?.outstandingAmount) ??
    0;
  if (Number.isNaN(normalizedPlanAmount) || Number.isNaN(normalizedOutstandingAmount)) {
    throw new Error("INVALID_BILLING_AMOUNT");
  }
  const totalAmount = Number((normalizedPlanAmount + normalizedOutstandingAmount).toFixed(2));

  const normalizedBillingStatus = normalizeBillingStatus(billing?.billingStatus || "active");
  const normalizedBillingCycle = normalizeBillingCycle(billing?.billingCycle || "monthly");
  const normalizedCustomCycleLabel = normalizeNullableText(billing?.customCycleLabel);
  const normalizedCustomCycleDays =
    billing?.customCycleDays === null || billing?.customCycleDays === undefined
      ? null
      : Number(billing.customCycleDays);
  const normalizedCurrencyCode = String(
    currencyCode || billing?.currencyCode || "INR"
  )
    .trim()
    .toUpperCase();
  const normalizedInvoiceNumber = await generateBillingInvoiceNumber({
    companyCode: company.companyCode,
    invoiceDate: normalizedInvoiceDate,
  });

  const result = await pool.query(
    `
    INSERT INTO company_billing_invoices (
      company_id,
      invoice_number,
      invoice_date,
      period_start_date,
      period_end_date,
      due_date,
      currency_code,
      plan_amount,
      outstanding_amount,
      total_amount,
      billing_status,
      billing_cycle,
      custom_cycle_label,
      custom_cycle_days,
      subscription_plan,
      payment_reference,
      payment_terms,
      notes,
      generated_by_user_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19
    )
    RETURNING
      id,
      company_id AS "companyId",
      invoice_number AS "invoiceNumber",
      invoice_date AS "invoiceDate",
      period_start_date AS "periodStartDate",
      period_end_date AS "periodEndDate",
      due_date AS "dueDate",
      currency_code AS "currencyCode",
      plan_amount AS "planAmount",
      outstanding_amount AS "outstandingAmount",
      total_amount AS "totalAmount",
      billing_status AS "billingStatus",
      billing_cycle AS "billingCycle",
      custom_cycle_label AS "customCycleLabel",
      custom_cycle_days AS "customCycleDays",
      subscription_plan AS "subscriptionPlan",
      payment_reference AS "paymentReference",
      payment_terms AS "paymentTerms",
      notes,
      generated_by_user_id AS "generatedByUserId",
      created_at AS "createdAt"
    `,
    [
      normalizedCompanyId,
      normalizedInvoiceNumber,
      normalizedInvoiceDate,
      normalizedPeriodStartDate,
      normalizedPeriodEndDate,
      normalizedDueDate,
      normalizedCurrencyCode,
      normalizedPlanAmount,
      normalizedOutstandingAmount,
      totalAmount,
      normalizedBillingStatus,
      normalizedBillingCycle,
      normalizedCustomCycleLabel,
      normalizedCustomCycleDays,
      normalizeNullableText(subscriptionPlan || billing?.subscriptionPlan),
      normalizeNullableText(paymentReference || billing?.paymentReference),
      normalizeNullableText(paymentTerms || billing?.paymentTerms),
      normalizeNullableText(notes),
      Number(generatedByUserId || 0) || null,
    ]
  );

  const companyProfile = await getCompanyProfile(normalizedCompanyId);
  const platformOwnerCompanyId =
    Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
      ? env.platformOwnerCompanyId
      : null;
  const issuerProfile = platformOwnerCompanyId
    ? await getCompanyProfile(platformOwnerCompanyId)
    : null;

  return {
    company,
    billing,
    invoice: result.rows[0] || null,
    companyProfile,
    issuerProfile,
  };
};

const permanentlyDeleteManagedCompany = async ({
  companyId,
  deletedByUserId = null,
}) => {
  await ensureOnboardingFoundation();

  const normalizedCompanyId = Number(companyId || 0) || null;
  if (!normalizedCompanyId) {
    throw new Error("INVALID_MANAGED_COMPANY_DELETE");
  }

  const platformOwnerCompanyId =
    Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
      ? env.platformOwnerCompanyId
      : null;
  if (platformOwnerCompanyId && normalizedCompanyId === platformOwnerCompanyId) {
    throw new Error("PLATFORM_OWNER_COMPANY_CANNOT_BE_DELETED");
  }

  return await withTransaction(async (db) => {
    const company = await getCompanyById(normalizedCompanyId, db);
    if (!company) {
      throw new Error("COMPANY_NOT_FOUND");
    }

    const tableResult = await db.query(
      `
      SELECT table_schema AS "schemaName", table_name AS "tableName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'company_id'
        AND table_name <> 'companies'
      ORDER BY table_name ASC
      `
    );

    for (const row of tableResult.rows) {
      const schemaName = quoteIdentifier(row.schemaName);
      const tableName = quoteIdentifier(row.tableName);
      await db.query(
        `DELETE FROM ${schemaName}.${tableName} WHERE company_id = $1`,
        [normalizedCompanyId]
      );
    }

    const deleteResult = await db.query(
      `
      DELETE FROM companies
      WHERE id = $1
      RETURNING
        id,
        company_code AS "companyCode",
        company_name AS "companyName"
      `,
      [normalizedCompanyId]
    );

    if (!deleteResult.rows[0]) {
      throw new Error("COMPANY_NOT_FOUND");
    }

    return {
      company: deleteResult.rows[0],
      deletedByUserId: Number(deletedByUserId || 0) || null,
    };
  });
};

module.exports = {
  bootstrapCompanyOwner,
  buildCompanyCodeBase,
  createManagedCompanyBillingInvoice,
  getCompanyById,
  findCompanyByName,
  isCompanyCodeConflict,
  isCompanyNameConflict,
  listManagedCompanies,
  listManagedCompanyBillingInvoices,
  permanentlyDeleteManagedCompany,
  updateManagedCompanyBillingProfile,
  updateManagedCompanyProfile,
  setManagedCompanyAccessStatus,
};
