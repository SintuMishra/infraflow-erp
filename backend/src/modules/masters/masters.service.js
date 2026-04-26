const {
  findCrusherUnits,
  findMaterials,
  findShifts,
  findVehicleTypes,
  findConfigOptions,
  findUnits,
  findUnitByIdForScope,
  insertUnit,
  updateUnit,
  findMaterialById,
  findMaterialUnitConversions,
  insertMaterialUnitConversion,
  updateMaterialUnitConversion,
  findOverlappingActiveMaterialUnitConversion,
  insertConfigOption,
  updateConfigOption,
  setConfigOptionStatus,
  insertCrusherUnit,
  insertMaterial,
  insertShift,
  insertVehicleType,
  updateCrusherUnit,
  updateMaterial,
  updateShift,
  updateVehicleType,
  setCrusherUnitStatus,
  setMaterialStatus,
  setMaterialHsnSacCode,
  setShiftStatus,
  setVehicleTypeStatus,
  getMaterialUsageSummary,
  getVehicleTypeUsageSummary,
  getCrusherUnitUsageSummary,
  getShiftUsageSummary,
} = require("./masters.model");
const { inferMaterialHsnSacCode } = require("../../utils/materialHsn.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const logger = require("../../utils/logger");

const allowedConfigTypes = [
  "plant_type",
  "power_source",
  "material_category",
  "material_unit",
  "vehicle_category",
  "material_hsn_rule",
  "employee_department",
  "procurement_item_category",
];

const mapConfigOptions = (rows) => ({
  plantTypes: rows.filter((row) => row.configType === "plant_type"),
  powerSources: rows.filter((row) => row.configType === "power_source"),
  materialCategories: rows.filter((row) => row.configType === "material_category"),
  materialUnits: rows.filter((row) => row.configType === "material_unit"),
  vehicleCategories: rows.filter((row) => row.configType === "vehicle_category"),
  materialHsnRules: rows.filter((row) => row.configType === "material_hsn_rule"),
  employeeDepartments: rows.filter((row) => row.configType === "employee_department"),
  procurementItemCategories: rows.filter(
    (row) => row.configType === "procurement_item_category"
  ),
});

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureMasterCanDeactivate = async ({
  id,
  isActive,
  getUsageSummary,
  masterLabel,
}) => {
  if (Boolean(isActive)) {
    return;
  }

  const summary = await getUsageSummary({ id });
  const totalReferences = Number(summary?.totalReferences || 0);

  if (totalReferences <= 0) {
    return;
  }

  const usageParts = (summary?.usage || [])
    .map((item) => `${item.label} (${item.count})`)
    .join(", ");

  const error = createHttpError(
    409,
    `Cannot deactivate ${masterLabel}. It is currently referenced in ${usageParts}.`
  );
  error.code = "MASTER_IN_USE";
  error.details = {
    master: masterLabel,
    totalReferences,
    usage: summary.usage || [],
  };
  throw error;
};

const getMasterData = async (companyId = null) => {
  const [crusherUnits, materials, shifts, vehicleTypes, configRows] =
    await Promise.all([
      findCrusherUnits(companyId),
      findMaterials(companyId),
      findShifts(companyId),
      findVehicleTypes(companyId),
      findConfigOptions(companyId),
    ]);

  return {
    crusherUnits,
    materials,
    shifts,
    vehicleTypes,
    configOptions: mapConfigOptions(configRows),
  };
};

const validateConfigType = (configType) => {
  if (!allowedConfigTypes.includes(configType)) {
    throw createHttpError(400, "Invalid config type");
  }
};

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizeProcurementCategoryValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const isUiOtherPlaceholder = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "__other__";

const ensureValidSelectableValue = (value, fieldName) => {
  if (!value) {
    return value;
  }

  if (isUiOtherPlaceholder(value)) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  if (String(value).length > 120) {
    throw createHttpError(400, `${fieldName} is too long`);
  }

  return value;
};

const normalizeRequiredText = (value, message) => {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw createHttpError(400, message);
  }

  return normalized;
};

const normalizeSortOrder = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const sortOrder = Number(value);
  if (!Number.isFinite(sortOrder)) {
    throw createHttpError(400, "Sort order must be a valid number");
  }

  return sortOrder;
};

const normalizeBoolean = (value, fieldName, defaultValue = null) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  throw createHttpError(400, `${fieldName} must be true or false`);
};

