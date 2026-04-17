const formatDateOnly = (value) => {
  if (!value) return null;

  // Keep date-only database strings unchanged while rejecting arbitrary text.
  if (typeof value === "string") {
    const matchedDate = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (matchedDate) {
      return matchedDate[1];
    }
  }

  // If it's a JS Date object, format using local date parts,
  // not UTC date parts, so the date does not shift backward.
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // Fallback for unexpected date-like values
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatRowsDateField = (rows, fieldName) => {
  return rows.map((row) => ({
    ...row,
    [fieldName]: formatDateOnly(row[fieldName]),
  }));
};

const formatRowDateField = (row, fieldName) => {
  if (!row) return row;

  return {
    ...row,
    [fieldName]: formatDateOnly(row[fieldName]),
  };
};

module.exports = {
  formatDateOnly,
  formatRowsDateField,
  formatRowDateField,
};
