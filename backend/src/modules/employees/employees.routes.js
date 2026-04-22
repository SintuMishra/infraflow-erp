const express = require("express");
const {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateStatus,
  updateLoginStatus,
} = require("./employees.controller");
const {
  validateCreateEmployeeInput,
  validateEmployeeUpdateInput,
  validateEmployeeStatusInput,
} = require("./employees.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "hr", "manager"),
  getEmployees
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreateEmployeeInput,
  createEmployee
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "hr", "manager"),
  validateEmployeeUpdateInput,
  updateEmployee
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateEmployeeStatusInput,
  updateStatus
);

router.patch(
  "/:id/login-status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  updateLoginStatus
);

module.exports = router;
