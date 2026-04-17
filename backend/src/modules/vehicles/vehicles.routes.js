const express = require("express");
const {
  getVehicles,
  createVehicle,
  updateVehicle,
  updateVehicleStatus,
  getEquipmentLogs,
  createEquipmentLog,
} = require("./vehicles.controller");
const {
  validateCreateVehicleInput,
  validateUpdateVehicleInput,
  validateVehicleStatusUpdate,
  validateCreateEquipmentLogInput,
} = require("./vehicles.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getVehicles
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreateVehicleInput,
  createVehicle
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateUpdateVehicleInput,
  updateVehicle
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateVehicleStatusUpdate,
  updateVehicleStatus
);

router.get(
  "/equipment-logs",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getEquipmentLogs
);

router.post(
  "/equipment-logs",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor", "site_engineer"),
  validateCreateEquipmentLogInput,
  createEquipmentLog
);

module.exports = router;
