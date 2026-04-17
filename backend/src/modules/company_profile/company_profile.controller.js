const {
  getCompanyProfile,
  saveCompanyProfile,
} = require("./company_profile.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getCompanyProfileController = async (req, res) => {
  try {
    const data = await getCompanyProfile(req.companyId || null);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load company profile");
  }
};

const saveCompanyProfileController = async (req, res) => {
  try {
    const data = await saveCompanyProfile(req.body, req.companyId || null);

    await recordAuditEvent({
      action: "company_profile.saved",
      actorUserId: req.user?.userId || null,
      targetType: "company_profile",
      targetId: data?.id || req.companyId || null,
      companyId: req.companyId || null,
      details: {
        companyName: data?.companyName || req.body.companyName || null,
        branchName: data?.branchName || req.body.branchName || null,
        gstin: data?.gstin || req.body.gstin || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Company profile saved successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to save company profile");
  }
};

module.exports = {
  getCompanyProfileController,
  saveCompanyProfileController,
};
