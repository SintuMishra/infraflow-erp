const {
  listOrders,
  getOrder,
  createOrder,
  editOrder,
  changeOrderStatus,
} = require("./purchase_orders.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const resolveScopedCompanyId = (req) =>
  normalizeCompanyId(req.companyId ?? req.user?.companyId ?? req.headers["x-company-id"]);

const getAllPurchaseOrders = async (req, res) => {
  try {
    const data = await listOrders({
      companyId: resolveScopedCompanyId(req),
      status: req.query?.status,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase orders");
  }
};

const getPurchaseOrderDetails = async (req, res) => {
  try {
    const data = await getOrder({
      id: req.params.id,
      companyId: resolveScopedCompanyId(req),
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase order");
  }
};

const addPurchaseOrder = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await createOrder({
      ...req.body,
      companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_order.created",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_order",
      targetId: data.id,
      companyId,
      details: {
        poNumber: data.poNumber,
        vendorId: data.vendorId,
        status: data.status,
        totalAmount: data.totalAmount,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create purchase order");
  }
};

const editPurchaseOrderController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await editOrder({
      id: req.params.id,
      companyId,
      ...req.body,
    });

    await recordAuditEvent({
      action: "purchase_order.updated",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_order",
      targetId: data.id,
      companyId,
      details: {
        status: data.status,
        totalAmount: data.totalAmount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update purchase order");
  }
};

const updatePurchaseOrderStatusController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await changeOrderStatus({
      id: req.params.id,
      companyId,
      status: req.body.status,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_order.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_order",
      targetId: data.id,
      companyId,
      details: {
        status: data.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase order status updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update purchase order status");
  }
};

module.exports = {
  addPurchaseOrder,
  editPurchaseOrderController,
  getAllPurchaseOrders,
  getPurchaseOrderDetails,
  updatePurchaseOrderStatusController,
};
