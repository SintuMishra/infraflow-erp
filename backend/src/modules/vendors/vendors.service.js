const {
  findAllVendors,
  insertVendor,
  updateVendor,
  updateVendorStatus,
} = require("./vendors.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeVendorPayload = (payload) => ({
  vendorName: String(payload.vendorName || "").trim(),
  vendorType: String(payload.vendorType || "").trim(),
  contactPerson: String(payload.contactPerson || "").trim(),
  mobileNumber: String(payload.mobileNumber || "").trim(),
  address: String(payload.address || "").trim(),
  companyId: normalizeCompanyId(payload.companyId),
});

const getVendors = async (companyId = null) => {
  return await findAllVendors(companyId);
};

const createVendor = async (payload) => {
  const normalizedPayload = normalizeVendorPayload(payload);

  if (!normalizedPayload.vendorName || !normalizedPayload.vendorType) {
    throw buildValidationError("vendorName and vendorType are required");
  }

  return await insertVendor(normalizedPayload);
};

const editVendor = async (payload) => {
  const normalizedPayload = normalizeVendorPayload(payload);

  if (!normalizedPayload.vendorName || !normalizedPayload.vendorType) {
    throw buildValidationError("vendorName and vendorType are required");
  }

  const updated = await updateVendor({
    ...payload,
    ...normalizedPayload,
  });

  if (!updated) {
    throw buildValidationError("Vendor not found", 404);
  }

  return updated;
};

const changeVendorStatus = async (payload) => {
  if (typeof payload.isActive !== "boolean") {
    throw buildValidationError("isActive must be provided as true or false");
  }

  const updated = await updateVendorStatus(payload);

  if (!updated) {
    throw buildValidationError("Vendor not found", 404);
  }

  return updated;
};

module.exports = {
  getVendors,
  createVendor,
  editVendor,
  changeVendorStatus,
};
