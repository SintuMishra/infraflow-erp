const { pool } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const VOUCHER_TYPES = new Set([
  "journal",
  "payment",
  "receipt",
  "contra",
  "sales_invoice",
  "purchase_bill",
  "reversal",
]);

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeVoucherType = (value) => String(value || "").trim().toLowerCase();

const assertVoucherType = (voucherType) => {
  if (!VOUCHER_TYPES.has(voucherType)) {
    const error = new Error("Invalid voucherType");
    error.statusCode = 400;
    throw error;
  }
};

const ensureVoucherBalanced = (lines = []) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    const error = new Error("At least two voucher lines are required");
    error.statusCode = 400;
    throw error;
  }

  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((line, index) => {
    const debit = roundMoney(line?.debit || 0);
    const credit = roundMoney(line?.credit || 0);

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      const error = new Error(`Voucher line ${index + 1} must have either debit or credit`);
      error.statusCode = 400;
      throw error;
    }

    if (!line?.ledgerId || !line?.accountId) {
      const error = new Error(`Voucher line ${index + 1} requires accountId and ledgerId`);
      error.statusCode = 400;
      throw error;
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    const error = new Error("Voucher is unbalanced: total debit must equal total credit");
    error.statusCode = 400;
    throw error;
  }

  return {
    totalDebit,
    totalCredit,
  };
};

const getNextVoucherNumber = async ({ companyId, voucherType, voucherDate, db = pool }) => {
  const safeType = String(voucherType || "JV").slice(0, 3).toUpperCase();
  const datePart = String(voucherDate || "").replace(/-/g, "");
  const prefix = `${safeType}-${datePart}-`;

  const result = await db.query(
    `
    SELECT voucher_number AS "voucherNumber"
    FROM vouchers
    WHERE company_id = $1
      AND voucher_number LIKE $2
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, `${prefix}%`]
  );

  const lastVoucherNumber = String(result.rows[0]?.voucherNumber || "").trim();
  const match = lastVoucherNumber.match(/-(\d{4})$/);
  const nextSeq = match ? Number(match[1]) + 1 : 1;

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

const getLedgerById = async ({ ledgerId, companyId, db = pool }) => {
  const result = await db.query(
    `
    SELECT
      l.*,
      a.account_type AS "accountType",
      a.allow_direct_posting AS "allowDirectPosting",
      a.is_active AS "accountIsActive"
    FROM ledgers l
    INNER JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE l.id = $1 AND l.company_id = $2
    LIMIT 1
    `,
    [ledgerId, companyId]
  );

  return result.rows[0] || null;
};

const resolveOpenAccountingPeriod = async ({
  companyId,
  voucherDate,
  accountingPeriodId = null,
  db = pool,
}) => {
  if (!(await tableExists("accounting_periods", db))) {
    return null;
  }

  if (accountingPeriodId) {
    const periodResult = await db.query(
      `
      SELECT
        id,
        period_start AS "periodStart",
        period_end AS "periodEnd",
        status
      FROM accounting_periods
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      `,
      [accountingPeriodId, companyId]
    );
    const period = periodResult.rows[0] || null;
    if (!period) {
      const error = new Error("Selected accounting period not found in company scope");
      error.statusCode = 400;
      throw error;
    }

    if (period.status !== "open") {
      const error = new Error("Selected accounting period is not open");
      error.statusCode = 409;
      throw error;
    }

    if (voucherDate < String(period.periodStart) || voucherDate > String(period.periodEnd)) {
      const error = new Error("voucherDate does not fall in selected accounting period");
      error.statusCode = 400;
      throw error;
    }

    return period;
  }

  const periodResult = await db.query(
    `
    SELECT
      id,
      period_start AS "periodStart",
      period_end AS "periodEnd",
      status
    FROM accounting_periods
    WHERE company_id = $1
      AND period_start <= $2::date
      AND period_end >= $2::date
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, voucherDate]
  );
  const period = periodResult.rows[0] || null;

  if (!period) {
    const error = new Error("No accounting period found for voucherDate");
    error.statusCode = 409;
    throw error;
  }

  if (period.status !== "open") {
    const error = new Error("Accounting period is not open for voucher posting");
    error.statusCode = 409;
    throw error;
  }

  return period;
};

