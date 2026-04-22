const {
  listRequests,
  getRequest,
  createRequest,
  editRequest,
  changeRequestStatus,
} = require("./purchase_requests.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const resolveScopedCompanyId = (req) =>
  normalizeCompanyId(req.companyId ?? req.user?.companyId ?? req.headers["x-company-id"]);

const getAllPurchaseRequests = async (req, res) => {
  try {
    const data = await listRequests({
      companyId: resolveScopedCompanyId(req),
      status: req.query?.status,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase requests");
  }
};

const getPurchaseRequestDetails = async (req, res) => {
  try {
    const data = await getRequest({
      id: req.params.id,
      companyId: resolveScopedCompanyId(req),
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase request");
  }
};

const addPurchaseRequest = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await createRequest({
      ...req.body,
      requestedByEmployeeId: req.body?.requestedByEmployeeId || req.user?.employeeId || null,
      companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_request.created",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_request",
      targetId: data.id,
      companyId,
      details: {
        requestNumber: data.requestNumber,
        vendorId: data.vendorId,
        requestedByEmployeeId: data.requestedByEmployeeId || null,
        status: data.status,
        totalAmount: data.totalAmount,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Purchase request created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create purchase request");
  }
};

const editPurchaseRequestController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await editRequest({
      id: req.params.id,
      companyId,
      ...req.body,
    });

    await recordAuditEvent({
      action: "purchase_request.updated",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_request",
      targetId: data.id,
      companyId,
      details: {
        status: data.status,
        totalAmount: data.totalAmount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase request updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update purchase request");
  }
};

const updatePurchaseRequestStatusController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await changeRequestStatus({
      id: req.params.id,
      companyId,
      status: req.body.status,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_request.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_request",
      targetId: data.id,
      companyId,
      details: {
        status: data.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase request status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update purchase request status");
  }
};

module.exports = {
  addPurchaseRequest,
  editPurchaseRequestController,
  getAllPurchaseRequests,
  getPurchaseRequestDetails,
  updatePurchaseRequestStatusController,
};
