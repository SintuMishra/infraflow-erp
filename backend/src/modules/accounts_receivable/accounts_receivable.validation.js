const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateDispatchReadyPayload = (req, res, next) => {
  if (req.body?.financeNotes && typeof req.body.financeNotes !== "string") {
    return sendValidationError(res, "financeNotes must be text");
  }

  return next();
};

const validateCreateReceivableFromDispatchPayload = (req, res, next) => {
  if (!ISO_DATE_PATTERN.test(String(req.body?.dueDate || "").trim())) {
    return sendValidationError(res, "dueDate must use YYYY-MM-DD format");
  }

  return next();
};

const validateSettleReceivablePayload = (req, res, next) => {
  if (!(Number(req.body?.amount || 0) > 0)) {
    return sendValidationError(res, "amount must be greater than 0");
  }

  if (!ISO_DATE_PATTERN.test(String(req.body?.settlementDate || "").trim())) {
    return sendValidationError(res, "settlementDate must use YYYY-MM-DD format");
  }

  return next();
};

module.exports = {
  validateDispatchReadyPayload,
  validateCreateReceivableFromDispatchPayload,
  validateSettleReceivablePayload,
};
