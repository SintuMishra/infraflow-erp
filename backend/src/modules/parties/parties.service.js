const {
  getAllParties,
  getPartyById,
  insertParty,
  updateParty,
  updatePartyStatus,
} = require("./parties.model");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizePartyPayload = (payload) => ({
  partyName: String(payload.partyName || "").trim(),
  partyCode: String(payload.partyCode || "").trim(),
  contactPerson: String(payload.contactPerson || "").trim(),
  mobileNumber: String(payload.mobileNumber || "").trim(),
  gstin: String(payload.gstin || "").trim().toUpperCase(),
  pan: String(payload.pan || "").trim().toUpperCase(),
  addressLine1: String(payload.addressLine1 || "").trim(),
  addressLine2: String(payload.addressLine2 || "").trim(),
  city: String(payload.city || "").trim(),
  stateName: String(payload.stateName || "").trim(),
  stateCode: String(payload.stateCode || "").trim(),
  pincode: String(payload.pincode || "").trim(),
  partyType: String(payload.partyType || "customer").trim().toLowerCase(),
});

const validatePartyPayload = (payload) => {
  if (!payload.partyName) {
    throw buildValidationError("partyName is required");
  }
};

const listParties = async (companyId = null) => {
  return await getAllParties(companyId);
};

const createParty = async (payload) => {
  const normalizedPayload = normalizePartyPayload(payload);
  validatePartyPayload(normalizedPayload);
  return await insertParty({
    ...normalizedPayload,
    companyId: payload.companyId || null,
  });
};

const editParty = async (partyId, payload, companyId = null) => {
  const normalizedPayload = normalizePartyPayload(payload);
  validatePartyPayload(normalizedPayload);

  const existing = await getPartyById(Number(partyId), companyId);
  if (!existing) {
    throw buildValidationError("Party not found", 404);
  }

  return await updateParty(Number(partyId), {
    ...normalizedPayload,
    companyId,
  });
};

const changePartyStatus = async (partyId, isActive, companyId = null) => {
  const existing = await getPartyById(Number(partyId), companyId);
  if (!existing) {
    throw buildValidationError("Party not found", 404);
  }

  if (typeof isActive !== "boolean") {
    throw buildValidationError("isActive must be provided as true or false");
  }

  return await updatePartyStatus(Number(partyId), isActive, companyId);
};

module.exports = {
  listParties,
  createParty,
  editParty,
  changePartyStatus,
};
