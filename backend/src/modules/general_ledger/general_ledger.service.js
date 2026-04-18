const { withTransaction, pool } = require("../../config/db");
const {
  getFinancePolicyControls,
  updateFinancePolicyControls,
  createVoucher,
  submitVoucher,
  approveVoucher,
  rejectVoucher,
  postVoucher,
  reverseVoucher,
  listVouchers,
  getVoucherById,
  getWorkflowInbox,
  listFinanceTransitionHistory,
} = require("./general_ledger.model");

const toCompanyId = (value) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getCompanyIdOrThrow = (companyId) => {
  const normalized = toCompanyId(companyId);
  if (!normalized) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const listVoucherEntries = async (filters = {}) => {
  const companyId = getCompanyIdOrThrow(filters.companyId);
  return listVouchers({ ...filters, companyId });
};

const getVoucherWorkflowInbox = async ({ companyId, limit = 50 }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  return getWorkflowInbox({
    companyId: normalizedCompanyId,
    limit,
  });
};

const getFinancePolicySettings = async ({ companyId }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  return getFinancePolicyControls({
    companyId: normalizedCompanyId,
  });
};

const updateFinancePolicySettings = async ({
  companyId,
  userId,
  allowSubmitterSelfApproval,
  allowMakerSelfApproval,
  allowApproverSelfPosting,
  allowMakerSelfPosting,
  lastUpdateNotes = "",
}) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);

  return withTransaction((db) =>
    updateFinancePolicyControls({
      companyId: normalizedCompanyId,
      userId,
      allowSubmitterSelfApproval,
      allowMakerSelfApproval,
      allowApproverSelfPosting,
      allowMakerSelfPosting,
      lastUpdateNotes,
      db,
    })
  );
};

const getFinanceTransitionHistory = async ({
  companyId,
  entityType = "",
  entityId = null,
  action = "",
  performedByUserId = null,
  dateFrom = "",
  dateTo = "",
  limit = 100,
  page = 1,
}) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  return listFinanceTransitionHistory({
    companyId: normalizedCompanyId,
    entityType,
    entityId,
    action,
    performedByUserId,
    dateFrom,
    dateTo,
    limit,
    page,
  });
};

const getVoucherEntryById = async ({ voucherId, companyId }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  const data = await getVoucherById({ voucherId: normalizedVoucherId, companyId: normalizedCompanyId });
  if (!data) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  return data;
};

const createVoucherEntry = async ({
  companyId,
  voucherType,
  voucherDate,
  accountingPeriodId = null,
  approvalStatus = "draft",
  narration = "",
  sourceModule = null,
  sourceRecordId = null,
  sourceEvent = null,
  lines = [],
  createdByUserId = null,
  autoPost = false,
}) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);

  return withTransaction(async (db) => {
    const safeApprovalStatus = String(approvalStatus || "draft").trim().toLowerCase();
    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType,
      voucherDate,
      accountingPeriodId,
      approvalStatus: safeApprovalStatus,
      narration,
      sourceModule,
      sourceRecordId,
      sourceEvent,
      lines,
      createdByUserId,
      db,
    });

    if (!autoPost) {
      return voucher;
    }

    if (!Number(createdByUserId || 0)) {
      const error = new Error("createdByUserId is required for auto-post workflow");
      error.statusCode = 400;
      throw error;
    }

    const policy = await getFinancePolicyControls({
      companyId: normalizedCompanyId,
      db,
    });
    if (
      Number(createdByUserId || 0) > 0 &&
      (!policy.allowMakerSelfApproval ||
        !policy.allowSubmitterSelfApproval ||
        !policy.allowMakerSelfPosting ||
        !policy.allowApproverSelfPosting)
    ) {
      const error = new Error(
        "Auto-post requires maker-checker policy override. Submit, approve, and post using separate users."
      );
      error.statusCode = 409;
      throw error;
    }

    const submittedVoucher = await submitVoucher({
      voucherId: voucher.id,
      companyId: normalizedCompanyId,
      submittedByUserId: createdByUserId,
      db,
    });

    const approvedVoucher = await approveVoucher({
      voucherId: submittedVoucher.id,
      companyId: normalizedCompanyId,
      approvedByUserId: createdByUserId,
      db,
    });

    return postVoucher({
      voucherId: approvedVoucher.id,
      companyId: normalizedCompanyId,
      postedByUserId: createdByUserId,
      db,
    });
  });
};

