const DEFAULT_PROCUREMENT_ITEM_CATEGORIES = [
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "spare_part", label: "Spare Part" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
];

export const normalizeProcurementItemCategoryValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "material";
};

export const getProcurementItemCategoryOptions = (masters) => {
  const configuredRows = Array.isArray(masters?.configOptions?.procurementItemCategories)
    ? masters.configOptions.procurementItemCategories
    : [];

  const activeRows = configuredRows.filter((row) => row?.isActive !== false);
  const seen = new Set();
  const options = [];

  for (const row of activeRows) {
    const value = normalizeProcurementItemCategoryValue(row?.optionValue || row?.optionLabel);
    if (seen.has(value)) {
      continue;
    }

    const label = String(row?.optionLabel || row?.optionValue || value)
      .trim()
      .replace(/\s+/g, " ");

    seen.add(value);
    options.push({
      value,
      label: label || value,
    });
  }

  if (!options.length) {
    return DEFAULT_PROCUREMENT_ITEM_CATEGORIES;
  }

  return options;
};
