const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_REPORT_STATUSES = ["on_track", "watch", "blocked", "completed"];
const SHIFT_VALUE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

const normalizeShiftValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const validateProjectReportInput = (req, res, next) => {
  const {
    reportDate,
    plantId,
    projectName,
    siteName,
    workDone,
    labourCount,
    machineCount,
    progressPercent,
    reportStatus,
    shift,
  } = req.body;

  if (
    !String(reportDate || "").trim() ||
    plantId === undefined ||
    plantId === null ||
    plantId === "" ||
    !String(projectName || "").trim() ||
    !String(siteName || "").trim() ||
    !String(workDone || "").trim() ||
    labourCount === undefined ||
    machineCount === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "reportDate, plantId, projectName, siteName, workDone, labourCount, and machineCount are required",
    });
  }

  if (!Number.isInteger(Number(plantId)) || Number(plantId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a positive integer",
    });
  }

  if (!DATE_ONLY_PATTERN.test(String(reportDate).trim())) {
    return res.status(400).json({
      success: false,
      message: "reportDate must use YYYY-MM-DD format",
    });
  }

  if (Number(labourCount) < 0 || Number(machineCount) < 0) {
    return res.status(400).json({
      success: false,
      message: "labourCount and machineCount cannot be negative",
    });
  }

  if (
    progressPercent !== undefined &&
    progressPercent !== null &&
    progressPercent !== "" &&
    (Number(progressPercent) < 0 || Number(progressPercent) > 100)
  ) {
    return res.status(400).json({
      success: false,
      message: "progressPercent must be between 0 and 100",
    });
  }

  if (
    reportStatus &&
    !ALLOWED_REPORT_STATUSES.includes(String(reportStatus).trim().toLowerCase())
  ) {
    return res.status(400).json({
      success: false,
      message: `reportStatus must be one of: ${ALLOWED_REPORT_STATUSES.join(", ")}`,
    });
  }

  const normalizedShift = normalizeShiftValue(shift);
  if (shift && !SHIFT_VALUE_PATTERN.test(normalizedShift)) {
    return res.status(400).json({
      success: false,
      message:
        "shift must be 2-50 chars and use letters, numbers, spaces, hyphens, or underscores",
    });
  }

  req.body.shift = normalizedShift;
  req.body.reportStatus = String(reportStatus || "")
    .trim()
    .toLowerCase();

  return next();
};

module.exports = {
  validateProjectReportInput,
};
