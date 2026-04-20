const {
  getVehicles,
  createVehicle,
  editVehicle,
  toggleVehicleStatus,
  listReports,
  createReport,
  editReport,
  removeReport,
} = require("./boulder_reports.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ROUTE_TYPES = ["to_stock_yard", "direct_to_crushing_hub"];

const parsePositiveInteger = (value, field) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const normalizeListQueryFilters = (query = {}) => {
  const search = String(query.search || "").trim();
  const contractorName = String(query.contractorName || "").trim();
  const routeType = String(query.routeType || "").trim();
  const startDate = String(query.startDate || "").trim();
  const endDate = String(query.endDate || "").trim();
  const rawPlantId = String(query.plantId || "").trim();
  const rawShiftId = String(query.shiftId || "").trim();
  const rawCrusherUnitId = String(query.crusherUnitId || "").trim();
  const rawVehicleId = String(query.vehicleId || "").trim();
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);

  const plantId = rawPlantId ? parsePositiveInteger(rawPlantId, "plantId") : null;
  const shiftId = rawShiftId ? parsePositiveInteger(rawShiftId, "shiftId") : null;
  const crusherUnitId = rawCrusherUnitId
    ? parsePositiveInteger(rawCrusherUnitId, "crusherUnitId")
    : null;
  const vehicleId = rawVehicleId ? parsePositiveInteger(rawVehicleId, "vehicleId") : null;

  if (routeType && !ALLOWED_ROUTE_TYPES.includes(routeType)) {
    const error = new Error("routeType must be to_stock_yard or direct_to_crushing_hub");
    error.statusCode = 400;
    throw error;
  }

  if (startDate && !DATE_ONLY_PATTERN.test(startDate)) {
    const error = new Error("startDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  if (endDate && !DATE_ONLY_PATTERN.test(endDate)) {
    const error = new Error("endDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  if (startDate && endDate && startDate > endDate) {
    const error = new Error("startDate cannot be later than endDate");
    error.statusCode = 400;
    throw error;
  }

  return {
    search,
    contractorName,
    routeType,
    startDate,
    endDate,
    plantId,
    shiftId,
    crusherUnitId,
    vehicleId,
    page,
    limit,
  };
};

const getBoulderVehiclesController = async (req, res) => {
  try {
    const vehicles = await getVehicles(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load boulder vehicles");
  }
};

const createBoulderVehicleController = async (req, res) => {
  try {
    const vehicle = await createVehicle({
      ...req.body,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "boulder.vehicle.created",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_vehicle",
      targetId: vehicle?.id || null,
      companyId: req.companyId || null,
      details: {
        vehicleNumber: vehicle?.vehicleNumber || null,
        contractorName: vehicle?.contractorName || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Boulder logistics vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create boulder vehicle");
  }
};

const updateBoulderVehicleController = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, "vehicleId");

    const vehicle = await editVehicle({
      ...req.body,
      id,
      companyId: req.companyId || null,
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Boulder vehicle not found",
      });
    }

    await recordAuditEvent({
      action: "boulder.vehicle.updated",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_vehicle",
      targetId: vehicle.id,
      companyId: req.companyId || null,
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        contractorName: vehicle.contractorName,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Boulder logistics vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update boulder vehicle");
  }
};

const updateBoulderVehicleStatusController = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, "vehicleId");

    const vehicle = await toggleVehicleStatus({
      id,
      companyId: req.companyId || null,
      isActive: req.body.isActive,
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Boulder vehicle not found",
      });
    }

    await recordAuditEvent({
      action: "boulder.vehicle.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_vehicle",
      targetId: vehicle.id,
      companyId: req.companyId || null,
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        isActive: vehicle.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Boulder logistics vehicle status updated successfully",
      data: vehicle,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update boulder vehicle status");
  }
};

const getBoulderReportsController = async (req, res) => {
  try {
    const filters = normalizeListQueryFilters(req.query || {});
    const reports = await listReports({
      companyId: req.companyId || null,
      ...filters,
    });

    return res.status(200).json({
      success: true,
      data: reports.items,
      meta: {
        filters,
        summary: reports.summary,
        pagination: reports.pagination,
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load boulder reports");
  }
};

const createBoulderReportController = async (req, res) => {
  try {
    const report = await createReport({
      ...req.body,
      companyId: req.companyId || null,
      createdBy: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "boulder.report.created",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_report",
      targetId: report?.id || null,
      companyId: req.companyId || null,
      details: {
        reportDate: report?.reportDate || null,
        plantId: report?.plantId || null,
        routeType: report?.routeType || null,
        vehicleNumber: report?.vehicleNumberSnapshot || null,
        contractorName: report?.contractorNameSnapshot || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Boulder daily report created successfully",
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create boulder report");
  }
};

const updateBoulderReportController = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, "reportId");

    const report = await editReport({
      ...req.body,
      id,
      companyId: req.companyId || null,
      updatedBy: req.user?.userId || null,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Boulder report not found",
      });
    }

    await recordAuditEvent({
      action: "boulder.report.updated",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_report",
      targetId: report.id,
      companyId: req.companyId || null,
      details: {
        reportDate: report.reportDate,
        plantId: report.plantId,
        routeType: report.routeType,
        vehicleNumber: report.vehicleNumberSnapshot,
        contractorName: report.contractorNameSnapshot,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Boulder daily report updated successfully",
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update boulder report");
  }
};

const deleteBoulderReportController = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, "reportId");

    const deletedId = await removeReport({
      id,
      companyId: req.companyId || null,
    });

    if (!deletedId) {
      return res.status(404).json({
        success: false,
        message: "Boulder report not found",
      });
    }

    await recordAuditEvent({
      action: "boulder.report.deleted",
      actorUserId: req.user?.userId || null,
      targetType: "boulder_report",
      targetId: deletedId,
      companyId: req.companyId || null,
      details: {},
    });

    return res.status(200).json({
      success: true,
      message: "Boulder daily report deleted successfully",
      data: { id: deletedId },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to delete boulder report");
  }
};

module.exports = {
  getBoulderVehiclesController,
  createBoulderVehicleController,
  updateBoulderVehicleController,
  updateBoulderVehicleStatusController,
  getBoulderReportsController,
  createBoulderReportController,
  updateBoulderReportController,
  deleteBoulderReportController,
};
