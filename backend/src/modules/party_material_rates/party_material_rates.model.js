const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const getRateSchemaFlags = async () => {
  const [
    ratesHasCompany,
    ratesHasEffectiveFrom,
    ratesHasLoadingChargeBasis,
    ratesHasRateUnit,
    ratesHasRateUnitLabel,
    ratesHasRateUnitsPerTon,
  ] = await Promise.all([
    hasColumn("party_material_rates", "company_id"),
    hasColumn("party_material_rates", "effective_from"),
    hasColumn("party_material_rates", "loading_charge_basis"),
    hasColumn("party_material_rates", "rate_unit"),
    hasColumn("party_material_rates", "rate_unit_label"),
    hasColumn("party_material_rates", "rate_units_per_ton"),
  ]);

  return {
    ratesHasCompany,
    ratesHasEffectiveFrom,
    ratesHasLoadingChargeBasis,
    ratesHasRateUnit,
    ratesHasRateUnitLabel,
    ratesHasRateUnitsPerTon,
  };
};

const buildBaseQuery = ({
  ratesHasEffectiveFrom,
  ratesHasLoadingChargeBasis,
  ratesHasRateUnit,
  ratesHasRateUnitLabel,
  ratesHasRateUnitsPerTon,
}) => `
SELECT
  pmr.id,
  pmr.plant_id AS "plantId",
  p.plant_name AS "plantName",
  pmr.party_id AS "partyId",
  pty.party_name AS "partyName",
  pmr.material_id AS "materialId",
  m.material_name AS "materialName",
  pmr.rate_per_ton AS "ratePerTon",
  ${
    ratesHasRateUnit
      ? `COALESCE(pmr.rate_unit, 'per_ton') AS "rateUnit",`
      : `'per_ton'::text AS "rateUnit",`
  }
  ${
    ratesHasRateUnitLabel
      ? `pmr.rate_unit_label AS "rateUnitLabel",`
      : `NULL::text AS "rateUnitLabel",`
  }
  ${
    ratesHasRateUnitsPerTon
      ? `COALESCE(pmr.rate_units_per_ton, 1) AS "rateUnitsPerTon",`
      : `1::numeric AS "rateUnitsPerTon",`
  }
  pmr.royalty_mode AS "royaltyMode",
  pmr.royalty_value AS "royaltyValue",
  pmr.tons_per_brass AS "tonsPerBrass",
  pmr.loading_charge AS "loadingCharge",
  ${
    ratesHasLoadingChargeBasis
      ? `COALESCE(pmr.loading_charge_basis, 'fixed') AS "loadingChargeBasis",`
      : `'fixed' AS "loadingChargeBasis",`
  }
  pmr.notes,
  ${
    ratesHasEffectiveFrom
      ? `pmr.effective_from::text AS "effectiveFrom",`
      : `NULL AS "effectiveFrom",`
  }
  pmr.is_active AS "isActive"
FROM party_material_rates pmr
JOIN plant_master p ON p.id = pmr.plant_id
JOIN party_master pty ON pty.id = pmr.party_id
JOIN material_master m ON m.id = pmr.material_id
`;

const getAllRates = async (companyId = null) => {
  const schema = await getRateSchemaFlags();
  const baseQuery = buildBaseQuery(schema);
  const result = await pool.query(
    `${baseQuery} ${
      schema.ratesHasCompany && companyId !== null ? `WHERE pmr.company_id = $1` : ""
    } ORDER BY ${
      schema.ratesHasEffectiveFrom
        ? `pmr.effective_from DESC NULLS LAST, pmr.id DESC`
        : `pmr.id DESC`
    }`,
    schema.ratesHasCompany && companyId !== null ? [companyId] : []
  );
  return result.rows;
};

const findActiveRateConflict = async ({
  plantId,
  partyId,
  materialId,
  effectiveFrom,
  companyId = null,
  excludeRateId = null,
}) => {
  const { ratesHasCompany, ratesHasEffectiveFrom } = await getRateSchemaFlags();

  const params = [plantId, partyId, materialId];
  let nextParamIndex = params.length + 1;

  let effectiveFromCondition = "";
  if (ratesHasEffectiveFrom) {
    effectiveFromCondition = `AND COALESCE(effective_from, CURRENT_DATE) = $${nextParamIndex++}`;
    params.push(effectiveFrom || null);
  }

  let excludeCondition = "";
  if (excludeRateId !== null && excludeRateId !== undefined) {
    excludeCondition = `AND id <> $${nextParamIndex++}`;
    params.push(Number(excludeRateId));
  }

  let companyCondition = "";
  if (ratesHasCompany && companyId !== null) {
    companyCondition = `AND company_id = $${nextParamIndex++}`;
    params.push(companyId);
  }

  const result = await pool.query(
    `
    SELECT id
    FROM party_material_rates
    WHERE plant_id = $1
      AND party_id = $2
      AND material_id = $3
      AND is_active = TRUE
      ${effectiveFromCondition}
      ${excludeCondition}
      ${companyCondition}
    ORDER BY id DESC
    LIMIT 1
    `,
    params
  );

  return result.rows[0] || null;
};

