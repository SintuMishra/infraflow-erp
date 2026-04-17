const allowedOwnershipTypes = ["company", "attached_private", "transporter"];
const allowedStatuses = ["active", "in_use", "inactive", "maintenance"];

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

const validateCreateEquipmentLogInput = (req, res, next) => {
  const {
    usageDate,
    equipmentName,
    equipmentType,
    usageHours,
    fuelUsed,
    plantId,
  } = req.body;

  if (
    !usageDate ||
    !equipmentName ||
    !equipmentType ||
    usageHours === undefined ||
    fuelUsed === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "usageDate, equipmentName, equipmentType, usageHours, and fuelUsed are required",
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

  next();
};

module.exports = {
  validateCreateVehicleInput,
  validateUpdateVehicleInput,
  validateVehicleStatusUpdate,
  validateCreateEquipmentLogInput,
};