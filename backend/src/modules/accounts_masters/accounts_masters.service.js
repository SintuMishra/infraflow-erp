const { pool, withTransaction } = require("../../config/db");

const requireCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const listAccountGroups = async ({ companyId }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const result = await pool.query(
    `
    SELECT
      id,
      group_code AS "groupCode",
      group_name AS "groupName",
      nature,
      parent_group_id AS "parentGroupId",
      display_order AS "displayOrder",
      is_system AS "isSystem",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM account_groups
    WHERE company_id = $1
    ORDER BY display_order ASC, group_name ASC
    `,
    [normalizedCompanyId]
  );

  return result.rows;
};

const createAccountGroup = async ({
  companyId,
  groupCode,
  groupName,
  nature,
  parentGroupId = null,
  displayOrder = 0,
  isSystem = false,
  isActive = true,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedCode = String(groupCode || "").trim().toUpperCase();
  const normalizedName = String(groupName || "").trim();

  if (!normalizedCode || !normalizedName || !String(nature || "").trim()) {
    const error = new Error("groupCode, groupName and nature are required");
    error.statusCode = 400;
    throw error;
  }
  if (!["asset", "liability", "equity", "income", "expense"].includes(String(nature).trim().toLowerCase())) {
    const error = new Error("nature must be asset/liability/equity/income/expense");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO account_groups (
      company_id,
      group_code,
      group_name,
      nature,
      parent_group_id,
      display_order,
      is_system,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING
      id,
      group_code AS "groupCode",
      group_name AS "groupName",
      nature,
      parent_group_id AS "parentGroupId",
      display_order AS "displayOrder",
      is_system AS "isSystem",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      normalizedCode,
      normalizedName,
      String(nature).trim().toLowerCase(),
      parentGroupId || null,
      Number(displayOrder || 0),
      Boolean(isSystem),
      Boolean(isActive),
    ]
  );

  return result.rows[0] || null;
};

const listChartOfAccounts = async ({ companyId, accountType = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  let where = "WHERE coa.company_id = $1";

  if (accountType) {
    values.push(String(accountType).trim().toLowerCase());
    where += ` AND coa.account_type = $${values.length}`;
  }

  const result = await pool.query(
    `
    SELECT
      coa.id,
      coa.account_group_id AS "accountGroupId",
      ag.group_name AS "accountGroupName",
      coa.account_code AS "accountCode",
      coa.account_name AS "accountName",
      coa.account_type AS "accountType",
      coa.normal_balance AS "normalBalance",
      coa.allow_direct_posting AS "allowDirectPosting",
      coa.is_party_control AS "isPartyControl",
      coa.is_bank_control AS "isBankControl",
      coa.is_system AS "isSystem",
      coa.is_active AS "isActive",
      coa.created_at AS "createdAt",
      coa.updated_at AS "updatedAt"
    FROM chart_of_accounts coa
    INNER JOIN account_groups ag ON ag.id = coa.account_group_id
    ${where}
    ORDER BY coa.account_code ASC, coa.id ASC
    `,
    values
  );

  return result.rows;
};

const createChartOfAccount = async ({
  companyId,
  accountGroupId,
  accountCode,
  accountName,
  accountType,
  normalBalance,
  allowDirectPosting = true,
  isPartyControl = false,
  isBankControl = false,
  isSystem = false,
  isActive = true,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedCode = String(accountCode || "").trim().toUpperCase();
  const normalizedName = String(accountName || "").trim();
  if (!Number(accountGroupId) || !normalizedCode || !normalizedName) {
    const error = new Error("accountGroupId, accountCode, and accountName are required");
    error.statusCode = 400;
    throw error;
  }
  const normalizedAccountType = String(accountType || "ledger").trim().toLowerCase();
  if (!["control", "ledger", "cash", "bank", "customer", "supplier", "tax", "adjustment"].includes(normalizedAccountType)) {
    const error = new Error("Unsupported accountType");
    error.statusCode = 400;
    throw error;
  }
  const normalizedBalance = String(normalBalance || "debit").trim().toLowerCase();
  if (!["debit", "credit"].includes(normalizedBalance)) {
    const error = new Error("normalBalance must be debit or credit");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO chart_of_accounts (
      company_id,
      account_group_id,
      account_code,
      account_name,
      account_type,
      normal_balance,
      allow_direct_posting,
      is_party_control,
      is_bank_control,
      is_system,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING
      id,
      account_group_id AS "accountGroupId",
      account_code AS "accountCode",
      account_name AS "accountName",
      account_type AS "accountType",
      normal_balance AS "normalBalance",
      allow_direct_posting AS "allowDirectPosting",
      is_party_control AS "isPartyControl",
      is_bank_control AS "isBankControl",
      is_system AS "isSystem",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      Number(accountGroupId),
      normalizedCode,
      normalizedName,
      normalizedAccountType,
      normalizedBalance,
      Boolean(allowDirectPosting),
      Boolean(isPartyControl),
      Boolean(isBankControl),
      Boolean(isSystem),
      Boolean(isActive),
    ]
  );

  return result.rows[0] || null;
};

const listLedgers = async ({ companyId, accountId = null, partyId = null, vendorId = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const filters = ["l.company_id = $1"];

  if (accountId) {
    values.push(Number(accountId));
    filters.push(`l.account_id = $${values.length}`);
  }

  if (partyId) {
    values.push(Number(partyId));
    filters.push(`l.party_id = $${values.length}`);
  }

  if (vendorId) {
    values.push(Number(vendorId));
    filters.push(`l.vendor_id = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      l.id,
      l.account_id AS "accountId",
      a.account_name AS "accountName",
      l.ledger_code AS "ledgerCode",
      l.ledger_name AS "ledgerName",
      l.party_id AS "partyId",
      p.party_name AS "partyName",
      l.vendor_id AS "vendorId",
      v.vendor_name AS "vendorName",
      l.plant_id AS "plantId",
      pm.plant_name AS "plantName",
      l.project_id AS "projectId",
      pr.project_name AS "projectName",
      l.vehicle_id AS "vehicleId",
      vh.vehicle_number AS "vehicleNumber",
      l.currency_code AS "currencyCode",
      l.opening_debit AS "openingDebit",
      l.opening_credit AS "openingCredit",
      l.is_system_generated AS "isSystemGenerated",
      l.is_active AS "isActive",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
    FROM ledgers l
    INNER JOIN chart_of_accounts a ON a.id = l.account_id
    LEFT JOIN party_master p ON p.id = l.party_id
    LEFT JOIN vendor_master v ON v.id = l.vendor_id
    LEFT JOIN plant_master pm ON pm.id = l.plant_id
    LEFT JOIN project_daily_reports pr ON pr.id = l.project_id
    LEFT JOIN vehicles vh ON vh.id = l.vehicle_id
    WHERE ${filters.join(" AND ")}
    ORDER BY l.ledger_name ASC
    `,
    values
  );

  return result.rows;
};

const createLedger = async ({
  companyId,
  accountId,
  ledgerCode,
  ledgerName,
  partyId = null,
  vendorId = null,
  plantId = null,
  projectId = null,
  vehicleId = null,
  currencyCode = "INR",
  openingDebit = 0,
  openingCredit = 0,
  isSystemGenerated = false,
  isActive = true,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  if (!Number(accountId) || !String(ledgerCode || "").trim() || !String(ledgerName || "").trim()) {
    const error = new Error("accountId, ledgerCode and ledgerName are required");
    error.statusCode = 400;
    throw error;
  }
  if (Boolean(partyId) && Boolean(vendorId)) {
    const error = new Error("Only one of partyId or vendorId can be set on ledger");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO ledgers (
      company_id,
      account_id,
      ledger_code,
      ledger_name,
      party_id,
      vendor_id,
      plant_id,
      project_id,
      vehicle_id,
      currency_code,
      opening_debit,
      opening_credit,
      is_system_generated,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING
      id,
      account_id AS "accountId",
      ledger_code AS "ledgerCode",
      ledger_name AS "ledgerName",
      party_id AS "partyId",
      vendor_id AS "vendorId",
      plant_id AS "plantId",
      project_id AS "projectId",
      vehicle_id AS "vehicleId",
      currency_code AS "currencyCode",
      opening_debit AS "openingDebit",
      opening_credit AS "openingCredit",
      is_system_generated AS "isSystemGenerated",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      Number(accountId),
      String(ledgerCode).trim().toUpperCase(),
      String(ledgerName).trim(),
      partyId || null,
      vendorId || null,
      plantId || null,
      projectId || null,
      vehicleId || null,
      String(currencyCode || "INR").trim().toUpperCase(),
      Number(openingDebit || 0),
      Number(openingCredit || 0),
      Boolean(isSystemGenerated),
      Boolean(isActive),
    ]
  );

  return result.rows[0] || null;
};

const listFinancialYears = async ({ companyId }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const result = await pool.query(
    `
    SELECT
      id,
      fy_code AS "fyCode",
      fy_name AS "fyName",
      start_date AS "startDate",
      end_date AS "endDate",
      is_closed AS "isClosed",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM financial_years
    WHERE company_id = $1
    ORDER BY start_date DESC, id DESC
    `,
    [normalizedCompanyId]
  );

  return result.rows;
};

const createFinancialYear = async ({ companyId, fyCode, fyName, startDate, endDate }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  if (!String(fyCode || "").trim() || !String(fyName || "").trim()) {
    const error = new Error("fyCode and fyName are required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO financial_years (company_id, fy_code, fy_name, start_date, end_date)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING
      id,
      fy_code AS "fyCode",
      fy_name AS "fyName",
      start_date AS "startDate",
      end_date AS "endDate",
      is_closed AS "isClosed",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      String(fyCode).trim(),
      String(fyName).trim(),
      String(startDate || "").trim(),
      String(endDate || "").trim(),
    ]
  );

  return result.rows[0] || null;
};

const createAccountingPeriod = async ({
  companyId,
  financialYearId,
  periodCode,
  periodName,
  periodStart,
  periodEnd,
  status = "open",
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  if (!Number(financialYearId) || !String(periodCode || "").trim()) {
    const error = new Error("financialYearId and periodCode are required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO accounting_periods (
      company_id,
      financial_year_id,
      period_code,
      period_name,
      period_start,
      period_end,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING
      id,
      financial_year_id AS "financialYearId",
      period_code AS "periodCode",
      period_name AS "periodName",
      period_start AS "periodStart",
      period_end AS "periodEnd",
      status,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      Number(financialYearId),
      String(periodCode).trim(),
      String(periodName || "").trim() || String(periodCode).trim(),
      String(periodStart || "").trim(),
      String(periodEnd || "").trim(),
      String(status || "open").trim().toLowerCase(),
    ]
  );

  return result.rows[0] || null;
};

const bootstrapDefaultAccounts = async ({ companyId, userId = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);

  return withTransaction(async (db) => {
    const existing = await db.query(
      `SELECT COUNT(*)::int AS total FROM account_groups WHERE company_id = $1`,
      [normalizedCompanyId]
    );

    if (Number(existing.rows[0]?.total || 0) > 0) {
      return {
        created: false,
        message: "Finance masters already initialized",
      };
    }

    const groupSeed = [
      ["ASSET", "Assets", "asset", 10],
      ["LIAB", "Liabilities", "liability", 20],
      ["EQUITY", "Equity", "equity", 30],
      ["INCOME", "Income", "income", 40],
      ["EXPENSE", "Expenses", "expense", 50],
    ];

    const groupIds = {};
    for (const [code, name, nature, order] of groupSeed) {
      const row = await db.query(
        `
        INSERT INTO account_groups (
          company_id, group_code, group_name, nature, display_order, is_system, is_active
        )
        VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
        RETURNING id
        `,
        [normalizedCompanyId, code, name, nature, order]
      );
      groupIds[code] = row.rows[0]?.id;
    }

    const accountSeed = [
      ["CASH_MAIN", "Cash In Hand", "cash", "debit", groupIds.ASSET],
      ["BANK_MAIN", "Bank Account", "bank", "debit", groupIds.ASSET],
      ["AR_CONTROL", "Accounts Receivable Control", "customer", "debit", groupIds.ASSET],
      ["AP_CONTROL", "Accounts Payable Control", "supplier", "credit", groupIds.LIAB],
      ["REV_DISPATCH", "Dispatch Revenue", "ledger", "credit", groupIds.INCOME],
      ["EXP_PURCHASE", "Purchase Expense", "ledger", "debit", groupIds.EXPENSE],
    ];

    const accountIds = {};
    for (const [code, name, type, normalBalance, groupId] of accountSeed) {
      const accountRow = await db.query(
        `
        INSERT INTO chart_of_accounts (
          company_id,
          account_group_id,
          account_code,
          account_name,
          account_type,
          normal_balance,
          allow_direct_posting,
          is_party_control,
          is_bank_control,
          is_system,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,TRUE,TRUE)
        RETURNING id
        `,
        [
          normalizedCompanyId,
          groupId,
          code,
          name,
          type,
          normalBalance,
          code === "AR_CONTROL" || code === "AP_CONTROL",
          code === "BANK_MAIN",
        ]
      );

      accountIds[code] = accountRow.rows[0]?.id;
    }

    const ledgerSeed = [
      ["LDG-CASH", "Cash In Hand", accountIds.CASH_MAIN],
      ["LDG-BANK", "Primary Bank", accountIds.BANK_MAIN],
      ["LDG-ARCTRL", "Accounts Receivable Control", accountIds.AR_CONTROL],
      ["LDG-APCTRL", "Accounts Payable Control", accountIds.AP_CONTROL],
      ["LDG-REVDIS", "Dispatch Revenue", accountIds.REV_DISPATCH],
      ["LDG-EXPPUR", "Purchase Expense", accountIds.EXP_PURCHASE],
    ];

    for (const [code, name, accountId] of ledgerSeed) {
      await db.query(
        `
        INSERT INTO ledgers (
          company_id,
          account_id,
          ledger_code,
          ledger_name,
          is_system_generated,
          is_active
        )
        VALUES ($1,$2,$3,$4,TRUE,TRUE)
        `,
        [normalizedCompanyId, accountId, code, name]
      );
    }

    const defaultRules = [
      ["DISPATCH_TO_RECEIVABLE", "dispatch_to_receivable", "dispatch", "sales_invoice", "AR_CONTROL", "REV_DISPATCH", true, false, false],
      ["BILL_TO_PAYABLE", "bill_to_payable", "accounts_payable", "purchase_bill", "EXP_PURCHASE", "AP_CONTROL", false, true, false],
      ["RECEIPT_SETTLEMENT", "receipt_settlement", "accounts_receivable", "receipt", "CASH_MAIN", "AR_CONTROL", true, false, false],
      ["PAYMENT_SETTLEMENT", "payment_settlement", "accounts_payable", "payment", "AP_CONTROL", "BANK_MAIN", false, true, false],
    ];

    for (const [ruleCode, eventName, sourceModule, voucherType, debitCode, creditCode, partyRequired, vendorRequired, requiresApproval] of defaultRules) {
      await db.query(
        `
        INSERT INTO finance_posting_rules (
          company_id,
          rule_code,
          event_name,
          source_module,
          voucher_type,
          debit_account_id,
          credit_account_id,
          party_required,
          vendor_required,
          requires_approval,
          auto_post_enabled,
          is_active,
          rule_priority
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,TRUE,100)
        `,
        [
          normalizedCompanyId,
          ruleCode,
          eventName,
          sourceModule,
          voucherType,
          accountIds[debitCode],
          accountIds[creditCode],
          partyRequired,
          vendorRequired,
          requiresApproval,
        ]
      );
    }

    return {
      created: true,
      initializedByUserId: userId || null,
    };
  });
};

const syncPartyAndVendorLedgers = async ({ companyId }) => {
  const normalizedCompanyId = requireCompanyId(companyId);

  return withTransaction(async (db) => {
    const controlAccountsRes = await db.query(
      `
      SELECT account_code AS "accountCode", id
      FROM chart_of_accounts
      WHERE company_id = $1
        AND account_code IN ('AR_CONTROL', 'AP_CONTROL')
      `,
      [normalizedCompanyId]
    );

    const arAccountId = controlAccountsRes.rows.find((row) => row.accountCode === "AR_CONTROL")?.id || null;
    const apAccountId = controlAccountsRes.rows.find((row) => row.accountCode === "AP_CONTROL")?.id || null;

    if (!arAccountId || !apAccountId) {
      const error = new Error("Run finance master bootstrap first (missing control accounts)");
      error.statusCode = 400;
      throw error;
    }

    const parties = await db.query(
      `
      SELECT id, party_name AS "partyName", party_type AS "partyType"
      FROM party_master
      WHERE company_id = $1
      `,
      [normalizedCompanyId]
    );

    let createdLedgers = 0;

    for (const party of parties.rows) {
      const type = String(party.partyType || "").toLowerCase();
      const isCustomer = type.includes("customer") || type === "both";
      const isSupplier = type.includes("supplier") || type === "both";

      if (isCustomer) {
        const customerCode = `CUS-${party.id}`;
        const inserted = await db.query(
          `
          INSERT INTO ledgers (
            company_id,
            account_id,
            ledger_code,
            ledger_name,
            party_id,
            is_system_generated,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
          ON CONFLICT (company_id, ledger_code) DO NOTHING
          `,
          [normalizedCompanyId, arAccountId, customerCode, `${party.partyName} - Receivable`, party.id]
        );
        createdLedgers += inserted.rowCount || 0;
      }

      if (isSupplier) {
        const supplierCode = `SUP-${party.id}`;
        const inserted = await db.query(
          `
          INSERT INTO ledgers (
            company_id,
            account_id,
            ledger_code,
            ledger_name,
            party_id,
            is_system_generated,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
          ON CONFLICT (company_id, ledger_code) DO NOTHING
          `,
          [normalizedCompanyId, apAccountId, supplierCode, `${party.partyName} - Payable`, party.id]
        );
        createdLedgers += inserted.rowCount || 0;
      }
    }

    const vendors = await db.query(
      `
      SELECT id, vendor_name AS "vendorName"
      FROM vendor_master
      WHERE company_id = $1
      `,
      [normalizedCompanyId]
    );

    for (const vendor of vendors.rows) {
      const code = `VND-${vendor.id}`;
      const inserted = await db.query(
        `
        INSERT INTO ledgers (
          company_id,
          account_id,
          ledger_code,
          ledger_name,
          vendor_id,
          is_system_generated,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
        ON CONFLICT (company_id, ledger_code) DO NOTHING
        `,
        [normalizedCompanyId, apAccountId, code, `${vendor.vendorName} - Payable`, vendor.id]
      );
      createdLedgers += inserted.rowCount || 0;
    }

    return {
      createdLedgers,
    };
  });
};

module.exports = {
  listAccountGroups,
  createAccountGroup,
  listChartOfAccounts,
  createChartOfAccount,
  listLedgers,
  createLedger,
  listFinancialYears,
  createFinancialYear,
  createAccountingPeriod,
  bootstrapDefaultAccounts,
  syncPartyAndVendorLedgers,
};
