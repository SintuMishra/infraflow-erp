const { pool } = require("../../config/db");
const { resolveReportDateRange } = require("../../utils/reportDateRange.util");
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requireCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const normalizeDate = (value, label) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (!ISO_DATE_PATTERN.test(text)) {
    const error = new Error(`${label} must use YYYY-MM-DD format`);
    error.statusCode = 400;
    throw error;
  }
  return text;
};

const normalizeDateRange = ({ dateFrom = "", dateTo = "" }) => {
  const resolvedRange = resolveReportDateRange({ dateFrom, dateTo, defaultDays: 30 });
  const normalizedDateFrom = normalizeDate(resolvedRange.dateFrom, "dateFrom");
  const normalizedDateTo = normalizeDate(resolvedRange.dateTo, "dateTo");

  if (normalizedDateFrom && normalizedDateTo && normalizedDateTo < normalizedDateFrom) {
    const error = new Error("dateTo cannot be earlier than dateFrom");
    error.statusCode = 400;
    throw error;
  }

  return {
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
  };
};

const buildDateWhere = (values, dateFrom, dateTo, field = "v.voucher_date") => {
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

const appendRunningBalance = (rows = [], openingBalance = 0) => {
  let running = Number(openingBalance || 0);
  return rows.map((row) => {
    running += Number(row.debit || 0) - Number(row.credit || 0);
    return {
      ...row,
      runningBalance: running,
    };
  });
};

const buildAgeingBucketTotals = (rows = []) =>
  rows.reduce(
    (acc, row) => {
      const bucket = String(row.ageingBucket || "current");
      const amount = Number(row.outstandingAmount || 0);
      acc[bucket] = Number(acc[bucket] || 0) + amount;
      acc.totalOutstanding += amount;
      return acc;
    },
    {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      totalOutstanding: 0,
    }
  );

const getTrialBalanceReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere(values, range.dateFrom, range.dateTo);

  const result = await pool.query(
    `
    SELECT
      a.id AS "accountId",
      a.account_code AS "accountCode",
      a.account_name AS "accountName",
      ag.group_name AS "groupName",
      COALESCE(SUM(CASE WHEN v.id IS NULL THEN 0 ELSE vl.debit END), 0)::numeric AS "debit",
      COALESCE(SUM(CASE WHEN v.id IS NULL THEN 0 ELSE vl.credit END), 0)::numeric AS "credit",
      COALESCE(
        SUM(CASE WHEN v.id IS NULL THEN 0 ELSE vl.debit - vl.credit END),
        0
      )::numeric AS "netBalance"
    FROM chart_of_accounts a
    INNER JOIN account_groups ag ON ag.id = a.account_group_id
    LEFT JOIN voucher_lines vl ON vl.account_id = a.id AND vl.company_id = a.company_id
    LEFT JOIN vouchers v ON v.id = vl.voucher_id
      AND v.company_id = a.company_id
      AND v.status = 'posted'
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
    rows: result.rows.map((row) => {
      const netBalance = Number(row.netBalance || 0);
      return {
        ...row,
        closingDebit: netBalance >= 0 ? netBalance : 0,
        closingCredit: netBalance < 0 ? Math.abs(netBalance) : 0,
      };
    }),
    totals,
  };
};

const getLedgerReport = async ({ companyId, ledgerId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
  const normalizedLedgerId = Number(ledgerId || 0) || null;
  if (!normalizedLedgerId) {
    const error = new Error("Valid ledgerId is required");
    error.statusCode = 400;
    throw error;
  }

  const values = [normalizedCompanyId, normalizedLedgerId];
  const dateClause = buildDateWhere(values, range.dateFrom, range.dateTo);

  const ledgerMetaResult = await pool.query(
    `
    SELECT
      opening_debit AS "openingDebit",
      opening_credit AS "openingCredit"
    FROM ledgers
    WHERE id = $1
      AND company_id = $2
    LIMIT 1
    `,
    [normalizedLedgerId, normalizedCompanyId]
  );
  const ledgerMeta = ledgerMetaResult.rows[0] || null;
  if (!ledgerMeta) {
    const error = new Error("Ledger not found in company scope");
    error.statusCode = 404;
    throw error;
  }

  let openingBalance = Number(ledgerMeta.openingDebit || 0) - Number(ledgerMeta.openingCredit || 0);
  if (range.dateFrom) {
    const openingTxnResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(vl.debit - vl.credit), 0)::numeric AS "openingMovement"
      FROM voucher_lines vl
      INNER JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = $1
        AND vl.ledger_id = $2
        AND v.status = 'posted'
        AND v.voucher_date < $3::date
      `,
      [normalizedCompanyId, normalizedLedgerId, range.dateFrom]
    );
    openingBalance += Number(openingTxnResult.rows[0]?.openingMovement || 0);
  }

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
      AND v.status = 'posted'
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return {
    openingBalance,
    lines: appendRunningBalance(result.rows, openingBalance),
  };
};

