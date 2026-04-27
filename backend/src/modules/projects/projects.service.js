const {
  findAllProjectReports,
  findProjectReportLookups,
  findProjectReportSummary,
  insertProjectReport,
  updateProjectReportById,
  deleteProjectReportById,
} = require("./projects.model");
const { plantExists } = require("../dispatch/dispatch.model");
const { findShifts } = require("../masters/masters.model");
const { resolveReportDateRange } = require("../../utils/reportDateRange.util");

const normalizeShiftValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeProjectReportPayload = (payload = {}) => ({
  reportDate: payload.reportDate,
  plantId: Number(payload.plantId),
  projectName: String(payload.projectName || "").trim(),
  siteName: String(payload.siteName || "").trim(),
  workDone: String(payload.workDone || "").trim(),
  labourCount: Number(payload.labourCount),
  machineCount: Number(payload.machineCount),
  materialUsed: String(payload.materialUsed || "").trim(),
  remarks: String(payload.remarks || "").trim(),
  shift: normalizeShiftValue(payload.shift),
  weather: String(payload.weather || "").trim(),
  blockers: String(payload.blockers || "").trim(),
  nextPlan: String(payload.nextPlan || "").trim(),
  reportStatus: String(payload.reportStatus || "").trim(),
  progressPercent:
    payload.progressPercent === "" ||
    payload.progressPercent === null ||
    payload.progressPercent === undefined
      ? null
      : Number(payload.progressPercent),
});

const resolveMasterLinkedShift = async ({ companyId = null, shift = "" } = {}) => {
  const normalizedShift = normalizeShiftValue(shift);

  if (!normalizedShift) {
    return "";
  }

  const masterShifts = await findShifts(companyId);
  const activeShift = masterShifts.find(
    (item) =>
      item &&
      item.isActive !== false &&
      normalizeShiftValue(item.shiftName) === normalizedShift
  );

  if (!activeShift) {
    const error = new Error(
      "Shift must match an active shift configured in Masters"
    );
    error.statusCode = 400;
    throw error;
  }

  return normalizeShiftValue(activeShift.shiftName);
};

const buildProjectReportSummary = (summaryRow = {}, reports = []) => {
  const total = Number(summaryRow.total || 0);
  const totalLabour = Number(summaryRow.totalLabour || 0);
  const totalMachines = Number(summaryRow.totalMachines || 0);
  const uniqueProjects = Number(summaryRow.uniqueProjects || 0);
  const uniqueSites = Number(summaryRow.uniqueSites || 0);
  const latestDate = summaryRow.latestDate || null;
  return {
    total,
    totalLabour,
    totalMachines,
    uniqueProjects,
    uniqueSites,
    uniquePlants: Number(summaryRow.uniquePlants || 0),
    latestDate,
    averageLabourPerReport: total ? Number((totalLabour / total).toFixed(2)) : 0,
    averageMachinesPerReport: total ? Number((totalMachines / total).toFixed(2)) : 0,
    labourPerMachine: totalMachines ? Number((totalLabour / totalMachines).toFixed(2)) : 0,
    materialCoverage: total
      ? Math.round((Number(summaryRow.materialEntries || 0) / total) * 100)
      : 0,
    remarksCoverage: total
      ? Math.round((Number(summaryRow.remarkEntries || 0) / total) * 100)
      : 0,
    topProjectName: summaryRow.topProjectName || reports[0]?.projectName || "",
  };
};

const getProjectReports = async ({
  companyId = null,
  search = "",
  plantId = null,
  projectName = "",
  siteName = "",
  reportStatus = "",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 25,
} = {}) => {
  const resolvedRange = resolveReportDateRange({
    startDate,
    endDate,
    defaultDays: 30,
  });
  const filters = {
    companyId,
    search,
    plantId,
    projectName,
    siteName,
    reportStatus,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
    page,
    limit,
  };

  const [reportPage, lookups, summaryRow] = await Promise.all([
    findAllProjectReports(filters),
    findProjectReportLookups(companyId),
    findProjectReportSummary(filters),
  ]);

  return {
    items: reportPage.items,
    summary: buildProjectReportSummary(summaryRow, reportPage.items),
    lookups,
    pagination: {
      total: reportPage.total,
      page: reportPage.page,
      limit: reportPage.limit,
      totalPages: reportPage.total ? Math.ceil(reportPage.total / reportPage.limit) : 0,
      hasPreviousPage: reportPage.page > 1,
      hasNextPage:
        reportPage.total ? reportPage.page < Math.ceil(reportPage.total / reportPage.limit) : false,
    },
  };
};

const createProjectReport = async (reportData) => {
  const normalized = normalizeProjectReportPayload(reportData);

  if (!Number.isInteger(normalized.plantId) || normalized.plantId <= 0) {
    const error = new Error("Plant is required");
    error.statusCode = 400;
    throw error;
  }

  const plant = await plantExists(normalized.plantId, reportData.companyId || null);

  if (!plant) {
    const error = new Error("Selected plant does not exist");
    error.statusCode = 400;
    throw error;
  }

  normalized.shift = await resolveMasterLinkedShift({
    companyId: reportData.companyId || null,
    shift: normalized.shift,
  });

  return insertProjectReport({
    ...normalized,
    createdBy: reportData.createdBy || null,
    companyId: reportData.companyId || null,
  });
};

const editProjectReport = async (reportData) => {
  const normalized = normalizeProjectReportPayload(reportData);

  if (!Number.isInteger(normalized.plantId) || normalized.plantId <= 0) {
    const error = new Error("Plant is required");
    error.statusCode = 400;
    throw error;
  }

  const plant = await plantExists(normalized.plantId, reportData.companyId || null);

  if (!plant) {
    const error = new Error("Selected plant does not exist");
    error.statusCode = 400;
    throw error;
  }

  normalized.shift = await resolveMasterLinkedShift({
    companyId: reportData.companyId || null,
    shift: normalized.shift,
  });

  return updateProjectReportById({
    id: reportData.id,
    companyId: reportData.companyId || null,
    ...normalized,
  });
};

const removeProjectReport = async ({ id, companyId = null }) => {
  return deleteProjectReportById({ id, companyId });
};

module.exports = {
  buildProjectReportSummary,
  getProjectReports,
  createProjectReport,
  editProjectReport,
  removeProjectReport,
  normalizeProjectReportPayload,
};
