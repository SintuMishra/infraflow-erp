const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const mapRow = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    companyName: row.company_name,
    logoUrl: row.company_logo_url,
    branchName: row.branch_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateName: row.state_name,
    stateCode: row.state_code,
    pincode: row.pincode,
    gstin: row.gstin,
    pan: row.pan,
    mobile: row.mobile,
    email: row.email,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    ifscCode: row.ifsc_code,
    termsNotes: row.terms_notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const getActiveCompanyProfile = async (companyId = null, db = pool) => {
  const profileHasCompany = await hasColumn("company_profile", "company_id", db);
  const result = await db.query(
    `
    SELECT *
    FROM company_profile
    WHERE is_active = TRUE
    ${profileHasCompany && companyId !== null ? `AND company_id = $1` : ""}
    ORDER BY id DESC
    LIMIT 1
    `,
    profileHasCompany && companyId !== null ? [companyId] : []
  );

  return mapRow(result.rows[0]);
};

const upsertCompanyProfile = async ({
  companyName,
  logoUrl,
  branchName,
  addressLine1,
  addressLine2,
  city,
  stateName,
  stateCode,
  pincode,
  gstin,
  pan,
  mobile,
  email,
  bankName,
  bankAccount,
  ifscCode,
  termsNotes,
}, companyId = null, db = pool) => {
  const profileHasCompany = await hasColumn("company_profile", "company_id", db);
  const existing = await getActiveCompanyProfile(companyId, db);

  if (!existing) {
    const insertResult = await db.query(
      `
      INSERT INTO company_profile (
        company_name,
        company_logo_url,
        branch_name,
        address_line1,
        address_line2,
        city,
        state_name,
        state_code,
        pincode,
        gstin,
        pan,
        mobile,
        email,
        bank_name,
        bank_account,
        ifsc_code,
        terms_notes
        ${profileHasCompany ? `, company_id` : ""}
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        ${profileHasCompany ? `,$18` : ""}
      )
      RETURNING *
      `,
      [
        companyName,
        logoUrl || null,
        branchName || null,
        addressLine1 || null,
        addressLine2 || null,
        city || null,
        stateName || null,
        stateCode || null,
        pincode || null,
        gstin || null,
        pan || null,
        mobile || null,
        email || null,
        bankName || null,
        bankAccount || null,
        ifscCode || null,
        termsNotes || null,
        ...(profileHasCompany ? [companyId || null] : []),
      ]
    );

    return mapRow(insertResult.rows[0]);
  }

  const updateResult = await db.query(
    `
    UPDATE company_profile
    SET
      company_name = $1,
      company_logo_url = $2,
      branch_name = $3,
      address_line1 = $4,
      address_line2 = $5,
      city = $6,
      state_name = $7,
      state_code = $8,
      pincode = $9,
      gstin = $10,
      pan = $11,
      mobile = $12,
      email = $13,
      bank_name = $14,
      bank_account = $15,
      ifsc_code = $16,
      terms_notes = $17,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $18
    ${profileHasCompany && companyId !== null ? `AND company_id = $19` : ""}
    RETURNING *
    `,
    [
      companyName,
      logoUrl || null,
      branchName || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      stateName || null,
      stateCode || null,
      pincode || null,
      gstin || null,
      pan || null,
      mobile || null,
      email || null,
      bankName || null,
      bankAccount || null,
      ifscCode || null,
      termsNotes || null,
      existing.id,
      ...(profileHasCompany && companyId !== null ? [companyId] : []),
    ]
  );

  return mapRow(updateResult.rows[0]);
};

module.exports = {
  getActiveCompanyProfile,
  upsertCompanyProfile,
};
