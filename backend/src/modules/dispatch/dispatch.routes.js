const express = require("express");
const {
  getAllDispatchReports,
  getDispatchReportByIdController,
  createDispatchDailyReport,
  editDispatchReportController,
  updateDispatchStatusController,
} = require("./dispatch.controller");
const {
  validateDispatchReportInput,
  validateDispatchEditInput,
  validateDispatchStatusInput,
} = require("./dispatch.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getAllDispatchReports
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getDispatchReportByIdController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  validateDispatchReportInput,
  createDispatchDailyReport
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  validateDispatchEditInput,
  editDispatchReportController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  validateDispatchStatusInput,
  updateDispatchStatusController
);

module.exports = router;
