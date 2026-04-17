const express = require("express");
const {
  getAllVendors,
  addVendor,
  editVendorController,
  updateVendorStatusController,
} = require("./vendors.controller");
const {
  validateCreateVendorInput,
  validateUpdateVendorInput,
  validateVendorStatusPayload,
} = require("./vendors.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getAllVendors
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateVendorInput,
  addVendor
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateUpdateVendorInput,
  editVendorController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateVendorStatusPayload,
  updateVendorStatusController
);

module.exports = router;
