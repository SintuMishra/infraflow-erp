const {
  getDispatchReports,
  getDispatchReportById,
  createDispatchReport,
  editDispatchReport,
  updateDispatchStatus,
} = require("./dispatch.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { resolveReportDateRange } = require("../../utils/reportDateRange.util");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_SOURCE_TYPES = ["Crusher", "Project", "Plant", "Store"];
const ALLOWED_STATUSES = ["pending", "completed", "cancelled"];
const ALLOWED_LINK_FILTERS = ["linked", "unlinked"];

const handleDispatchDbError = (res, error) => {
  if (!error?.code) {
    return false;
  }

  if (
    error.code === "23514" &&
    String(error.constraint || "").includes("dispatch_reports_royalty_mode_check")
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid royalty mode for dispatch billing configuration",
    });
    return true;
  }

  return false;
};

const normalizeDispatchQueryFilters = (query = {}) => {
  const search = String(query.search || "").trim();
  const rawPlantId = String(query.plantId || "").trim();
  const rawPartyId = String(query.partyId || "").trim();
  const rawMaterialId = String(query.materialId || "").trim();
  const linkedOrderFilter = String(query.linkedOrderFilter || "").trim();
  const sourceType = String(query.sourceType || "").trim();
  const status = String(query.status || "").trim();
  const dateFrom = String(query.dateFrom || "").trim();
  const dateTo = String(query.dateTo || "").trim();
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const plantId = rawPlantId ? Number(rawPlantId) : null;
  const partyId = rawPartyId ? Number(rawPartyId) : null;
  const materialId = rawMaterialId ? Number(rawMaterialId) : null;

  if (rawPlantId && (!Number.isInteger(plantId) || plantId <= 0)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "plantId must be a positive integer";
    throw error;
  }

  if (rawPartyId && (!Number.isInteger(partyId) || partyId <= 0)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "partyId must be a positive integer";
    throw error;
  }

  if (rawMaterialId && (!Number.isInteger(materialId) || materialId <= 0)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "materialId must be a positive integer";
    throw error;
  }

  if (linkedOrderFilter && !ALLOWED_LINK_FILTERS.includes(linkedOrderFilter)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "linkedOrderFilter must be linked or unlinked";
    throw error;
  }

  if (sourceType && !ALLOWED_SOURCE_TYPES.includes(sourceType)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "sourceType is invalid";
    throw error;
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "status is invalid";
    throw error;
  }

  if (dateFrom && !DATE_ONLY_PATTERN.test(dateFrom)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "dateFrom must use YYYY-MM-DD format";
    throw error;
  }

  if (dateTo && !DATE_ONLY_PATTERN.test(dateTo)) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "dateTo must use YYYY-MM-DD format";
    throw error;
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error("INVALID_DISPATCH_REPORT_FILTERS");
    error.details = "dateFrom cannot be later than dateTo";
    throw error;
  }

  return {
    search,
    plantId,
    partyId,
    materialId,
    linkedOrderFilter,
    sourceType,
    status,
    dateFrom,
    dateTo,
    page,
    limit,
  };
};

const getAllDispatchReports = async (req, res) => {
  try {
    const filters = normalizeDispatchQueryFilters(req.query || {});
    const resolvedRange = resolveReportDateRange({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      defaultDays: 30,
    });
    const reports = await getDispatchReports({
      companyId: req.companyId || null,
      ...filters,
      dateFrom: resolvedRange.dateFrom,
      dateTo: resolvedRange.dateTo,
    });

    return res.status(200).json({
      success: true,
      data: reports.items,
      meta: {
        filters: {
          ...filters,
          dateFrom: resolvedRange.dateFrom,
          dateTo: resolvedRange.dateTo,
        },
        summary: reports.summary,
        pagination: reports.pagination,
      },
    });
  } catch (error) {
    if (error.message === "INVALID_DISPATCH_REPORT_FILTERS") {
      return res.status(400).json({
        success: false,
        message: error.details || "Invalid dispatch report filters",
      });
    }

    return sendControllerError(req, res, error, "Failed to load dispatch reports");
  }
};

const getDispatchReportByIdController = async (req, res) => {
  try {
    const report = await getDispatchReportById(req.params.id, req.companyId || null);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load dispatch report");
  }
};

const createDispatchDailyReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user.userId,
      companyId: req.companyId || null,
    };

    const report = await createDispatchReport(payload);

    await recordAuditEvent({
      action: "dispatch.created",
      actorUserId: req.user?.userId || null,
      targetType: "dispatch_report",
      targetId: report.id,
      companyId: req.companyId || null,
      details: {
        dispatchDate: report.dispatchDate || req.body.dispatchDate || null,
        invoiceNumber: report.invoiceNumber || req.body.invoiceNumber || null,
        vehicleId: report.vehicleId || req.body.vehicleId || null,
        partyId: report.partyId || req.body.partyId || null,
        materialId: report.materialId || req.body.materialId || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Dispatch report created successfully",
      data: report,
    });
  } catch (error) {
    if (handleDispatchDbError(res, error)) {
      return;
    }

    return sendControllerError(req, res, error, "Failed to create dispatch report");
  }
};

const editDispatchReportController = async (req, res) => {
  try {
    const report = await editDispatchReport({
      reportId: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });

    await recordAuditEvent({
      action: "dispatch.updated",
      actorUserId: req.user?.userId || null,
      targetType: "dispatch_report",
      targetId: report.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        invoiceNumber: report.invoiceNumber || req.body.invoiceNumber || null,
        status: report.status || req.body.status || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Dispatch report updated successfully",
      data: report,
    });
  } catch (error) {
    if (handleDispatchDbError(res, error)) {
      return;
    }

    return sendControllerError(req, res, error, "Failed to update dispatch report");
  }
};

const updateDispatchStatusController = async (req, res) => {
  try {
    const report = await updateDispatchStatus({
      reportId: req.params.id,
      status: req.body.status,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "dispatch.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "dispatch_report",
      targetId: report.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        status: req.body.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Dispatch status updated successfully",
      data: report,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update dispatch status");
  }
};

module.exports = {
  getAllDispatchReports,
  getDispatchReportByIdController,
  createDispatchDailyReport,
  editDispatchReportController,
  updateDispatchStatusController,
};
