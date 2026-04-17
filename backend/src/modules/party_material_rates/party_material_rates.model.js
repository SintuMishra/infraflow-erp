const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const baseQuery = `
SELECT
  pmr.id,
  pmr.plant_id AS "plantId",
  p.plant_name AS "plantName",
  pmr.party_id AS "partyId",
  pty.party_name AS "partyName",
  pmr.material_id AS "materialId",
  m.material_name AS "materialName",
  pmr.rate_per_ton AS "ratePerTon",
  pmr.royalty_mode AS "royaltyMode",
  pmr.royalty_value AS "royaltyValue",
  pmr.loading_charge AS "loadingCharge",
  pmr.notes,
  pmr.is_active AS "isActive"
FROM party_material_rates pmr
JOIN plant_master p ON p.id = pmr.plant_id
JOIN party_master pty ON pty.id = pmr.party_id
JOIN material_master m ON m.id = pmr.material_id
`;

const getAllRates = async (companyId = null) => {
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const result = await pool.query(
    `${baseQuery} ${
      ratesHasCompany && companyId !== null ? `WHERE pmr.company_id = $1` : ""
    } ORDER BY pmr.id DESC`,
    ratesHasCompany && companyId !== null ? [companyId] : []
  );
  return result.rows;
};

const insertRate = async (data) => {
  const {
    plantId,
    partyId,
    materialId,
    ratePerTon,
    royaltyMode,
    royaltyValue,
    loadingCharge,
    notes,
    companyId,
  } = data;
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");

  const query = `
    INSERT INTO party_material_rates
    (plant_id, party_id, material_id, rate_per_ton, royalty_mode, royalty_value, loading_charge, notes${
      ratesHasCompany ? `, company_id` : ""
    })
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8${ratesHasCompany ? `,$9` : ""})
    RETURNING id
  `;

  const values = [
    plantId,
    partyId,
    materialId,
    ratePerTon,
    royaltyMode,
    royaltyValue,
    loadingCharge,
    notes,
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
    royaltyMode,
    royaltyValue,
    loadingCharge,
    notes,
    companyId,
  } = data;
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");

  const query = `
    UPDATE party_material_rates
    SET plant_id=$1,
        party_id=$2,
        material_id=$3,
        rate_per_ton=$4,
        royalty_mode=$5,
        royalty_value=$6,
        loading_charge=$7,
        notes=$8,
        updated_at = CURRENT_TIMESTAMP
    WHERE id=$9
    ${ratesHasCompany && companyId !== null ? `AND company_id = $10` : ""}
    RETURNING id
  `;

  await pool.query(query, [
    plantId,
    partyId,
    materialId,
    ratePerTon,
    royaltyMode,
    royaltyValue,
    loadingCharge,
    notes,
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
  insertRate,
  updateRate,
  toggleStatus,
};
