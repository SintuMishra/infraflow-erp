const {
  findAllVehicles,
  insertVehicle,
  editVehicle,
  setVehicleStatus,
  findAllEquipmentLogs,
  findLatestEquipmentLog,
  insertEquipmentLog,
  plantExists,
} = require("./vehicles.model");

const allowedOwnershipTypes = ["company", "attached_private", "transporter"];
const allowedVehicleStatuses = ["active", "in_use", "inactive", "maintenance"];

const roundToTwo = (value) => Math.round(Number(value) * 100) / 100;

const normalizeNumber = (value, { allowBlank = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    return allowBlank ? null : Number.NaN;
  }

  return Number(value);
};

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
    const error = new Error(
      "vehicleCapacityTons must be a valid number greater than 0"
    );
    error.statusCode = 400;
    throw error;
  }
};

const buildEquipmentIdentity = ({ equipmentName, equipmentType, plantId }) => ({
  equipmentName: String(equipmentName || "").trim(),
  equipmentType: String(equipmentType || "").trim(),
  plantId: plantId ? Number(plantId) : null,
});

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
      vehicleCapacityTons === "" ||
      vehicleCapacityTons === undefined ||
      vehicleCapacityTons === null
        ? null
        : Number(vehicleCapacityTons),
    companyId,
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
      vehicleCapacityTons === "" ||
      vehicleCapacityTons === undefined ||
      vehicleCapacityTons === null
        ? null
        : Number(vehicleCapacityTons),
    companyId,
  });
};

const updateVehicleStatusRecord = async ({ vehicleId, status, companyId }) => {
  validateVehicleStatus(status);

  return await setVehicleStatus({
    vehicleId: Number(vehicleId),
    status,
    companyId,
  });
};

const getEquipmentLogsList = async (companyId = null) => {
  return await findAllEquipmentLogs(companyId);
};

const getEquipmentLogContext = async ({
  equipmentName,
  equipmentType,
  plantId,
  companyId,
}) => {
  if (!equipmentName || !equipmentType || !plantId) {
    return {
      latestLog: null,
      suggestedOpeningMeterReading: null,
      isFirstLog: true,
    };
  }

  const equipmentIdentity = buildEquipmentIdentity({
    equipmentName,
    equipmentType,
    plantId,
  });

  const latestLog = await findLatestEquipmentLog({
    ...equipmentIdentity,
    companyId,
  });

  return {
    latestLog,
    suggestedOpeningMeterReading: latestLog?.closingMeterReading ?? null,
    isFirstLog: !latestLog,
  };
};

const createEquipmentLogRecord = async ({
  usageDate,
  equipmentName,
  equipmentType,
  siteName,
  openingMeterReading,
  closingMeterReading,
  fuelUsed,
  remarks,
  createdBy,
  plantId,
  companyId,
}) => {
  await validatePlantIfPresent(plantId, companyId);

  const normalizedFuelUsed = normalizeNumber(fuelUsed);
  const normalizedOpening = normalizeNumber(openingMeterReading, {
    allowBlank: true,
  });
  const normalizedClosing = normalizeNumber(closingMeterReading);

  if (!siteName || !String(siteName).trim()) {
    const error = new Error("siteName is required");
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(normalizedFuelUsed) || normalizedFuelUsed < 0) {
    const error = new Error("fuelUsed must be a valid number greater than or equal to 0");
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(normalizedClosing) || normalizedClosing < 0) {
    const error = new Error(
      "closingMeterReading must be a valid number greater than or equal to 0"
    );
    error.statusCode = 400;
    throw error;
  }

  const equipmentIdentity = buildEquipmentIdentity({
    equipmentName,
    equipmentType,
    plantId,
  });
  const latestLog = await findLatestEquipmentLog({
    ...equipmentIdentity,
    companyId,
  });

  if (latestLog && usageDate < latestLog.usageDate) {
    const error = new Error(
      `Backdated logs are not allowed after the latest entry dated ${latestLog.usageDate}`
    );
    error.statusCode = 400;
    throw error;
  }

  const resolvedOpening =
    latestLog?.closingMeterReading !== null && latestLog?.closingMeterReading !== undefined
      ? latestLog.closingMeterReading
      : normalizedOpening;

  if (resolvedOpening === null || resolvedOpening === undefined) {
    const error = new Error(
      "openingMeterReading is required for the first equipment log"
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedOpening !== null &&
    latestLog &&
    roundToTwo(normalizedOpening) !== roundToTwo(latestLog.closingMeterReading)
  ) {
    const error = new Error(
      `Opening meter reading must match the last closing meter reading (${latestLog.closingMeterReading})`
    );
    error.statusCode = 400;
    throw error;
  }

  if (normalizedClosing < resolvedOpening) {
    const error = new Error(
      "closingMeterReading must be greater than or equal to openingMeterReading"
    );
    error.statusCode = 400;
    throw error;
  }

  const usageHours = roundToTwo(normalizedClosing - resolvedOpening);

  return await insertEquipmentLog({
    usageDate,
    equipmentName: equipmentIdentity.equipmentName,
    equipmentType: equipmentIdentity.equipmentType,
    siteName: String(siteName).trim(),
    usageHours,
    fuelUsed: roundToTwo(normalizedFuelUsed),
    openingMeterReading: roundToTwo(resolvedOpening),
    closingMeterReading: roundToTwo(normalizedClosing),
    remarks,
    createdBy,
    plantId: equipmentIdentity.plantId,
    companyId,
  });
};

module.exports = {
  getVehiclesList,
  createVehicleRecord,
  updateVehicleRecord,
  updateVehicleStatusRecord,
  getEquipmentLogsList,
  getEquipmentLogContext,
  createEquipmentLogRecord,
};
