const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  getBoulderVehiclesController,
  createBoulderVehicleController,
  updateBoulderVehicleController,
  updateBoulderVehicleStatusController,
  getBoulderReportsController,
  createBoulderReportController,
  updateBoulderReportController,
  deleteBoulderReportController,
} = require("./boulder_reports.controller");
const {
  validateVehicleInput,
  validateVehicleStatusInput,
  validateReportInput,
} = require("./boulder_reports.validation");

const router = express.Router();

router.get(
  "/vehicles",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getBoulderVehiclesController
);

router.post(
  "/vehicles",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  validateVehicleInput,
  createBoulderVehicleController
);

router.patch(
  "/vehicles/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  validateVehicleInput,
  updateBoulderVehicleController
);

router.patch(
  "/vehicles/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  validateVehicleStatusInput,
  updateBoulderVehicleStatusController
);

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getBoulderReportsController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  validateReportInput,
  createBoulderReportController
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  validateReportInput,
  updateBoulderReportController
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor"),
  deleteBoulderReportController
);

module.exports = router;
