const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const getTransportRateSchemaFlags = async () => {
  const [
    transportRatesHasCompany,
    transportRatesHasBillingBasis,
    transportRatesHasRateUnitId,
    transportRatesHasMinimumCharge,
  ] = await Promise.all([
    hasColumn("transport_rates", "company_id"),
    hasColumn("transport_rates", "billing_basis"),
    hasColumn("transport_rates", "rate_unit_id"),
    hasColumn("transport_rates", "minimum_charge"),
  ]);

  return {
    transportRatesHasCompany,
    transportRatesHasBillingBasis,
    transportRatesHasRateUnitId,
    transportRatesHasMinimumCharge,
  };
};

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
    __BILLING_BASIS_SELECT__
    tr.rate_value AS "rateValue",
    tr.distance_km AS "distanceKm",
    __RATE_UNIT_ID_SELECT__
    __MINIMUM_CHARGE_SELECT__
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
  minimumCharge:
    row.minimumCharge !== null && row.minimumCharge !== undefined
      ? Number(row.minimumCharge)
      : null,
});

const buildBaseTransportRateSelect = ({
  transportRatesHasBillingBasis,
  transportRatesHasRateUnitId,
  transportRatesHasMinimumCharge,
}) =>
  baseTransportRateSelect
    .replace(
      "__BILLING_BASIS_SELECT__",
      transportRatesHasBillingBasis
        ? `COALESCE(tr.billing_basis, tr.rate_type) AS "billingBasis",`
        : `tr.rate_type AS "billingBasis",`
    )
    .replace(
      "__RATE_UNIT_ID_SELECT__",
      transportRatesHasRateUnitId
        ? `tr.rate_unit_id AS "rateUnitId",`
        : `NULL::bigint AS "rateUnitId",`
    )
    .replace(
      "__MINIMUM_CHARGE_SELECT__",
      transportRatesHasMinimumCharge
        ? `tr.minimum_charge AS "minimumCharge",`
        : `NULL::numeric AS "minimumCharge",`
    );

const findAllTransportRates = async (companyId = null) => {
  const schema = await getTransportRateSchemaFlags();
  const baseSelect = buildBaseTransportRateSelect(schema);
  const query = `
    ${baseSelect}
    ${schema.transportRatesHasCompany && companyId !== null ? `WHERE tr.company_id = $1` : ""}
    ORDER BY tr.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows.map(mapRateRow);
};

const findTransportRateById = async (rateId, companyId = null) => {
  const schema = await getTransportRateSchemaFlags();
  const baseSelect = buildBaseTransportRateSelect(schema);
  const query = `
    ${baseSelect}
    WHERE tr.id = $1
    ${schema.transportRatesHasCompany && companyId !== null ? `AND tr.company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    schema.transportRatesHasCompany && companyId !== null ? [rateId, companyId] : [rateId]
  );
  return result.rows[0] ? mapRateRow(result.rows[0]) : null;
};

const insertTransportRate = async ({
  plantId,
  vendorId,
  materialId,
  rateType,
  billingBasis,
  rateValue,
  distanceKm,
  rateUnitId,
  minimumCharge,
  companyId,
}) => {
  const schema = await getTransportRateSchemaFlags();
  const columns = [
    "plant_id",
    "vendor_id",
    "material_id",
    "rate_type",
    "rate_value",
    "distance_km",
  ];
  const values = [plantId, vendorId, materialId, rateType, rateValue, distanceKm ?? null];

  if (schema.transportRatesHasBillingBasis) {
    columns.push("billing_basis");
    values.push(billingBasis || rateType);
  }

  if (schema.transportRatesHasRateUnitId) {
    columns.push("rate_unit_id");
    values.push(rateUnitId ?? null);
  }

  if (schema.transportRatesHasMinimumCharge) {
    columns.push("minimum_charge");
    values.push(minimumCharge ?? null);
  }

  if (schema.transportRatesHasCompany) {
    columns.push("company_id");
    values.push(companyId || null);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const query = `
    INSERT INTO transport_rates (${columns.join(", ")})
    VALUES (${placeholders})
    RETURNING id
  `;

  const result = await pool.query(query, values);
  return await findTransportRateById(result.rows[0].id, companyId || null);
};

const updateTransportRate = async ({
  rateId,
  plantId,
  vendorId,
  materialId,
  rateType,
  billingBasis,
  rateValue,
  distanceKm,
  rateUnitId,
  minimumCharge,
  companyId,
}) => {
  const schema = await getTransportRateSchemaFlags();
  const updates = [
    "plant_id = $1",
    "vendor_id = $2",
    "material_id = $3",
    "rate_type = $4",
    "rate_value = $5",
    "distance_km = $6",
  ];
  const values = [plantId, vendorId, materialId, rateType, rateValue, distanceKm ?? null];

  if (schema.transportRatesHasBillingBasis) {
    updates.push(`billing_basis = $${values.length + 1}`);
    values.push(billingBasis || rateType);
  }

  if (schema.transportRatesHasRateUnitId) {
    updates.push(`rate_unit_id = $${values.length + 1}`);
    values.push(rateUnitId ?? null);
  }

  if (schema.transportRatesHasMinimumCharge) {
    updates.push(`minimum_charge = $${values.length + 1}`);
    values.push(minimumCharge ?? null);
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(rateId);
  const rateIdPlaceholder = `$${values.length}`;
  const companyPlaceholder =
    schema.transportRatesHasCompany && companyId !== null ? `$${values.length + 1}` : null;
  if (companyPlaceholder) {
    values.push(companyId);
  }
  const query = `
    UPDATE transport_rates
    SET ${updates.join(", ")}
    WHERE id = ${rateIdPlaceholder}
    ${companyPlaceholder ? `AND company_id = ${companyPlaceholder}` : ""}
    RETURNING id
  `;

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
