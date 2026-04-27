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

const findPlantsPage = async ({ companyId = null, page = 1, limit = 25, search = "" } = {}) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const values = [];
  const conditions = [];
  let parameterIndex = 1;

  if (plantsHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`company_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (String(search || "").trim()) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    conditions.push(
      `(LOWER(COALESCE(plant_name, '')) LIKE $${parameterIndex} OR LOWER(COALESCE(plant_code, '')) LIKE $${parameterIndex})`
    );
    parameterIndex += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const queryValues = [...values, limit, offset];

  const result = await pool.query(
    `
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
      ${whereClause}
      ORDER BY plant_name ASC, id ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `,
    queryValues
  );

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM plant_master
      ${whereClause}
    `,
    values
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findPlantLookup = async (companyId = null) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    SELECT
      id,
      plant_name AS label,
      plant_code AS code,
      plant_type AS "plantType",
      is_active AS "isActive"
    FROM plant_master
    WHERE is_active = true
    ${plantsHasCompany && companyId !== null ? `AND company_id = $1` : ""}
    ORDER BY plant_name ASC, id ASC
  `;

  const result = await pool.query(query, plantsHasCompany && companyId !== null ? [companyId] : []);
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
  findPlantsPage,
  findPlantLookup,
  insertPlant,
  updatePlant,
  updatePlantStatus,
};
