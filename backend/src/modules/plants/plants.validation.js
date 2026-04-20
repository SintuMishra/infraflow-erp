const allowedPowerSourceTypes = ["diesel", "electric", "electricity", "hybrid", "other"];
const isOtherCustomValue = (value) => /^other\s*:\s*\S+/i.test(String(value || "").trim());
const hasOtherPrefix = (value) => /^other\s*:/i.test(String(value || "").trim());
const isOtherPlaceholder = (value) => String(value || "").trim().toLowerCase() === "__other__";
const isTooLong = (value, maxLength = 120) => String(value || "").trim().length > maxLength;

const isBlank = (value) => String(value || "").trim() === "";

const validatePlantPayload = (req, res, next) => {
  const { plantName, plantType, powerSourceType } = req.body || {};

  if (isBlank(plantName) || isBlank(plantType)) {
    return res.status(400).json({
      success: false,
      message: "plantName and plantType are required",
    });
  }

  if (isOtherPlaceholder(plantType)) {
    return res.status(400).json({
      success: false,
      message: "Please select or enter a valid plantType",
    });
  }

  if (isTooLong(plantType)) {
    return res.status(400).json({
      success: false,
      message: "plantType is too long",
    });
  }

  if (hasOtherPrefix(plantType) && !isOtherCustomValue(plantType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid plantType",
    });
  }

  if (
    powerSourceType !== undefined &&
    powerSourceType !== null &&
    powerSourceType !== ""
  ) {
    if (isOtherPlaceholder(powerSourceType)) {
      return res.status(400).json({
        success: false,
        message: "Please select or enter a valid powerSourceType",
      });
    }

    if (isTooLong(powerSourceType)) {
      return res.status(400).json({
        success: false,
        message: "powerSourceType is too long",
      });
    }

    const normalizedPowerSourceType = String(powerSourceType).trim().toLowerCase();
    const isValidKnownPowerType = allowedPowerSourceTypes.includes(normalizedPowerSourceType);
    const isValidCustomPowerType =
      isOtherCustomValue(powerSourceType) || /^[a-z0-9][a-z0-9 /_-]{1,119}$/i.test(normalizedPowerSourceType);

    if (!isValidKnownPowerType && !isValidCustomPowerType) {
      return res.status(400).json({
        success: false,
        message: "Invalid powerSourceType",
      });
    }
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
