const express = require("express");
const {
  getTransportRates,
  createTransportRate,
  updateTransportRateController,
  updateTransportRateStatusController,
} = require("./transport_rates.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getTransportRates
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  createTransportRate
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  updateTransportRateController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  updateTransportRateStatusController
);

module.exports = router;
