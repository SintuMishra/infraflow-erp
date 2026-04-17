const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const mapRow = (row) => ({
  id: row.id,
  partyName: row.party_name,
  partyCode: row.party_code,
  contactPerson: row.contact_person,
  mobileNumber: row.mobile_number,
  gstin: row.gstin,
  pan: row.pan,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  city: row.city,
  stateName: row.state_name,
  stateCode: row.state_code,
  pincode: row.pincode,
  partyType: row.party_type,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getAllParties = async (companyId = null) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const result = await pool.query(
    `
    SELECT *
    FROM party_master
    ${partiesHasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY id DESC
    `,
    partiesHasCompany && companyId !== null ? [companyId] : []
  );

  return result.rows.map(mapRow);
};

const getPartyById = async (partyId, companyId = null) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const result = await pool.query(
    `
    SELECT *
    FROM party_master
    WHERE id = $1
    ${partiesHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
    `,
    partiesHasCompany && companyId !== null ? [partyId, companyId] : [partyId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

const insertParty = async ({
  partyName,
  partyCode,
  contactPerson,
  mobileNumber,
  gstin,
  pan,
  addressLine1,
  addressLine2,
  city,
  stateName,
  stateCode,
  pincode,
  partyType,
  companyId,
}) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const result = await pool.query(
    `
    INSERT INTO party_master (
      party_name,
      party_code,
      contact_person,
      mobile_number,
      gstin,
      pan,
      address_line1,
      address_line2,
      city,
      state_name,
      state_code,
      pincode,
      party_type
      ${partiesHasCompany ? `, company_id` : ""}
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      ${partiesHasCompany ? `,$14` : ""}
    )
    RETURNING *
    `,
    [
      partyName,
      partyCode || null,
      contactPerson || null,
      mobileNumber || null,
      gstin || null,
      pan || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      stateName || null,
      stateCode || null,
      pincode || null,
      partyType || "customer",
      ...(partiesHasCompany ? [companyId || null] : []),
    ]
  );

  return mapRow(result.rows[0]);
};

const updateParty = async (
  partyId,
  {
    partyName,
    partyCode,
    contactPerson,
    mobileNumber,
    gstin,
    pan,
    addressLine1,
    addressLine2,
    city,
    stateName,
    stateCode,
    pincode,
    partyType,
    companyId,
  }
) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const result = await pool.query(
    `
    UPDATE party_master
    SET
      party_name = $1,
      party_code = $2,
      contact_person = $3,
      mobile_number = $4,
      gstin = $5,
      pan = $6,
      address_line1 = $7,
      address_line2 = $8,
      city = $9,
      state_name = $10,
      state_code = $11,
      pincode = $12,
      party_type = $13,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $14
    ${partiesHasCompany && companyId !== null ? `AND company_id = $15` : ""}
    RETURNING *
    `,
    [
      partyName,
      partyCode || null,
      contactPerson || null,
      mobileNumber || null,
      gstin || null,
      pan || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      stateName || null,
      stateCode || null,
      pincode || null,
      partyType || "customer",
      partyId,
      ...(partiesHasCompany && companyId !== null ? [companyId] : []),
    ]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

const updatePartyStatus = async (partyId, isActive, companyId = null) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const result = await pool.query(
    `
    UPDATE party_master
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${partiesHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING *
    `,
    partiesHasCompany && companyId !== null
      ? [isActive, partyId, companyId]
      : [isActive, partyId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

module.exports = {
  getAllParties,
  getPartyById,
  insertParty,
  updateParty,
  updatePartyStatus,
};
