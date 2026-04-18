const {
  findCrusherUnits,
  findMaterials,
  findShifts,
  findVehicleTypes,
  findConfigOptions,
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

const allowedConfigTypes = [
  "plant_type",
  "power_source",
  "material_category",
  "material_unit",
  "vehicle_category",
  "material_hsn_rule",
];

const mapConfigOptions = (rows) => ({
  plantTypes: rows.filter((row) => row.configType === "plant_type"),
  powerSources: rows.filter((row) => row.configType === "power_source"),
  materialCategories: rows.filter((row) => row.configType === "material_category"),
  materialUnits: rows.filter((row) => row.configType === "material_unit"),
  vehicleCategories: rows.filter((row) => row.configType === "vehicle_category"),
  materialHsnRules: rows.filter((row) => row.configType === "material_hsn_rule"),
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
  category: normalizeOptionalText(payload.category),
});

const normalizeConfigPayload = (payload) => {
  const configType = normalizeRequiredText(payload.configType, "Config type is required");
  validateConfigType(configType);
  const optionLabel = normalizeRequiredText(payload.optionLabel, "Option label is required");
  const optionValue = normalizeOptionalText(payload.optionValue) || optionLabel;
  const sortOrder = normalizeSortOrder(payload.sortOrder);

  if (configType === "material_hsn_rule" && !/^[0-9A-Za-z]{4,8}$/.test(optionValue)) {
    throw createHttpError(
      400,
      "Material HSN auto-rule value must be an HSN/SAC-style code (4-8 letters/numbers)"
    );
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
    category: normalizedCategory,
    unit: normalizeOptionalText(payload.unit),
    gstRate,
  };
};

const normalizeCrusherUnitPayload = (payload) => ({
  ...payload,
  unitName: normalizeRequiredText(payload.unitName, "Unit name is required"),
  unitCode: normalizeOptionalText(payload.unitCode),
  location: normalizeOptionalText(payload.location),
  plantType: normalizeRequiredText(payload.plantType, "Plant type is required"),
  powerSourceType: normalizeOptionalText(payload.powerSourceType),
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
  createConfigOption,
  editConfigOption,
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
