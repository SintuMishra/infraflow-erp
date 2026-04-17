const model = require("./party_material_rates.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRatePayload = (data = {}) => ({
  plantId: Number(data.plantId),
  partyId: Number(data.partyId),
  materialId: Number(data.materialId),
  ratePerTon: Number(data.ratePerTon),
  royaltyMode: String(data.royaltyMode || "").trim(),
  royaltyValue:
    data.royaltyValue === undefined || data.royaltyValue === null || data.royaltyValue === ""
      ? 0
      : Number(data.royaltyValue),
  loadingCharge:
    data.loadingCharge === undefined || data.loadingCharge === null || data.loadingCharge === ""
      ? 0
      : Number(data.loadingCharge),
  notes: String(data.notes || "").trim(),
  effectiveFrom: String(data.effectiveFrom || "").trim(),
  companyId: normalizeCompanyId(data.companyId),
});

const validate = (data) => {
  if (
    !Number.isInteger(data.plantId) ||
    data.plantId <= 0 ||
    !Number.isInteger(data.partyId) ||
    data.partyId <= 0 ||
    !Number.isInteger(data.materialId) ||
    data.materialId <= 0
  ) {
    throw buildValidationError("Plant, Party, Material required");
  }

  if (!Number.isFinite(data.ratePerTon) || data.ratePerTon <= 0) {
    throw buildValidationError("Rate must be > 0");
  }

  if (!["per_ton", "fixed", "none"].includes(data.royaltyMode)) {
    throw buildValidationError("Invalid royalty mode");
  }

  if (!Number.isFinite(data.royaltyValue) || data.royaltyValue < 0) {
    throw buildValidationError("royaltyValue must be 0 or greater");
  }

  if (!Number.isFinite(data.loadingCharge) || data.loadingCharge < 0) {
    throw buildValidationError("loadingCharge must be 0 or greater");
  }
};

const getRates = async (companyId = null) => {
  return await model.getAllRates(companyId);
};

const createRate = async (data) => {
  const normalized = normalizeRatePayload(data);
  validate(normalized);
  return await model.insertRate(normalized);
};

const updateRate = async (id, data) => {
  const normalized = normalizeRatePayload(data);
  validate(normalized);
  const updated = await model.updateRate(id, normalized);

  if (!updated) {
    throw buildValidationError("Party material rate not found", 404);
  }

  return updated;
};

const changeStatus = async (id, isActive, companyId = null) => {
  if (typeof isActive !== "boolean") {
    throw buildValidationError("isActive must be provided as true or false");
  }

  const updated = await model.toggleStatus(id, isActive, companyId);

  if (!updated) {
    throw buildValidationError("Party material rate not found", 404);
  }

  return updated;
};

module.exports = {
  getRates,
  createRate,
  updateRate,
  changeStatus,
  normalizeRatePayload,
};
