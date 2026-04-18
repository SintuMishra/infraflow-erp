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

  if (!req.body?.cashOrBankLedgerId && !req.body?.cashOrBankAccountId) {
    return sendValidationError(res, "cashOrBankLedgerId or cashOrBankAccountId is required");
  }

  if (!req.body?.counterAccountId || !req.body?.counterLedgerId) {
    return sendValidationError(res, "counterAccountId and counterLedgerId are required");
  }

  return next();
};

module.exports = {
  validateCreateBankAccountPayload,
  validateBankAccountStatusPayload,
  validateCreateCashBankVoucherPayload,
};
