export function normalizePlantType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isCrusherPlantType(value) {
  const normalized = normalizePlantType(value);

  if (!normalized) {
    return false;
  }

  return [
    "crusher",
    "crushing",
    "crusher plant",
    "stone crusher",
    "aggregate crusher",
  ].some((candidate) => normalized.includes(candidate));
}
