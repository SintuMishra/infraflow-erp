const {
  findAllVehicles,
  insertVehicle,
  editVehicle,
  setVehicleStatus,
  findAllEquipmentLogs,
  insertEquipmentLog,
  plantExists,
} = require("./vehicles.model");

const allowedOwnershipTypes = ["company", "attached_private", "transporter"];
const allowedVehicleStatuses = ["active", "in_use", "inactive", "maintenance"];

const validatePlantIfPresent = async (plantId, companyId = null) => {
  if (plantId) {
    const exists = await plantExists(Number(plantId), companyId);
    if (!exists) {
      const error = new Error("Selected plant does not exist");
      error.statusCode = 400;
      throw error;
    }
  }
};

const validateOwnershipType = (ownershipType) => {
  if (ownershipType && !allowedOwnershipTypes.includes(ownershipType)) {
    const error = new Error("Invalid ownership type");
    error.statusCode = 400;
    throw error;
  }
};

const validateVehicleStatus = (status) => {
  if (status && !allowedVehicleStatuses.includes(status)) {
    const error = new Error("Invalid vehicle status");
    error.statusCode = 400;
    throw error;
  }
};

const validateVendorRequirement = ({ ownershipType, vendorId }) => {
  if (
    (ownershipType === "attached_private" || ownershipType === "transporter") &&
    !vendorId
  ) {
    const error = new Error(
      "vendorId is required for attached/private or transporter vehicles"
    );
    error.statusCode = 400;
    throw error;
  }
};

const validateVehicleCapacity = (vehicleCapacityTons) => {
  if (
    vehicleCapacityTons !== undefined &&
    vehicleCapacityTons !== null &&
    vehicleCapacityTons !== "" &&
    (Number.isNaN(Number(vehicleCapacityTons)) || Number(vehicleCapacityTons) <= 0)
  ) {
    const error = new Error("vehicleCapacityTons must be a valid number greater than 0");
    error.statusCode = 400;
    throw error;
  }
};

const getVehiclesList = async (companyId = null) => {
  return await findAllVehicles(companyId);
};

const createVehicleRecord = async ({
  vehicleNumber,
  vehicleType,
  assignedDriver,
  status,
  ownershipType,
  vendorId,
  plantId,
  vehicleCapacityTons,
  companyId,
}) => {
  await validatePlantIfPresent(plantId, companyId);
  validateOwnershipType(ownershipType);
  validateVehicleStatus(status);
  validateVendorRequirement({ ownershipType, vendorId });
  validateVehicleCapacity(vehicleCapacityTons);

  return await insertVehicle({
    vehicleNumber,
    vehicleType,
    assignedDriver,
    status,
    ownershipType,
    vendorId,
    plantId: plantId ? Number(plantId) : null,
    vehicleCapacityTons:
      vehicleCapacityTons === "" || vehicleCapacityTons === undefined || vehicleCapacityTons === null
        ? null
        : Number(vehicleCapacityTons),
    companyId: companyId || null,
  });
};

const updateVehicleRecord = async ({
  vehicleId,
  vehicleNumber,
  vehicleType,
  assignedDriver,
  status,
  ownershipType,
  vendorId,
  plantId,
  vehicleCapacityTons,
  companyId,
}) => {
  await validatePlantIfPresent(plantId, companyId);
  validateOwnershipType(ownershipType);
  validateVehicleStatus(status);
  validateVendorRequirement({ ownershipType, vendorId });
  validateVehicleCapacity(vehicleCapacityTons);

  return await editVehicle({
    vehicleId: Number(vehicleId),
    vehicleNumber,
    vehicleType,
    assignedDriver,
    status,
    ownershipType,
    vendorId,
    plantId: plantId ? Number(plantId) : null,
    vehicleCapacityTons:
      vehicleCapacityTons === "" || vehicleCapacityTons === undefined || vehicleCapacityTons === null
        ? null
        : Number(vehicleCapacityTons),
    companyId: companyId || null,
  });
};

const updateVehicleStatusRecord = async ({ vehicleId, status, companyId }) => {
  validateVehicleStatus(status);

  return await setVehicleStatus({
    vehicleId: Number(vehicleId),
    status,
    companyId: companyId || null,
  });
};

const getEquipmentLogsList = async (companyId = null) => {
  return await findAllEquipmentLogs(companyId);
};

const createEquipmentLogRecord = async ({
  usageDate,
  equipmentName,
  equipmentType,
  siteName,
  usageHours,
  fuelUsed,
  remarks,
  createdBy,
  plantId,
  companyId,
}) => {
  await validatePlantIfPresent(plantId, companyId);

  return await insertEquipmentLog({
    usageDate,
    equipmentName,
    equipmentType,
    siteName,
    usageHours,
    fuelUsed,
    remarks,
    createdBy,
    plantId: plantId ? Number(plantId) : null,
    companyId: companyId || null,
  });
};

module.exports = {
  getVehiclesList,
  createVehicleRecord,
  updateVehicleRecord,
  updateVehicleStatusRecord,
  getEquipmentLogsList,
  createEquipmentLogRecord,
};
