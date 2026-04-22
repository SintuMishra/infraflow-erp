export const normalizeShiftValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized;
};

export const getProjectShiftOptions = ({ masters, includeBlank = true } = {}) => {
  const options = [];
  const seen = new Set();

  if (includeBlank) {
    options.push({ value: "", label: "Not Set" });
    seen.add("");
  }

  const pushOption = (value, label) => {
    const normalizedValue = normalizeShiftValue(value);
    const normalizedLabel = String(label || value || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!normalizedLabel || seen.has(normalizedValue)) {
      return;
    }

    options.push({
      value: normalizedValue,
      label: normalizedLabel,
    });
    seen.add(normalizedValue);
  };

  for (const shift of masters?.shifts || []) {
    if (!shift || shift.isActive === false) {
      continue;
    }

    const suffix =
      shift?.startTime && shift?.endTime ? ` (${shift.startTime}-${shift.endTime})` : "";
    const label = `${String(shift.shiftName || "").trim()}${suffix}`.trim();
    pushOption(shift.shiftName, label);
  }

  return options;
};
