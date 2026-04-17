const {
  getDashboardSummary,
  getCommercialExceptions,
  markCommercialExceptionReviewed,
  assignCommercialException,
} = require("./dashboard.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { getEmployeesList } = require("../employees/employees.service");

const dashboardSummary = async (req, res) => {
  try {
    const summary = await getDashboardSummary(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load dashboard data");
  }
};

const dashboardCommercialExceptions = async (req, res) => {
  try {
    const data = await getCommercialExceptions(req.companyId || null, {
      partyId: req.query.partyId || "",
      exceptionType: req.query.exceptionType || "",
      assignedEmployeeId: req.query.assignedEmployeeId || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
      includeReviewed: req.query.includeReviewed || false,
      reviewedOnly: req.query.reviewedOnly || false,
      page: req.query.page || 1,
      limit: req.query.limit || 250,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error.message === "INVALID_COMMERCIAL_EXCEPTION_FILTERS") {
      return res.status(400).json({
        success: false,
        message: error.details || "Invalid commercial exception filters",
      });
    }

    return sendControllerError(
      req,
      res,
      error,
      "Failed to load commercial exceptions"
    );
  }
};

const reviewCommercialExceptionController = async (req, res) => {
  try {
    const data = await markCommercialExceptionReviewed({
      companyId: req.companyId || null,
      exceptionKey: req.body.exceptionKey,
      actorUserId: req.user?.userId || null,
      actorName: req.user?.fullName || req.user?.name || "",
      actorUsername: req.user?.username || "",
      exceptionType: req.body.exceptionType || "",
      entityId: req.body.entityId,
      reference: req.body.reference || "",
      notes: req.body.notes || "",
    });

    await recordAuditEvent({
      action: "commercial_exception.reviewed",
      actorUserId: req.user?.userId || null,
      targetType: "commercial_exception",
      targetId: data.entityId,
      companyId: req.companyId || null,
      details: data,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to review commercial exception"
    );
  }
};

const assignCommercialExceptionController = async (req, res) => {
  try {
    const employees = await getEmployeesList(req.companyId || null);
    const assignee = employees.find(
      (employee) =>
        String(employee.id) === String(req.body.assigneeEmployeeId) &&
        String(employee.status || "").toLowerCase() === "active"
    );

    if (!assignee) {
      return res.status(400).json({
        success: false,
        message: "Selected assignee must be an active employee",
      });
    }

    const data = await assignCommercialException({
      companyId: req.companyId || null,
      exceptionKey: req.body.exceptionKey,
      actorUserId: req.user?.userId || null,
      actorName: req.user?.fullName || req.user?.name || "",
      actorUsername: req.user?.username || "",
      exceptionType: req.body.exceptionType || "",
      entityId: req.body.entityId,
      reference: req.body.reference || "",
      assigneeEmployeeId: assignee.id,
      assigneeName: assignee.fullName || "",
      assigneeEmployeeCode: assignee.employeeCode || "",
    });

    await recordAuditEvent({
      action: "commercial_exception.assigned",
      actorUserId: req.user?.userId || null,
      targetType: "commercial_exception",
      targetId: data.entityId,
      companyId: req.companyId || null,
      details: data,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to assign commercial exception"
    );
  }
};

module.exports = {
  dashboardSummary,
  dashboardCommercialExceptions,
  reviewCommercialExceptionController,
  assignCommercialExceptionController,
};