const submitVoucherEntry = async ({ voucherId, companyId, userId = null }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction((db) =>
    submitVoucher({
      voucherId: normalizedVoucherId,
      companyId: normalizedCompanyId,
      submittedByUserId: userId,
      db,
    })
  );
};

const approveVoucherEntry = async ({ voucherId, companyId, userId = null, approvalNotes = "" }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction((db) =>
    approveVoucher({
      voucherId: normalizedVoucherId,
      companyId: normalizedCompanyId,
      approvedByUserId: userId,
      approvalNotes,
      db,
    })
  );
};

const rejectVoucherEntry = async ({ voucherId, companyId, userId = null, rejectionReason = "" }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction((db) =>
    rejectVoucher({
      voucherId: normalizedVoucherId,
      companyId: normalizedCompanyId,
      rejectedByUserId: userId,
      rejectionReason,
      db,
    })
  );
};

const postVoucherEntry = async ({ voucherId, companyId, userId = null }) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction((db) =>
    postVoucher({
      voucherId: normalizedVoucherId,
      companyId: normalizedCompanyId,
      postedByUserId: userId,
      db,
    })
  );
};

const reverseVoucherEntry = async ({
  voucherId,
  companyId,
  voucherDate,
  narration = "",
  userId = null,
}) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedVoucherId = Number(voucherId || 0) || null;
  const normalizedDate = String(voucherDate || "").trim();

  if (!normalizedVoucherId) {
    const error = new Error("Valid voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const error = new Error("voucherDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction((db) =>
    reverseVoucher({
      voucherId: normalizedVoucherId,
      companyId: normalizedCompanyId,
      voucherDate: normalizedDate,
      narration,
      userId,
      db,
    })
  );
};

const getLedgerBook = async ({
  ledgerId,
  companyId,
  dateFrom = "",
  dateTo = "",
}) => {
  const normalizedCompanyId = getCompanyIdOrThrow(companyId);
  const normalizedLedgerId = Number(ledgerId || 0) || null;
  if (!normalizedLedgerId) {
    const error = new Error("Valid ledgerId is required");
    error.statusCode = 400;
    throw error;
  }

  const values = [normalizedCompanyId, normalizedLedgerId];
  const where = ["vl.company_id = $1", "vl.ledger_id = $2"];

  if (dateFrom) {
    values.push(dateFrom);
    where.push(`v.voucher_date >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    where.push(`v.voucher_date <= $${values.length}::date`);
  }

  const linesResult = await pool.query(
    `
    SELECT
      v.id AS "voucherId",
      v.voucher_number AS "voucherNumber",
      v.voucher_type AS "voucherType",
      v.voucher_date AS "voucherDate",
      v.status AS "voucherStatus",
      vl.id AS "lineId",
      vl.line_number AS "lineNumber",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration",
      p.party_name AS "partyName",
      vd.vendor_name AS "vendorName",
      pm.plant_name AS "plantName",
      pr.project_name AS "projectName",
      vh.vehicle_number AS "vehicleNumber"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    LEFT JOIN party_master p ON p.id = vl.party_id
    LEFT JOIN vendor_master vd ON vd.id = vl.vendor_id
    LEFT JOIN plant_master pm ON pm.id = vl.plant_id
    LEFT JOIN project_daily_reports pr ON pr.id = vl.project_id
    LEFT JOIN vehicles vh ON vh.id = vl.vehicle_id
    WHERE ${where.join(" AND ")}
    ORDER BY v.voucher_date ASC, v.id ASC, vl.line_number ASC
    `,
    values
  );

  const summaryResult = await pool.query(
    `
    SELECT
      COALESCE(SUM(vl.debit), 0)::numeric AS "totalDebit",
      COALESCE(SUM(vl.credit), 0)::numeric AS "totalCredit"
    FROM voucher_lines vl
    INNER JOIN vouchers v ON v.id = vl.voucher_id
    WHERE ${where.join(" AND ")}
    `,
    values
  );

  return {
    lines: linesResult.rows,
    totals: summaryResult.rows[0] || { totalDebit: 0, totalCredit: 0 },
  };
};

module.exports = {
  listVoucherEntries,
  getVoucherWorkflowInbox,
  getFinancePolicySettings,
  updateFinancePolicySettings,
  getFinanceTransitionHistory,
  getVoucherEntryById,
  createVoucherEntry,
  submitVoucherEntry,
  approveVoucherEntry,
  rejectVoucherEntry,
  postVoucherEntry,
  reverseVoucherEntry,
  getLedgerBook,
};
