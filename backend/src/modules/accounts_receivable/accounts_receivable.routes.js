const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  listReceivablesController,
  markDispatchReadyController,
  createFromDispatchController,
  settleReceivableController,
} = require("./accounts_receivable.controller");
const {
  validateDispatchReadyPayload,
  validateCreateReceivableFromDispatchPayload,
  validateSettleReceivablePayload,
} = require("./accounts_receivable.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listReceivablesController
);

router.post(
  "/dispatch/:dispatchId/mark-ready",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateDispatchReadyPayload,
  markDispatchReadyController
);

router.post(
  "/dispatch/:dispatchId/create",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateReceivableFromDispatchPayload,
  createFromDispatchController
);

router.post(
  "/:id/settle",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateSettleReceivablePayload,
  settleReceivableController
);

module.exports = router;
