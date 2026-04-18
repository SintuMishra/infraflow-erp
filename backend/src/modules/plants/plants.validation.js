const allowedPlantTypes = [
  "Crusher",
  "Batching",
  "RMC",
  "HotMix",
  "Asphalt",
  "Other",
];
const allowedPowerSourceTypes = ["diesel", "electric", "electricity", "hybrid", "other"];
const isOtherCustomValue = (value) => /^other\s*:\s*\S+/i.test(String(value || "").trim());

const isBlank = (value) => String(value || "").trim() === "";

const validatePlantPayload = (req, res, next) => {
  const { plantName, plantType, powerSourceType } = req.body || {};

  if (isBlank(plantName) || isBlank(plantType)) {
    return res.status(400).json({
      success: false,
      message: "plantName and plantType are required",
    });
  }

  if (
    !allowedPlantTypes.includes(String(plantType).trim()) &&
    !isOtherCustomValue(plantType)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid plantType",
    });
  }

  if (
    powerSourceType !== undefined &&
    powerSourceType !== null &&
    powerSourceType !== "" &&
    !allowedPowerSourceTypes.includes(String(powerSourceType).trim().toLowerCase()) &&
    !isOtherCustomValue(powerSourceType)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid powerSourceType",
    });
  }

  next();
};

const validatePlantStatusPayload = (req, res, next) => {
  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be provided as true or false",
    });
  }

  next();
};

module.exports = {
  validateCreatePlantInput: validatePlantPayload,
  validateUpdatePlantInput: validatePlantPayload,
  validatePlantStatusPayload,
};
