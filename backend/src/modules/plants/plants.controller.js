const {
  getPlants,
  createPlant,
  editPlant,
  changePlantStatus,
} = require("./plants.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getAllPlants = async (req, res) => {
  try {
    const data = await getPlants(req.companyId || null);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load plants");
  }
};

const addPlant = async (req, res) => {
  try {
    const data = await createPlant({
      ...req.body,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "plant.created",
      actorUserId: req.user?.userId || null,
      targetType: "plant",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        plantName: data.plantName || req.body.plantName || null,
        plantCode: data.plantCode || req.body.plantCode || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Plant created successfully",
      data,
    });
  } catch (error) {
    console.error("POST /plants error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Plant name or code already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to create plant");
  }
};

const editPlantController = async (req, res) => {
  try {
    const data = await editPlant({
      plantId: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });

    await recordAuditEvent({
      action: "plant.updated",
      actorUserId: req.user?.userId || null,
      targetType: "plant",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        plantName: data.plantName || req.body.plantName || null,
        plantCode: data.plantCode || req.body.plantCode || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Plant updated successfully",
      data,
    });
  } catch (error) {
    console.error("PATCH /plants/:id error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Plant name or code already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to update plant");
  }
};

const updatePlantStatusController = async (req, res) => {
  try {
    const data = await changePlantStatus({
      plantId: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "plant.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "plant",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Plant activated successfully"
        : "Plant deactivated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update plant status");
  }
};

module.exports = {
  getAllPlants,
  addPlant,
  editPlantController,
  updatePlantStatusController,
};
