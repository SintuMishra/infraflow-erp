const {
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
} = require("./vehicles.service");
const { sendControllerError } = require("../../utils/http.util");
const {
  normalizePage,
  normalizeLimit,
  shouldUsePaginatedResponse,
} = require("../../utils/pagination.util");

const getVehicles = async (req, res) => {
  try {
    if (shouldUsePaginatedResponse(req.query || {})) {
      const pageData = await getVehiclesPage({
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
            totalPages: pageData.total
              ? Math.ceil(pageData.total / pageData.limit)
              : 0,
          },
        },
      });
    }

    const vehicles = await getVehiclesList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load vehicles");
  }
};

const getVehicleLookup = async (req, res) => {
  try {
    const vehicles = await getVehicleLookupList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load vehicles lookup");
  }
};

const createVehicle = async (req, res) => {
  try {
    const vehicle = await createVehicleRecord({
      ...req.body,
      companyId: req.companyId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("POST /vehicles error:", error);

    return sendControllerError(req, res, error, "Failed to create vehicle");
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await updateVehicleRecord({
      vehicleId: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("PATCH /vehicles/:id error:", error);

    return sendControllerError(req, res, error, "Failed to update vehicle");
  }
};

const updateVehicleStatus = async (req, res) => {
  try {
    const vehicle = await updateVehicleStatusRecord({
      vehicleId: req.params.id,
      status: req.body.status,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Vehicle status updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("PATCH /vehicles/:id/status error:", error);

    return sendControllerError(req, res, error, "Failed to update vehicle status");
  }
};

const getEquipmentLogs = async (req, res) => {
  try {
    const logs = await getEquipmentLogsList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("GET /vehicles/equipment-logs error:", error);

    return sendControllerError(req, res, error, "Failed to load equipment logs");
  }
};

const getEquipmentLogReadingContext = async (req, res) => {
  try {
    const context = await getEquipmentLogContext({
      equipmentName: req.query.equipmentName,
      equipmentType: req.query.equipmentType,
      plantId: req.query.plantId,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error("GET /vehicles/equipment-logs/context error:", error);

    return sendControllerError(
      req,
      res,
      error,
      "Failed to load equipment reading context"
    );
  }
};

const createEquipmentLog = async (req, res) => {
  try {
    const log = await createEquipmentLogRecord({
      ...req.body,
      createdBy: req.user.userId,
      companyId: req.companyId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Equipment log created successfully",
      data: log,
    });
  } catch (error) {
    console.error("POST /vehicles/equipment-logs error:", error);

    return sendControllerError(req, res, error, "Failed to create equipment log");
  }
};

const updateEquipmentLog = async (req, res) => {
  try {
    const log = await updateEquipmentLogRecord({
      logId: req.params.id,
      ...req.body,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Equipment log updated successfully",
      data: log,
    });
  } catch (error) {
    console.error("PATCH /vehicles/equipment-logs/:id error:", error);

    return sendControllerError(req, res, error, "Failed to update equipment log");
  }
};

const deleteEquipmentLog = async (req, res) => {
  try {
    const result = await deleteEquipmentLogRecord({
      logId: req.params.id,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Equipment log deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("DELETE /vehicles/equipment-logs/:id error:", error);

    return sendControllerError(req, res, error, "Failed to delete equipment log");
  }
};

module.exports = {
  getVehicles,
  getVehicleLookup,
  createVehicle,
  updateVehicle,
  updateVehicleStatus,
  getEquipmentLogs,
  getEquipmentLogReadingContext,
  createEquipmentLog,
  updateEquipmentLog,
  deleteEquipmentLog,
};
