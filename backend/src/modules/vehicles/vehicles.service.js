const {
  findAllVehicles,
  findVehiclesPage,
  findVehicleLookup,
  insertVehicle,
  editVehicle,
  setVehicleStatus,
  findAllEquipmentLogs,
  findEquipmentLogById,
  findEquipmentLogChain,
  findLatestEquipmentLog,
  insertEquipmentLog,
  removeEquipmentLog,
  updateEquipmentLog,
  plantExists,
} = require("./vehicles.model");
const { withTransaction } = require("../../config/db");
const {
  getCached,
  invalidateCacheByPrefix,
  buildCompanyScopedCachePrefix,
} = require("../../utils/simpleCache.util");

const allowedOwnershipTypes = ["company", "attached_private", "transporter"];
const allowedVehicleStatuses = ["active", "in_use", "inactive", "maintenance"];
const allowedMeterUnits = ["hours", "km"];

const roundToTwo = (value) => Math.round(Number(value) * 100) / 100;
const normalizeText = (value) => String(value || "").trim();

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

const normalizeMeterUnit = (meterUnit) => {
  const normalized = String(meterUnit || "hours")
    .trim()
    .toLowerCase();

  if (!allowedMeterUnits.includes(normalized)) {
    const error = new Error("meterUnit must be either hours or km");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

const ensureValidEquipmentDatePosition = ({
  usageDate,
  previousLog = null,
  nextLog = null,
}) => {
  if (previousLog && usageDate < previousLog.usageDate) {
    const error = new Error(
      `Usage date cannot be earlier than the previous entry dated ${previousLog.usageDate}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (nextLog && usageDate > nextLog.usageDate) {
    const error = new Error(
      `Usage date cannot be later than the next entry dated ${nextLog.usageDate}`
    );
    error.statusCode = 400;
    throw error;
  }
};

const buildEquipmentLogPayload = ({
  log,
  openingMeterReading,
  closingMeterReading,
  meterUnit,
}) => {
  const roundedOpening = roundToTwo(openingMeterReading);
  const roundedClosing = roundToTwo(closingMeterReading);

  if (roundedClosing < roundedOpening) {
    const error = new Error(
      `Equipment log dated ${log.usageDate} has closing meter below the required opening continuity`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    logId: Number(log.id),
    usageDate: log.usageDate,
    siteName: String(log.siteName || "").trim(),
    usageHours: roundToTwo(roundedClosing - roundedOpening),
    fuelUsed: roundToTwo(Number(log.fuelUsed || 0)),
    openingMeterReading: roundedOpening,
    closingMeterReading: roundedClosing,
    meterUnit,
    manualVehicleNumber: normalizeText(log.manualVehicleNumber) || null,
    driverOperatorName: normalizeText(log.driverOperatorName) || null,
    remarks: normalizeText(log.remarks) || null,
    plantId: log.plantId ? Number(log.plantId) : null,
  };
};

const rebalanceEquipmentChain = async ({
  db,
  chainLogs,
  companyId,
  meterUnit,
  startIndex,
}) => {
  const normalizedMeterUnit = normalizeMeterUnit(meterUnit);
  const targetStart = Math.max(0, startIndex);
  const nextChain = chainLogs.map((log) => ({ ...log, meterUnit: normalizedMeterUnit }));

  for (let index = targetStart; index < nextChain.length; index += 1) {
    const currentLog = nextChain[index];
    const previousLog = index > 0 ? nextChain[index - 1] : null;
    const resolvedOpening = previousLog
      ? roundToTwo(previousLog.closingMeterReading)
      : roundToTwo(currentLog.openingMeterReading);

    if (resolvedOpening === null || resolvedOpening === undefined) {
      const error = new Error(
        `Opening meter reading is required for the first equipment log dated ${currentLog.usageDate}`
      );
      error.statusCode = 400;
      throw error;
    }

    const updatedLog = await updateEquipmentLog({
      ...buildEquipmentLogPayload({
        log: currentLog,
        openingMeterReading: resolvedOpening,
        closingMeterReading: currentLog.closingMeterReading,
        meterUnit: normalizedMeterUnit,
      }),
      companyId,
      db,
    });

    nextChain[index] = updatedLog;
  }

  if (targetStart > 0) {
    for (let index = 0; index < targetStart; index += 1) {
      if (nextChain[index].meterUnit !== normalizedMeterUnit) {
        const updatedLog = await updateEquipmentLog({
          ...buildEquipmentLogPayload({
            log: nextChain[index],
            openingMeterReading: nextChain[index].openingMeterReading,
            closingMeterReading: nextChain[index].closingMeterReading,
            meterUnit: normalizedMeterUnit,
          }),
          companyId,
          db,
        });
        nextChain[index] = updatedLog;
      }
    }
  }

  return nextChain;
};

const getVehiclesList = async (companyId = null) => {
  return await findAllVehicles(companyId);
};

const getVehiclesPage = async ({ companyId = null, page = 1, limit = 25, search = "" } = {}) =>
  findVehiclesPage({ companyId, page, limit, search });

const getVehicleLookupList = async (companyId = null) =>
  getCached(
    `${buildCompanyScopedCachePrefix("vehicles-lookup", companyId)}active`,
    60_000,
    () => findVehicleLookup(companyId)
  );

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

  const created = await insertVehicle({
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
  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("vehicles-lookup", companyId));
  return created;
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

  const updated = await editVehicle({
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
  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("vehicles-lookup", companyId));
  return updated;
};

const updateVehicleStatusRecord = async ({ vehicleId, status, companyId }) => {
  validateVehicleStatus(status);

  const updated = await setVehicleStatus({
    vehicleId: Number(vehicleId),
    status,
    companyId,
  });
  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("vehicles-lookup", companyId));
  return updated;
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
      suggestedMeterUnit: "hours",
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
    suggestedMeterUnit: latestLog?.meterUnit || "hours",
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
  meterUnit,
  manualVehicleNumber,
  driverOperatorName,
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
  const resolvedMeterUnit = latestLog?.meterUnit || normalizeMeterUnit(meterUnit);

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
    meterUnit: resolvedMeterUnit,
    manualVehicleNumber: normalizeText(manualVehicleNumber) || null,
    driverOperatorName: normalizeText(driverOperatorName) || null,
    remarks,
    createdBy,
    plantId: equipmentIdentity.plantId,
    companyId,
  });
};

const updateEquipmentLogRecord = async ({
  logId,
  usageDate,
  equipmentName,
  equipmentType,
  siteName,
  openingMeterReading,
  closingMeterReading,
  fuelUsed,
  meterUnit,
  manualVehicleNumber,
  driverOperatorName,
  remarks,
  plantId,
  companyId,
}) => {
  await validatePlantIfPresent(plantId, companyId);

  return withTransaction(async (db) => {
    const existingLog = await findEquipmentLogById({
      logId: Number(logId),
      companyId,
      db,
    });

    if (!existingLog) {
      const error = new Error("Equipment log not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      String(equipmentName || "").trim().toLowerCase() !==
        String(existingLog.equipmentName || "").trim().toLowerCase() ||
      String(equipmentType || "").trim().toLowerCase() !==
        String(existingLog.equipmentType || "").trim().toLowerCase()
    ) {
      const error = new Error(
        "Equipment name and type cannot be changed after the log is created"
      );
      error.statusCode = 400;
      throw error;
    }

    if (Number(existingLog.plantId || 0) !== Number(plantId || 0)) {
      const error = new Error(
        "Equipment log plant cannot be changed once meter history has started"
      );
      error.statusCode = 400;
      throw error;
    }

    if (!siteName || !String(siteName).trim()) {
      const error = new Error("siteName is required");
      error.statusCode = 400;
      throw error;
    }

    const normalizedFuelUsed = normalizeNumber(fuelUsed);
    const normalizedOpening = normalizeNumber(openingMeterReading, {
      allowBlank: true,
    });
    const normalizedClosing = normalizeNumber(closingMeterReading);

    if (Number.isNaN(normalizedFuelUsed) || normalizedFuelUsed < 0) {
      const error = new Error(
        "fuelUsed must be a valid number greater than or equal to 0"
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      normalizedOpening !== null &&
      (Number.isNaN(normalizedOpening) || normalizedOpening < 0)
    ) {
      const error = new Error(
        "openingMeterReading must be a valid number greater than or equal to 0"
      );
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

    const chainLogs = await findEquipmentLogChain({
      equipmentName: existingLog.equipmentName,
      equipmentType: existingLog.equipmentType,
      plantId: existingLog.plantId,
      companyId,
      db,
    });
    const currentIndex = chainLogs.findIndex(
      (log) => Number(log.id) === Number(existingLog.id)
    );

    if (currentIndex === -1) {
      const error = new Error("Equipment log not found");
      error.statusCode = 404;
      throw error;
    }

    const previousLog = currentIndex > 0 ? chainLogs[currentIndex - 1] : null;
    const nextLog =
      currentIndex < chainLogs.length - 1 ? chainLogs[currentIndex + 1] : null;

    ensureValidEquipmentDatePosition({
      usageDate,
      previousLog,
      nextLog,
    });

    const resolvedOpening = previousLog
      ? roundToTwo(previousLog.closingMeterReading)
      : normalizedOpening;

    if (resolvedOpening === null || resolvedOpening === undefined) {
      const error = new Error(
        "openingMeterReading is required for the first equipment log"
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

    const normalizedMeterUnit = normalizeMeterUnit(
      meterUnit || existingLog.meterUnit
    );

    const draftChain = chainLogs.map((log) => ({ ...log }));
    draftChain[currentIndex] = {
      ...draftChain[currentIndex],
      usageDate,
      siteName: String(siteName).trim(),
      fuelUsed: roundToTwo(normalizedFuelUsed),
      openingMeterReading: roundToTwo(resolvedOpening),
      closingMeterReading: roundToTwo(normalizedClosing),
      meterUnit: normalizedMeterUnit,
      manualVehicleNumber: normalizeText(manualVehicleNumber) || null,
      driverOperatorName: normalizeText(driverOperatorName) || null,
      remarks: normalizeText(remarks) || null,
    };

    const startIndex = normalizedMeterUnit !== (existingLog.meterUnit || "hours")
      ? 0
      : currentIndex;

    const rebalancedChain = await rebalanceEquipmentChain({
      db,
      chainLogs: draftChain,
      companyId,
      meterUnit: normalizedMeterUnit,
      startIndex,
    });

    return (
      rebalancedChain.find((log) => Number(log.id) === Number(existingLog.id)) ||
      null
    );
  });
};

const deleteEquipmentLogRecord = async ({ logId, companyId }) => {
  return withTransaction(async (db) => {
    const existingLog = await findEquipmentLogById({
      logId: Number(logId),
      companyId,
      db,
    });

    if (!existingLog) {
      const error = new Error("Equipment log not found");
      error.statusCode = 404;
      throw error;
    }

    const chainLogs = await findEquipmentLogChain({
      equipmentName: existingLog.equipmentName,
      equipmentType: existingLog.equipmentType,
      plantId: existingLog.plantId,
      companyId,
      db,
    });
    const currentIndex = chainLogs.findIndex(
      (log) => Number(log.id) === Number(existingLog.id)
    );

    const deleted = await removeEquipmentLog({
      logId: Number(logId),
      companyId,
      db,
    });

    if (!deleted) {
      const error = new Error("Equipment log not found");
      error.statusCode = 404;
      throw error;
    }

    const remainingChain = chainLogs.filter(
      (log) => Number(log.id) !== Number(existingLog.id)
    );

    if (remainingChain.length > 0) {
      const startIndex = currentIndex === 0 ? 0 : currentIndex;
      await rebalanceEquipmentChain({
        db,
        chainLogs: remainingChain,
        companyId,
        meterUnit: remainingChain[0]?.meterUnit || existingLog.meterUnit || "hours",
        startIndex,
      });
    }

    return { id: Number(logId) };
  });
};

module.exports = {
  getVehiclesList,
  getVehiclesPage,
  getVehicleLookupList,
  createVehicleRecord,
  updateVehicleRecord,
  updateVehicleStatusRecord,
  getEquipmentLogsList,
  getEquipmentLogContext,
  createEquipmentLogRecord,
  updateEquipmentLogRecord,
  deleteEquipmentLogRecord,
};
