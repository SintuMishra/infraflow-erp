const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FINANCE_TRANSITION_ACTIONS = new Set([
  "create",
  "submit",
  "approve",
  "post",
  "reject",
  "reverse",
  "close",
  "reopen",
  "close_period",
  "reopen_period",
]);

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateCreateVoucherInput = (req, res, next) => {
  const {
    voucherType,
    voucherDate,
    lines,
    sourceModule,
    sourceRecordId,
    sourceEvent,
    approvalStatus,
  } = req.body || {};

  if (!String(voucherType || "").trim()) {
    return sendValidationError(res, "voucherType is required");
  }

  if (!ISO_DATE_PATTERN.test(String(voucherDate || "").trim())) {
    return sendValidationError(res, "voucherDate must use YYYY-MM-DD format");
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    return sendValidationError(res, "At least two voucher lines are required");
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || {};
    if (!Number(line.accountId) || !Number(line.ledgerId)) {
      return sendValidationError(
        res,
        `Line ${index + 1} requires accountId and ledgerId`
      );
    }

    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      return sendValidationError(
        res,
        `Line ${index + 1} must include either debit or credit`
      );
    }
  }

  const hasSourceModule = Boolean(String(sourceModule || "").trim());
  const hasSourceRecord = Number(sourceRecordId || 0) > 0;
  const hasSourceEvent = Boolean(String(sourceEvent || "").trim());
  const sourceFieldCount = [hasSourceModule, hasSourceRecord, hasSourceEvent].filter(Boolean).length;

  if (sourceFieldCount > 0 && sourceFieldCount < 3) {
    return sendValidationError(
      res,
      "sourceModule, sourceRecordId, and sourceEvent must be provided together"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "approvalStatus") &&
    !["draft", "submitted", "approved", "rejected"].includes(String(approvalStatus || "").trim().toLowerCase())
  ) {
    return sendValidationError(res, "approvalStatus must be draft/submitted/approved/rejected");
  }

  return next();
};

const validateReverseVoucherInput = (req, res, next) => {
  if (!ISO_DATE_PATTERN.test(String(req.body?.voucherDate || "").trim())) {
    return sendValidationError(res, "voucherDate must use YYYY-MM-DD format");
  }

  return next();
};

const validateApproveVoucherInput = (req, res, next) => {
  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "approvalNotes") &&
    typeof req.body.approvalNotes !== "string"
  ) {
    return sendValidationError(res, "approvalNotes must be text when provided");
  }
  return next();
};

const validateRejectVoucherInput = (req, res, next) => {
  const reason = String(req.body?.rejectionReason || "").trim();
  if (!reason) {
    return sendValidationError(res, "rejectionReason is required");
  }
  return next();
};

const validateWorkflowInboxQuery = (req, res, next) => {
  const limit = String(req.query?.limit || "").trim();
  if (limit) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
      return sendValidationError(res, "limit must be an integer between 1 and 200");
    }
  }
  return next();
};

const validateTransitionHistoryQuery = (req, res, next) => {
  const entityType = String(req.query?.entityType || "").trim().toLowerCase();
  if (entityType && !["voucher", "accounting_period"].includes(entityType)) {
    return sendValidationError(res, "entityType must be voucher/accounting_period");
  }

  const entityId = String(req.query?.entityId || "").trim();
  if (entityId && !(Number(entityId) > 0)) {
    return sendValidationError(res, "entityId must be a positive integer");
  }

  const action = String(req.query?.action || "").trim().toLowerCase();
  if (action && !FINANCE_TRANSITION_ACTIONS.has(action)) {
    return sendValidationError(res, "Unsupported transition action filter");
  }

  const performedByUserId = String(req.query?.performedByUserId || "").trim();
  if (performedByUserId && !(Number(performedByUserId) > 0)) {
    return sendValidationError(res, "performedByUserId must be a positive integer");
  }

  const dateFrom = String(req.query?.dateFrom || "").trim();
  const dateTo = String(req.query?.dateTo || "").trim();
  if (dateFrom && !ISO_DATE_PATTERN.test(dateFrom)) {
    return sendValidationError(res, "dateFrom must use YYYY-MM-DD format");
  }
  if (dateTo && !ISO_DATE_PATTERN.test(dateTo)) {
    return sendValidationError(res, "dateTo must use YYYY-MM-DD format");
  }
  if (dateFrom && dateTo && dateTo < dateFrom) {
    return sendValidationError(res, "dateTo cannot be earlier than dateFrom");
  }

  const limit = String(req.query?.limit || "").trim();
  if (limit) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 500) {
      return sendValidationError(res, "limit must be an integer between 1 and 500");
    }
  }

  const page = String(req.query?.page || "").trim();
  if (page) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
      return sendValidationError(res, "page must be a positive integer");
    }
  }

  const format = String(req.query?.format || "").trim().toLowerCase();
  if (format && !["json", "csv"].includes(format)) {
    return sendValidationError(res, "format must be json/csv when provided");
  }

  return next();
};

const validateFinancePolicyPayload = (req, res, next) => {
  const payload = req.body || {};
  const requiredFields = [
    "allowSubmitterSelfApproval",
    "allowMakerSelfApproval",
    "allowApproverSelfPosting",
    "allowMakerSelfPosting",
  ];

  for (const field of requiredFields) {
    if (typeof payload[field] !== "boolean") {
      return sendValidationError(res, `${field} must be boolean`);
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "lastUpdateNotes") &&
    typeof payload.lastUpdateNotes !== "string"
  ) {
    return sendValidationError(res, "lastUpdateNotes must be text when provided");
  }

  if (String(payload.lastUpdateNotes || "").trim().length > 400) {
    return sendValidationError(res, "lastUpdateNotes cannot exceed 400 characters");
  }

  return next();
};

module.exports = {
  validateCreateVoucherInput,
  validateReverseVoucherInput,
  validateApproveVoucherInput,
  validateRejectVoucherInput,
  validateWorkflowInboxQuery,
  validateTransitionHistoryQuery,
  validateFinancePolicyPayload,
};
