const {
  getCrusherReports,
  createCrusherReport,
  editCrusherReport,
  removeCrusherReport,
} = require("./crusher.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { resolveReportDateRange } = require("../../utils/reportDateRange.util");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeCrusherQueryFilters = (query = {}) => {
  const search = String(query.search || "").trim();
  const shift = String(query.shift || "").trim();
  const rawPlantId = String(query.plantId || "").trim();
  const crusherUnitName = String(query.crusherUnitName || "").trim();
  const materialType = String(query.materialType || "").trim();
  const operationalStatus = String(query.operationalStatus || "").trim();
  const startDate = String(query.startDate || "").trim();
  const endDate = String(query.endDate || "").trim();
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const plantId = rawPlantId ? Number(rawPlantId) : null;

  if (rawPlantId && (!Number.isInteger(plantId) || plantId <= 0)) {
    const error = new Error("INVALID_CRUSHER_REPORT_FILTERS");
    error.details = "plantId must be a positive integer";
    throw error;
  }

  if (startDate && !DATE_ONLY_PATTERN.test(startDate)) {
    const error = new Error("INVALID_CRUSHER_REPORT_FILTERS");
    error.details = "startDate must use YYYY-MM-DD format";
    throw error;
  }

  if (endDate && !DATE_ONLY_PATTERN.test(endDate)) {
    const error = new Error("INVALID_CRUSHER_REPORT_FILTERS");
    error.details = "endDate must use YYYY-MM-DD format";
    throw error;
  }

  if (startDate && endDate && startDate > endDate) {
    const error = new Error("INVALID_CRUSHER_REPORT_FILTERS");
    error.details = "startDate cannot be later than endDate";
    throw error;
  }

  return {
    search,
    shift,
    plantId,
    crusherUnitName,
    materialType,
    operationalStatus,
    startDate,
    endDate,
    page,
    limit,
  };
};

const parseCrusherReportId = (rawId) => {
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("INVALID_CRUSHER_REPORT_ID");
    throw error;
  }

  return id;
};

const recordCrusherAudit = async ({ action, req, reportId = null, details = {} }) => {
  await recordAuditEvent({
    action,
    actorUserId: req.user?.userId || null,
    targetType: "crusher_report",
    targetId: reportId,
    companyId: req.companyId || null,
    details,
  });
};

const getAllCrusherReports = async (req, res) => {
  try {
    const filters = normalizeCrusherQueryFilters(req.query || {});
    const resolvedRange = resolveReportDateRange({
      startDate: filters.startDate,
      endDate: filters.endDate,
      defaultDays: 30,
    });
    const reports = await getCrusherReports({
      companyId: req.companyId || null,
      ...filters,
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate,
    });

    return res.status(200).json({
      success: true,
      data: reports.items,
      meta: {
        filters: {
          ...filters,
          startDate: resolvedRange.startDate,
          endDate: resolvedRange.endDate,
        },
        summary: reports.summary,
        lookups: reports.lookups,
        pagination: reports.pagination,
      },
    });
  } catch (error) {
    if (error.message === "INVALID_CRUSHER_REPORT_FILTERS") {
      return res.status(400).json({
        success: false,
        message: error.details || "Invalid crusher report filters",
      });
    }

    return sendControllerError(req, res, error, "Failed to load crusher reports");
  }
};

const createCrusherDailyReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user.userId,
      companyId: req.companyId || null,
    };

    const report = await createCrusherReport(payload);

    await recordCrusherAudit({
      action: "crusher_report.created",
      req,
      reportId: report.id,
      details: {
        plantId: report.plantId || null,
        plantName: report.plantName || null,
        crusherUnitName: report.crusherUnitName,
        materialType: report.materialType,
        reportDate: report.reportDate,
        operationalStatus: report.operationalStatus || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Crusher daily report created successfully",
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create crusher report");
  }
};

const updateCrusherDailyReport = async (req, res) => {
  try {
    const reportId = parseCrusherReportId(req.params.id);
    const report = await editCrusherReport({
      ...req.body,
      id: reportId,
      companyId: req.companyId || null,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Crusher report not found",
      });
    }

    await recordCrusherAudit({
      action: "crusher_report.updated",
      req,
      reportId: report.id,
      details: {
        plantId: report.plantId || null,
        plantName: report.plantName || null,
        crusherUnitName: report.crusherUnitName,
        materialType: report.materialType,
        reportDate: report.reportDate,
        operationalStatus: report.operationalStatus || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Crusher daily report updated successfully",
      data: report,
    });
  } catch (error) {
    if (error.message === "INVALID_CRUSHER_REPORT_ID") {
      return res.status(400).json({
        success: false,
        message: "Invalid crusher report id",
      });
    }

    return sendControllerError(req, res, error, "Failed to update crusher report");
  }
};

const deleteCrusherDailyReport = async (req, res) => {
  try {
    const reportId = parseCrusherReportId(req.params.id);
    const report = await removeCrusherReport({
      id: reportId,
      companyId: req.companyId || null,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Crusher report not found",
      });
    }

    await recordCrusherAudit({
      action: "crusher_report.deleted",
      req,
      reportId: report.id,
      details: {
        plantId: report.plantId || null,
        plantName: report.plantName || null,
        crusherUnitName: report.crusherUnitName,
        materialType: report.materialType,
        reportDate: report.reportDate,
        operationalStatus: report.operationalStatus || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Crusher daily report deleted successfully",
      data: report,
    });
  } catch (error) {
    if (error.message === "INVALID_CRUSHER_REPORT_ID") {
      return res.status(400).json({
        success: false,
        message: "Invalid crusher report id",
      });
    }

    return sendControllerError(req, res, error, "Failed to delete crusher report");
  }
};

module.exports = {
  getAllCrusherReports,
  createCrusherDailyReport,
  updateCrusherDailyReport,
  deleteCrusherDailyReport,
  normalizeCrusherQueryFilters,
  parseCrusherReportId,
};
