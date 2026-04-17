const express = require("express");
const {
  getAllPartyOrdersController,
  createPartyOrderController,
  updatePartyOrderController,
  updatePartyOrderStatusController,
} = require("./party_orders.controller");
const {
  validatePartyOrderPayload,
  validatePartyOrderStatusPayload,
} = require("./party_orders.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getAllPartyOrdersController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validatePartyOrderPayload,
  createPartyOrderController
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validatePartyOrderPayload,
  updatePartyOrderController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validatePartyOrderStatusPayload,
  updatePartyOrderStatusController
);

module.exports = router;