const assertSourcePostingAllowed = async ({
  companyId,
  sourceModule = null,
  sourceRecordId = null,
  sourceEvent = null,
  db = pool,
}) => {
  if (!sourceModule || !sourceRecordId || !sourceEvent) {
    return;
  }

  if (!(await tableExists("finance_source_links", db))) {
    return;
  }

  const existingLinkResult = await db.query(
    `
    SELECT id, posting_status AS "postingStatus", voucher_id AS "voucherId"
    FROM finance_source_links
    WHERE company_id = $1
      AND source_module = $2
      AND source_record_id = $3
      AND source_event = $4
    LIMIT 1
    `,
    [companyId, sourceModule, sourceRecordId, sourceEvent]
  );

  const existing = existingLinkResult.rows[0] || null;
  if (!existing) {
    return;
  }

  if (
    ["posted", "pending", "reversed"].includes(String(existing.postingStatus || "").toLowerCase()) &&
    existing.voucherId
  ) {
    const error = new Error(
      `Financial source already linked to voucher (status: ${existing.postingStatus}). Duplicate posting blocked.`
    );
    error.statusCode = 409;
    throw error;
  }
};

const getVoucherById = async ({ voucherId, companyId, db = pool }) => {
  const voucherResult = await db.query(
    `
    SELECT
      id,
      company_id AS "companyId",
      voucher_number AS "voucherNumber",
      voucher_type AS "voucherType",
      voucher_date AS "voucherDate",
      accounting_period_id AS "accountingPeriodId",
      status,
      approval_status AS "approvalStatus",
      narration,
      total_debit AS "totalDebit",
      total_credit AS "totalCredit",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      posted_by_user_id AS "postedByUserId",
      posted_at AS "postedAt",
      reversal_of_voucher_id AS "reversalOfVoucherId",
      reversed_from_voucher_id AS "reversedFromVoucherId",
      created_by_user_id AS "createdByUserId",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vouchers
    WHERE id = $1 AND company_id = $2
    LIMIT 1
    `,
    [voucherId, companyId]
  );

  const voucher = voucherResult.rows[0] || null;
  if (!voucher) {
    return null;
  }

  const linesResult = await db.query(
    `
    SELECT
      vl.id,
      vl.line_number AS "lineNumber",
      vl.account_id AS "accountId",
      a.account_name AS "accountName",
      vl.ledger_id AS "ledgerId",
      l.ledger_name AS "ledgerName",
      vl.party_id AS "partyId",
      p.party_name AS "partyName",
      vl.vendor_id AS "vendorId",
      v.vendor_name AS "vendorName",
      vl.plant_id AS "plantId",
      pm.plant_name AS "plantName",
      vl.project_id AS "projectId",
      pr.project_name AS "projectName",
      vl.vehicle_id AS "vehicleId",
      vh.vehicle_number AS "vehicleNumber",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration"
    FROM voucher_lines vl
    INNER JOIN chart_of_accounts a ON a.id = vl.account_id
    INNER JOIN ledgers l ON l.id = vl.ledger_id
    LEFT JOIN party_master p ON p.id = vl.party_id
    LEFT JOIN vendor_master v ON v.id = vl.vendor_id
    LEFT JOIN plant_master pm ON pm.id = vl.plant_id
    LEFT JOIN (
      SELECT DISTINCT id, project_name
      FROM project_daily_reports
    ) pr ON pr.id = vl.project_id
    LEFT JOIN vehicles vh ON vh.id = vl.vehicle_id
    WHERE vl.voucher_id = $1
    ORDER BY vl.line_number ASC, vl.id ASC
    `,
    [voucherId]
  );

  return {
    ...voucher,
    lines: linesResult.rows,
  };
};

