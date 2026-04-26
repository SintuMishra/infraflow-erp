const { pool } = require("../../config/db");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");

const buildScopedParams = (companyEnabled, companyId, values = []) =>
  companyEnabled && companyId !== null ? [...values, companyId] : values;

const countScopedRowsById = async ({
  tableName,
  idColumn,
  idValue,
  companyId,
}) => {
  if (!(await tableExists(tableName))) {
    return 0;
  }

  if (!(await hasColumn(tableName, idColumn))) {
    return 0;
  }

  const hasCompany = await hasColumn(tableName, "company_id");
  const query = `
    SELECT COUNT(*)::int AS "count"
    FROM ${tableName}
    WHERE ${idColumn} = $1
    ${hasCompany && companyId !== null ? `AND company_id = $2` : ""}
  `;

  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [idValue])
  );
  return Number(result.rows[0]?.count || 0);
};

const findScopedMasterLabel = async ({
  tableName,
  idColumn = "id",
  labelColumn,
  idValue,
  companyId,
}) => {
  if (!(await tableExists(tableName))) {
    return "";
  }

  if (!(await hasColumn(tableName, labelColumn))) {
    return "";
  }

  const hasCompany = await hasColumn(tableName, "company_id");
  const query = `
    SELECT ${labelColumn} AS "label"
    FROM ${tableName}
    WHERE ${idColumn} = $1
    ${hasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [idValue])
  );

  return String(result.rows[0]?.label || "").trim();
};

const countScopedRowsByText = async ({
  tableName,
  textColumn,
  textValue,
  companyId,
}) => {
  const normalizedText = String(textValue || "").trim();

  if (!normalizedText) {
    return 0;
  }

  if (!(await tableExists(tableName))) {
    return 0;
  }

  if (!(await hasColumn(tableName, textColumn))) {
    return 0;
  }

  const hasCompany = await hasColumn(tableName, "company_id");
  const query = `
    SELECT COUNT(*)::int AS "count"
    FROM ${tableName}
    WHERE LOWER(BTRIM(${textColumn})) = LOWER(BTRIM($1))
    ${hasCompany && companyId !== null ? `AND company_id = $2` : ""}
  `;

  const result = await pool.query(
    query,
    buildScopedParams(hasCompany, companyId, [normalizedText])
  );
  return Number(result.rows[0]?.count || 0);
};

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

const mapUnitMasterRow = (row) =>
  row
    ? {
        ...row,
        companyId: row.companyId !== null && row.companyId !== undefined ? Number(row.companyId) : null,
        precisionScale:
          row.precisionScale !== null && row.precisionScale !== undefined
            ? Number(row.precisionScale)
            : null,
        isBaseUnit: Boolean(row.isBaseUnit),
        isActive: Boolean(row.isActive),
      }
    : null;

const mapMaterialUnitConversionRow = (row) =>
  row
    ? {
        ...row,
        companyId: row.companyId !== null && row.companyId !== undefined ? Number(row.companyId) : null,
        materialId: row.materialId !== null && row.materialId !== undefined ? Number(row.materialId) : null,
        fromUnitId: row.fromUnitId !== null && row.fromUnitId !== undefined ? Number(row.fromUnitId) : null,
        toUnitId: row.toUnitId !== null && row.toUnitId !== undefined ? Number(row.toUnitId) : null,
        conversionFactor:
          row.conversionFactor !== null && row.conversionFactor !== undefined
            ? Number(row.conversionFactor)
            : null,
        isActive: Boolean(row.isActive),
      }
    : null;

const findUnits = async (companyId = null) => {
  const query = `
    SELECT
      um.id,
      um.company_id AS "companyId",
      um.unit_code AS "unitCode",
      um.unit_name AS "unitName",
      um.dimension_type AS "dimensionType",
      um.precision_scale AS "precisionScale",
      um.is_base_unit AS "isBaseUnit",
      um.is_active AS "isActive"
    FROM public.unit_master um
    WHERE ${companyId !== null ? `(um.company_id = $1 OR um.company_id IS NULL)` : `um.company_id IS NULL`}
    ORDER BY
      CASE WHEN um.company_id IS NULL THEN 1 ELSE 0 END,
      um.dimension_type ASC,
      um.unit_name ASC,
      um.id ASC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows.map(mapUnitMasterRow);
};

