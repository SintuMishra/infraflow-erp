const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  listPayablesController,
  createPayableController,
  settlePayableController,
} = require("./accounts_payable.controller");
const {
  validateCreatePayablePayload,
  validateSettlePayablePayload,
} = require("./accounts_payable.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listPayablesController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreatePayablePayload,
  createPayableController
);

router.post(
  "/:id/settle",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateSettlePayablePayload,
  settlePayableController
);

module.exports = router;
