const express = require("express");
const {
  getVehicles,
  getVehicleLookup,
  createVehicle,
  updateVehicle,
  updateVehicleStatus,
  getEquipmentLogs,
  getEquipmentLogReadingContext,
  createEquipmentLog,
  updateEquipmentLog,
  deleteEquipmentLog,
} = require("./vehicles.controller");
const {
  validateCreateVehicleInput,
  validateUpdateVehicleInput,
  validateVehicleStatusUpdate,
  validateEquipmentLogContextInput,
  validateCreateEquipmentLogInput,
  validateEquipmentLogIdParam,
} = require("./vehicles.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/lookup",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getVehicleLookup
);

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

router.get(
  "/equipment-logs/context",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  validateEquipmentLogContextInput,
  getEquipmentLogReadingContext
);

router.post(
  "/equipment-logs",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor", "site_engineer"),
  validateCreateEquipmentLogInput,
  createEquipmentLog
);

router.patch(
  "/equipment-logs/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor", "site_engineer"),
  validateEquipmentLogIdParam,
  validateCreateEquipmentLogInput,
  updateEquipmentLog
);

router.delete(
  "/equipment-logs/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "crusher_supervisor", "site_engineer"),
  validateEquipmentLogIdParam,
  deleteEquipmentLog
);

module.exports = router;
