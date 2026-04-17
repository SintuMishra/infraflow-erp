const {
  getVehiclesList,
  createVehicleRecord,
  updateVehicleRecord,
  updateVehicleStatusRecord,
  getEquipmentLogsList,
  createEquipmentLogRecord,
} = require("./vehicles.service");
const { sendControllerError } = require("../../utils/http.util");

const getVehicles = async (req, res) => {
  try {
    const vehicles = await getVehiclesList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load vehicles");
  }
};

const createVehicle = async (req, res) => {
  try {
    const vehicle = await createVehicleRecord({
      ...req.body,
      companyId: req.companyId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("POST /vehicles error:", error);

    return sendControllerError(req, res, error, "Failed to create vehicle");
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await updateVehicleRecord({
      vehicleId: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("PATCH /vehicles/:id error:", error);

    return sendControllerError(req, res, error, "Failed to update vehicle");
  }
};

const updateVehicleStatus = async (req, res) => {
  try {
    const vehicle = await updateVehicleStatusRecord({
      vehicleId: req.params.id,
      status: req.body.status,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Vehicle status updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("PATCH /vehicles/:id/status error:", error);

    return sendControllerError(req, res, error, "Failed to update vehicle status");
  }
};

const getEquipmentLogs = async (req, res) => {
  try {
    const logs = await getEquipmentLogsList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("GET /vehicles/equipment-logs error:", error);

    return sendControllerError(req, res, error, "Failed to load equipment logs");
  }
};

const createEquipmentLog = async (req, res) => {
  try {
    const log = await createEquipmentLogRecord({
      ...req.body,
      createdBy: req.user.userId,
      companyId: req.companyId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Equipment log created successfully",
      data: log,
    });
  } catch (error) {
    console.error("POST /vehicles/equipment-logs error:", error);

    return sendControllerError(req, res, error, "Failed to create equipment log");
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle,
  updateVehicleStatus,
  getEquipmentLogs,
  createEquipmentLog,
};
