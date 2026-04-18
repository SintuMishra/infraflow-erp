const { pool } = require("../../config/db");

const requireCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const buildDateWhere = (prefix, values, dateFrom, dateTo, field = "v.voucher_date") => {
  const conditions = [];
  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`${field} >= $${values.length}::date`);
  }
  if (dateTo) {
    values.push(dateTo);
    conditions.push(`${field} <= $${values.length}::date`);
  }
  return conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
};

const appendRunningBalance = (rows = []) => {
  let running = 0;
  return rows.map((row) => {
    running += Number(row.debit || 0) - Number(row.credit || 0);
    return {
      ...row,
      runningBalance: running,
    };
  });
};

const getTrialBalanceReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere("tb", values, dateFrom, dateTo);

  const result = await pool.query(
    `
    SELECT
      a.id AS "accountId",
      a.account_code AS "accountCode",
      a.account_name AS "accountName",
      ag.group_name AS "groupName",
      COALESCE(SUM(vl.debit), 0)::numeric AS "debit",
      COALESCE(SUM(vl.credit), 0)::numeric AS "credit",
      COALESCE(SUM(vl.debit - vl.credit), 0)::numeric AS "netBalance"
    FROM chart_of_accounts a
    INNER JOIN account_groups ag ON ag.id = a.account_group_id
    LEFT JOIN voucher_lines vl ON vl.account_id = a.id AND vl.company_id = a.company_id
    LEFT JOIN vouchers v ON v.id = vl.voucher_id
      AND v.company_id = a.company_id
      AND v.status IN ('posted', 'reversed')
      ${dateClause}
    WHERE a.company_id = $1
      AND a.is_active = TRUE
    GROUP BY a.id, a.account_code, a.account_name, ag.group_name
    ORDER BY a.account_code ASC
    `,
    values
  );

  const totals = result.rows.reduce(
    (acc, row) => {
      acc.totalDebit += Number(row.debit || 0);
      acc.totalCredit += Number(row.credit || 0);
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 }
  );

  return {
    rows: result.rows,
    totals,
  };
};