const findUnitByIdForScope = async (id, companyId = null) => {
  const query = `
    SELECT
      um.id,
      um.company_id AS "companyId",
      um.unit_code AS "unitCode",
      um.unit_name AS "unitName",
      um.dimension_type AS "dimensionType",
      um.precision_scale AS "precisionScale",
      um.is_base_unit AS "isBaseUnit",
      um.is_active AS "isActive"
    FROM public.unit_master um
    WHERE um.id = $1
    ${companyId !== null ? `AND (um.company_id = $2 OR um.company_id IS NULL)` : `AND um.company_id IS NULL`}
    LIMIT 1
  `;

  const values = companyId !== null ? [id, companyId] : [id];
  const result = await pool.query(query, values);
  return mapUnitMasterRow(result.rows[0] || null);
};

const insertUnit = async ({
  unitCode,
  unitName,
  dimensionType,
  precisionScale,
  isBaseUnit,
  isActive,
  companyId,
}) => {
  const result = await pool.query(
    `
      INSERT INTO public.unit_master (
        company_id,
        unit_code,
        unit_name,
        dimension_type,
        precision_scale,
        is_base_unit,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        company_id AS "companyId",
        unit_code AS "unitCode",
        unit_name AS "unitName",
        dimension_type AS "dimensionType",
        precision_scale AS "precisionScale",
        is_base_unit AS "isBaseUnit",
        is_active AS "isActive"
    `,
    [companyId || null, unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive]
  );

  return mapUnitMasterRow(result.rows[0]);
};

const updateUnit = async ({
  id,
  unitCode,
  unitName,
  dimensionType,
  precisionScale,
  isBaseUnit,
  isActive,
  companyId,
}) => {
  const query = `
    UPDATE public.unit_master
    SET
      unit_code = $1,
      unit_name = $2,
      dimension_type = $3,
      precision_scale = $4,
      is_base_unit = $5,
      is_active = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    ${
      companyId !== null
        ? `AND (company_id = $8 OR company_id IS NULL)`
        : `AND company_id IS NULL`
    }
    RETURNING
      id,
      company_id AS "companyId",
      unit_code AS "unitCode",
      unit_name AS "unitName",
      dimension_type AS "dimensionType",
      precision_scale AS "precisionScale",
      is_base_unit AS "isBaseUnit",
      is_active AS "isActive"
  `;

  const values =
    companyId !== null
      ? [unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive, id, companyId]
      : [unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive, id];

  const result = await pool.query(query, values);
  return mapUnitMasterRow(result.rows[0] || null);
};

const findMaterialById = async (id, companyId = null) => {
  const hasCompany = await hasColumn("material_master", "company_id");
  const result = await pool.query(
    `
      SELECT
        id,
        material_name AS "materialName",
        material_code AS "materialCode",
        is_active AS "isActive"
      FROM public.material_master
      WHERE id = $1
      ${hasCompany && companyId !== null ? `AND company_id = $2` : ""}
      LIMIT 1
    `,
    buildScopedParams(hasCompany, companyId, [id])
  );

  return result.rows[0] || null;
};

const findMaterialUnitConversions = async (companyId = null) => {
  const result = await pool.query(
    `
      SELECT
        muc.id,
        muc.company_id AS "companyId",
        muc.material_id AS "materialId",
        mm.material_name AS "materialName",
        muc.from_unit_id AS "fromUnitId",
        from_um.unit_code AS "fromUnitCode",
        from_um.unit_name AS "fromUnitName",
        muc.to_unit_id AS "toUnitId",
        to_um.unit_code AS "toUnitCode",
        to_um.unit_name AS "toUnitName",
        muc.conversion_factor AS "conversionFactor",
        muc.conversion_method AS "conversionMethod",
        muc.effective_from AS "effectiveFrom",
        muc.effective_to AS "effectiveTo",
        muc.notes,
        muc.is_active AS "isActive"
      FROM public.material_unit_conversions muc
      INNER JOIN public.material_master mm ON mm.id = muc.material_id
      INNER JOIN public.unit_master from_um ON from_um.id = muc.from_unit_id
      INNER JOIN public.unit_master to_um ON to_um.id = muc.to_unit_id
      WHERE ${companyId !== null ? `(muc.company_id = $1 OR muc.company_id IS NULL)` : `muc.company_id IS NULL`}
      ORDER BY
        CASE WHEN muc.company_id IS NULL THEN 1 ELSE 0 END,
        muc.material_id ASC,
        muc.from_unit_id ASC,
        muc.to_unit_id ASC,
        muc.effective_from DESC,
        muc.id DESC
    `,
    companyId !== null ? [companyId] : []
  );

  return result.rows.map(mapMaterialUnitConversionRow);
};

