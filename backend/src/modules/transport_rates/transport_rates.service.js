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
const allowedBillingBases = [...allowedRateTypes, "per_unit"];

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateRateType = (rateType) => {
  if (!allowedRateTypes.includes(rateType)) {
    throw buildValidationError("Invalid rate type");
  }
};

const validateBillingBasis = (billingBasis) => {
  if (!allowedBillingBases.includes(billingBasis)) {
    throw buildValidationError("Invalid billingBasis");
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
    throw buildValidationError("rateValue must be greater than 0");
  }
};

const validateDistanceIfNeeded = (billingBasis, distanceKm) => {
  if (billingBasis === "per_km") {
    if (
      distanceKm === undefined ||
      distanceKm === null ||
      distanceKm === "" ||
      Number.isNaN(Number(distanceKm)) ||
      Number(distanceKm) <= 0
    ) {
      throw buildValidationError("distanceKm is required for per_km billing basis");
    }
  }

  if (
    distanceKm !== undefined &&
    distanceKm !== null &&
    distanceKm !== "" &&
    (Number.isNaN(Number(distanceKm)) || Number(distanceKm) < 0)
  ) {
    throw buildValidationError("distanceKm must be 0 or more");
  }
};

const validateRateUnitIfNeeded = (billingBasis, rateUnitId) => {
  if (billingBasis !== "per_unit") {
    return;
  }

  if (
    rateUnitId === undefined ||
    rateUnitId === null ||
    rateUnitId === "" ||
    Number.isNaN(Number(rateUnitId)) ||
    Number(rateUnitId) <= 0
  ) {
    throw buildValidationError("rateUnitId is required for per_unit billing basis");
  }
};

const validateMinimumCharge = (minimumCharge) => {
  if (
    minimumCharge !== undefined &&
    minimumCharge !== null &&
    minimumCharge !== "" &&
    (Number.isNaN(Number(minimumCharge)) || Number(minimumCharge) < 0)
  ) {
    throw buildValidationError("minimumCharge must be 0 or more");
  }
};

const normalizeTransportRatePayload = (data = {}) => {
  const billingBasis = String(data.billingBasis || data.rateType || "").trim();
  const normalizedLegacyRateType =
    billingBasis === "per_unit" ? "per_ton" : billingBasis;
  const rateType = String(data.rateType || normalizedLegacyRateType || "").trim();

  return {
    plantId: data.plantId,
    vendorId: data.vendorId,
    materialId: data.materialId,
    billingBasis,
    rateType,
    rateValue:
      data.rateValue === undefined || data.rateValue === null || data.rateValue === ""
        ? null
        : Number(data.rateValue),
    distanceKm:
      data.distanceKm === undefined || data.distanceKm === null || data.distanceKm === ""
        ? null
        : Number(data.distanceKm),
    rateUnitId:
      data.rateUnitId === undefined || data.rateUnitId === null || data.rateUnitId === ""
        ? null
        : Number(data.rateUnitId),
    minimumCharge:
      data.minimumCharge === undefined || data.minimumCharge === null || data.minimumCharge === ""
        ? null
        : Number(data.minimumCharge),
    companyId: data.companyId || null,
  };
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
  ...payload
}) => {
  const {
    plantId,
    vendorId,
    materialId,
    billingBasis,
    rateType,
    rateValue,
    distanceKm,
    rateUnitId,
    minimumCharge,
    companyId,
  } = normalizeTransportRatePayload(payload);

  if (!plantId || !vendorId || !materialId) {
    throw buildValidationError("plantId, vendorId, and materialId are required");
  }

  validateBillingBasis(billingBasis);
  validateRateType(rateType);
  validatePositiveRateValue(rateValue);
  validateDistanceIfNeeded(billingBasis, distanceKm);
  validateRateUnitIfNeeded(billingBasis, rateUnitId);
  validateMinimumCharge(minimumCharge);
  await validateLinkedRecords({ plantId, vendorId, materialId, companyId });

  return await insertTransportRate({
    plantId: Number(plantId),
    vendorId: Number(vendorId),
    materialId: Number(materialId),
    rateType,
    billingBasis,
    rateValue: Number(rateValue),
    distanceKm,
    rateUnitId,
    minimumCharge,
    companyId: companyId || null,
  });
};

const updateTransportRateRecord = async ({
  rateId,
  ...payload
}) => {
  const {
    plantId,
    vendorId,
    materialId,
    billingBasis,
    rateType,
    rateValue,
    distanceKm,
    rateUnitId,
    minimumCharge,
    companyId,
  } = normalizeTransportRatePayload(payload);

  if (!plantId || !vendorId || !materialId) {
    throw buildValidationError("plantId, vendorId, and materialId are required");
  }

  validateBillingBasis(billingBasis);
  validateRateType(rateType);
  validatePositiveRateValue(rateValue);
  validateDistanceIfNeeded(billingBasis, distanceKm);
  validateRateUnitIfNeeded(billingBasis, rateUnitId);
  validateMinimumCharge(minimumCharge);
  await validateLinkedRecords({ plantId, vendorId, materialId, companyId });

  return await updateTransportRate({
    rateId: Number(rateId),
    plantId: Number(plantId),
    vendorId: Number(vendorId),
    materialId: Number(materialId),
    rateType,
    billingBasis,
    rateValue: Number(rateValue),
    distanceKm,
    rateUnitId,
    minimumCharge,
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
  normalizeTransportRatePayload,
};
