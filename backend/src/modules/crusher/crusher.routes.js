const express = require("express");
const {
  getAllCrusherReports,
  createCrusherDailyReport,
  updateCrusherDailyReport,
  deleteCrusherDailyReport,
} = require("./crusher.controller");
const {
  validateCrusherReportInput,
} = require("./crusher.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor", "hr"),
  getAllCrusherReports
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  validateCrusherReportInput,
  createCrusherDailyReport
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  validateCrusherReportInput,
  updateCrusherDailyReport
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor"),
  deleteCrusherDailyReport
);

module.exports = router;
