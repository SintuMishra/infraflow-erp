const allowedOwnershipTypes = ["company", "attached_private", "transporter"];
const allowedStatuses = ["active", "in_use", "inactive", "maintenance"];

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const isInvalidNonNegativeNumber = (value, { required = false } = {}) => {
  if (isBlank(value)) {
    return required;
  }

  return Number.isNaN(Number(value)) || Number(value) < 0;
};

const validateVehiclePayload = (req, res, next) => {
  const {
    vehicleNumber,
    vehicleType,
    ownershipType,
    vendorId,
    status,
    plantId,
    vehicleCapacityTons,
  } = req.body;

  if (!vehicleNumber || !vehicleType) {
    return res.status(400).json({
      success: false,
      message: "vehicleNumber and vehicleType are required",
    });
  }

  if (ownershipType && !allowedOwnershipTypes.includes(ownershipType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ownership type",
    });
  }

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid vehicle status",
    });
  }

  if (
    (ownershipType === "attached_private" || ownershipType === "transporter") &&
    !vendorId
  ) {
    return res.status(400).json({
      success: false,
      message: "vendorId is required for attached/private or transporter vehicles",
    });
  }

  if (!plantId) {
    return res.status(400).json({
      success: false,
      message: "plantId is required",
    });
  }

  if (Number.isNaN(Number(plantId)) || Number(plantId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a valid positive number",
    });
  }

  if (
    vehicleCapacityTons !== undefined &&
    vehicleCapacityTons !== null &&
    vehicleCapacityTons !== "" &&
    (Number.isNaN(Number(vehicleCapacityTons)) || Number(vehicleCapacityTons) <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "vehicleCapacityTons must be a valid number greater than 0",
    });
  }

  next();
};

const validateCreateVehicleInput = validateVehiclePayload;
const validateUpdateVehicleInput = validateVehiclePayload;

const validateVehicleStatusUpdate = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid vehicle status",
    });
  }

  next();
};

const validateEquipmentLogContextInput = (req, res, next) => {
  const { equipmentName, equipmentType, plantId } = req.query;

  if (isBlank(equipmentName) || isBlank(equipmentType) || isBlank(plantId)) {
    return res.status(400).json({
      success: false,
      message: "equipmentName, equipmentType, and plantId are required",
    });
  }

  if (Number.isNaN(Number(plantId)) || Number(plantId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a valid positive number",
    });
  }

  next();
};

const validateCreateEquipmentLogInput = (req, res, next) => {
  const {
    usageDate,
    equipmentName,
    equipmentType,
    siteName,
    openingMeterReading,
    closingMeterReading,
    fuelUsed,
    plantId,
  } = req.body;

  if (!usageDate || !equipmentName || !equipmentType || !siteName) {
    return res.status(400).json({
      success: false,
      message: "usageDate, equipmentName, equipmentType, and siteName are required",
    });
  }

  if (!plantId) {
    return res.status(400).json({
      success: false,
      message: "plantId is required",
    });
  }

  if (Number.isNaN(Number(plantId)) || Number(plantId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a valid positive number",
    });
  }

  if (isInvalidNonNegativeNumber(closingMeterReading, { required: true })) {
    return res.status(400).json({
      success: false,
      message:
        "closingMeterReading must be a valid number greater than or equal to 0",
    });
  }

  if (isInvalidNonNegativeNumber(openingMeterReading, { required: false })) {
    return res.status(400).json({
      success: false,
      message:
        "openingMeterReading must be a valid number greater than or equal to 0",
    });
  }

  if (isInvalidNonNegativeNumber(fuelUsed, { required: true })) {
    return res.status(400).json({
      success: false,
      message: "fuelUsed must be a valid number greater than or equal to 0",
    });
  }

  next();
};

module.exports = {
  validateCreateVehicleInput,
  validateUpdateVehicleInput,
  validateVehicleStatusUpdate,
  validateEquipmentLogContextInput,
  validateCreateEquipmentLogInput,
};
