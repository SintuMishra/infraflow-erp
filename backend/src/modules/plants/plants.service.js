const {
  findAllPlants,
  findPlantsPage,
  findPlantLookup,
  insertPlant,
  updatePlant,
  updatePlantStatus,
} = require("./plants.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const {
  getCached,
  invalidateCacheByPrefix,
  buildCompanyScopedCachePrefix,
} = require("../../utils/simpleCache.util");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizePlantPayload = (payload = {}) => ({
  plantName: String(payload.plantName || "").trim(),
  plantCode: String(payload.plantCode || "").trim(),
  plantType: String(payload.plantType || "").trim(),
  location: String(payload.location || "").trim(),
  powerSourceType: String(payload.powerSourceType || "diesel")
    .trim()
    .toLowerCase(),
  companyId: normalizeCompanyId(payload.companyId),
});

const getPlants = async (companyId = null) => {
  return await findAllPlants(companyId);
};

const getPlantsPage = async ({
  companyId = null,
  page = 1,
  limit = 25,
  search = "",
} = {}) => findPlantsPage({ companyId, page, limit, search });

const getPlantLookup = async (companyId = null) =>
  getCached(
    `${buildCompanyScopedCachePrefix("plants-lookup", companyId)}active`,
    60_000,
    () => findPlantLookup(companyId)
  );

const createPlant = async (payload) => {
  const normalizedPayload = normalizePlantPayload(payload);

  if (!normalizedPayload.plantName || !normalizedPayload.plantType) {
    throw buildValidationError("plantName and plantType are required");
  }

  const created = await insertPlant(normalizedPayload);
  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("plants-lookup", normalizedPayload.companyId));
  return created;
};

const editPlant = async (payload) => {
  const normalizedPayload = normalizePlantPayload(payload);

  if (!normalizedPayload.plantName || !normalizedPayload.plantType) {
    throw buildValidationError("plantName and plantType are required");
  }

  const updated = await updatePlant({
    ...payload,
    ...normalizedPayload,
  });

  if (!updated) {
    throw buildValidationError("Plant not found", 404);
  }

  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("plants-lookup", normalizedPayload.companyId));
  return updated;
};

const changePlantStatus = async (payload) => {
  if (typeof payload.isActive !== "boolean") {
    throw buildValidationError("isActive must be provided as true or false");
  }

  const updated = await updatePlantStatus(payload);

  if (!updated) {
    throw buildValidationError("Plant not found", 404);
  }

  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("plants-lookup", payload.companyId));
  return updated;
};

module.exports = {
  getPlants,
  getPlantsPage,
  getPlantLookup,
  createPlant,
  editPlant,
  changePlantStatus,
  normalizePlantPayload,
};
