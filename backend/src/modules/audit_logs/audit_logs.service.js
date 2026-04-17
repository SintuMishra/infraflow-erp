const { listAuditLogs } = require("./audit_logs.model");

const MAX_ACTION_FILTER_LENGTH = 120;
const MAX_TARGET_TYPE_FILTER_LENGTH = 120;
const MAX_SEARCH_FILTER_LENGTH = 200;
const MAX_LIMIT = 200;

const toTrimmedString = (value) => String(value || "").trim();

const validatePaginationFilter = (value, label) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    const error = new Error(`${label} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
};

const validateLength = (value, maxLength, label) => {
  if (value.length <= maxLength) {
    return;
  }

  const error = new Error(`${label} cannot exceed ${maxLength} characters`);
  error.statusCode = 400;
  throw error;
};

const validateAuditDateFilters = ({ startDate = "", endDate = "" }) => {
  const normalizedStart = String(startDate || "").trim();
  const normalizedEnd = String(endDate || "").trim();

  if (!normalizedStart && !normalizedEnd) {
    return;
  }

  const startValue = normalizedStart ? new Date(`${normalizedStart}T00:00:00Z`) : null;
  const endValue = normalizedEnd ? new Date(`${normalizedEnd}T00:00:00Z`) : null;

  if (startValue && Number.isNaN(startValue.getTime())) {
    const error = new Error("Start date is invalid");
    error.statusCode = 400;
    throw error;
  }

  if (endValue && Number.isNaN(endValue.getTime())) {
    const error = new Error("End date is invalid");
    error.statusCode = 400;
    throw error;
  }

  if (startValue && endValue && endValue < startValue) {
    const error = new Error("End date cannot be before start date");
    error.statusCode = 400;
    throw error;
  }
};

const getAuditLogs = async ({
  companyId = null,
  action = "",
  targetType = "",
  search = "",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 100,
}) => {
  const normalizedAction = toTrimmedString(action);
  const normalizedTargetType = toTrimmedString(targetType);
  const normalizedSearch = toTrimmedString(search);
  const normalizedStartDate = toTrimmedString(startDate);
  const normalizedEndDate = toTrimmedString(endDate);

  validateLength(normalizedAction, MAX_ACTION_FILTER_LENGTH, "Action filter");
  validateLength(normalizedTargetType, MAX_TARGET_TYPE_FILTER_LENGTH, "Target filter");
  validateLength(normalizedSearch, MAX_SEARCH_FILTER_LENGTH, "Search filter");
  validatePaginationFilter(page, "Page");
  validatePaginationFilter(limit, "Limit");

  if (Number(limit || 0) > MAX_LIMIT) {
    const error = new Error(`Limit cannot exceed ${MAX_LIMIT}`);
    error.statusCode = 400;
    throw error;
  }

  validateAuditDateFilters({ startDate: normalizedStartDate, endDate: normalizedEndDate });

  return listAuditLogs({
    companyId,
    action: normalizedAction,
    targetType: normalizedTargetType,
    search: normalizedSearch,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    page,
    limit,
  });
};

module.exports = {
  getAuditLogs,
};
