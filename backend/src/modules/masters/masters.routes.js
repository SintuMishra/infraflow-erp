const express = require("express");
const {
  getMasters,
  addConfigOption,
  editConfigOptionController,
  toggleConfigOptionController,
  addCrusherUnit,
  addMaterial,
  addShift,
  addVehicleType,
  editCrusherUnitController,
  editMaterialController,
  editShiftController,
  editVehicleTypeController,
  toggleCrusherUnitController,
  toggleMaterialController,
  toggleShiftController,
  toggleVehicleTypeController,
  getMasterHealthCheckController,
  autoFillMaterialHsnSacController,
} = require("./masters.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles(
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer"
  ),
  getMasters
);

router.get(
  "/health-check",
  authenticate,
  authorizeRoles(
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer"
  ),
  getMasterHealthCheckController
);

router.post(
  "/config-options",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  addConfigOption
);

router.patch(
  "/config-options/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  editConfigOptionController
);

router.patch(
  "/config-options/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  toggleConfigOptionController
);

router.post(
  "/crusher-units",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  addCrusherUnit
);

router.post(
  "/materials",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  addMaterial
);

router.post(
  "/shifts",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  addShift
);

router.post(
  "/vehicle-types",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  addVehicleType
);

router.post(
  "/materials/auto-fill-hsn",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  autoFillMaterialHsnSacController
);

router.patch(
  "/crusher-units/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  editCrusherUnitController
);

router.patch(
  "/materials/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  editMaterialController
);

router.patch(
  "/shifts/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  editShiftController
);

router.patch(
  "/vehicle-types/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  editVehicleTypeController
);

router.patch(
  "/crusher-units/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  toggleCrusherUnitController
);

router.patch(
  "/materials/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  toggleMaterialController
);

router.patch(
  "/shifts/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  toggleShiftController
);

router.patch(
  "/vehicle-types/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  toggleVehicleTypeController
);

module.exports = router;
