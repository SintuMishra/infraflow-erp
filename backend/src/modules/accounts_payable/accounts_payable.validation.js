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

  if (!req.body?.partyId && !req.body?.vendorId) {
    return sendValidationError(res, "Either partyId or vendorId is required");
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

  return next();
};

module.exports = {
  validateCreatePayablePayload,
  validateSettlePayablePayload,
};