const getLedgerReport = async ({ companyId, ledgerId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedLedgerId = Number(ledgerId || 0) || null;
  if (!normalizedLedgerId) {
    const error = new Error("Valid ledgerId is required");
    error.statusCode = 400;
    throw error;
  }

  const values = [normalizedCompanyId, normalizedLedgerId];
  const dateClause = buildDateWhere("l", values, dateFrom, dateTo);

  const result = await pool.query(
    `
    SELECT
      v.id AS "voucherId",
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      v.status AS "voucherStatus",
      vl.line_number AS "lineNumber",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration",
      a.account_code AS "accountCode",
      a.account_name AS "accountName"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    INNER JOIN chart_of_accounts a ON a.id = vl.account_id
    WHERE vl.company_id = $1
      AND vl.ledger_id = $2
      AND v.status IN ('posted', 'reversed')
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return appendRunningBalance(result.rows);
};

const getPartyLedgerReport = async ({ companyId, partyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedPartyId = Number(partyId || 0) || null;
  if (!normalizedPartyId) {
    const error = new Error("Valid partyId is required");
    error.statusCode = 400;
    throw error;
  }

  const values = [normalizedCompanyId, normalizedPartyId];
  const dateClause = buildDateWhere("pl", values, dateFrom, dateTo);

  const result = await pool.query(
    `
    SELECT
      v.id AS "voucherId",
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      l.ledger_name AS "ledgerName",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    INNER JOIN ledgers l ON l.id = vl.ledger_id
    WHERE vl.company_id = $1
      AND vl.party_id = $2
      AND v.status IN ('posted', 'reversed')
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return appendRunningBalance(result.rows);
};

const getReceivableAgeingReport = async ({ companyId }) => {
  const normalizedCompanyId = requireCompanyId(companyId);

  const result = await pool.query(
    `
    SELECT
      r.id,
      r.party_id AS "partyId",
      p.party_name AS "partyName",
      r.invoice_number AS "invoiceNumber",
      r.invoice_date AS "invoiceDate",
      r.due_date AS "dueDate",
      r.amount,
      r.outstanding_amount AS "outstandingAmount",
      r.status,
      GREATEST((CURRENT_DATE - r.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN CURRENT_DATE <= r.due_date THEN 'current'
        WHEN CURRENT_DATE - r.due_date <= 30 THEN '1-30'
        WHEN CURRENT_DATE - r.due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - r.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket"
    FROM receivables r
    LEFT JOIN party_master p ON p.id = r.party_id
    WHERE r.company_id = $1
      AND r.outstanding_amount > 0
    ORDER BY r.due_date ASC, r.id ASC
    `,
    [normalizedCompanyId]
  );

  return appendRunningBalance(result.rows);
};

const getPayableAgeingReport = async ({ companyId }) => {
  const normalizedCompanyId = requireCompanyId(companyId);

  const result = await pool.query(
    `
    SELECT
      p.id,
      p.party_id AS "partyId",
      pr.party_name AS "partyName",
      p.vendor_id AS "vendorId",
      vd.vendor_name AS "vendorName",
      p.reference_number AS "referenceNumber",
      p.bill_date AS "billDate",
      p.due_date AS "dueDate",
      p.amount,
      p.outstanding_amount AS "outstandingAmount",
      p.status,
      GREATEST((CURRENT_DATE - p.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN CURRENT_DATE <= p.due_date THEN 'current'
        WHEN CURRENT_DATE - p.due_date <= 30 THEN '1-30'
        WHEN CURRENT_DATE - p.due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - p.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket"
    FROM payables p
    LEFT JOIN party_master pr ON pr.id = p.party_id
    LEFT JOIN vendor_master vd ON vd.id = p.vendor_id
    WHERE p.company_id = $1
      AND p.outstanding_amount > 0
    ORDER BY p.due_date ASC, p.id ASC
    `,
    [normalizedCompanyId]
  );

  return appendRunningBalance(result.rows);
};

const getVoucherRegisterReport = async ({
  companyId,
  voucherType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const filters = ["v.company_id = $1"];

  if (voucherType) {
    values.push(String(voucherType).trim().toLowerCase());
    filters.push(`v.voucher_type = $${values.length}`);
  }

  if (status) {
    values.push(String(status).trim().toLowerCase());
    filters.push(`v.status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    filters.push(`v.voucher_date >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    filters.push(`v.voucher_date <= $${values.length}::date`);
  }

  const result = await pool.query(
    `
    SELECT
      v.id,
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      v.status,
      v.approval_status AS "approvalStatus",
      v.narration,
      v.source_module AS "sourceModule",
      v.source_record_id AS "sourceRecordId",
      v.total_debit AS "totalDebit",
      v.total_credit AS "totalCredit",
      COUNT(vl.id)::int AS "lineCount",
      v.created_at AS "createdAt",
      v.posted_at AS "postedAt"
    FROM vouchers v
    LEFT JOIN voucher_lines vl ON vl.voucher_id = v.id
    WHERE ${filters.join(" AND ")}
    GROUP BY v.id
    ORDER BY v.voucher_date DESC, v.id DESC
    `
    ,
    values
  );

  return result.rows;
};

const getCashBookReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere("cb", values, dateFrom, dateTo);

  const result = await pool.query(
    `
    SELECT
      v.id AS "voucherId",
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      l.ledger_name AS "ledgerName",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    INNER JOIN chart_of_accounts a ON a.id = vl.account_id
    INNER JOIN ledgers l ON l.id = vl.ledger_id
    WHERE vl.company_id = $1
      AND a.account_type = 'cash'
      AND v.status IN ('posted', 'reversed')
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return result.rows;
};

const getBankBookReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere("bb", values, dateFrom, dateTo);

  const result = await pool.query(
    `
    SELECT
      v.id AS "voucherId",
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      l.ledger_name AS "ledgerName",
      b.account_name AS "bankAccountName",
      b.bank_name AS "bankName",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    INNER JOIN chart_of_accounts a ON a.id = vl.account_id
    INNER JOIN ledgers l ON l.id = vl.ledger_id
    LEFT JOIN bank_accounts b ON b.ledger_id = l.id AND b.company_id = vl.company_id
    WHERE vl.company_id = $1
      AND a.account_type = 'bank'
      AND v.status IN ('posted', 'reversed')
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return result.rows;
};

module.exports = {
  getTrialBalanceReport,
  getLedgerReport,
  getPartyLedgerReport,
  getReceivableAgeingReport,
  getPayableAgeingReport,
  getCashBookReport,
  getBankBookReport,
  getVoucherRegisterReport,
};