const insertRate = async (data) => {
  const {
    plantId,
    partyId,
    materialId,
    ratePerTon,
    rateUnit,
    rateUnitLabel,
    rateUnitsPerTon,
    royaltyMode,
    royaltyValue,
    tonsPerBrass,
    loadingCharge,
    loadingChargeBasis,
    notes,
    effectiveFrom,
    companyId,
  } = data;
  const schema = await getRateSchemaFlags();
  const baseQuery = buildBaseQuery(schema);

  const insertColumns = [
    "plant_id",
    "party_id",
    "material_id",
    "rate_per_ton",
    "royalty_mode",
    "royalty_value",
    "tons_per_brass",
    "loading_charge",
    "notes",
  ];
  const values = [
    plantId,
    partyId,
    materialId,
    ratePerTon,
    royaltyMode,
    royaltyValue,
    royaltyMode === "per_brass" ? tonsPerBrass : null,
    loadingCharge,
    notes,
  ];

  if (schema.ratesHasRateUnit) {
    insertColumns.push("rate_unit");
    values.push(rateUnit);
  }
  if (schema.ratesHasRateUnitLabel) {
    insertColumns.push("rate_unit_label");
    values.push(rateUnitLabel);
  }
  if (schema.ratesHasRateUnitsPerTon) {
    insertColumns.push("rate_units_per_ton");
    values.push(rateUnitsPerTon);
  }
  if (schema.ratesHasLoadingChargeBasis) {
    insertColumns.push("loading_charge_basis");
    values.push(loadingChargeBasis);
  }
  if (schema.ratesHasEffectiveFrom) {
    insertColumns.push("effective_from");
    values.push(effectiveFrom || null);
  }
  if (schema.ratesHasCompany) {
    insertColumns.push("company_id");
    values.push(companyId || null);
  }

  const query = `
    INSERT INTO party_material_rates
    (${insertColumns.join(", ")})
    VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(", ")})
    RETURNING id
  `;

  const result = await pool.query(query, values);

  const inserted = await pool.query(
    `${baseQuery} WHERE pmr.id = $1 ${
      schema.ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    schema.ratesHasCompany && companyId !== null
      ? [result.rows[0].id, companyId]
      : [result.rows[0].id]
  );

  return inserted.rows[0];
};

const updateRate = async (id, data) => {
  const {
    plantId,
    partyId,
    materialId,
    ratePerTon,
    rateUnit,
    rateUnitLabel,
    rateUnitsPerTon,
    royaltyMode,
    royaltyValue,
    tonsPerBrass,
    loadingCharge,
    loadingChargeBasis,
    notes,
    effectiveFrom,
    companyId,
  } = data;
  const schema = await getRateSchemaFlags();
  const baseQuery = buildBaseQuery(schema);

  const assignments = [
    "plant_id=$1",
    "party_id=$2",
    "material_id=$3",
    "rate_per_ton=$4",
  ];
  const values = [plantId, partyId, materialId, ratePerTon];

  if (schema.ratesHasRateUnit) {
    assignments.push(`rate_unit=$${values.length + 1}`);
    values.push(rateUnit);
  }
  if (schema.ratesHasRateUnitLabel) {
    assignments.push(`rate_unit_label=$${values.length + 1}`);
    values.push(rateUnitLabel);
  }
  if (schema.ratesHasRateUnitsPerTon) {
    assignments.push(`rate_units_per_ton=$${values.length + 1}`);
    values.push(rateUnitsPerTon);
  }

  assignments.push(`royalty_mode=$${values.length + 1}`);
  values.push(royaltyMode);
  assignments.push(`royalty_value=$${values.length + 1}`);
  values.push(royaltyValue);
  assignments.push(`tons_per_brass=$${values.length + 1}`);
  values.push(royaltyMode === "per_brass" ? tonsPerBrass : null);
  assignments.push(`loading_charge=$${values.length + 1}`);
  values.push(loadingCharge);

  if (schema.ratesHasLoadingChargeBasis) {
    assignments.push(`loading_charge_basis=$${values.length + 1}`);
    values.push(loadingChargeBasis);
  }

  assignments.push(`notes=$${values.length + 1}`);
  values.push(notes);

  if (schema.ratesHasEffectiveFrom) {
    assignments.push(`effective_from=$${values.length + 1}`);
    values.push(effectiveFrom || null);
  }

  assignments.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  const idParam = values.length;

  if (schema.ratesHasCompany && companyId !== null) {
    values.push(companyId);
  }
  const companyParam = values.length;

  const query = `
    UPDATE party_material_rates
    SET ${assignments.join(", ")}
    WHERE id=$${idParam}
    ${
      schema.ratesHasCompany && companyId !== null
        ? `AND company_id = $${companyParam}`
        : ""
    }
    RETURNING id
  `;

  await pool.query(query, values);

  const updated = await pool.query(
    `${baseQuery} WHERE pmr.id = $1 ${
      schema.ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    schema.ratesHasCompany && companyId !== null ? [id, companyId] : [id]
  );

  return updated.rows[0];
};

const toggleStatus = async (id, isActive, companyId = null) => {
  const schema = await getRateSchemaFlags();
  const baseQuery = buildBaseQuery(schema);
  const result = await pool.query(
    `
    UPDATE party_material_rates
    SET is_active=$1, updated_at=CURRENT_TIMESTAMP
    WHERE id=$2
    ${schema.ratesHasCompany && companyId !== null ? `AND company_id = $3` : ""} RETURNING id
  `,
    schema.ratesHasCompany && companyId !== null ? [isActive, id, companyId] : [isActive, id]
  );

  const row = await pool.query(
    `${baseQuery} WHERE pmr.id=$1 ${
      schema.ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    schema.ratesHasCompany && companyId !== null ? [id, companyId] : [id]
  );

  return row.rows[0];
};

module.exports = {
  getAllRates,
  findActiveRateConflict,
  insertRate,
  updateRate,
  toggleStatus,
};
