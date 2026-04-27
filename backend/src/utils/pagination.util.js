const normalizePage = (value, fallback = 1) =>
  Math.max(Number(value) || fallback, 1);

const normalizeLimit = (value, fallback = 25, max = 100) =>
  Math.min(Math.max(Number(value) || fallback, 1), max);

const shouldUsePaginatedResponse = (query = {}) =>
  String(query.paginate || "").trim().toLowerCase() === "true" ||
  Object.prototype.hasOwnProperty.call(query, "page") ||
  Object.prototype.hasOwnProperty.call(query, "limit") ||
  Object.prototype.hasOwnProperty.call(query, "search");

module.exports = {
  normalizePage,
  normalizeLimit,
  shouldUsePaginatedResponse,
};
