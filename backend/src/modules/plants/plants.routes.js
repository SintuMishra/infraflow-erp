const express = require("express");
const {
  getAllPlants,
  addPlant,
  editPlantController,
  updatePlantStatusController,
} = require("./plants.controller");
const {
  validateCreatePlantInput,
  validateUpdatePlantInput,
  validatePlantStatusPayload,
} = require("./plants.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getAllPlants
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreatePlantInput,
  addPlant
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateUpdatePlantInput,
  editPlantController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validatePlantStatusPayload,
  updatePlantStatusController
);

module.exports = router;
