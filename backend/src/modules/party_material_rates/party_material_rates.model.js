const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const buildBaseQuery = (hasEffectiveFrom, hasLoadingChargeBasis) => `
SELECT
  pmr.id,
  pmr.plant_id AS "plantId",
  p.plant_name AS "plantName",
  pmr.party_id AS "partyId",
  pty.party_name AS "partyName",
  pmr.material_id AS "materialId",
  m.material_name AS "materialName",
  pmr.rate_per_ton AS "ratePerTon",
  COALESCE(pmr.rate_unit, 'per_ton') AS "rateUnit",
  pmr.rate_unit_label AS "rateUnitLabel",
  COALESCE(pmr.rate_units_per_ton, 1) AS "rateUnitsPerTon",
  pmr.royalty_mode AS "royaltyMode",
  pmr.royalty_value AS "royaltyValue",
  pmr.tons_per_brass AS "tonsPerBrass",
  pmr.loading_charge AS "loadingCharge",
  ${
    hasLoadingChargeBasis
      ? `COALESCE(pmr.loading_charge_basis, 'fixed') AS "loadingChargeBasis",`
      : `'fixed' AS "loadingChargeBasis",`
  }
  pmr.notes,
  ${
    hasEffectiveFrom
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
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");
  const ratesHasLoadingChargeBasis = await hasColumn(
    "party_material_rates",
    "loading_charge_basis"
  );
  const baseQuery = buildBaseQuery(ratesHasEffectiveFrom, ratesHasLoadingChargeBasis);
  const result = await pool.query(
    `${baseQuery} ${
      ratesHasCompany && companyId !== null ? `WHERE pmr.company_id = $1` : ""
    } ORDER BY ${
      ratesHasEffectiveFrom
        ? `pmr.effective_from DESC NULLS LAST, pmr.id DESC`
        : `pmr.id DESC`
    }`,
    ratesHasCompany && companyId !== null ? [companyId] : []
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
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");

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
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");
  const ratesHasLoadingChargeBasis = await hasColumn(
    "party_material_rates",
    "loading_charge_basis"
  );
  const baseQuery = buildBaseQuery(ratesHasEffectiveFrom, ratesHasLoadingChargeBasis);

  const query = `
    INSERT INTO party_material_rates
    (plant_id, party_id, material_id, rate_per_ton, rate_unit, rate_unit_label, rate_units_per_ton, royalty_mode, royalty_value, tons_per_brass, loading_charge${
      ratesHasLoadingChargeBasis ? `, loading_charge_basis` : ""
    }, notes${
      ratesHasEffectiveFrom ? `, effective_from` : ""
    }${
      ratesHasCompany ? `, company_id` : ""
    })
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11${
      ratesHasLoadingChargeBasis ? `,$12` : ""
    },$${ratesHasLoadingChargeBasis ? 13 : 12}${
      ratesHasEffectiveFrom ? `,$${ratesHasLoadingChargeBasis ? 14 : 13}` : ""
    }${
      ratesHasCompany
        ? ratesHasEffectiveFrom
          ? `,$${ratesHasLoadingChargeBasis ? 15 : 14}`
          : `,$${ratesHasLoadingChargeBasis ? 14 : 13}`
        : ""
    })
    RETURNING id
  `;

  const values = [
    plantId,
    partyId,
    materialId,
    ratePerTon,
    rateUnit,
    rateUnitLabel,
    rateUnitsPerTon,
    royaltyMode,
    royaltyValue,
    royaltyMode === "per_brass" ? tonsPerBrass : null,
    loadingCharge,
    ...(ratesHasLoadingChargeBasis ? [loadingChargeBasis] : []),
    notes,
    ...(ratesHasEffectiveFrom ? [effectiveFrom || null] : []),
    ...(ratesHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);

  const inserted = await pool.query(
    `${baseQuery} WHERE pmr.id = $1 ${
      ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    ratesHasCompany && companyId !== null
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
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");
  const ratesHasLoadingChargeBasis = await hasColumn(
    "party_material_rates",
    "loading_charge_basis"
  );
  const baseQuery = buildBaseQuery(ratesHasEffectiveFrom, ratesHasLoadingChargeBasis);

  const query = `
    UPDATE party_material_rates
    SET plant_id=$1,
        party_id=$2,
        material_id=$3,
        rate_per_ton=$4,
        rate_unit=$5,
        rate_unit_label=$6,
        rate_units_per_ton=$7,
        royalty_mode=$8,
        royalty_value=$9,
        tons_per_brass=$10,
        loading_charge=$11,
        ${ratesHasLoadingChargeBasis ? `loading_charge_basis=$12,` : ""}
        notes=$${ratesHasLoadingChargeBasis ? 13 : 12},
        ${ratesHasEffectiveFrom ? `effective_from=$${ratesHasLoadingChargeBasis ? 14 : 13},` : ""}
        updated_at = CURRENT_TIMESTAMP
    WHERE id=$${ratesHasEffectiveFrom ? (ratesHasLoadingChargeBasis ? 15 : 14) : (ratesHasLoadingChargeBasis ? 14 : 13)}
    ${ratesHasCompany && companyId !== null ? `AND company_id = $${ratesHasEffectiveFrom ? (ratesHasLoadingChargeBasis ? 16 : 15) : (ratesHasLoadingChargeBasis ? 15 : 14)}` : ""}
    RETURNING id
  `;

  await pool.query(query, [
    plantId,
    partyId,
    materialId,
    ratePerTon,
    rateUnit,
    rateUnitLabel,
    rateUnitsPerTon,
    royaltyMode,
    royaltyValue,
    royaltyMode === "per_brass" ? tonsPerBrass : null,
    loadingCharge,
    ...(ratesHasLoadingChargeBasis ? [loadingChargeBasis] : []),
    notes,
    ...(ratesHasEffectiveFrom ? [effectiveFrom || null] : []),
    id,
    ...(ratesHasCompany && companyId !== null ? [companyId] : []),
  ]);

  const updated = await pool.query(
    `${baseQuery} WHERE pmr.id = $1 ${
      ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    ratesHasCompany && companyId !== null ? [id, companyId] : [id]
  );

  return updated.rows[0];
};

const toggleStatus = async (id, isActive, companyId = null) => {
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");
  const ratesHasLoadingChargeBasis = await hasColumn(
    "party_material_rates",
    "loading_charge_basis"
  );
  const baseQuery = buildBaseQuery(ratesHasEffectiveFrom, ratesHasLoadingChargeBasis);
  const result = await pool.query(
    `
    UPDATE party_material_rates
    SET is_active=$1, updated_at=CURRENT_TIMESTAMP
    WHERE id=$2
    ${ratesHasCompany && companyId !== null ? `AND company_id = $3` : ""} RETURNING id
  `,
    ratesHasCompany && companyId !== null ? [isActive, id, companyId] : [isActive, id]
  );

  const row = await pool.query(
    `${baseQuery} WHERE pmr.id=$1 ${
      ratesHasCompany && companyId !== null ? `AND pmr.company_id = $2` : ""
    }`,
    ratesHasCompany && companyId !== null ? [id, companyId] : [id]
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
