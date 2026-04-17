const express = require("express");
const { getAuditLogsController } = require("./audit_logs.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getAuditLogsController
);

module.exports = router;
