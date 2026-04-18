const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateCreatePostingRulePayload = (req, res, next) => {
  const {
    ruleCode,
    eventName,
    sourceModule,
    voucherType,
    debitAccountId,
    creditAccountId,
  } = req.body || {};

  if (!String(ruleCode || "").trim()) {
    return sendValidationError(res, "ruleCode is required");
  }
  if (!String(eventName || "").trim()) {
    return sendValidationError(res, "eventName is required");
  }
  if (!String(sourceModule || "").trim()) {
    return sendValidationError(res, "sourceModule is required");
  }
  if (!String(voucherType || "").trim()) {
    return sendValidationError(res, "voucherType is required");
  }
  if (!Number(debitAccountId) || !Number(creditAccountId)) {
    return sendValidationError(res, "debitAccountId and creditAccountId are required");
  }

  return next();
};

const validatePostingRuleStatusPayload = (req, res, next) => {
  if (typeof req.body?.isActive !== "boolean") {
    return sendValidationError(res, "isActive must be boolean");
  }

  return next();
};

module.exports = {
  validateCreatePostingRulePayload,
  validatePostingRuleStatusPayload,
};
