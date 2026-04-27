const DEFAULT_REPORT_RANGE_DAYS = 30;

const formatDateOnlyUtc = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveReportDateRange = ({
  startDate = "",
  endDate = "",
  dateFrom = "",
  dateTo = "",
  defaultDays = DEFAULT_REPORT_RANGE_DAYS,
} = {}) => {
  const normalizedStartDate = String(startDate || dateFrom || "").trim();
  const normalizedEndDate = String(endDate || dateTo || "").trim();

  if (normalizedStartDate && normalizedEndDate) {
    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      dateFrom: normalizedStartDate,
      dateTo: normalizedEndDate,
    };
  }

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(Number(defaultDays) || 30, 1) + 1);

  const resolvedStart = formatDateOnlyUtc(start);
  const resolvedEnd = formatDateOnlyUtc(end);

  return {
    startDate: normalizedStartDate || resolvedStart,
    endDate: normalizedEndDate || resolvedEnd,
    dateFrom: normalizedStartDate || resolvedStart,
    dateTo: normalizedEndDate || resolvedEnd,
  };
};

module.exports = {
  DEFAULT_REPORT_RANGE_DAYS,
  resolveReportDateRange,
};