const normalizePositiveInteger = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw createHttpError(400, `${fieldName} must be a valid positive integer`);
  }
  return numeric;
};

const normalizeDateOnly = (value, fieldName) => {
  const normalized = normalizeRequiredText(value, `${fieldName} is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError(400, `${fieldName} must be in YYYY-MM-DD format`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }
  return normalized;
};

const normalizeOptionalDateOnly = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizeDateOnly(value, fieldName);
};

const allowedUnitDimensionTypes = ["weight", "volume", "count", "distance", "time", "custom"];
const allowedConversionMethods = [
  "standard",
  "density_based",
  "vehicle_capacity_based",
  "manual_defined",
];

const normalizeUnitPayload = (payload) => {
  const unitCode = normalizeRequiredText(payload.unitCode, "unitCode is required").toUpperCase();
  const unitName = normalizeRequiredText(payload.unitName, "unitName is required");
  const dimensionType = normalizeRequiredText(
    payload.dimensionType,
    "dimensionType is required"
  ).toLowerCase();
  const precisionScale = Number(payload.precisionScale);

  if (!/^[A-Z0-9_]{2,40}$/.test(unitCode)) {
    throw createHttpError(
      400,
      "unitCode must be 2-40 characters using uppercase letters, numbers, or underscores only"
    );
  }

  if (!allowedUnitDimensionTypes.includes(dimensionType)) {
    throw createHttpError(400, "Invalid dimensionType");
  }

  if (!Number.isInteger(precisionScale) || precisionScale < 0 || precisionScale > 6) {
    throw createHttpError(400, "precisionScale must be an integer between 0 and 6");
  }

  return {
    id: payload.id ? normalizePositiveInteger(payload.id, "id") : undefined,
    companyId: normalizeCompanyId(payload.companyId),
    unitCode,
    unitName,
    dimensionType,
    precisionScale,
    isBaseUnit: normalizeBoolean(payload.isBaseUnit, "isBaseUnit", false),
    isActive: normalizeBoolean(payload.isActive, "isActive", true),
  };
};

const normalizeMaterialUnitConversionPayload = (payload) => {
  const materialId = normalizePositiveInteger(payload.materialId, "materialId");
  const fromUnitId = normalizePositiveInteger(payload.fromUnitId, "fromUnitId");
  const toUnitId = normalizePositiveInteger(payload.toUnitId, "toUnitId");
  const conversionFactor = Number(payload.conversionFactor);
  const conversionMethod = normalizeRequiredText(
    payload.conversionMethod,
    "conversionMethod is required"
  ).toLowerCase();
  const effectiveFrom = normalizeDateOnly(payload.effectiveFrom, "effectiveFrom");
  const effectiveTo = normalizeOptionalDateOnly(payload.effectiveTo, "effectiveTo");

  if (fromUnitId === toUnitId) {
    throw createHttpError(400, "fromUnitId and toUnitId must be different");
  }

  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw createHttpError(400, "conversionFactor must be greater than 0");
  }

  if (!allowedConversionMethods.includes(conversionMethod)) {
    throw createHttpError(400, "Invalid conversionMethod");
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw createHttpError(400, "effectiveTo cannot be earlier than effectiveFrom");
  }

  return {
    id: payload.id ? normalizePositiveInteger(payload.id, "id") : undefined,
    companyId: normalizeCompanyId(payload.companyId),
    materialId,
    fromUnitId,
    toUnitId,
    conversionFactor,
    conversionMethod,
    effectiveFrom,
    effectiveTo,
    notes: normalizeOptionalText(payload.notes),
    isActive: normalizeBoolean(payload.isActive, "isActive", true),
  };
};

const ensureUniqueUnitField = async ({ companyId, accessor, value, idToIgnore = null, message }) => {
  const rows = await findUnits(companyId);
  ensureUniqueMasterField({
    rows: rows.filter((row) => String(row.companyId || "") === String(companyId || "")),
    accessor,
    value,
    idToIgnore,
    message,
  });
};

const ensureUnitCanBeUsedForConversion = async ({ unitId, companyId, fieldName }) => {
  const unit = await findUnitByIdForScope(unitId, companyId);
  if (!unit) {
    throw createHttpError(404, `${fieldName} does not exist`);
  }
  if (!unit.isActive) {
    throw createHttpError(400, `${fieldName} is inactive`);
  }
  return unit;
};

const ensureMaterialExistsForConversion = async ({ materialId, companyId }) => {
  const material = await findMaterialById(materialId, companyId);
  if (!material) {
    throw createHttpError(404, "materialId does not exist");
  }
  return material;
};

const ensureNoActiveOverlappingConversion = async ({
  idToIgnore = null,
  materialId,
  fromUnitId,
  toUnitId,
  effectiveFrom,
  effectiveTo,
  companyId,
  isActive,
}) => {
  if (!isActive) {
    return;
  }

  const conflict = await findOverlappingActiveMaterialUnitConversion({
    idToIgnore,
    materialId,
    fromUnitId,
    toUnitId,
    effectiveFrom,
    effectiveTo,
    companyId,
  });

  if (conflict) {
    throw createHttpError(
      409,
      "An active overlapping conversion already exists for this material and unit pair"
    );
  }
};

const normalizeShiftPayload = (payload) => {
  const startTime = normalizeOptionalText(payload.startTime);
  const endTime = normalizeOptionalText(payload.endTime);

  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw createHttpError(400, "Both shift start time and end time are required together");
  }

  if (startTime && endTime && startTime === endTime) {
    throw createHttpError(400, "Shift start time and end time cannot be the same");
  }

  return {
    ...payload,
    shiftName: normalizeRequiredText(payload.shiftName, "Shift name is required"),
    startTime,
    endTime,
  };
};

const normalizeVehicleTypePayload = (payload) => ({
  ...payload,
  typeName: normalizeRequiredText(payload.typeName, "Vehicle type name is required"),
  category: ensureValidSelectableValue(
    normalizeOptionalText(payload.category),
    "Vehicle category"
  ),
});

const normalizeConfigPayload = (payload) => {
  const configType = normalizeRequiredText(payload.configType, "Config type is required");
  validateConfigType(configType);
  const optionLabel = normalizeRequiredText(payload.optionLabel, "Option label is required");
  let optionValue = normalizeOptionalText(payload.optionValue) || optionLabel;
  const sortOrder = normalizeSortOrder(payload.sortOrder);

  if (configType === "material_hsn_rule" && !/^[0-9A-Za-z]{4,8}$/.test(optionValue)) {
    throw createHttpError(
      400,
      "Material HSN auto-rule value must be an HSN/SAC-style code (4-8 letters/numbers)"
    );
  }

  if (configType === "employee_department") {
    const normalizedRole = String(optionValue || "")
      .trim()
      .toLowerCase();
    const allowedDepartmentRoles = [
      "manager",
      "hr",
      "crusher_supervisor",
      "site_engineer",
      "operator",
      "admin",
    ];

    if (!allowedDepartmentRoles.includes(normalizedRole)) {
      throw createHttpError(
        400,
        "Employee department default role must be one of manager, hr, crusher_supervisor, site_engineer, operator, or admin"
      );
    }
  }

  if (configType === "procurement_item_category") {
    optionValue = normalizeProcurementCategoryValue(optionValue || optionLabel);
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(optionValue)) {
      throw createHttpError(
        400,
        "Procurement item category value must be 2-50 characters and use letters, numbers, and underscores only"
      );
    }
  }

  return {
    ...payload,
    configType,
    optionLabel,
    optionValue,
    sortOrder,
  };
};

const ensureUniqueMasterField = ({
  rows,
  accessor,
  value,
  idToIgnore = null,
  message,
}) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return;
  }

  const hasDuplicate = rows.some((row) => {
    if (idToIgnore !== null && String(row.id) === String(idToIgnore)) {
      return false;
    }

    return (
      String(accessor(row) || "")
        .trim()
        .toLowerCase() === normalizedValue
    );
  });

  if (hasDuplicate) {
    throw createHttpError(409, message);
  }
};

const normalizeMaterialPayload = async (payload) => {
  const gstRate = Number(payload.gstRate);

  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    throw createHttpError(400, "Material GST rate must be between 0 and 100");
  }

  const normalizedMaterialName = normalizeRequiredText(
    payload.materialName,
    "Material name is required"
  );
  const normalizedCategory = normalizeOptionalText(payload.category);
  const explicitHsnSacCode = normalizeOptionalText(payload.hsnSacCode);
  const configRows = await findConfigOptions(payload.companyId || null);
  const materialHsnRules = configRows.filter(
    (row) => row.configType === "material_hsn_rule" && row.isActive
  );
  const inferredHsnSacCode =
    explicitHsnSacCode ||
    inferMaterialHsnSacCode({
      materialName: normalizedMaterialName,
      category: normalizedCategory,
      rules: materialHsnRules,
    })?.code ||
    null;

  return {
    ...payload,
    materialName: normalizedMaterialName,
    materialCode: normalizeOptionalText(payload.materialCode),
    hsnSacCode: inferredHsnSacCode,
    category: ensureValidSelectableValue(normalizedCategory, "Material category"),
    unit: ensureValidSelectableValue(normalizeOptionalText(payload.unit), "Material unit"),
    gstRate,
  };
};

const normalizeCrusherUnitPayload = (payload) => ({
  ...payload,
  unitName: normalizeRequiredText(payload.unitName, "Unit name is required"),
  unitCode: normalizeOptionalText(payload.unitCode),
  location: normalizeOptionalText(payload.location),
  plantType: ensureValidSelectableValue(
    normalizeRequiredText(payload.plantType, "Plant type is required"),
    "Plant type"
  ),
  powerSourceType: ensureValidSelectableValue(
    normalizeOptionalText(payload.powerSourceType),
    "Power source type"
  ),
});

const createConfigOption = async (payload) => {
  const normalized = normalizeConfigPayload(payload);
  const existingOptions = await findConfigOptions(payload.companyId || null);

  ensureUniqueMasterField({
    rows: existingOptions,
    accessor: (row) => `${row.configType}::${row.optionLabel}`,
    value: `${normalized.configType}::${normalized.optionLabel}`,
    message: "This configuration option already exists",
  });

  return await insertConfigOption(normalized);
};

const editConfigOption = async (payload) => {
  const normalized = normalizeConfigPayload(payload);
  const existingOptions = await findConfigOptions(payload.companyId || null);

  ensureUniqueMasterField({
    rows: existingOptions,
    accessor: (row) => `${row.configType}::${row.optionLabel}`,
    value: `${normalized.configType}::${normalized.optionLabel}`,
    idToIgnore: payload.id,
    message: "Another configuration option with this label already exists",
  });

  return await updateConfigOption(normalized);
};

const toggleConfigOption = async (payload) => await setConfigOptionStatus(payload);

const createCrusherUnit = async (payload) => {
  const normalized = normalizeCrusherUnitPayload(payload);
  const existingRows = await findCrusherUnits(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.unitName,
    value: normalized.unitName,
    message: "A crusher unit with this name already exists",
  });

  return await insertCrusherUnit(normalized);
};

const createMaterial = async (payload) => {
  const normalized = await normalizeMaterialPayload(payload);
  const existingRows = await findMaterials(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.materialName,
    value: normalized.materialName,
    message: "A material with this name already exists",
  });

  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.materialCode,
    value: normalized.materialCode,
    message: "A material with this code already exists",
  });

  return await insertMaterial(normalized);
};

const createShift = async (payload) => {
  const normalized = normalizeShiftPayload(payload);
  const existingRows = await findShifts(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.shiftName,
    value: normalized.shiftName,
    message: "A shift with this name already exists",
  });

  return await insertShift(normalized);
};

const createVehicleType = async (payload) => {
  const normalized = normalizeVehicleTypePayload(payload);
  const existingRows = await findVehicleTypes(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.typeName,
    value: normalized.typeName,
    message: "A vehicle type with this name already exists",
  });

  return await insertVehicleType(normalized);
};

const isMissingUnitsSchemaError = (error) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const detail = String(error.detail || "").toLowerCase();
  const combined = `${message} ${detail}`;

  return (
    (error.code === "42P01" &&
      (combined.includes('relation "public.unit_master" does not exist') ||
        combined.includes('relation "unit_master" does not exist') ||
        (combined.includes("unit_master") && combined.includes("does not exist")))) ||
    (error.code === "42703" &&
      combined.includes("unit_master") &&
      (combined.includes("unit_code") ||
        combined.includes("unit_name") ||
        combined.includes("dimension_type") ||
        combined.includes("precision_scale") ||
        combined.includes("is_base_unit") ||
        combined.includes("is_active") ||
        combined.includes("company_id")))
  );
};

const getUnits = async (companyId = null) => {
  try {
    return await findUnits(normalizeCompanyId(companyId));
  } catch (error) {
    if (isMissingUnitsSchemaError(error)) {
      logger.warn("Unit master schema is unavailable; returning empty units list fallback", {
        companyId: normalizeCompanyId(companyId),
        code: error.code || null,
        message: error.message || null,
      });
      return [];
    }

    throw error;
  }
};

const createUnitMaster = async (payload) => {
  const normalized = normalizeUnitPayload(payload);
  await ensureUniqueUnitField({
    companyId: normalized.companyId,
    accessor: (row) => row.unitCode,
    value: normalized.unitCode,
    message: "A unit with this code already exists",
  });
  await ensureUniqueUnitField({
    companyId: normalized.companyId,
    accessor: (row) => row.unitName,
    value: normalized.unitName,
    message: "A unit with this name already exists",
  });

  return await insertUnit(normalized);
};

const editUnitMaster = async (payload) => {
  const normalized = normalizeUnitPayload(payload);
  await ensureUniqueUnitField({
    companyId: normalized.companyId,
    accessor: (row) => row.unitCode,
    value: normalized.unitCode,
    idToIgnore: normalized.id,
    message: "Another unit with this code already exists",
  });
  await ensureUniqueUnitField({
    companyId: normalized.companyId,
    accessor: (row) => row.unitName,
    value: normalized.unitName,
    idToIgnore: normalized.id,
    message: "Another unit with this name already exists",
  });

  return await updateUnit(normalized);
};

const getMaterialUnitConversions = async (companyId = null) =>
  await findMaterialUnitConversions(normalizeCompanyId(companyId));

const createMaterialUnitConversionMaster = async (payload) => {
  const normalized = normalizeMaterialUnitConversionPayload(payload);

  await Promise.all([
    ensureMaterialExistsForConversion({
      materialId: normalized.materialId,
      companyId: normalized.companyId,
    }),
    ensureUnitCanBeUsedForConversion({
      unitId: normalized.fromUnitId,
      companyId: normalized.companyId,
      fieldName: "fromUnitId",
    }),
    ensureUnitCanBeUsedForConversion({
      unitId: normalized.toUnitId,
      companyId: normalized.companyId,
      fieldName: "toUnitId",
    }),
  ]);

  await ensureNoActiveOverlappingConversion(normalized);
  return await insertMaterialUnitConversion(normalized);
};

const editMaterialUnitConversionMaster = async (payload) => {
  const normalized = normalizeMaterialUnitConversionPayload(payload);

  await Promise.all([
    ensureMaterialExistsForConversion({
      materialId: normalized.materialId,
      companyId: normalized.companyId,
    }),
    ensureUnitCanBeUsedForConversion({
      unitId: normalized.fromUnitId,
      companyId: normalized.companyId,
      fieldName: "fromUnitId",
    }),
    ensureUnitCanBeUsedForConversion({
      unitId: normalized.toUnitId,
      companyId: normalized.companyId,
      fieldName: "toUnitId",
    }),
  ]);

  await ensureNoActiveOverlappingConversion({
    ...normalized,
    idToIgnore: normalized.id,
  });
  return await updateMaterialUnitConversion(normalized);
};

const editCrusherUnit = async (payload) => {
  const normalized = normalizeCrusherUnitPayload(payload);
  const existingRows = await findCrusherUnits(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.unitName,
    value: normalized.unitName,
    idToIgnore: payload.id,
    message: "Another crusher unit with this name already exists",
  });

  return await updateCrusherUnit(normalized);
};

const editMaterial = async (payload) => {
  const normalized = await normalizeMaterialPayload(payload);
  const existingRows = await findMaterials(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.materialName,
    value: normalized.materialName,
    idToIgnore: payload.id,
    message: "Another material with this name already exists",
  });
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.materialCode,
    value: normalized.materialCode,
    idToIgnore: payload.id,
    message: "Another material with this code already exists",
  });

  return await updateMaterial(normalized);
};

const editShift = async (payload) => {
  const normalized = normalizeShiftPayload(payload);
  const existingRows = await findShifts(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.shiftName,
    value: normalized.shiftName,
    idToIgnore: payload.id,
    message: "Another shift with this name already exists",
  });

  return await updateShift(normalized);
};

const editVehicleType = async (payload) => {
  const normalized = normalizeVehicleTypePayload(payload);
  const existingRows = await findVehicleTypes(payload.companyId || null);
  ensureUniqueMasterField({
    rows: existingRows,
    accessor: (row) => row.typeName,
    value: normalized.typeName,
    idToIgnore: payload.id,
    message: "Another vehicle type with this name already exists",
  });

  return await updateVehicleType(normalized);
};

const toggleCrusherUnit = async (payload) => {
  await ensureMasterCanDeactivate({
    id: payload.id,
    isActive: payload.isActive,
    masterLabel: "crusher unit",
    getUsageSummary: ({ id }) =>
      getCrusherUnitUsageSummary({
        id,
        companyId: payload.companyId || null,
      }),
  });
  return setCrusherUnitStatus(payload);
};

const toggleMaterial = async (payload) => {
  await ensureMasterCanDeactivate({
    id: payload.id,
    isActive: payload.isActive,
    masterLabel: "material",
    getUsageSummary: ({ id }) =>
      getMaterialUsageSummary({
        id,
        companyId: payload.companyId || null,
      }),
  });
  return setMaterialStatus(payload);
};

const toggleShift = async (payload) => {
  await ensureMasterCanDeactivate({
    id: payload.id,
    isActive: payload.isActive,
    masterLabel: "shift",
    getUsageSummary: ({ id }) =>
      getShiftUsageSummary({
        id,
        companyId: payload.companyId || null,
      }),
  });
  return setShiftStatus(payload);
};

const toggleVehicleType = async (payload) => {
  await ensureMasterCanDeactivate({
    id: payload.id,
    isActive: payload.isActive,
    masterLabel: "vehicle type",
    getUsageSummary: ({ id }) =>
      getVehicleTypeUsageSummary({
        id,
        companyId: payload.companyId || null,
      }),
  });
  return setVehicleTypeStatus(payload);
};

const getMasterHealthCheck = async (companyId = null) => {
  const [crusherUnits, materials, shifts, vehicleTypes, configRows] =
    await Promise.all([
      findCrusherUnits(companyId),
      findMaterials(companyId),
      findShifts(companyId),
      findVehicleTypes(companyId),
      findConfigOptions(companyId),
    ]);

  const activeMaterials = materials.filter((item) => item.isActive);
  const activeCrusherUnits = crusherUnits.filter((item) => item.isActive);
  const activeShifts = shifts.filter((item) => item.isActive);
  const activeVehicleTypes = vehicleTypes.filter((item) => item.isActive);
  const activeConfigRows = configRows.filter((item) => item.isActive);
  const activeMaterialHsnRules = activeConfigRows.filter(
    (row) => row.configType === "material_hsn_rule"
  );
  const activePlantTypes = activeConfigRows.filter(
    (row) => row.configType === "plant_type"
  );
  const activePowerSources = activeConfigRows.filter(
    (row) => row.configType === "power_source"
  );

  const materialsMissingHsnSac = activeMaterials.filter(
    (item) => !String(item.hsnSacCode || "").trim()
  );
  const materialsInvalidGstRate = activeMaterials.filter((item) => {
    const gstRate = Number(item.gstRate);
    return !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100;
  });

  const normalizedCodeMap = new Map();
  const duplicateMaterialCodes = new Set();
  for (const material of activeMaterials) {
    const code = String(material.materialCode || "")
      .trim()
      .toLowerCase();
    if (!code) continue;
    if (normalizedCodeMap.has(code)) {
      duplicateMaterialCodes.add(code);
      continue;
    }
    normalizedCodeMap.set(code, material.id);
  }

  const issues = [];
  if (materialsMissingHsnSac.length > 0) {
    issues.push({
      code: "materials_missing_hsn_sac",
      severity: "warning",
      title: "Active materials missing HSN/SAC",
      description:
        "HSN/SAC is required for tax-facing dispatch invoices and GST-ready prints.",
      count: materialsMissingHsnSac.length,
      samples: materialsMissingHsnSac.slice(0, 5).map((item) => item.materialName),
    });
  }

  if (duplicateMaterialCodes.size > 0) {
    issues.push({
      code: "duplicate_active_material_codes",
      severity: "warning",
      title: "Duplicate active material codes",
      description:
        "Duplicate codes increase the risk of incorrect selection during dispatch and billing.",
      count: duplicateMaterialCodes.size,
      samples: Array.from(duplicateMaterialCodes).slice(0, 5),
    });
  }

  if (activeMaterialHsnRules.length === 0) {
    issues.push({
      code: "missing_material_hsn_rules",
      severity: "info",
      title: "No active material HSN auto-rules configured",
      description:
        "Add material_hsn_rule options for faster and more consistent HSN assignment.",
      count: 0,
    });
  }

  if (materialsInvalidGstRate.length > 0) {
    issues.push({
      code: "invalid_material_gst_rate",
      severity: "warning",
      title: "Active materials with invalid GST rates",
      description:
        "Invalid GST rates can break billing totals and compliance calculations.",
      count: materialsInvalidGstRate.length,
      samples: materialsInvalidGstRate.slice(0, 5).map((item) => item.materialName),
    });
  }

  if (activeCrusherUnits.length === 0) {
    issues.push({
      code: "no_active_crusher_units",
      severity: "warning",
      title: "No active crusher units",
      description: "Dispatch and operational forms need at least one active crusher unit.",
      count: 0,
    });
  }

  if (activeShifts.length === 0) {
    issues.push({
      code: "no_active_shifts",
      severity: "warning",
      title: "No active shifts",
      description: "Shift-dependent entries and planning will remain blocked.",
      count: 0,
    });
  }

  if (activeVehicleTypes.length === 0) {
    issues.push({
      code: "no_active_vehicle_types",
      severity: "warning",
      title: "No active vehicle types",
      description: "Fleet and dispatch workflows need at least one active vehicle type.",
      count: 0,
    });
  }

  if (activePlantTypes.length === 0) {
    issues.push({
      code: "no_active_plant_types",
      severity: "info",
      title: "No active plant type options",
      description: "Plant and unit forms will rely on manual custom values.",
      count: 0,
    });
  }

  if (activePowerSources.length === 0) {
    issues.push({
      code: "no_active_power_source_options",
      severity: "info",
      title: "No active power source options",
      description: "Power source selection defaults to manual entry across forms.",
      count: 0,
    });
  }

  return {
    counts: {
      crusherUnits: crusherUnits.length,
      materials: materials.length,
      shifts: shifts.length,
      vehicleTypes: vehicleTypes.length,
      configOptions: configRows.length,
      activeCrusherUnits: activeCrusherUnits.length,
      activeMaterials: activeMaterials.length,
      activeShifts: activeShifts.length,
      activeVehicleTypes: activeVehicleTypes.length,
      activeConfigOptions: activeConfigRows.length,
      materialsMissingHsnSac: materialsMissingHsnSac.length,
      materialsInvalidGstRate: materialsInvalidGstRate.length,
      activeMaterialHsnRules: activeMaterialHsnRules.length,
      activePlantTypes: activePlantTypes.length,
      activePowerSources: activePowerSources.length,
    },
    issues,
  };
};

const autoFillMissingMaterialHsnSac = async (companyId = null) => {
  const [materials, configRows] = await Promise.all([
    findMaterials(companyId),
    findConfigOptions(companyId),
  ]);

  const materialHsnRules = configRows.filter(
    (row) => row.configType === "material_hsn_rule" && row.isActive
  );

  const candidates = materials.filter(
    (material) => material.isActive && !String(material.hsnSacCode || "").trim()
  );

  const updated = [];
  const skipped = [];

  for (const material of candidates) {
    const suggestion = inferMaterialHsnSacCode({
      materialName: material.materialName,
      category: material.category,
      rules: materialHsnRules,
    });

    if (!suggestion?.code) {
      skipped.push({
        id: material.id,
        materialName: material.materialName,
        reason: "No matching inference rule for this material",
      });
      continue;
    }

    const saved = await setMaterialHsnSacCode({
      id: material.id,
      hsnSacCode: suggestion.code,
      companyId,
    });

    if (!saved) {
      skipped.push({
        id: material.id,
        materialName: material.materialName,
        reason: "Material update failed or out of scope",
      });
      continue;
    }

    updated.push({
      id: saved.id,
      materialName: saved.materialName,
      hsnSacCode: saved.hsnSacCode,
      reason: suggestion.reason,
    });
  }

  return {
    candidateCount: candidates.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    updated,
    skipped,
  };
};

module.exports = {
  getMasterData,
  getUnits,
  getMaterialUnitConversions,
  createConfigOption,
  createUnitMaster,
  createMaterialUnitConversionMaster,
  editConfigOption,
  editUnitMaster,
  editMaterialUnitConversionMaster,
  toggleConfigOption,
  createCrusherUnit,
  createMaterial,
  createShift,
  createVehicleType,
  editCrusherUnit,
  editMaterial,
  editShift,
  editVehicleType,
  toggleCrusherUnit,
  toggleMaterial,
  toggleShift,
  toggleVehicleType,
  getMasterHealthCheck,
  autoFillMissingMaterialHsnSac,
};
