const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const buildScopedParams = (companyEnabled, companyId, values = []) =>
  companyEnabled && companyId !== null ? [...values, companyId] : values;

const findCrusherUnits = async (companyId = null) => {
  const hasCompany = await hasColumn("crusher_units", "company_id");
  const hasPlantType = await hasColumn("crusher_units", "plant_type");
  const query = `
    SELECT
      id,
      unit_name AS "unitName",
      unit_code AS "unitCode",
      location,
      ${hasPlantType ? `plant_type AS "plantType",` : `'Crusher'::text AS "plantType",`}
      power_source_type AS "powerSourceType",
      is_active AS "isActive"
    FROM crusher_units
    ${hasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY unit_name ASC
  `;
  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [])
  );
  return result.rows;
};

const findMaterials = async (companyId = null) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const hasHsnSacCode = await hasColumn("material_master", "hsn_sac_code");
  const query = `
    SELECT
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      ${hasHsnSacCode ? `hsn_sac_code AS "hsnSacCode",` : `NULL::text AS "hsnSacCode",`}
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
    FROM material_master
    ${hasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY material_name ASC
  `;
  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [])
  );
  return result.rows;
};

const findShifts = async (companyId = null) => {
  const hasCompany = await hasColumn("shift_master", "company_id");
  const query = `
    SELECT
      id,
      shift_name AS "shiftName",
      start_time AS "startTime",
      end_time AS "endTime",
      is_active AS "isActive"
    FROM shift_master
    ${hasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY id ASC
  `;
  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [])
  );
  return result.rows;
};

const findVehicleTypes = async (companyId = null) => {
  const hasCompany = await hasColumn("vehicle_type_master", "company_id");
  const query = `
    SELECT
      id,
      type_name AS "typeName",
      category,
      is_active AS "isActive"
    FROM vehicle_type_master
    ${hasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY type_name ASC
  `;
  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [])
  );
  return result.rows;
};

const findConfigOptions = async (companyId = null) => {
  const hasCompany = await hasColumn("master_config_options", "company_id");
  const query = `
    SELECT
      id,
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM master_config_options
    ${hasCompany && companyId !== null ? `WHERE company_id = $1` : ""}
    ORDER BY config_type ASC, sort_order ASC, option_label ASC
  `;
  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [])
  );
  return result.rows;
};

