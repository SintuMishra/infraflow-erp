const express = require("express");
const {
  getAllPartiesController,
  getPartyLookupController,
  createPartyController,
  updatePartyController,
  updatePartyStatusController,
} = require("./parties.controller");
const {
  validateCreatePartyInput,
  validateUpdatePartyInput,
  validatePartyStatusPayload,
} = require("./parties.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/lookup",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getPartyLookupController
);

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getAllPartiesController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreatePartyInput,
  createPartyController
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateUpdatePartyInput,
  updatePartyController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validatePartyStatusPayload,
  updatePartyStatusController
);

module.exports = router;
