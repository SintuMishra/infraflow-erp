const service = require("./party_orders.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getAllPartyOrdersController = async (req, res) => {
  try {
    const data = await service.getOrders(req.companyId || null);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load party orders");
  }
};

const createPartyOrderController = async (req, res) => {
  try {
    const data = await service.createOrder({
      ...req.body,
      createdBy: req.user?.userId || null,
      updatedBy: req.user?.userId || null,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "party_order.created",
      actorUserId: req.user?.userId || null,
      targetType: "party_order",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        orderNumber: data.orderNumber,
        partyId: data.partyId,
        materialId: data.materialId,
        orderedQuantityTons: data.orderedQuantityTons,
      },
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Order number already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to create party order");
  }
};

const updatePartyOrderController = async (req, res) => {
  try {
    const data = await service.editOrder(req.params.id, {
      ...req.body,
      updatedBy: req.user?.userId || null,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "party_order.updated",
      actorUserId: req.user?.userId || null,
      targetType: "party_order",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        orderNumber: data.orderNumber,
        status: data.status,
        orderedQuantityTons: data.orderedQuantityTons,
      },
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Order number already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to update party order");
  }
};

const updatePartyOrderStatusController = async (req, res) => {
  try {
    const data = await service.changeOrderStatus(req.params.id, req.body.status, {
      updatedBy: req.user?.userId || null,
      companyId: req.companyId || null,
      actorRole: req.user?.role || null,
    });

    await recordAuditEvent({
      action: "party_order.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "party_order",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        status: data.status,
      },
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to update party order status"
    );
  }
};

module.exports = {
  getAllPartyOrdersController,
  createPartyOrderController,
  updatePartyOrderController,
  updatePartyOrderStatusController,
};