const getPartyLedgerReport = async ({ companyId, partyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
  const normalizedPartyId = Number(partyId || 0) || null;
  if (!normalizedPartyId) {
    const error = new Error("Valid partyId is required");
    error.statusCode = 400;
    throw error;
  }

  const values = [normalizedCompanyId, normalizedPartyId];
  const dateClause = buildDateWhere(values, range.dateFrom, range.dateTo);

  let openingBalance = 0;
  if (range.dateFrom) {
    const openingResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(vl.debit - vl.credit), 0)::numeric AS "openingMovement"
      FROM voucher_lines vl
      INNER JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = $1
        AND vl.party_id = $2
        AND v.status = 'posted'
        AND v.voucher_date < $3::date
      `,
      [normalizedCompanyId, normalizedPartyId, range.dateFrom]
    );
    openingBalance = Number(openingResult.rows[0]?.openingMovement || 0);
  }

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
      AND v.status = 'posted'
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  return {
    openingBalance,
    lines: appendRunningBalance(result.rows, openingBalance),
  };
};

const getReceivableAgeingReport = async ({ companyId, asOfDate = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedAsOfDate = normalizeDate(asOfDate, "asOfDate") || new Date().toISOString().slice(0, 10);

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
      GREATEST(($2::date - r.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN $2::date <= r.due_date THEN 'current'
        WHEN $2::date - r.due_date <= 30 THEN '1-30'
        WHEN $2::date - r.due_date <= 60 THEN '31-60'
        WHEN $2::date - r.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket"
    FROM receivables r
    LEFT JOIN party_master p ON p.id = r.party_id
    WHERE r.company_id = $1
      AND r.outstanding_amount > 0
    ORDER BY r.due_date ASC, r.id ASC
    `,
    [normalizedCompanyId, normalizedAsOfDate]
  );

  return {
    items: result.rows,
    bucketTotals: buildAgeingBucketTotals(result.rows),
    asOfDate: normalizedAsOfDate,
  };
};

const getPayableAgeingReport = async ({ companyId, asOfDate = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedAsOfDate = normalizeDate(asOfDate, "asOfDate") || new Date().toISOString().slice(0, 10);

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
      GREATEST(($2::date - p.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN $2::date <= p.due_date THEN 'current'
        WHEN $2::date - p.due_date <= 30 THEN '1-30'
        WHEN $2::date - p.due_date <= 60 THEN '31-60'
        WHEN $2::date - p.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket"
    FROM payables p
    LEFT JOIN party_master pr ON pr.id = p.party_id
    LEFT JOIN vendor_master vd ON vd.id = p.vendor_id
    WHERE p.company_id = $1
      AND p.outstanding_amount > 0
    ORDER BY p.due_date ASC, p.id ASC
    `,
    [normalizedCompanyId, normalizedAsOfDate]
  );

  return {
    items: result.rows,
    bucketTotals: buildAgeingBucketTotals(result.rows),
    asOfDate: normalizedAsOfDate,
  };
};

const getVoucherRegisterReport = async ({
  companyId,
  voucherType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
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

  if (range.dateFrom) {
    values.push(range.dateFrom);
    filters.push(`v.voucher_date >= $${values.length}::date`);
  }

  if (range.dateTo) {
    values.push(range.dateTo);
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

  return {
    items: result.rows,
    totals: result.rows.reduce(
      (acc, row) => {
        acc.totalDebit += Number(row.totalDebit || 0);
        acc.totalCredit += Number(row.totalCredit || 0);
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 }
    ),
  };
};

const getCashBookReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere(values, range.dateFrom, range.dateTo);

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
      AND v.status = 'posted'
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  const balances = new Map();
  return result.rows.map((row) => {
    const key = String(row.ledgerName || "");
    const running = Number(balances.get(key) || 0) + Number(row.debit || 0) - Number(row.credit || 0);
    balances.set(key, running);
    return {
      ...row,
      runningBalance: running,
    };
  });
};

const getBankBookReport = async ({ companyId, dateFrom = "", dateTo = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const range = normalizeDateRange({ dateFrom, dateTo });
  const values = [normalizedCompanyId];
  const dateClause = buildDateWhere(values, range.dateFrom, range.dateTo);

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
      AND v.status = 'posted'
      ${dateClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  const balances = new Map();
  return result.rows.map((row) => {
    const key = String(row.ledgerName || "");
    const running = Number(balances.get(key) || 0) + Number(row.debit || 0) - Number(row.credit || 0);
    balances.set(key, running);
    return {
      ...row,
      runningBalance: running,
    };
  });
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
