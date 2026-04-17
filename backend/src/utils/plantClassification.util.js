const normalizePlantTypeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const isCrusherPlantType = (value) => {
  const normalized = normalizePlantTypeValue(value);

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
};

module.exports = {
  isCrusherPlantType,
  normalizePlantTypeValue,
};
