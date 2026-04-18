const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) =>
  res.status(400).json({ success: false, message });

const validateCreateBankAccountPayload = (req, res, next) => {
  if (!String(req.body?.accountName || "").trim()) {
    return sendValidationError(res, "accountName is required");
  }
  if (!String(req.body?.bankName || "").trim()) {
    return sendValidationError(res, "bankName is required");
  }
  if (!String(req.body?.accountNumber || "").trim()) {
    return sendValidationError(res, "accountNumber is required");
  }
  return next();
};

const validateBankAccountStatusPayload = (req, res, next) => {
  if (typeof req.body?.isActive !== "boolean") {
    return sendValidationError(res, "isActive must be boolean");
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "isDefault") &&
    typeof req.body.isDefault !== "boolean"
  ) {
    return sendValidationError(res, "isDefault must be boolean when provided");
  }

  return next();
};

const validateCreateCashBankVoucherPayload = (req, res, next) => {
  if (!ISO_DATE_PATTERN.test(String(req.body?.voucherDate || "").trim())) {
    return sendValidationError(res, "voucherDate must use YYYY-MM-DD format");
  }

  if (!(Number(req.body?.amount || 0) > 0)) {
    return sendValidationError(res, "amount must be greater than 0");
  }

  if (!String(req.body?.voucherType || "").trim()) {
    return sendValidationError(res, "voucherType is required");
  }

  const normalizedType = String(req.body?.voucherType || "").trim().toLowerCase();
  if (!["receipt", "payment", "contra"].includes(normalizedType)) {
    return sendValidationError(res, "voucherType must be receipt/payment/contra");
  }

  if (!req.body?.cashOrBankLedgerId && !req.body?.cashOrBankAccountId) {
    return sendValidationError(res, "cashOrBankLedgerId or cashOrBankAccountId is required");
  }

  if (!req.body?.counterAccountId || !req.body?.counterLedgerId) {
    return sendValidationError(res, "counterAccountId and counterLedgerId are required");
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "partyId") && req.body.partyId !== null && req.body.partyId !== undefined && Number(req.body.partyId || 0) <= 0) {
    return sendValidationError(res, "partyId must be a positive integer when provided");
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "vendorId") && req.body.vendorId !== null && req.body.vendorId !== undefined && Number(req.body.vendorId || 0) <= 0) {
    return sendValidationError(res, "vendorId must be a positive integer when provided");
  }

  if (req.body?.partyId && req.body?.vendorId) {
    return sendValidationError(res, "Provide either partyId or vendorId, not both");
  }

  return next();
};

module.exports = {
  validateCreateBankAccountPayload,
  validateBankAccountStatusPayload,
  validateCreateCashBankVoucherPayload,
};
