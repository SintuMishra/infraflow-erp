const service = require("./party_material_rates.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getAll = async (req, res) => {
  try {
    const data = await service.getRates(req.companyId || null);
    res.json({ success: true, data });
  } catch (e) {
    return sendControllerError(
      req,
      res,
      e,
      "Failed to load party material rates"
    );
  }
};

const create = async (req, res) => {
  try {
    const data = await service.createRate({
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordAuditEvent({
      action: "party_material_rate.created",
      actorUserId: req.user?.userId || null,
      targetType: "party_material_rate",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        partyId: data.partyId || req.body.partyId || null,
        materialId: data.materialId || req.body.materialId || null,
        ratePerTon: data.ratePerTon || req.body.ratePerTon || null,
      },
    });
    return res.status(201).json({ success: true, data });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A rate already exists for this plant, party, and material",
      });
    }

    if (e.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Selected plant, party, or material is invalid for this company",
      });
    }

    return sendControllerError(
      req,
      res,
      e,
      "Failed to create party material rate"
    );
  }
};

const update = async (req, res) => {
  try {
    const data = await service.updateRate(req.params.id, {
      ...req.body,
      companyId: req.companyId || null,
    });
    await recordAuditEvent({
      action: "party_material_rate.updated",
      actorUserId: req.user?.userId || null,
      targetType: "party_material_rate",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        partyId: data.partyId || req.body.partyId || null,
        materialId: data.materialId || req.body.materialId || null,
        ratePerTon: data.ratePerTon || req.body.ratePerTon || null,
      },
    });
    return res.status(200).json({ success: true, data });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A rate already exists for this plant, party, and material",
      });
    }

    if (e.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Selected plant, party, or material is invalid for this company",
      });
    }

    return sendControllerError(
      req,
      res,
      e,
      "Failed to update party material rate"
    );
  }
};

const status = async (req, res) => {
  try {
    const data = await service.changeStatus(
      req.params.id,
      req.body.isActive,
      req.companyId || null
    );
    await recordAuditEvent({
      action: "party_material_rate.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "party_material_rate",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return sendControllerError(
      req,
      res,
      e,
      "Failed to update party material rate status"
    );
  }
};

module.exports = {
  getAll,
  create,
  update,
  status,
};