const insertMaterialUnitConversion = async ({
  materialId,
  fromUnitId,
  toUnitId,
  conversionFactor,
  conversionMethod,
  effectiveFrom,
  effectiveTo,
  notes,
  isActive,
  companyId,
}) => {
  const result = await pool.query(
    `
      INSERT INTO public.material_unit_conversions (
        company_id,
        material_id,
        from_unit_id,
        to_unit_id,
        conversion_factor,
        conversion_method,
        effective_from,
        effective_to,
        notes,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id,
        company_id AS "companyId",
        material_id AS "materialId",
        from_unit_id AS "fromUnitId",
        to_unit_id AS "toUnitId",
        conversion_factor AS "conversionFactor",
        conversion_method AS "conversionMethod",
        effective_from AS "effectiveFrom",
        effective_to AS "effectiveTo",
        notes,
        is_active AS "isActive"
    `,
    [
      companyId || null,
      materialId,
      fromUnitId,
      toUnitId,
      conversionFactor,
      conversionMethod,
      effectiveFrom,
      effectiveTo,
      notes,
      isActive,
    ]
  );

  return mapMaterialUnitConversionRow(result.rows[0]);
};

const updateMaterialUnitConversion = async ({
  id,
  materialId,
  fromUnitId,
  toUnitId,
  conversionFactor,
  conversionMethod,
  effectiveFrom,
  effectiveTo,
  notes,
  isActive,
  companyId,
}) => {
  const query = `
    UPDATE public.material_unit_conversions
    SET
      material_id = $1,
      from_unit_id = $2,
      to_unit_id = $3,
      conversion_factor = $4,
      conversion_method = $5,
      effective_from = $6,
      effective_to = $7,
      notes = $8,
      is_active = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    ${companyId !== null ? `AND company_id = $11` : `AND company_id IS NULL`}
    RETURNING
      id,
      company_id AS "companyId",
      material_id AS "materialId",
      from_unit_id AS "fromUnitId",
      to_unit_id AS "toUnitId",
      conversion_factor AS "conversionFactor",
      conversion_method AS "conversionMethod",
      effective_from AS "effectiveFrom",
      effective_to AS "effectiveTo",
      notes,
      is_active AS "isActive"
  `;

  const values =
    companyId !== null
      ? [
          materialId,
          fromUnitId,
          toUnitId,
          conversionFactor,
          conversionMethod,
          effectiveFrom,
          effectiveTo,
          notes,
          isActive,
          id,
          companyId,
        ]
      : [
          materialId,
          fromUnitId,
          toUnitId,
          conversionFactor,
          conversionMethod,
          effectiveFrom,
          effectiveTo,
          notes,
          isActive,
          id,
        ];

  const result = await pool.query(query, values);
  return mapMaterialUnitConversionRow(result.rows[0] || null);
};

