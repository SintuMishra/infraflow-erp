const isPositiveNumber = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  !Number.isNaN(Number(value)) &&
  Number(value) > 0;

const allowedRoyaltyModes = ["per_ton", "fixed", "none"];

const validateRatePayload = (req, res, next) => {
  const {
    plantId,
    partyId,
    materialId,
    ratePerTon,
    royaltyMode,
    royaltyValue,
    loadingCharge,
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

  if (!allowedRoyaltyModes.includes(String(royaltyMode || "").trim())) {
    return res.status(400).json({
      success: false,
      message: "royaltyMode must be one of per_ton, fixed, none",
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
