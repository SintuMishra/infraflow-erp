const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const findAllVendors = async (companyId = null) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const query = `
    SELECT
      id,
      vendor_name AS "vendorName",
      vendor_type AS "vendorType",
      contact_person AS "contactPerson",
      mobile_number AS "mobileNumber",
      address,
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vendor_master
    ${vendorsHasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY vendor_name ASC
  `;
  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows;
};

const insertVendor = async ({
  vendorName,
  vendorType,
  contactPerson,
  mobileNumber,
  address,
  companyId,
}) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const query = `
    INSERT INTO vendor_master (
      vendor_name,
      vendor_type,
      contact_person,
      mobile_number,
      address
      ${vendorsHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, $5${vendorsHasCompany ? `, $6` : ""})
    RETURNING
      id,
      vendor_name AS "vendorName",
      vendor_type AS "vendorType",
      contact_person AS "contactPerson",
      mobile_number AS "mobileNumber",
      address,
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [
    vendorName,
    vendorType,
    contactPerson || null,
    mobileNumber || null,
    address || null,
    ...(vendorsHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateVendor = async ({
  vendorId,
  vendorName,
  vendorType,
  contactPerson,
  mobileNumber,
  address,
  companyId,
}) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const query = `
    UPDATE vendor_master
    SET
      vendor_name = $1,
      vendor_type = $2,
      contact_person = $3,
      mobile_number = $4,
      address = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    ${vendorsHasCompany && companyId !== null ? `AND company_id = $7` : ""}
    RETURNING
      id,
      vendor_name AS "vendorName",
      vendor_type AS "vendorType",
      contact_person AS "contactPerson",
      mobile_number AS "mobileNumber",
      address,
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [
    vendorName,
    vendorType,
    contactPerson || null,
    mobileNumber || null,
    address || null,
    vendorId,
    ...(vendorsHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateVendorStatus = async ({ vendorId, isActive, companyId }) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const query = `
    UPDATE vendor_master
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${vendorsHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      vendor_name AS "vendorName",
      vendor_type AS "vendorType",
      contact_person AS "contactPerson",
      mobile_number AS "mobileNumber",
      address,
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const result = await pool.query(
    query,
    vendorsHasCompany && companyId !== null
      ? [isActive, vendorId, companyId]
      : [isActive, vendorId]
  );
  return result.rows[0];
};

module.exports = {
  findAllVendors,
  insertVendor,
  updateVendor,
  updateVendorStatus,
};