const insertConfigOption = async ({
  configType,
  optionLabel,
  optionValue,
  sortOrder,
  companyId,
}) => {
  const hasCompany = await hasColumn("master_config_options", "company_id");
  const query = `
    INSERT INTO master_config_options (
      config_type,
      option_label,
      option_value,
      sort_order
      ${hasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4${hasCompany ? `, $5` : ""})
    RETURNING
      id,
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
  `;
  const values = [
    configType,
    optionLabel,
    optionValue || optionLabel,
    sortOrder ?? 0,
    ...(hasCompany ? [companyId || null] : []),
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateConfigOption = async ({
  id,
  configType,
  optionLabel,
  optionValue,
  sortOrder,
  companyId,
}) => {
  const hasCompany = await hasColumn("master_config_options", "company_id");
  const query = `
    UPDATE master_config_options
    SET
      config_type = $1,
      option_label = $2,
      option_value = $3,
      sort_order = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    ${hasCompany && companyId !== null ? `AND company_id = $6` : ""}
    RETURNING
      id,
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
  `;
  const values = buildScopedParams(hasCompany, companyId, [
    configType,
    optionLabel,
    optionValue || optionLabel,
    sortOrder ?? 0,
    id,
  ]);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const setConfigOptionStatus = async ({ id, isActive, companyId }) => {
  const hasCompany = await hasColumn("master_config_options", "company_id");
  const result = await pool.query(
    `
    UPDATE master_config_options
    SET is_active = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [isActive, id])
  );
  return result.rows[0] || null;
};

const insertCrusherUnit = async ({
  unitName,
  unitCode,
  location,
  plantType,
  powerSourceType,
  companyId,
}) => {
  const hasCompany = await hasColumn("crusher_units", "company_id");
  const hasPlantType = await hasColumn("crusher_units", "plant_type");
  const query = `
    INSERT INTO crusher_units (
      unit_name,
      unit_code,
      location,
      ${hasPlantType ? `plant_type,` : ""}
      power_source_type
      ${hasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, ${hasPlantType ? `$4, ` : ""}$${hasPlantType ? 5 : 4}${hasCompany ? `, $${hasPlantType ? 6 : 5}` : ""})
    RETURNING
      id,
      unit_name AS "unitName",
      unit_code AS "unitCode",
      location,
      ${hasPlantType ? `plant_type AS "plantType",` : `'Crusher'::text AS "plantType",`}
      power_source_type AS "powerSourceType",
      is_active AS "isActive"
  `;
  const values = [
    unitName,
    unitCode || null,
    location || null,
    ...(hasPlantType ? [plantType || "Crusher"] : []),
    powerSourceType || "diesel",
    ...(hasCompany ? [companyId || null] : []),
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const insertMaterial = async ({
  materialName,
  materialCode,
  hsnSacCode,
  category,
  unit,
  gstRate,
  companyId,
}) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const hasHsnSacCode = await hasColumn("material_master", "hsn_sac_code");
  const query = `
    INSERT INTO material_master (
      material_name,
      material_code,
      ${hasHsnSacCode ? `hsn_sac_code,` : ""}
      category,
      unit,
      gst_rate
      ${hasCompany ? `, company_id` : ""}
    )
    VALUES (
      $1,
      $2,
      ${hasHsnSacCode ? `$3,` : ""}
      $${hasHsnSacCode ? 4 : 3},
      $${hasHsnSacCode ? 5 : 4},
      $${hasHsnSacCode ? 6 : 5}
      ${hasCompany ? `, $${hasHsnSacCode ? 7 : 6}` : ""}
    )
    RETURNING
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      ${hasHsnSacCode ? `hsn_sac_code AS "hsnSacCode",` : `NULL::text AS "hsnSacCode",`}
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
  `;
  const values = [
    materialName,
    materialCode || null,
    ...(hasHsnSacCode ? [hsnSacCode || null] : []),
    category || null,
    unit || "tons",
    gstRate,
    ...(hasCompany ? [companyId || null] : []),
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const insertShift = async ({ shiftName, startTime, endTime, companyId }) => {
  const hasCompany = await hasColumn("shift_master", "company_id");
  const query = `
    INSERT INTO shift_master (
      shift_name,
      start_time,
      end_time
      ${hasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3${hasCompany ? `, $4` : ""})
    RETURNING
      id,
      shift_name AS "shiftName",
      start_time AS "startTime",
      end_time AS "endTime",
      is_active AS "isActive"
  `;
  const values = [
    shiftName,
    startTime || null,
    endTime || null,
    ...(hasCompany ? [companyId || null] : []),
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const insertVehicleType = async ({ typeName, category, companyId }) => {
  const hasCompany = await hasColumn("vehicle_type_master", "company_id");
  const query = `
    INSERT INTO vehicle_type_master (
      type_name,
      category
      ${hasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2${hasCompany ? `, $3` : ""})
    RETURNING
      id,
      type_name AS "typeName",
      category,
      is_active AS "isActive"
  `;
  const values = [typeName, category || null, ...(hasCompany ? [companyId || null] : [])];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateCrusherUnit = async ({
  id,
  unitName,
  unitCode,
  location,
  plantType,
  powerSourceType,
  companyId,
}) => {
  const hasCompany = await hasColumn("crusher_units", "company_id");
  const hasPlantType = await hasColumn("crusher_units", "plant_type");
  const query = `
    UPDATE crusher_units
    SET
      unit_name = $1,
      unit_code = $2,
      location = $3,
      ${hasPlantType ? `plant_type = $4,` : ""}
      power_source_type = $${hasPlantType ? 5 : 4},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${hasPlantType ? 6 : 5}
    ${hasCompany && companyId !== null ? `AND company_id = $${hasPlantType ? 7 : 6}` : ""}
    RETURNING
      id,
      unit_name AS "unitName",
      unit_code AS "unitCode",
      location,
      ${hasPlantType ? `plant_type AS "plantType",` : `'Crusher'::text AS "plantType",`}
      power_source_type AS "powerSourceType",
      is_active AS "isActive"
  `;
  const values = buildScopedParams(hasCompany, companyId, [
    unitName,
    unitCode || null,
    location || null,
    ...(hasPlantType ? [plantType || "Crusher"] : []),
    powerSourceType || "diesel",
    id,
  ]);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const updateMaterial = async ({
  id,
  materialName,
  materialCode,
  hsnSacCode,
  category,
  unit,
  gstRate,
  companyId,
}) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const hasHsnSacCode = await hasColumn("material_master", "hsn_sac_code");
  const query = `
    UPDATE material_master
    SET
      material_name = $1,
      material_code = $2,
      ${hasHsnSacCode ? `hsn_sac_code = $3,` : ""}
      category = $${hasHsnSacCode ? 4 : 3},
      unit = $${hasHsnSacCode ? 5 : 4},
      gst_rate = $${hasHsnSacCode ? 6 : 5},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${hasHsnSacCode ? 7 : 6}
    ${hasCompany && companyId !== null ? `AND company_id = $${hasHsnSacCode ? 8 : 7}` : ""}
    RETURNING
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      ${hasHsnSacCode ? `hsn_sac_code AS "hsnSacCode",` : `NULL::text AS "hsnSacCode",`}
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
  `;
  const values = buildScopedParams(hasCompany, companyId, [
    materialName,
    materialCode || null,
    ...(hasHsnSacCode ? [hsnSacCode || null] : []),
    category || null,
    unit || "tons",
    gstRate,
    id,
  ]);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const updateShift = async ({ id, shiftName, startTime, endTime, companyId }) => {
  const hasCompany = await hasColumn("shift_master", "company_id");
  const query = `
    UPDATE shift_master
    SET
      shift_name = $1,
      start_time = $2,
      end_time = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    ${hasCompany && companyId !== null ? `AND company_id = $5` : ""}
    RETURNING
      id,
      shift_name AS "shiftName",
      start_time AS "startTime",
      end_time AS "endTime",
      is_active AS "isActive"
  `;
  const values = buildScopedParams(hasCompany, companyId, [
    shiftName,
    startTime || null,
    endTime || null,
    id,
  ]);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const updateVehicleType = async ({ id, typeName, category, companyId }) => {
  const hasCompany = await hasColumn("vehicle_type_master", "company_id");
  const query = `
    UPDATE vehicle_type_master
    SET
      type_name = $1,
      category = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    ${hasCompany && companyId !== null ? `AND company_id = $4` : ""}
    RETURNING
      id,
      type_name AS "typeName",
      category,
      is_active AS "isActive"
  `;
  const values = buildScopedParams(hasCompany, companyId, [
    typeName,
    category || null,
    id,
  ]);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const setCrusherUnitStatus = async ({ id, isActive, companyId }) => {
  const hasCompany = await hasColumn("crusher_units", "company_id");
  const hasPlantType = await hasColumn("crusher_units", "plant_type");
  const result = await pool.query(
    `
    UPDATE crusher_units
    SET is_active = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      unit_name AS "unitName",
      unit_code AS "unitCode",
      location,
      ${hasPlantType ? `plant_type AS "plantType",` : `'Crusher'::text AS "plantType",`}
      power_source_type AS "powerSourceType",
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [isActive, id])
  );
  return result.rows[0] || null;
};

const setMaterialStatus = async ({ id, isActive, companyId }) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const result = await pool.query(
    `
    UPDATE material_master
    SET is_active = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [isActive, id])
  );
  return result.rows[0] || null;
};

const setMaterialHsnSacCode = async ({ id, hsnSacCode, companyId }) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const hasHsnSacCode = await hasColumn("material_master", "hsn_sac_code");

  if (!hasHsnSacCode) {
    return null;
  }

  const result = await pool.query(
    `
    UPDATE material_master
    SET hsn_sac_code = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      hsn_sac_code AS "hsnSacCode",
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [hsnSacCode, id])
  );
  return result.rows[0] || null;
};

const setShiftStatus = async ({ id, isActive, companyId }) => {
  const hasCompany = await hasColumn("shift_master", "company_id");
  const result = await pool.query(
    `
    UPDATE shift_master
    SET is_active = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      shift_name AS "shiftName",
      start_time AS "startTime",
      end_time AS "endTime",
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [isActive, id])
  );
  return result.rows[0] || null;
};

const setVehicleTypeStatus = async ({ id, isActive, companyId }) => {
  const hasCompany = await hasColumn("vehicle_type_master", "company_id");
  const result = await pool.query(
    `
    UPDATE vehicle_type_master
    SET is_active = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${hasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING
      id,
      type_name AS "typeName",
      category,
      is_active AS "isActive"
    `,
    buildScopedParams(hasCompany, companyId, [isActive, id])
  );
  return result.rows[0] || null;
};

module.exports = {
  findCrusherUnits,
  findMaterials,
  findShifts,
  findVehicleTypes,
  findConfigOptions,
  insertConfigOption,
  updateConfigOption,
  setConfigOptionStatus,
  insertCrusherUnit,
  insertMaterial,
  insertShift,
  insertVehicleType,
  updateCrusherUnit,
  updateMaterial,
  updateShift,
  updateVehicleType,
  setCrusherUnitStatus,
  setMaterialStatus,
  setMaterialHsnSacCode,
  setShiftStatus,
  setVehicleTypeStatus,
};
