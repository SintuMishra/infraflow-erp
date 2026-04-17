const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const findAllPlants = async (companyId = null) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    SELECT
      id,
      plant_name AS "plantName",
      plant_code AS "plantCode",
      plant_type AS "plantType",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM plant_master
    ${plantsHasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY plant_name ASC
  `;
  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows;
};

const insertPlant = async ({
  plantName,
  plantCode,
  plantType,
  location,
  powerSourceType,
  companyId,
}) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    INSERT INTO plant_master (
      plant_name,
      plant_code,
      plant_type,
      location,
      power_source_type
      ${plantsHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, $5${plantsHasCompany ? `, $6` : ""})
    RETURNING
      id,
      plant_name AS "plantName",
      plant_code AS "plantCode",
      plant_type AS "plantType",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [
    plantName,
    plantCode || null,
    plantType,
    location || null,
    powerSourceType || "diesel",
    ...(plantsHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updatePlant = async ({
  plantId,
  plantName,
  plantCode,
  plantType,
  location,
  powerSourceType,
  companyId,
}) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    UPDATE plant_master
    SET
      plant_name = $1,
      plant_code = $2,
      plant_type = $3,
      location = $4,
      power_source_type = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    ${plantsHasCompany && companyId !== null ? `AND company_id = $7` : ""}
    RETURNING
      id,
      plant_name AS "plantName",
      plant_code AS "plantCode",
      plant_type AS "plantType",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [
    plantName,
    plantCode || null,
    plantType,
    location || null,
    powerSourceType || "diesel",
    plantId,
    ...(plantsHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updatePlantStatus = async ({ plantId, isActive, companyId }) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    UPDATE plant_master
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${plantsHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      plant_name AS "plantName",
      plant_code AS "plantCode",
      plant_type AS "plantType",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const result = await pool.query(
    query,
    plantsHasCompany && companyId !== null
      ? [isActive, plantId, companyId]
      : [isActive, plantId]
  );
  return result.rows[0];
};

module.exports = {
  findAllPlants,
  insertPlant,
  updatePlant,
  updatePlantStatus,
};
