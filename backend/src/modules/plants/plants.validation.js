const allowedPlantTypes = [
  "Crusher",
  "Batching",
  "RMC",
  "HotMix",
  "Asphalt",
  "Other",
];
const allowedPowerSourceTypes = ["diesel", "electric", "hybrid", "other"];

const isBlank = (value) => String(value || "").trim() === "";

const validatePlantPayload = (req, res, next) => {
  const { plantName, plantType, powerSourceType } = req.body || {};

  if (isBlank(plantName) || isBlank(plantType)) {
    return res.status(400).json({
      success: false,
      message: "plantName and plantType are required",
    });
  }

  if (!allowedPlantTypes.includes(String(plantType).trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid plantType",
    });
  }

  if (
    powerSourceType !== undefined &&
    powerSourceType !== null &&
    powerSourceType !== "" &&
    !allowedPowerSourceTypes.includes(String(powerSourceType).trim().toLowerCase())
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
