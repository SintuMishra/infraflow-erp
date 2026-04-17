const express = require("express");
const {
  getAllProjectReports,
  createProjectDailyReport,
  updateProjectDailyReport,
  deleteProjectDailyReport,
} = require("./projects.controller");
const {
  validateProjectReportInput,
} = require("./projects.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "site_engineer", "hr"),
  getAllProjectReports
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "site_engineer"),
  validateProjectReportInput,
  createProjectDailyReport
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "site_engineer"),
  validateProjectReportInput,
  updateProjectDailyReport
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "site_engineer"),
  deleteProjectDailyReport
);

module.exports = router;
