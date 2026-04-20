const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value) => String(value).padStart(2, "0");

const isDateOnlyString = (value) =>
  typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim());

const formatLocalDateParts = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

export const toDateOnlyValue = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (isDateOnlyString(trimmed)) {
      return trimmed;
    }

    // For date-time strings, prefer local-date normalization so UTC values
    // do not appear as an incorrect previous-day date in the UI.
    const parsedStringDate = new Date(trimmed);
    if (!Number.isNaN(parsedStringDate.getTime())) {
      return formatLocalDateParts(parsedStringDate);
    }

    const matchedDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matchedDate) {
      return matchedDate[1];
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return formatLocalDateParts(parsed);
};

export const getTodayDateValue = () => formatLocalDateParts(new Date());

export const parseDateOnlyValue = (value) => {
  const dateOnlyValue = toDateOnlyValue(value);

  if (!dateOnlyValue) {
    return null;
  }

  const parsed = new Date(`${dateOnlyValue}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDisplayDate = (value, options = {}) => {
  if (!value) {
    return "-";
  }

  const normalized = typeof value === "string" ? value.trim() : value;
  const parsed = isDateOnlyString(normalized)
    ? parseDateOnlyValue(normalized)
    : new Date(normalized);

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  const formatOptions = {
    day: "2-digit",
    month: "short",
    ...options,
  };

  if (!Object.prototype.hasOwnProperty.call(options, "year")) {
    formatOptions.year = "numeric";
  }

  return new Intl.DateTimeFormat("en-IN", formatOptions).format(parsed);
};

export const formatDateTimeLabel = (value, options = {}) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  const formatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };

  if (!Object.prototype.hasOwnProperty.call(options, "year")) {
    formatOptions.year = "numeric";
  }

  return new Intl.DateTimeFormat("en-IN", formatOptions).format(parsed);
};

export const getTimestampFileLabel = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "timestamp";
  }

  return [
    formatLocalDateParts(parsed),
    pad(parsed.getHours()),
    pad(parsed.getMinutes()),
    pad(parsed.getSeconds()),
  ].join("-");
};
