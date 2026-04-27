const {
  listParties,
  listPartiesPage,
  listPartyLookup,
  createParty,
  editParty,
  changePartyStatus,
} = require("./parties.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  normalizePage,
  normalizeLimit,
  shouldUsePaginatedResponse,
} = require("../../utils/pagination.util");

const getAllPartiesController = async (req, res) => {
  try {
    if (shouldUsePaginatedResponse(req.query || {})) {
      const pageData = await listPartiesPage({
        companyId: req.companyId || null,
        page: normalizePage(req.query.page, 1),
        limit: normalizeLimit(req.query.limit, 25, 100),
        search: String(req.query.search || "").trim(),
      });

      return res.status(200).json({
        success: true,
        data: pageData.items,
        meta: {
          pagination: {
            total: pageData.total,
            page: pageData.page,
            limit: pageData.limit,
            totalPages: pageData.total
              ? Math.ceil(pageData.total / pageData.limit)
              : 0,
          },
        },
      });
    }

    const data = await listParties(req.companyId || null);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load parties");
  }
};

const getPartyLookupController = async (req, res) => {
  try {
    const data = await listPartyLookup(req.companyId || null);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load party lookup");
  }
};

const createPartyController = async (req, res) => {
  try {
    const data = await createParty({
      ...req.body,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "party.created",
      actorUserId: req.user?.userId || null,
      targetType: "party",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        partyName: data.partyName || req.body.partyName || null,
        billingName: data.billingName || req.body.billingName || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Party created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create party");
  }
};

const updatePartyController = async (req, res) => {
  try {
    const data = await editParty(
      req.params.id,
      req.body,
      req.companyId || null
    );

    await recordAuditEvent({
      action: "party.updated",
      actorUserId: req.user?.userId || null,
      targetType: "party",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        partyName: data.partyName || req.body.partyName || null,
        billingName: data.billingName || req.body.billingName || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Party updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update party");
  }
};

const updatePartyStatusController = async (req, res) => {
  try {
    const data = await changePartyStatus(
      req.params.id,
      req.body.isActive,
      req.companyId || null
    );

    await recordAuditEvent({
      action: "party.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "party",
      targetId: data.id || req.params.id,
      companyId: req.companyId || null,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Party activated successfully"
        : "Party deactivated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update party status");
  }
};

module.exports = {
  getAllPartiesController,
  getPartyLookupController,
  createPartyController,
  updatePartyController,
  updatePartyStatusController,
};
