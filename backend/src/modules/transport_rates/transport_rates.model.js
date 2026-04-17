const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const baseTransportRateSelect = `
  SELECT
    tr.id,
    tr.plant_id AS "plantId",
    pm.plant_name AS "plantName",
    tr.vendor_id AS "vendorId",
    vm.vendor_name AS "vendorName",
    tr.material_id AS "materialId",
    mm.material_name AS "materialName",
    tr.rate_type AS "rateType",
    tr.rate_value AS "rateValue",
    tr.distance_km AS "distanceKm",
    tr.is_active AS "isActive",
    tr.created_at AS "createdAt",
    tr.updated_at AS "updatedAt"
  FROM transport_rates tr
  INNER JOIN plant_master pm ON pm.id = tr.plant_id
  INNER JOIN vendor_master vm ON vm.id = tr.vendor_id
  INNER JOIN material_master mm ON mm.id = tr.material_id
`;

const mapRateRow = (row) => ({
  ...row,
  rateValue: row.rateValue !== null ? Number(row.rateValue) : null,
  distanceKm: row.distanceKm !== null ? Number(row.distanceKm) : null,
});

const findAllTransportRates = async (companyId = null) => {
  const transportRatesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    ${baseTransportRateSelect}
    ${transportRatesHasCompany && companyId !== null ? `WHERE tr.company_id = $1` : ""}
    ORDER BY tr.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows.map(mapRateRow);
};

const findTransportRateById = async (rateId, companyId = null) => {
  const transportRatesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    ${baseTransportRateSelect}
    WHERE tr.id = $1
    ${transportRatesHasCompany && companyId !== null ? `AND tr.company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    transportRatesHasCompany && companyId !== null ? [rateId, companyId] : [rateId]
  );
  return result.rows[0] ? mapRateRow(result.rows[0]) : null;
};

const insertTransportRate = async ({
  plantId,
  vendorId,
  materialId,
  rateType,
  rateValue,
  distanceKm,
  companyId,
}) => {
  const transportRatesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    INSERT INTO transport_rates (
      plant_id,
      vendor_id,
      material_id,
      rate_type,
      rate_value,
      distance_km
      ${transportRatesHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, $5, $6${transportRatesHasCompany ? `, $7` : ""})
    RETURNING id
  `;

  const values = [
    plantId,
    vendorId,
    materialId,
    rateType,
    rateValue,
    distanceKm ?? null,
    ...(transportRatesHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);
  return await findTransportRateById(result.rows[0].id, companyId || null);
};

const updateTransportRate = async ({
  rateId,
  plantId,
  vendorId,
  materialId,
  rateType,
  rateValue,
  distanceKm,
  companyId,
}) => {
  const transportRatesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    UPDATE transport_rates
    SET
      plant_id = $1,
      vendor_id = $2,
      material_id = $3,
      rate_type = $4,
      rate_value = $5,
      distance_km = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    ${transportRatesHasCompany && companyId !== null ? `AND company_id = $8` : ""}
    RETURNING id
  `;

  const values = [
    plantId,
    vendorId,
    materialId,
    rateType,
    rateValue,
    distanceKm ?? null,
    rateId,
    ...(transportRatesHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    const error = new Error("Transport rate not found");
    error.statusCode = 404;
    throw error;
  }

  return await findTransportRateById(rateId, companyId || null);
};

const updateTransportRateStatus = async ({ rateId, isActive, companyId }) => {
  const transportRatesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    UPDATE transport_rates
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${transportRatesHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING id
  `;

  const result = await pool.query(
    query,
    transportRatesHasCompany && companyId !== null
      ? [isActive, rateId, companyId]
      : [isActive, rateId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Transport rate not found");
    error.statusCode = 404;
    throw error;
  }

  return await findTransportRateById(rateId, companyId || null);
};

const plantExists = async (plantId, companyId = null) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const result = await pool.query(
    `
    SELECT id
    FROM plant_master
    WHERE id = $1
    ${plantsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
    `,
    plantsHasCompany && companyId !== null ? [plantId, companyId] : [plantId]
  );

  return result.rows.length > 0;
};

const vendorExists = async (vendorId, companyId = null) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const result = await pool.query(
    `
    SELECT id
    FROM vendor_master
    WHERE id = $1
    ${vendorsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
    `,
    vendorsHasCompany && companyId !== null ? [vendorId, companyId] : [vendorId]
  );

  return result.rows.length > 0;
};

const materialExists = async (materialId, companyId = null) => {
  const materialsHasCompany = await hasColumn("material_master", "company_id");
  const result = await pool.query(
    `
    SELECT id
    FROM material_master
    WHERE id = $1
    ${materialsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
    `,
    materialsHasCompany && companyId !== null ? [materialId, companyId] : [materialId]
  );

  return result.rows.length > 0;
};

module.exports = {
  findAllTransportRates,
  findTransportRateById,
  insertTransportRate,
  updateTransportRate,
  updateTransportRateStatus,
  plantExists,
  vendorExists,
  materialExists,
};
