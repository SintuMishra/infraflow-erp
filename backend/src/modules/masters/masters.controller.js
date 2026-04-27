const {
  getMasterData,
  getMaterialsPage,
  getConfigOptionsPage,
  getMasterLookupData,
  getMaterialLookupList,
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
} = require("./masters.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizePage, normalizeLimit } = require("../../utils/pagination.util");

const recordMasterAudit = async ({
  req,
  action,
  targetType,
  targetId,
  details,
}) => {
  await recordAuditEvent({
    action,
    actorUserId: req.user?.userId || null,
    targetType,
    targetId,
    companyId: req.companyId || null,
    details,
  });
};

const ensureRecordFound = (record, message = "Record not found") => {
  if (record) {
    return;
  }

  const error = new Error(message);
  error.statusCode = 404;
  throw error;
};

const getMasters = async (req, res) => {
  try {
    const data = await getMasterData(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load master data");
  }
};

const getMasterLookupController = async (req, res) => {
  try {
    const data = await getMasterLookupData(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load master lookups");
  }
};

const getMaterialsPageController = async (req, res) => {
  try {
    const pageData = await getMaterialsPage({
      companyId: req.companyId || null,
      page: normalizePage(req.query.page, 1),
      limit: normalizeLimit(req.query.limit, 25, 100),
      search: String(req.query.search || "").trim(),
    });

    return res.status(200).json({
      success: true,
      data: pageData.items,
      meta: {
        pagination: {
          total: pageData.total,
          page: pageData.page,
          limit: pageData.limit,
          totalPages: pageData.total ? Math.ceil(pageData.total / pageData.limit) : 0,
        },
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load materials");
  }
};

const getMaterialLookupController = async (req, res) => {
  try {
    const data = await getMaterialLookupList(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load material lookup");
  }
};

const getConfigOptionsPageController = async (req, res) => {
  try {
    const pageData = await getConfigOptionsPage({
      companyId: req.companyId || null,
      page: normalizePage(req.query.page, 1),
      limit: normalizeLimit(req.query.limit, 25, 100),
      search: String(req.query.search || "").trim(),
    });

    return res.status(200).json({
      success: true,
      data: pageData.items,
      meta: {
        pagination: {
          total: pageData.total,
          page: pageData.page,
          limit: pageData.limit,
          totalPages: pageData.total ? Math.ceil(pageData.total / pageData.limit) : 0,
        },
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load config options");
  }
};

const getMasterHealthCheckController = async (req, res) => {
  try {
    const data = await getMasterHealthCheck(req.companyId || null);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load master health check");
  }
};

const getUnitsController = async (req, res) => {
  try {
    const data = await getUnits(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load units");
  }
};

const getMaterialUnitConversionsController = async (req, res) => {
  try {
    const data = await getMaterialUnitConversions(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load material unit conversions");
  }
};

const autoFillMaterialHsnSacController = async (req, res) => {
  try {
    const data = await autoFillMissingMaterialHsnSac(req.companyId || null);
    await recordMasterAudit({
      req,
      action: "master.material.hsn_auto_filled",
      targetType: "material",
      targetId: null,
      details: {
        candidateCount: data.candidateCount,
        updatedCount: data.updatedCount,
        skippedCount: data.skippedCount,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Material HSN/SAC auto-fill completed",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to auto-fill material HSN/SAC");
  }
};

const addConfigOption = async (req, res) => {
  try {
    const data = await createConfigOption({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.config_option.created",
      targetType: "config_option",
      targetId: data.id,
      details: {
        configType: data.configType || req.body.configType || null,
        optionLabel: data.optionLabel || req.body.optionLabel || null,
        optionValue: data.optionValue || req.body.optionValue || null,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Config option created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create config option");
  }
};

const addUnitController = async (req, res) => {
  try {
    const data = await createUnitMaster({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.unit.created",
      targetType: "unit",
      targetId: data.id,
      details: {
        unitCode: data.unitCode,
        unitName: data.unitName,
        dimensionType: data.dimensionType,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create unit");
  }
};

const addMaterialUnitConversionController = async (req, res) => {
  try {
    const data = await createMaterialUnitConversionMaster({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.material_unit_conversion.created",
      targetType: "material_unit_conversion",
      targetId: data.id,
      details: {
        materialId: data.materialId,
        fromUnitId: data.fromUnitId,
        toUnitId: data.toUnitId,
        conversionFactor: data.conversionFactor,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Material unit conversion created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create material unit conversion");
  }
};

const editConfigOptionController = async (req, res) => {
  try {
    const data = await editConfigOption({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Config option not found");
    await recordMasterAudit({
      req,
      action: "master.config_option.updated",
      targetType: "config_option",
      targetId: data.id,
      details: {
        configType: data.configType || req.body.configType || null,
        optionLabel: data.optionLabel || req.body.optionLabel || null,
        optionValue: data.optionValue || req.body.optionValue || null,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Config option updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update config option");
  }
};

const editUnitController = async (req, res) => {
  try {
    const data = await editUnitMaster({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Unit not found");
    await recordMasterAudit({
      req,
      action: "master.unit.updated",
      targetType: "unit",
      targetId: data.id,
      details: {
        unitCode: data.unitCode,
        unitName: data.unitName,
        dimensionType: data.dimensionType,
        isActive: data.isActive,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update unit");
  }
};

const editMaterialUnitConversionController = async (req, res) => {
  try {
    const data = await editMaterialUnitConversionMaster({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Material unit conversion not found");
    await recordMasterAudit({
      req,
      action: "master.material_unit_conversion.updated",
      targetType: "material_unit_conversion",
      targetId: data.id,
      details: {
        materialId: data.materialId,
        fromUnitId: data.fromUnitId,
        toUnitId: data.toUnitId,
        conversionFactor: data.conversionFactor,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        isActive: data.isActive,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Material unit conversion updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update material unit conversion");
  }
};

const toggleConfigOptionController = async (req, res) => {
  try {
    const data = await toggleConfigOption({
      id: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });
    ensureRecordFound(data, "Config option not found");
    await recordMasterAudit({
      req,
      action: "master.config_option.status_updated",
      targetType: "config_option",
      targetId: data.id,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Config option status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update config option status");
  }
};

const addCrusherUnit = async (req, res) => {
  try {
    const data = await createCrusherUnit({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.crusher_unit.created",
      targetType: "crusher_unit",
      targetId: data.id,
      details: {
        unitName: data.unitName || req.body.unitName || null,
        plantType: data.plantType || req.body.plantType || null,
        location: data.location || req.body.location || null,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Crusher unit created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create crusher unit");
  }
};

const addMaterial = async (req, res) => {
  try {
    const data = await createMaterial({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.material.created",
      targetType: "material",
      targetId: data.id,
      details: {
        materialName: data.materialName || req.body.materialName || null,
        materialCode: data.materialCode || req.body.materialCode || null,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Material created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create material");
  }
};

const addShift = async (req, res) => {
  try {
    const data = await createShift({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.shift.created",
      targetType: "shift",
      targetId: data.id,
      details: {
        shiftName: data.shiftName || req.body.shiftName || null,
        startTime: data.startTime || req.body.startTime || null,
        endTime: data.endTime || req.body.endTime || null,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Shift created successfully",
      data,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Shift name already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to create shift");
  }
};

const addVehicleType = async (req, res) => {
  try {
    const data = await createVehicleType({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordMasterAudit({
      req,
      action: "master.vehicle_type.created",
      targetType: "vehicle_type",
      targetId: data.id,
      details: {
        typeName: data.typeName || req.body.typeName || null,
      },
    });
    return res.status(201).json({
      success: true,
      message: "Vehicle type created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create vehicle type");
  }
};

const editCrusherUnitController = async (req, res) => {
  try {
    const data = await editCrusherUnit({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Crusher unit not found");
    await recordMasterAudit({
      req,
      action: "master.crusher_unit.updated",
      targetType: "crusher_unit",
      targetId: data.id,
      details: {
        unitName: data.unitName || req.body.unitName || null,
        plantType: data.plantType || req.body.plantType || null,
        location: data.location || req.body.location || null,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Crusher unit updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update crusher unit");
  }
};

const editMaterialController = async (req, res) => {
  try {
    const data = await editMaterial({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Material not found");
    await recordMasterAudit({
      req,
      action: "master.material.updated",
      targetType: "material",
      targetId: data.id,
      details: {
        materialName: data.materialName || req.body.materialName || null,
        materialCode: data.materialCode || req.body.materialCode || null,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Material updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update material");
  }
};

const editShiftController = async (req, res) => {
  try {
    const data = await editShift({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Shift not found");
    await recordMasterAudit({
      req,
      action: "master.shift.updated",
      targetType: "shift",
      targetId: data.id,
      details: {
        shiftName: data.shiftName || req.body.shiftName || null,
        startTime: data.startTime || req.body.startTime || null,
        endTime: data.endTime || req.body.endTime || null,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Shift updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update shift");
  }
};

const editVehicleTypeController = async (req, res) => {
  try {
    const data = await editVehicleType({
      id: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });
    ensureRecordFound(data, "Vehicle type not found");
    await recordMasterAudit({
      req,
      action: "master.vehicle_type.updated",
      targetType: "vehicle_type",
      targetId: data.id,
      details: {
        typeName: data.typeName || req.body.typeName || null,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Vehicle type updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update vehicle type");
  }
};

const toggleCrusherUnitController = async (req, res) => {
  try {
    const data = await toggleCrusherUnit({
      id: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });
    ensureRecordFound(data, "Crusher unit not found");
    await recordMasterAudit({
      req,
      action: "master.crusher_unit.status_updated",
      targetType: "crusher_unit",
      targetId: data.id,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Crusher unit status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update crusher unit status");
  }
};

const toggleMaterialController = async (req, res) => {
  try {
    const data = await toggleMaterial({
      id: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });
    ensureRecordFound(data, "Material not found");
    await recordMasterAudit({
      req,
      action: "master.material.status_updated",
      targetType: "material",
      targetId: data.id,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Material status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update material status");
  }
};

const toggleShiftController = async (req, res) => {
  try {
    const data = await toggleShift({
      id: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });
    ensureRecordFound(data, "Shift not found");
    await recordMasterAudit({
      req,
      action: "master.shift.status_updated",
      targetType: "shift",
      targetId: data.id,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Shift status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update shift status");
  }
};

const toggleVehicleTypeController = async (req, res) => {
  try {
    const data = await toggleVehicleType({
      id: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });
    ensureRecordFound(data, "Vehicle type not found");
    await recordMasterAudit({
      req,
      action: "master.vehicle_type.status_updated",
      targetType: "vehicle_type",
      targetId: data.id,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Vehicle type status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update vehicle type status");
  }
};

module.exports = {
  getMasters,
  getMasterLookupController,
  getMaterialsPageController,
  getMaterialLookupController,
  getConfigOptionsPageController,
  getUnitsController,
  getMaterialUnitConversionsController,
  addConfigOption,
  addUnitController,
  addMaterialUnitConversionController,
  editConfigOptionController,
  editUnitController,
  editMaterialUnitConversionController,
  toggleConfigOptionController,
  addCrusherUnit,
  addMaterial,
  addShift,
  addVehicleType,
  editCrusherUnitController,
  editMaterialController,
  editShiftController,
  editVehicleTypeController,
  toggleCrusherUnitController,
  toggleMaterialController,
  toggleShiftController,
  toggleVehicleTypeController,
  getMasterHealthCheckController,
  autoFillMaterialHsnSacController,
};
