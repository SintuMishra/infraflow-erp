const isPositiveNumber = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  !Number.isNaN(Number(value)) &&
  Number(value) > 0;

const allowedRoyaltyModes = ["per_ton", "per_brass", "fixed", "none"];
const allowedLoadingChargeBases = ["none", "fixed", "per_ton", "per_brass", "per_trip"];
const allowedRateUnits = [
  "per_ton",
  "per_metric_ton",
  "per_cft",
  "per_brass",
  "per_cubic_meter",
  "per_trip",
  "other",
];
const conversionRateUnits = ["per_cft", "per_brass", "per_cubic_meter", "per_trip", "other"];

const validateRatePayload = (req, res, next) => {
  const {
    plantId,
    partyId,
    materialId,
    ratePerTon,
    rateUnit,
    rateUnitLabel,
    rateUnitsPerTon,
    royaltyMode,
    royaltyValue,
    loadingCharge,
    loadingChargeBasis,
    tonsPerBrass,
    effectiveFrom,
  } = req.body || {};

  if (!isPositiveNumber(plantId) || !isPositiveNumber(partyId) || !isPositiveNumber(materialId)) {
    return res.status(400).json({
      success: false,
      message: "plantId, partyId and materialId must be valid positive numbers",
    });
  }

  if (!isPositiveNumber(ratePerTon)) {
    return res.status(400).json({
      success: false,
      message: "ratePerTon must be a valid number greater than 0",
    });
  }

  const normalizedRateUnit = String(rateUnit || "per_ton").trim();
  if (!allowedRateUnits.includes(normalizedRateUnit)) {
    return res.status(400).json({
      success: false,
      message:
        "rateUnit must be one of per_ton, per_metric_ton, per_cft, per_brass, per_cubic_meter, per_trip, other",
    });
  }

  if (normalizedRateUnit === "other" && !String(rateUnitLabel || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "rateUnitLabel is required when rateUnit is other",
    });
  }

  if (conversionRateUnits.includes(normalizedRateUnit) && !isPositiveNumber(rateUnitsPerTon)) {
    return res.status(400).json({
      success: false,
      message: "rateUnitsPerTon must be greater than 0 for converted rate units",
    });
  }

  if (
    rateUnitsPerTon !== undefined &&
    rateUnitsPerTon !== null &&
    rateUnitsPerTon !== "" &&
    (Number.isNaN(Number(rateUnitsPerTon)) || Number(rateUnitsPerTon) <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "rateUnitsPerTon must be greater than 0 when provided",
    });
  }

  if (!allowedRoyaltyModes.includes(String(royaltyMode || "").trim())) {
    return res.status(400).json({
      success: false,
      message: "royaltyMode must be one of per_ton, per_brass, fixed, none",
    });
  }

  if (royaltyValue !== undefined && royaltyValue !== null && royaltyValue !== "") {
    if (Number.isNaN(Number(royaltyValue)) || Number(royaltyValue) < 0) {
      return res.status(400).json({
        success: false,
        message: "royaltyValue must be 0 or greater",
      });
    }
  }

  if (loadingCharge !== undefined && loadingCharge !== null && loadingCharge !== "") {
    if (Number.isNaN(Number(loadingCharge)) || Number(loadingCharge) < 0) {
      return res.status(400).json({
        success: false,
        message: "loadingCharge must be 0 or greater",
      });
    }
  }

  if (!allowedLoadingChargeBases.includes(String(loadingChargeBasis || "fixed").trim())) {
    return res.status(400).json({
      success: false,
      message: "loadingChargeBasis must be one of none, fixed, per_ton, per_brass, per_trip",
    });
  }

  if (
    String(royaltyMode || "").trim() === "per_brass" ||
    String(loadingChargeBasis || "fixed").trim() === "per_brass"
  ) {
    if (!isPositiveNumber(tonsPerBrass)) {
      return res.status(400).json({
        success: false,
        message:
          "tonsPerBrass must be a valid number greater than 0 when royaltyMode or loadingChargeBasis is per_brass",
      });
    }
  } else if (tonsPerBrass !== undefined && tonsPerBrass !== null && tonsPerBrass !== "") {
    if (Number.isNaN(Number(tonsPerBrass)) || Number(tonsPerBrass) <= 0) {
      return res.status(400).json({
        success: false,
        message: "tonsPerBrass must be greater than 0 when provided",
      });
    }
  }

  if (effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveFrom).trim())) {
    return res.status(400).json({
      success: false,
      message: "effectiveFrom must be in YYYY-MM-DD format",
    });
  }

  next();
};

const validateRateStatusPayload = (req, res, next) => {
  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be provided as true or false",
    });
  }

  next();
};

module.exports = {
  validateCreateRateInput: validateRatePayload,
  validateUpdateRateInput: validateRatePayload,
  validateRateStatusPayload,
};
