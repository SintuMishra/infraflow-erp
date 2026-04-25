const model = require("./party_material_rates.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const { plantExists, materialExists } = require("../dispatch/dispatch.model");
const { getPartyById } = require("../parties/parties.model");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const allowedRateUnits = [
  "per_ton",
  "per_metric_ton",
  "per_cft",
  "per_brass",
  "per_cubic_meter",
  "per_trip",
  "other",
];
const conversionRateUnits = ["per_cft", "per_brass", "per_cubic_meter", "per_trip", "other"];
const allowedLoadingChargeBases = ["none", "fixed", "per_ton", "per_brass", "per_trip"];

const getDefaultRateUnitLabel = (rateUnit) => {
  if (rateUnit === "per_metric_ton") return "metric ton";
  if (rateUnit === "per_cft") return "CFT";
  if (rateUnit === "per_brass") return "brass";
  if (rateUnit === "per_cubic_meter") return "cubic meter";
  if (rateUnit === "per_trip") return "trip";
  return "ton";
};

const getTodayDateOnlyValue = () => new Date().toISOString().slice(0, 10);

const normalizeRateUnit = (data = {}) => {
  const rateUnit = String(data.rateUnit || "per_ton").trim();
  const rateUnitLabel = String(data.rateUnitLabel || "").trim();
  const rawUnitsPerTon = data.rateUnitsPerTon;
  const rateUnitsPerTon =
    rawUnitsPerTon === undefined || rawUnitsPerTon === null || rawUnitsPerTon === ""
      ? 1
      : Number(rawUnitsPerTon);

  return {
    rateUnit,
    rateUnitLabel: rateUnit === "other" ? rateUnitLabel : getDefaultRateUnitLabel(rateUnit),
    rateUnitsPerTon: conversionRateUnits.includes(rateUnit) ? rateUnitsPerTon : 1,
  };
};

const normalizeRatePayload = (data = {}) => {
  const loadingChargeBasis = String(data.loadingChargeBasis || "fixed").trim() || "fixed";

  return {
    plantId: Number(data.plantId),
    partyId: Number(data.partyId),
    materialId: Number(data.materialId),
    ratePerTon: Number(data.ratePerTon),
    ...normalizeRateUnit(data),
    royaltyMode: String(data.royaltyMode || "").trim(),
    royaltyValue:
      data.royaltyValue === undefined || data.royaltyValue === null || data.royaltyValue === ""
        ? 0
        : Number(data.royaltyValue),
    tonsPerBrass:
      data.tonsPerBrass === undefined || data.tonsPerBrass === null || data.tonsPerBrass === ""
        ? null
        : Number(data.tonsPerBrass),
    loadingCharge:
      loadingChargeBasis === "none" ||
      data.loadingCharge === undefined ||
      data.loadingCharge === null ||
      data.loadingCharge === ""
        ? 0
        : Number(data.loadingCharge),
    loadingChargeBasis,
    notes: String(data.notes || "").trim(),
    effectiveFrom: String(data.effectiveFrom || "").trim() || getTodayDateOnlyValue(),
    companyId: normalizeCompanyId(data.companyId),
  };
};

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

  if (!allowedRateUnits.includes(data.rateUnit)) {
    throw buildValidationError("Invalid rate unit");
  }

  if (data.rateUnit === "other" && !data.rateUnitLabel) {
    throw buildValidationError("rateUnitLabel is required for other rate unit");
  }

  if (!Number.isFinite(data.rateUnitsPerTon) || data.rateUnitsPerTon <= 0) {
    throw buildValidationError("rateUnitsPerTon must be greater than 0");
  }

  if (!["per_ton", "per_brass", "fixed", "none"].includes(data.royaltyMode)) {
    throw buildValidationError("Invalid royalty mode");
  }

  if (!Number.isFinite(data.royaltyValue) || data.royaltyValue < 0) {
    throw buildValidationError("royaltyValue must be 0 or greater");
  }

  if (!Number.isFinite(data.loadingCharge) || data.loadingCharge < 0) {
    throw buildValidationError("loadingCharge must be 0 or greater");
  }

  if (!allowedLoadingChargeBases.includes(data.loadingChargeBasis)) {
    throw buildValidationError("Invalid loading charge basis");
  }

  if (data.royaltyMode === "per_brass" || data.loadingChargeBasis === "per_brass") {
    if (!Number.isFinite(data.tonsPerBrass) || data.tonsPerBrass <= 0) {
      throw buildValidationError(
        "tonsPerBrass must be greater than 0 when royalty or loading is per_brass"
      );
    }
  } else if (data.tonsPerBrass !== null && (!Number.isFinite(data.tonsPerBrass) || data.tonsPerBrass <= 0)) {
    throw buildValidationError("tonsPerBrass must be greater than 0 when provided");
  }
};

const validateMasterLinks = async ({ plantId, partyId, materialId, companyId }) => {
  const [plant, party, material] = await Promise.all([
    plantExists(Number(plantId), companyId),
    getPartyById(Number(partyId), companyId),
    materialExists(Number(materialId), companyId),
  ]);

  if (!plant) {
    throw buildValidationError("Selected plant does not exist");
  }

  if (!party) {
    throw buildValidationError("Selected party does not exist");
  }

  if (!material) {
    throw buildValidationError("Selected material does not exist");
  }
};

const ensureNoActiveRateConflict = async ({
  rateId = null,
  plantId,
  partyId,
  materialId,
  effectiveFrom,
  companyId,
}) => {
  const conflictingRate = await model.findActiveRateConflict({
    plantId,
    partyId,
    materialId,
    effectiveFrom,
    companyId,
    excludeRateId: rateId,
  });

  if (conflictingRate) {
    throw buildValidationError(
      "An active party material rate already exists for this plant, party, material, and effective date"
    );
  }
};

const getRates = async (companyId = null) => {
  return await model.getAllRates(companyId);
};

const createRate = async (data) => {
  const normalized = normalizeRatePayload(data);
  validate(normalized);
  await validateMasterLinks(normalized);
  await ensureNoActiveRateConflict(normalized);
  return await model.insertRate(normalized);
};

const updateRate = async (id, data) => {
  const normalized = normalizeRatePayload(data);
  validate(normalized);
  await validateMasterLinks(normalized);
  await ensureNoActiveRateConflict({
    rateId: Number(id),
    ...normalized,
  });
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