const createVoucher = async ({
  companyId,
  voucherType,
  voucherDate,
  accountingPeriodId = null,
  approvalStatus = "approved",
  narration = "",
  sourceModule = null,
  sourceRecordId = null,
  sourceEvent = null,
  lines = [],
  createdByUserId = null,
  db = pool,
}) => {
  const normalizedType = normalizeVoucherType(voucherType);
  assertVoucherType(normalizedType);
  const normalizedDate = String(voucherDate || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const error = new Error("voucherDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  const safeApprovalStatus = String(approvalStatus || "approved").trim().toLowerCase();
  if (!["pending", "approved", "rejected"].includes(safeApprovalStatus)) {
    const error = new Error("approvalStatus must be pending, approved, or rejected");
    error.statusCode = 400;
    throw error;
  }

  const { totalDebit, totalCredit } = ensureVoucherBalanced(lines);
  await resolveOpenAccountingPeriod({
    companyId,
    voucherDate: normalizedDate,
    accountingPeriodId,
    db,
  });
  await assertSourcePostingAllowed({
    companyId,
    sourceModule,
    sourceRecordId,
    sourceEvent,
    db,
  });

  for (const [index, line] of lines.entries()) {
    const ledger = await getLedgerById({
      ledgerId: Number(line.ledgerId),
      companyId,
      db,
    });

    if (!ledger) {
      const error = new Error(`Ledger not found for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (!ledger.is_active || !ledger.accountIsActive) {
      const error = new Error(`Ledger is inactive for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (Number(ledger.account_id) !== Number(line.accountId)) {
      const error = new Error(`Account and ledger mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (line.partyId && ledger.party_id && Number(line.partyId) !== Number(ledger.party_id)) {
      const error = new Error(`Party and ledger mapping mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (line.vendorId && ledger.vendor_id && Number(line.vendorId) !== Number(ledger.vendor_id)) {
      const error = new Error(`Vendor and ledger mapping mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const voucherNumber = await getNextVoucherNumber({
    companyId,
    voucherType: normalizedType,
    voucherDate: normalizedDate,
    db,
  });

  const voucherInsert = await db.query(
    `
    INSERT INTO vouchers (
      company_id,
      voucher_number,
      voucher_type,
      voucher_date,
      accounting_period_id,
      status,
      approval_status,
      narration,
      total_debit,
      total_credit,
      source_module,
      source_record_id,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (
      $1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13
    )
    RETURNING id
    `,
    [
      companyId,
      voucherNumber,
      normalizedType,
      normalizedDate,
      accountingPeriodId || null,
      safeApprovalStatus,
      String(narration || "").trim() || null,
      totalDebit,
      totalCredit,
      sourceModule ? String(sourceModule).trim() : null,
      sourceRecordId || null,
      createdByUserId || null,
      createdByUserId || null,
    ]
  );

  const voucherId = voucherInsert.rows[0]?.id;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    await db.query(
      `
      INSERT INTO voucher_lines (
        voucher_id,
        company_id,
        line_number,
        account_id,
        ledger_id,
        party_id,
        vendor_id,
        plant_id,
        project_id,
        vehicle_id,
        line_narration,
        debit,
        credit,
        source_module,
        source_record_id
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      `,
      [
        voucherId,
        companyId,
        index + 1,
        Number(line.accountId),
        Number(line.ledgerId),
        line.partyId || null,
        line.vendorId || null,
        line.plantId || null,
        line.projectId || null,
        line.vehicleId || null,
        String(line.lineNarration || "").trim() || null,
        roundMoney(line.debit || 0),
        roundMoney(line.credit || 0),
        sourceModule ? String(sourceModule).trim() : null,
        sourceRecordId || null,
      ]
    );
  }

  return getVoucherById({ voucherId, companyId, db });
};

const postVoucher = async ({ voucherId, companyId, postedByUserId = null, db = pool }) => {
  const voucher = await getVoucherById({ voucherId, companyId, db });
  if (!voucher) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  if (voucher.status === "posted") {
    return voucher;
  }

  if (voucher.status !== "draft") {
    const error = new Error("Only draft vouchers can be posted");
    error.statusCode = 400;
    throw error;
  }

  if (voucher.approvalStatus !== "approved") {
    const error = new Error("Voucher approval is pending/rejected; posting blocked");
    error.statusCode = 400;
    throw error;
  }

  ensureVoucherBalanced(voucher.lines);

  await db.query(
    `
    UPDATE vouchers
    SET
      status = 'posted',
      posted_by_user_id = $1,
      posted_at = CURRENT_TIMESTAMP,
      updated_by_user_id = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND company_id = $3
    `,
    [postedByUserId || null, voucherId, companyId]
  );

  return getVoucherById({ voucherId, companyId, db });
};

const reverseVoucher = async ({
  voucherId,
  companyId,
  voucherDate,
  narration = "",
  userId = null,
  db = pool,
}) => {
  const originalVoucher = await getVoucherById({ voucherId, companyId, db });
  if (!originalVoucher) {
    const error = new Error("Voucher not found for reversal");
    error.statusCode = 404;
    throw error;
  }

  if (originalVoucher.status !== "posted") {
    const error = new Error("Only posted vouchers can be reversed");
    error.statusCode = 400;
    throw error;
  }

  const existingReversalResult = await db.query(
    `
    SELECT id
    FROM vouchers
    WHERE reversal_of_voucher_id = $1
      AND company_id = $2
    LIMIT 1
    `,
    [voucherId, companyId]
  );

  if (existingReversalResult.rows[0]?.id) {
    const error = new Error("Voucher is already reversed");
    error.statusCode = 409;
    throw error;
  }

  const reversalLines = originalVoucher.lines.map((line) => ({
    accountId: line.accountId,
    ledgerId: line.ledgerId,
    partyId: line.partyId || null,
    vendorId: line.vendorId || null,
    plantId: line.plantId || null,
    projectId: line.projectId || null,
    vehicleId: line.vehicleId || null,
    debit: Number(line.credit || 0),
    credit: Number(line.debit || 0),
    lineNarration: `Reversal of ${originalVoucher.voucherNumber}`,
  }));

  const reversalVoucher = await createVoucher({
    companyId,
    voucherType: "reversal",
    voucherDate,
    approvalStatus: "approved",
    narration: String(narration || "").trim() || `Reversal of voucher ${originalVoucher.voucherNumber}`,
    sourceModule: originalVoucher.sourceModule || "general_ledger",
    sourceRecordId: originalVoucher.id,
    lines: reversalLines,
    createdByUserId: userId,
    db,
  });

  await postVoucher({
    voucherId: reversalVoucher.id,
    companyId,
    postedByUserId: userId,
    db,
  });

  await db.query(
    `
    UPDATE vouchers
    SET
      status = 'reversed',
      reversed_from_voucher_id = $1,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [reversalVoucher.id, userId || null, voucherId, companyId]
  );

  await db.query(
    `
    UPDATE vouchers
    SET
      reversal_of_voucher_id = $1,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [voucherId, userId || null, reversalVoucher.id, companyId]
  );

  return {
    originalVoucher: await getVoucherById({ voucherId, companyId, db }),
    reversalVoucher: await getVoucherById({
      voucherId: reversalVoucher.id,
      companyId,
      db,
    }),
  };
};

const listVouchers = async ({
  companyId,
  voucherType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
  search = "",
  limit = 50,
  page = 1,
  db = pool,
}) => {
  const values = [companyId];
  const filters = ["company_id = $1"];

  if (voucherType) {
    values.push(normalizeVoucherType(voucherType));
    filters.push(`voucher_type = $${values.length}`);
  }

  if (status) {
    values.push(String(status).trim().toLowerCase());
    filters.push(`status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    filters.push(`voucher_date >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    filters.push(`voucher_date <= $${values.length}::date`);
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const token = `$${values.length}`;
    filters.push(`(
      LOWER(COALESCE(voucher_number, '')) LIKE ${token}
      OR LOWER(COALESCE(narration, '')) LIKE ${token}
      OR LOWER(COALESCE(source_module, '')) LIKE ${token}
    )`);
  }

  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  values.push(normalizedLimit);
  values.push(offset);

  const whereClause = `WHERE ${filters.join(" AND ")}`;

  const result = await db.query(
    `
    SELECT
      id,
      voucher_number AS "voucherNumber",
      voucher_type AS "voucherType",
      voucher_date AS "voucherDate",
      status,
      approval_status AS "approvalStatus",
      narration,
      total_debit AS "totalDebit",
      total_credit AS "totalCredit",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      created_at AS "createdAt",
      posted_at AS "postedAt"
    FROM vouchers
    ${whereClause}
    ORDER BY voucher_date DESC, id DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
    `,
    values
  );

  const countValues = values.slice(0, values.length - 2);
  const countResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM vouchers
    ${whereClause}
    `,
    countValues
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const upsertFinanceSourceLink = async ({
  companyId,
  sourceModule,
  sourceRecordId,
  sourceEvent,
  postingRuleCode = null,
  voucherId = null,
  postingStatus = "pending",
  metadata = null,
  db = pool,
}) => {
  const result = await db.query(
    `
    INSERT INTO finance_source_links (
      company_id,
      source_module,
      source_record_id,
      source_event,
      posting_rule_code,
      voucher_id,
      posting_status,
      metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (company_id, source_module, source_record_id, source_event)
    DO UPDATE
    SET
      posting_rule_code = EXCLUDED.posting_rule_code,
      voucher_id = EXCLUDED.voucher_id,
      posting_status = EXCLUDED.posting_status,
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id,
      company_id AS "companyId",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      source_event AS "sourceEvent",
      posting_rule_code AS "postingRuleCode",
      voucher_id AS "voucherId",
      posting_status AS "postingStatus",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      companyId,
      sourceModule,
      sourceRecordId,
      sourceEvent,
      postingRuleCode,
      voucherId,
      postingStatus,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0] || null;
};

const findPostingRule = async ({ companyId, sourceModule, eventName, db = pool }) => {
  const result = await db.query(
    `
    SELECT
      id,
      rule_code AS "ruleCode",
      event_name AS "eventName",
      source_module AS "sourceModule",
      voucher_type AS "voucherType",
      debit_account_id AS "debitAccountId",
      credit_account_id AS "creditAccountId",
      party_required AS "partyRequired",
      vendor_required AS "vendorRequired",
      requires_approval AS "requiresApproval",
      auto_post_enabled AS "autoPostEnabled",
      is_active AS "isActive",
      rule_priority AS "rulePriority"
    FROM finance_posting_rules
    WHERE company_id = $1
      AND source_module = $2
      AND event_name = $3
      AND is_active = TRUE
    ORDER BY rule_priority ASC, id ASC
    LIMIT 1
    `,
    [companyId, sourceModule, eventName]
  );

  return result.rows[0] || null;
};

module.exports = {
  VOUCHER_TYPES,
  ensureVoucherBalanced,
  getNextVoucherNumber,
  getVoucherById,
  createVoucher,
  postVoucher,
  reverseVoucher,
  listVouchers,
  upsertFinanceSourceLink,
  findPostingRule,
};
