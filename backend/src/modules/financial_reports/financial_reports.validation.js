const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const normalizeDate = (value) => String(value || "").trim();

const validateDateRangeQuery = (req, res, next) => {
  const dateFrom = normalizeDate(req.query?.dateFrom);
  const dateTo = normalizeDate(req.query?.dateTo);

  if (dateFrom && !ISO_DATE_PATTERN.test(dateFrom)) {
    return sendValidationError(res, "dateFrom must use YYYY-MM-DD format");
  }

  if (dateTo && !ISO_DATE_PATTERN.test(dateTo)) {
    return sendValidationError(res, "dateTo must use YYYY-MM-DD format");
  }

  if (dateFrom && dateTo && dateTo < dateFrom) {
    return sendValidationError(res, "dateTo cannot be earlier than dateFrom");
  }

  return next();
};

const validateLedgerReportQuery = (req, res, next) => {
  if (!(Number(req.query?.ledgerId || 0) > 0)) {
    return sendValidationError(res, "ledgerId must be a positive integer");
  }
  return validateDateRangeQuery(req, res, next);
};

const validatePartyLedgerReportQuery = (req, res, next) => {
  if (!(Number(req.query?.partyId || 0) > 0)) {
    return sendValidationError(res, "partyId must be a positive integer");
  }
  return validateDateRangeQuery(req, res, next);
};

const validateAsOfDateQuery = (req, res, next) => {
  const asOfDate = normalizeDate(req.query?.asOfDate);
  if (asOfDate && !ISO_DATE_PATTERN.test(asOfDate)) {
    return sendValidationError(res, "asOfDate must use YYYY-MM-DD format");
  }
  return next();
};

module.exports = {
  validateDateRangeQuery,
  validateLedgerReportQuery,
  validatePartyLedgerReportQuery,
  validateAsOfDateQuery,
};
