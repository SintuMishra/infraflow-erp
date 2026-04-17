const express = require("express");
const ctrl = require("./party_material_rates.controller");
const {
  validateCreateRateInput,
  validateUpdateRateInput,
  validateRateStatusPayload,
} = require("./party_material_rates.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  ctrl.getAll
);
router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateRateInput,
  ctrl.create
);
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateUpdateRateInput,
  ctrl.update
);
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateRateStatusPayload,
  ctrl.status
);

module.exports = router;
