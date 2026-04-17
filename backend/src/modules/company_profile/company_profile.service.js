const {
  getActiveCompanyProfile,
  upsertCompanyProfile,
} = require("./company_profile.model");

const normalizeCompanyProfilePayload = (payload = {}) => ({
  ...payload,
  companyName: String(payload.companyName || "").trim(),
  logoUrl: String(payload.logoUrl || "").trim(),
  branchName: String(payload.branchName || "").trim(),
  addressLine1: String(payload.addressLine1 || "").trim(),
  addressLine2: String(payload.addressLine2 || "").trim(),
  city: String(payload.city || "").trim(),
  stateName: String(payload.stateName || "").trim(),
  stateCode: String(payload.stateCode || "").trim(),
  pincode: String(payload.pincode || "").trim(),
  gstin: String(payload.gstin || "")
    .trim()
    .toUpperCase(),
  pan: String(payload.pan || "")
    .trim()
    .toUpperCase(),
  mobile: String(payload.mobile || "").trim(),
  email: String(payload.email || "").trim(),
  bankName: String(payload.bankName || "").trim(),
  bankAccount: String(payload.bankAccount || "").trim(),
  ifscCode: String(payload.ifscCode || "")
    .trim()
    .toUpperCase(),
  termsNotes: String(payload.termsNotes || "").trim(),
});

const getCompanyProfile = async (companyId = null, db) => {
  return await getActiveCompanyProfile(companyId, db);
};

const saveCompanyProfile = async (payload, companyId = null, db) => {
  const normalized = normalizeCompanyProfilePayload(payload);

  if (!normalized.companyName) {
    const error = new Error("companyName is required");
    error.statusCode = 400;
    throw error;
  }

  return await upsertCompanyProfile(normalized, companyId, db);
};

module.exports = {
  getCompanyProfile,
  saveCompanyProfile,
  normalizeCompanyProfilePayload,
};
