const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateCreatePayablePayload = (req, res, next) => {
  if (!(Number(req.body?.amount || 0) > 0)) {
    return sendValidationError(res, "amount must be greater than 0");
  }

  if (!ISO_DATE_PATTERN.test(String(req.body?.billDate || "").trim())) {
    return sendValidationError(res, "billDate must use YYYY-MM-DD format");
  }

  if (!ISO_DATE_PATTERN.test(String(req.body?.dueDate || "").trim())) {
    return sendValidationError(res, "dueDate must use YYYY-MM-DD format");
  }

  const hasParty = Number(req.body?.partyId || 0) > 0;
  const hasVendor = Number(req.body?.vendorId || 0) > 0;
  if (hasParty === hasVendor) {
    return sendValidationError(res, "Provide exactly one: partyId or vendorId");
  }

  if (String(req.body?.dueDate || "").trim() < String(req.body?.billDate || "").trim()) {
    return sendValidationError(res, "dueDate cannot be before billDate");
  }

  return next();
};

const validateSettlePayablePayload = (req, res, next) => {
  if (!(Number(req.body?.amount || 0) > 0)) {
    return sendValidationError(res, "amount must be greater than 0");
  }

  if (!ISO_DATE_PATTERN.test(String(req.body?.settlementDate || "").trim())) {
    return sendValidationError(res, "settlementDate must use YYYY-MM-DD format");
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "bankLedgerId") &&
    req.body.bankLedgerId !== null &&
    req.body.bankLedgerId !== undefined &&
    Number(req.body.bankLedgerId || 0) <= 0
  ) {
    return sendValidationError(res, "bankLedgerId must be a positive integer when provided");
  }

  return next();
};

module.exports = {
  validateCreatePayablePayload,
  validateSettlePayablePayload,
};
