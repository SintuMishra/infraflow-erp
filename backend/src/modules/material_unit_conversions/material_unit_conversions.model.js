const { pool } = require("../../config/db");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const mapUnitRow = (row) =>
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

const mapConversionRow = (row) =>
  row
    ? {
        ...row,
        companyId: row.companyId !== null && row.companyId !== undefined ? Number(row.companyId) : null,
        materialId: Number(row.materialId),
        fromUnitId: Number(row.fromUnitId),
        toUnitId: Number(row.toUnitId),
        conversionFactor:
          row.conversionFactor !== null && row.conversionFactor !== undefined
            ? Number(row.conversionFactor)
            : null,
        isActive: Boolean(row.isActive),
      }
    : null;

const findUnitById = async (unitId, companyId = null, db = pool) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const params = [Number(unitId)];
  let companyClause = "";

  if (scopedCompanyId !== null) {
    params.push(scopedCompanyId);
    companyClause = `AND (um.company_id = $2 OR um.company_id IS NULL)`;
  }

  const result = await db.query(
    `
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
      ${companyClause}
      LIMIT 1
    `,
    params
  );

  return mapUnitRow(result.rows[0] || null);
};

const findUnitByCode = async (unitCode, companyId = null, db = pool) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const normalizedCode = String(unitCode || "").trim();
  const params = [normalizedCode];
  let companyFilter = `um.company_id IS NULL`;
  let companySort = `CASE WHEN um.company_id IS NULL THEN 0 ELSE 1 END`;

  if (scopedCompanyId !== null) {
    params.push(scopedCompanyId);
    companyFilter = `(um.company_id = $2 OR um.company_id IS NULL)`;
    companySort = `CASE WHEN um.company_id = $2 THEN 0 ELSE 1 END`;
  }

  const result = await db.query(
    `
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
      WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM($1))
        AND ${companyFilter}
      ORDER BY ${companySort}, um.id ASC
      LIMIT 1
    `,
    params
  );

  return mapUnitRow(result.rows[0] || null);
};

const findConversionCandidates = async (
  { materialId, fromUnitId, toUnitId, companyId = null, effectiveDate = null },
  db = pool
) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const params = [Number(materialId), Number(fromUnitId), Number(toUnitId)];
  let nextParamIndex = params.length + 1;

  const effectiveDateClause = effectiveDate
    ? `
      AND muc.effective_from <= $${nextParamIndex}
      AND (muc.effective_to IS NULL OR muc.effective_to >= $${nextParamIndex})
    `
    : "";

  if (effectiveDate) {
    params.push(effectiveDate);
    nextParamIndex += 1;
  }

  const companyFilter =
    scopedCompanyId !== null
      ? `(muc.company_id = $${nextParamIndex} OR muc.company_id IS NULL)`
      : `muc.company_id IS NULL`;

  if (scopedCompanyId !== null) {
    params.push(scopedCompanyId);
  }

  const companySort =
    scopedCompanyId !== null
      ? `CASE WHEN muc.company_id = $${params.length} THEN 0 ELSE 1 END`
      : `CASE WHEN muc.company_id IS NULL THEN 0 ELSE 1 END`;

  const result = await db.query(
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
      WHERE muc.material_id = $1
        AND (
          (muc.from_unit_id = $2 AND muc.to_unit_id = $3)
          OR
          (muc.from_unit_id = $3 AND muc.to_unit_id = $2)
        )
        AND muc.is_active = TRUE
        ${effectiveDateClause}
        AND ${companyFilter}
      ORDER BY
        ${companySort},
        CASE
          WHEN muc.from_unit_id = $2 AND muc.to_unit_id = $3 THEN 0
          ELSE 1
        END,
        muc.effective_from DESC,
        muc.id DESC
    `,
    params
  );

  return result.rows.map(mapConversionRow);
};

module.exports = {
  findUnitByCode,
  findUnitById,
  findConversionCandidates,
};
