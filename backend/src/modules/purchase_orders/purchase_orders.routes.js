const express = require("express");
const {
  getAllPurchaseOrders,
  getPurchaseOrderDetails,
  addPurchaseOrder,
  editPurchaseOrderController,
  updatePurchaseOrderStatusController,
} = require("./purchase_orders.controller");
const {
  validateCreatePurchaseOrderInput,
  validateUpdatePurchaseOrderInput,
  validatePurchaseOrderStatusPayload,
} = require("./purchase_orders.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getAllPurchaseOrders
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getPurchaseOrderDetails
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreatePurchaseOrderInput,
  addPurchaseOrder
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateUpdatePurchaseOrderInput,
  editPurchaseOrderController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validatePurchaseOrderStatusPayload,
  updatePurchaseOrderStatusController
);

module.exports = router;
