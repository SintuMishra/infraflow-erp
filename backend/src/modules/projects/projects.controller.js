const {
  getProjectReports,
  createProjectReport,
  editProjectReport,
  removeProjectReport,
} = require("./projects.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { resolveReportDateRange } = require("../../utils/reportDateRange.util");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeReportQueryFilters = (query = {}) => {
  const search = String(query.search || "").trim();
  const rawPlantId = String(query.plantId || "").trim();
  const projectName = String(query.projectName || "").trim();
  const siteName = String(query.siteName || "").trim();
  const reportStatus = String(query.reportStatus || "").trim();
  const startDate = String(query.startDate || "").trim();
  const endDate = String(query.endDate || "").trim();
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const plantId = rawPlantId ? Number(rawPlantId) : null;

  if (rawPlantId && (!Number.isInteger(plantId) || plantId <= 0)) {
    const error = new Error("INVALID_PROJECT_REPORT_FILTERS");
    error.details = "plantId must be a positive integer";
    throw error;
  }

  if (startDate && !DATE_ONLY_PATTERN.test(startDate)) {
    const error = new Error("INVALID_PROJECT_REPORT_FILTERS");
    error.details = "startDate must use YYYY-MM-DD format";
    throw error;
  }

  if (endDate && !DATE_ONLY_PATTERN.test(endDate)) {
    const error = new Error("INVALID_PROJECT_REPORT_FILTERS");
    error.details = "endDate must use YYYY-MM-DD format";
    throw error;
  }

  if (startDate && endDate && startDate > endDate) {
    const error = new Error("INVALID_PROJECT_REPORT_FILTERS");
    error.details = "startDate cannot be later than endDate";
    throw error;
  }

  return {
    search,
    plantId,
    projectName,
    siteName,
    reportStatus,
    startDate,
    endDate,
    page,
    limit,
  };
};

const parseProjectReportId = (rawId) => {
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("INVALID_PROJECT_REPORT_ID");
    throw error;
  }

  return id;
};

const recordProjectReportAudit = async ({
  action,
  req,
  reportId = null,
  details = {},
}) => {
  await recordAuditEvent({
    action,
    actorUserId: req.user?.userId || null,
    targetType: "project_report",
    targetId: reportId,
    companyId: req.companyId || null,
    details,
  });
};

const getAllProjectReports = async (req, res) => {
  try {
    const filters = normalizeReportQueryFilters(req.query || {});
    const resolvedRange = resolveReportDateRange({
      startDate: filters.startDate,
      endDate: filters.endDate,
      defaultDays: 30,
    });
    const reports = await getProjectReports({
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
    if (error.message === "INVALID_PROJECT_REPORT_FILTERS") {
      return res.status(400).json({
        success: false,
        message: error.details || "Invalid project report filters",
      });
    }

    return sendControllerError(req, res, error, "Failed to load project reports");
  }
};

const createProjectDailyReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user.userId,
      companyId: req.companyId || null,
    };

    const report = await createProjectReport(payload);

    await recordProjectReportAudit({
      action: "project_report.created",
      req,
      reportId: report.id,
      details: {
        plantId: report.plantId || null,
        plantName: report.plantName || null,
        projectName: report.projectName,
        siteName: report.siteName,
        reportDate: report.reportDate,
        reportStatus: report.reportStatus || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project daily report created successfully",
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create project report");
  }
};

const updateProjectDailyReport = async (req, res) => {
  try {
    const reportId = parseProjectReportId(req.params.id);
    const report = await editProjectReport({
      ...req.body,
      id: reportId,
      companyId: req.companyId || null,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Project report not found",
      });
    }

    await recordProjectReportAudit({
      action: "project_report.updated",
      req,
      reportId: report.id,
      details: {
        plantId: report.plantId || null,
        plantName: report.plantName || null,
        projectName: report.projectName,
        siteName: report.siteName,
        reportDate: report.reportDate,
        reportStatus: report.reportStatus || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Project daily report updated successfully",
      data: report,
    });
  } catch (error) {
    if (error.message === "INVALID_PROJECT_REPORT_ID") {
      return res.status(400).json({
        success: false,
        message: "Invalid project report id",
      });
    }

    return sendControllerError(req, res, error, "Failed to update project report");
  }
};

const deleteProjectDailyReport = async (req, res) => {
  try {
    const reportId = parseProjectReportId(req.params.id);
    const deletedReport = await removeProjectReport({
      id: reportId,
      companyId: req.companyId || null,
    });

    if (!deletedReport) {
      return res.status(404).json({
        success: false,
        message: "Project report not found",
      });
    }

    await recordProjectReportAudit({
      action: "project_report.deleted",
      req,
      reportId: deletedReport.id,
      details: {
        plantId: deletedReport.plantId || null,
        plantName: deletedReport.plantName || null,
        projectName: deletedReport.projectName,
        siteName: deletedReport.siteName,
        reportDate: deletedReport.reportDate,
        reportStatus: deletedReport.reportStatus || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Project daily report deleted successfully",
      data: deletedReport,
    });
  } catch (error) {
    if (error.message === "INVALID_PROJECT_REPORT_ID") {
      return res.status(400).json({
        success: false,
        message: "Invalid project report id",
      });
    }

    return sendControllerError(req, res, error, "Failed to delete project report");
  }
};

module.exports = {
  getAllProjectReports,
  createProjectDailyReport,
  updateProjectDailyReport,
  deleteProjectDailyReport,
  normalizeReportQueryFilters,
  parseProjectReportId,
};
