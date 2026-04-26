const {
  getTransportRatesList,
  createTransportRateRecord,
  updateTransportRateRecord,
  changeTransportRateStatusRecord,
} = require("./transport_rates.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getTransportRates = async (req, res) => {
  try {
    const data = await getTransportRatesList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to load transport rates"
    );
  }
};

const createTransportRate = async (req, res) => {
  try {
    const data = await createTransportRateRecord({
      ...req.body,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "transport_rate.created",
      actorUserId: req.user?.userId || null,
      targetType: "transport_rate",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        billingBasis: data.billingBasis || req.body.billingBasis || null,
        rateType: data.rateType || req.body.rateType || null,
        rateUnitId: data.rateUnitId || req.body.rateUnitId || null,
        minimumCharge: data.minimumCharge || req.body.minimumCharge || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Transport rate created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to create transport rate"
    );
  }
};

const updateTransportRateController = async (req, res) => {
  try {
    const data = await updateTransportRateRecord({
      rateId: req.params.id,
      companyId: req.companyId || null,
      ...req.body,
    });

    await recordAuditEvent({
      action: "transport_rate.updated",
      actorUserId: req.user?.userId || null,
      targetType: "transport_rate",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        billingBasis: data.billingBasis || req.body.billingBasis || null,
        rateType: data.rateType || req.body.rateType || null,
        rateUnitId: data.rateUnitId || req.body.rateUnitId || null,
        minimumCharge: data.minimumCharge || req.body.minimumCharge || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Transport rate updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to update transport rate"
    );
  }
};

const updateTransportRateStatusController = async (req, res) => {
  try {
    const data = await changeTransportRateStatusRecord({
      rateId: req.params.id,
      isActive: req.body.isActive,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "transport_rate.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "transport_rate",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Transport rate activated successfully"
        : "Transport rate deactivated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(
      req,
      res,
      error,
      "Failed to update transport rate status"
    );
  }
};

module.exports = {
  getTransportRates,
  createTransportRate,
  updateTransportRateController,
  updateTransportRateStatusController,
};