const findOverlappingActiveMaterialUnitConversion = async ({
  idToIgnore = null,
  materialId,
  fromUnitId,
  toUnitId,
  effectiveFrom,
  effectiveTo,
  companyId,
}) => {
  const values = [
    materialId,
    fromUnitId,
    toUnitId,
    effectiveFrom,
    effectiveTo,
  ];
  let nextIndex = values.length + 1;

  let excludeClause = "";
  if (idToIgnore !== null && idToIgnore !== undefined) {
    excludeClause = `AND muc.id <> $${nextIndex}`;
    values.push(idToIgnore);
    nextIndex += 1;
  }

  const companyClause = companyId !== null ? `muc.company_id = $${nextIndex}` : `muc.company_id IS NULL`;
  if (companyId !== null) {
    values.push(companyId);
  }

  const result = await pool.query(
    `
      SELECT
        muc.id,
        muc.company_id AS "companyId",
        muc.material_id AS "materialId",
        muc.from_unit_id AS "fromUnitId",
        muc.to_unit_id AS "toUnitId",
        muc.conversion_factor AS "conversionFactor",
        muc.conversion_method AS "conversionMethod",
        muc.effective_from AS "effectiveFrom",
        muc.effective_to AS "effectiveTo",
        muc.is_active AS "isActive"
      FROM public.material_unit_conversions muc
      WHERE muc.is_active = TRUE
        AND muc.material_id = $1
        AND muc.from_unit_id = $2
        AND muc.to_unit_id = $3
        AND NOT (
          (muc.effective_to IS NOT NULL AND muc.effective_to < $4::date)
          OR
          ($5::date IS NOT NULL AND muc.effective_from > $5::date)
        )
        ${excludeClause}
        AND ${companyClause}
      ORDER BY muc.effective_from DESC, muc.id DESC
      LIMIT 1
    `,
    values
  );

  return mapMaterialUnitConversionRow(result.rows[0] || null);
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

const getMaterialUsageSummary = async ({ id, companyId }) => {
  const usageChecks = [
    { tableName: "dispatch_reports", idColumn: "material_id", label: "dispatch reports" },
    { tableName: "party_orders", idColumn: "material_id", label: "party orders" },
    { tableName: "party_material_rates", idColumn: "material_id", label: "party material rates" },
    { tableName: "transport_rates", idColumn: "material_id", label: "transport rates" },
  ];

  const usage = [];
  for (const check of usageChecks) {
    const count = await countScopedRowsById({
      tableName: check.tableName,
      idColumn: check.idColumn,
      idValue: id,
      companyId,
    });
    if (count > 0) {
      usage.push({ label: check.label, count });
    }
  }

  return {
    totalReferences: usage.reduce((sum, item) => sum + item.count, 0),
    usage,
  };
};

const getVehicleTypeUsageSummary = async ({ id, companyId }) => {
  const typeName = await findScopedMasterLabel({
    tableName: "vehicle_type_master",
    labelColumn: "type_name",
    idValue: id,
    companyId,
  });

  const vehiclesCount = await countScopedRowsByText({
    tableName: "vehicles",
    textColumn: "vehicle_type",
    textValue: typeName,
    companyId,
  });

  const usage = vehiclesCount > 0 ? [{ label: "vehicles", count: vehiclesCount }] : [];

  return {
    totalReferences: vehiclesCount,
    usage,
  };
};

const getCrusherUnitUsageSummary = async ({ id, companyId }) => {
  const unitName = await findScopedMasterLabel({
    tableName: "crusher_units",
    labelColumn: "unit_name",
    idValue: id,
    companyId,
  });

  const crusherReportsCount = await countScopedRowsByText({
    tableName: "crusher_daily_reports",
    textColumn: "crusher_unit_name",
    textValue: unitName,
    companyId,
  });

  const usage =
    crusherReportsCount > 0
      ? [{ label: "crusher daily reports", count: crusherReportsCount }]
      : [];

  return {
    totalReferences: crusherReportsCount,
    usage,
  };
};

const getShiftUsageSummary = async ({ id, companyId }) => {
  const shiftName = await findScopedMasterLabel({
    tableName: "shift_master",
    labelColumn: "shift_name",
    idValue: id,
    companyId,
  });

  const projectShiftCount = await countScopedRowsByText({
    tableName: "project_daily_reports",
    textColumn: "shift",
    textValue: shiftName,
    companyId,
  });

  const crusherShiftCount = await countScopedRowsByText({
    tableName: "crusher_daily_reports",
    textColumn: "shift_name",
    textValue: shiftName,
    companyId,
  });

  const usage = [];
  if (projectShiftCount > 0) {
    usage.push({ label: "project daily reports", count: projectShiftCount });
  }
  if (crusherShiftCount > 0) {
    usage.push({ label: "crusher daily reports", count: crusherShiftCount });
  }

  return {
    totalReferences: projectShiftCount + crusherShiftCount,
    usage,
  };
};

module.exports = {
  findCrusherUnits,
  findMaterials,
  findShifts,
  findVehicleTypes,
  findConfigOptions,
  findUnits,
  findUnitByIdForScope,
  insertUnit,
  updateUnit,
  findMaterialById,
  findMaterialUnitConversions,
  insertMaterialUnitConversion,
  updateMaterialUnitConversion,
  findOverlappingActiveMaterialUnitConversion,
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
  getMaterialUsageSummary,
  getVehicleTypeUsageSummary,
  getCrusherUnitUsageSummary,
  getShiftUsageSummary,
};
