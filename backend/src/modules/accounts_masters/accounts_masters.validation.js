const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateCreateAccountGroup = (req, res, next) => {
  if (!String(req.body?.groupCode || "").trim()) {
    return sendValidationError(res, "groupCode is required");
  }
  if (!String(req.body?.groupName || "").trim()) {
    return sendValidationError(res, "groupName is required");
  }
  if (!String(req.body?.nature || "").trim()) {
    return sendValidationError(res, "nature is required");
  }

  return next();
};

const validateCreateAccount = (req, res, next) => {
  if (!Number(req.body?.accountGroupId || 0)) {
    return sendValidationError(res, "accountGroupId is required");
  }
  if (!String(req.body?.accountCode || "").trim()) {
    return sendValidationError(res, "accountCode is required");
  }
  if (!String(req.body?.accountName || "").trim()) {
    return sendValidationError(res, "accountName is required");
  }

  return next();
};

const validateCreateLedger = (req, res, next) => {
  if (!Number(req.body?.accountId || 0)) {
    return sendValidationError(res, "accountId is required");
  }
  if (!String(req.body?.ledgerCode || "").trim()) {
    return sendValidationError(res, "ledgerCode is required");
  }
  if (!String(req.body?.ledgerName || "").trim()) {
    return sendValidationError(res, "ledgerName is required");
  }

  return next();
};

const validateCreateFinancialYear = (req, res, next) => {
  const { fyCode, fyName, startDate, endDate } = req.body || {};
  if (!String(fyCode || "").trim() || !String(fyName || "").trim()) {
    return sendValidationError(res, "fyCode and fyName are required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "").trim())) {
    return sendValidationError(res, "startDate must use YYYY-MM-DD format");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || "").trim())) {
    return sendValidationError(res, "endDate must use YYYY-MM-DD format");
  }

  return next();
};

const validateCreateAccountingPeriod = (req, res, next) => {
  const { financialYearId, periodCode, periodStart, periodEnd } = req.body || {};

  if (!Number(financialYearId || 0)) {
    return sendValidationError(res, "financialYearId is required");
  }
  if (!String(periodCode || "").trim()) {
    return sendValidationError(res, "periodCode is required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart || "").trim())) {
    return sendValidationError(res, "periodStart must use YYYY-MM-DD format");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodEnd || "").trim())) {
    return sendValidationError(res, "periodEnd must use YYYY-MM-DD format");
  }

  return next();
};

module.exports = {
  validateCreateAccountGroup,
  validateCreateAccount,
  validateCreateLedger,
  validateCreateFinancialYear,
  validateCreateAccountingPeriod,
};
