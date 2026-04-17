const {
  getVendors,
  createVendor,
  editVendor,
  changeVendorStatus,
} = require("./vendors.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const resolveScopedCompanyId = (req) =>
  normalizeCompanyId(req.companyId ?? req.user?.companyId ?? req.headers["x-company-id"]);

const logVendorScopeDebug = (req, companyId) => {
  if (process.env.DEBUG_VENDOR_SCOPE !== "true") {
    return;
  }

  console.log("[vendor-scope]", {
    path: req.originalUrl,
    method: req.method,
    companyId,
    reqCompanyId: req.companyId ?? null,
    userCompanyId: req.user?.companyId ?? null,
    headerCompanyId: req.headers["x-company-id"] ?? null,
  });
};

const getAllVendors = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await getVendors(companyId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load vendors");
  }
};

const addVendor = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    logVendorScopeDebug(req, companyId);

    const data = await createVendor({
      ...req.body,
      companyId,
    });

    await recordAuditEvent({
      action: "vendor.created",
      actorUserId: req.user?.userId || null,
      targetType: "vendor",
      targetId: data.id,
      companyId,
      details: {
        vendorName: data.vendorName || req.body.vendorName || null,
        vendorType: data.vendorType || req.body.vendorType || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data,
    });
  } catch (error) {
    console.error("POST /vendors error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Vendor name already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to create vendor");
  }
};

const editVendorController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    logVendorScopeDebug(req, companyId);

    const data = await editVendor({
      vendorId: req.params.id,
      companyId,
      ...req.body,
    });

    await recordAuditEvent({
      action: "vendor.updated",
      actorUserId: req.user?.userId || null,
      targetType: "vendor",
      targetId: data.id || req.params.id,
      companyId,
      details: {
        vendorName: data.vendorName || req.body.vendorName || null,
        vendorType: data.vendorType || req.body.vendorType || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data,
    });
  } catch (error) {
    console.error("PATCH /vendors/:id error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Vendor name already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to update vendor");
  }
};

const updateVendorStatusController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    logVendorScopeDebug(req, companyId);

    const data = await changeVendorStatus({
      vendorId: req.params.id,
      isActive: req.body.isActive,
      companyId,
    });

    await recordAuditEvent({
      action: "vendor.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "vendor",
      targetId: data.id || req.params.id,
      companyId,
      details: {
        isActive: Boolean(req.body.isActive),
      },
    });

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Vendor activated successfully"
        : "Vendor deactivated successfully",
      data,
    });
  } catch (error) {
    console.error("PATCH /vendors/:id/status error:", error);

    return sendControllerError(req, res, error, "Failed to update vendor status");
  }
};

module.exports = {
  getAllVendors,
  addVendor,
  editVendorController,
  updateVendorStatusController,
};
