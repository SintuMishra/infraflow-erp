const {
  findAllTransportRates,
  insertTransportRate,
  updateTransportRate,
  updateTransportRateStatus,
  plantExists,
  vendorExists,
  materialExists,
} = require("./transport_rates.model");

const allowedRateTypes = ["per_trip", "per_ton", "per_km", "per_day"];

const validateRateType = (rateType) => {
  if (!allowedRateTypes.includes(rateType)) {
    const error = new Error("Invalid rate type");
    error.statusCode = 400;
    throw error;
  }
};

const validatePositiveRateValue = (rateValue) => {
  if (
    rateValue === undefined ||
    rateValue === null ||
    rateValue === "" ||
    Number.isNaN(Number(rateValue)) ||
    Number(rateValue) <= 0
  ) {
    const error = new Error("rateValue must be greater than 0");
    error.statusCode = 400;
    throw error;
  }
};

const validateDistanceIfNeeded = (rateType, distanceKm) => {
  if (rateType === "per_km") {
    if (
      distanceKm === undefined ||
      distanceKm === null ||
      distanceKm === "" ||
      Number.isNaN(Number(distanceKm)) ||
      Number(distanceKm) <= 0
    ) {
      const error = new Error("distanceKm is required for per_km rate type");
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    distanceKm !== undefined &&
    distanceKm !== null &&
    distanceKm !== "" &&
    (Number.isNaN(Number(distanceKm)) || Number(distanceKm) < 0)
  ) {
    const error = new Error("distanceKm must be 0 or more");
    error.statusCode = 400;
    throw error;
  }
};

const validateLinkedRecords = async ({
  plantId,
  vendorId,
  materialId,
  companyId,
}) => {
  const [plantOk, vendorOk, materialOk] = await Promise.all([
    plantExists(Number(plantId), companyId),
    vendorExists(Number(vendorId), companyId),
    materialExists(Number(materialId), companyId),
  ]);

  if (!plantOk) {
    const error = new Error("Selected plant does not exist");
    error.statusCode = 400;
    throw error;
  }

  if (!vendorOk) {
    const error = new Error("Selected vendor does not exist");
    error.statusCode = 400;
    throw error;
  }

  if (!materialOk) {
    const error = new Error("Selected material does not exist");
    error.statusCode = 400;
    throw error;
  }
};

const getTransportRatesList = async (companyId = null) => {
  return await findAllTransportRates(companyId);
};

const createTransportRateRecord = async ({
  plantId,
  vendorId,
  materialId,
  rateType,
  rateValue,
  distanceKm,
  companyId,
}) => {
  if (!plantId || !vendorId || !materialId) {
    const error = new Error("plantId, vendorId, and materialId are required");
    error.statusCode = 400;
    throw error;
  }

  validateRateType(rateType);
  validatePositiveRateValue(rateValue);
  validateDistanceIfNeeded(rateType, distanceKm);
  await validateLinkedRecords({ plantId, vendorId, materialId, companyId });

  return await insertTransportRate({
    plantId: Number(plantId),
    vendorId: Number(vendorId),
    materialId: Number(materialId),
    rateType,
    rateValue: Number(rateValue),
    distanceKm:
      distanceKm === undefined || distanceKm === null || distanceKm === ""
        ? null
        : Number(distanceKm),
    companyId: companyId || null,
  });
};

const updateTransportRateRecord = async ({
  rateId,
  plantId,
  vendorId,
  materialId,
  rateType,
  rateValue,
  distanceKm,
  companyId,
}) => {
  if (!plantId || !vendorId || !materialId) {
    const error = new Error("plantId, vendorId, and materialId are required");
    error.statusCode = 400;
    throw error;
  }

  validateRateType(rateType);
  validatePositiveRateValue(rateValue);
  validateDistanceIfNeeded(rateType, distanceKm);
  await validateLinkedRecords({ plantId, vendorId, materialId, companyId });

  return await updateTransportRate({
    rateId: Number(rateId),
    plantId: Number(plantId),
    vendorId: Number(vendorId),
    materialId: Number(materialId),
    rateType,
    rateValue: Number(rateValue),
    distanceKm:
      distanceKm === undefined || distanceKm === null || distanceKm === ""
        ? null
        : Number(distanceKm),
    companyId: companyId || null,
  });
};

const changeTransportRateStatusRecord = async ({ rateId, isActive, companyId }) => {
  return await updateTransportRateStatus({
    rateId: Number(rateId),
    isActive: Boolean(isActive),
    companyId: companyId || null,
  });
};

module.exports = {
  getTransportRatesList,
  createTransportRateRecord,
  updateTransportRateRecord,
  changeTransportRateStatusRecord,
};
