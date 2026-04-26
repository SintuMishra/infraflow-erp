const model = require("./material_unit_conversions.model");
const { normalizeCompanyId, tableExists } = require("../../utils/companyScope.util");

const buildValidationError = (message, statusCode = 400, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

const UNIT_TABLE_NAME = "unit_master";
const CONVERSION_TABLE_NAME = "material_unit_conversions";

const normalizeDate = (value) => {
  const normalized = String(value || "").trim();
  return normalized || new Date().toISOString().slice(0, 10);
};

const normalizePositiveNumber = (value, fieldName) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw buildValidationError(`${fieldName} must be a valid number greater than or equal to 0`);
  }

  return numeric;
};

const ensureSchemaAvailable = async () => {
  const [unitsTableExists, conversionsTableExists] = await Promise.all([
    tableExists(UNIT_TABLE_NAME),
    tableExists(CONVERSION_TABLE_NAME),
  ]);

  if (!unitsTableExists || !conversionsTableExists) {
    throw buildValidationError(
      "Material unit conversion schema is not available. Run the latest migrations first.",
      503,
      "UNIT_CONVERSION_SCHEMA_MISSING"
    );
  }
};

const ensureUnitExistsAndActive = (unit, lookupLabel) => {
  if (!unit) {
    throw buildValidationError(`${lookupLabel} was not found`, 404, "UNIT_NOT_FOUND");
  }

  if (!unit.isActive) {
    throw buildValidationError(`${lookupLabel} is inactive`, 400, "UNIT_INACTIVE");
  }

  return unit;
};

const getUnitById = async (unitId, companyId = null) => {
  await ensureSchemaAvailable();

  const normalizedUnitId = Number(unitId);
  if (!Number.isInteger(normalizedUnitId) || normalizedUnitId <= 0) {
    throw buildValidationError("unitId must be a valid positive integer");
  }

  const unit = await model.findUnitById(normalizedUnitId, normalizeCompanyId(companyId));
  return ensureUnitExistsAndActive(unit, `Unit ${normalizedUnitId}`);
};

const getUnitByCode = async (unitCode, companyId = null) => {
  await ensureSchemaAvailable();

  const normalizedUnitCode = String(unitCode || "").trim();
  if (!normalizedUnitCode) {
    throw buildValidationError("unitCode is required");
  }

  const unit = await model.findUnitByCode(normalizedUnitCode, normalizeCompanyId(companyId));
  return ensureUnitExistsAndActive(unit, `Unit ${normalizedUnitCode}`);
};

const resolveConversionRecord = (rows, fromUnitId, toUnitId) => {
  const direct = rows.find(
    (row) => Number(row.fromUnitId) === Number(fromUnitId) && Number(row.toUnitId) === Number(toUnitId)
  );

  if (direct) {
    const directFactor = Number(direct.conversionFactor);
    return {
      conversionId: direct.id,
      originalConversionId: direct.id,
      fromUnitId: Number(fromUnitId),
      originalFromUnitId: Number(direct.fromUnitId),
      toUnitId: Number(toUnitId),
      originalToUnitId: Number(direct.toUnitId),
      conversionFactor: directFactor,
      effectiveConversionFactor: directFactor,
      conversionMethod: direct.conversionMethod,
      isReciprocal: false,
    };
  }

  const reverse = rows.find(
    (row) => Number(row.fromUnitId) === Number(toUnitId) && Number(row.toUnitId) === Number(fromUnitId)
  );

  if (!reverse) {
    return null;
  }

  const reverseFactor = Number(reverse.conversionFactor);
  if (!Number.isFinite(reverseFactor) || reverseFactor <= 0) {
    throw buildValidationError(
      `Stored conversion ${reverse.id} is invalid and cannot be used`,
      400,
      "INVALID_CONVERSION_FACTOR"
    );
  }

  return {
    conversionId: reverse.id,
    originalConversionId: reverse.id,
    fromUnitId: Number(fromUnitId),
    originalFromUnitId: Number(reverse.fromUnitId),
    toUnitId: Number(toUnitId),
    originalToUnitId: Number(reverse.toUnitId),
    conversionFactor: 1 / reverseFactor,
    effectiveConversionFactor: 1 / reverseFactor,
    conversionMethod: reverse.conversionMethod,
    isReciprocal: true,
  };
};

const getActiveConversion = async (
  materialId,
  fromUnitId,
  toUnitId,
  companyId = null,
  date = null
) => {
  await ensureSchemaAvailable();

  const normalizedMaterialId = Number(materialId);
  const normalizedFromUnitId = Number(fromUnitId);
  const normalizedToUnitId = Number(toUnitId);
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const effectiveDate = normalizeDate(date);

  if (!Number.isInteger(normalizedMaterialId) || normalizedMaterialId <= 0) {
    throw buildValidationError("materialId must be a valid positive integer");
  }

  const [fromUnit, toUnit] = await Promise.all([
    getUnitById(normalizedFromUnitId, normalizedCompanyId),
    getUnitById(normalizedToUnitId, normalizedCompanyId),
  ]);

  if (normalizedFromUnitId === normalizedToUnitId) {
    return {
      conversionId: null,
      originalConversionId: null,
      fromUnitId: fromUnit.id,
      originalFromUnitId: fromUnit.id,
      toUnitId: toUnit.id,
      originalToUnitId: toUnit.id,
      conversionFactor: 1,
      effectiveConversionFactor: 1,
      conversionMethod: "identity",
      isReciprocal: false,
    };
  }

  const candidates = await model.findConversionCandidates(
    {
      materialId: normalizedMaterialId,
      fromUnitId: normalizedFromUnitId,
      toUnitId: normalizedToUnitId,
      companyId: normalizedCompanyId,
      effectiveDate,
    }
  );

  const resolved = resolveConversionRecord(candidates, normalizedFromUnitId, normalizedToUnitId);

  if (!resolved) {
    throw buildValidationError(
      `No active material conversion found for material ${normalizedMaterialId} from ${fromUnit.unitCode} to ${toUnit.unitCode} on ${effectiveDate}`,
      404,
      "MATERIAL_CONVERSION_NOT_FOUND"
    );
  }

  return resolved;
};

const convertMaterialQuantity = async (
  materialId,
  quantity,
  fromUnitId,
  toUnitId,
  companyId = null,
  date = null
) => {
  const normalizedQuantity = normalizePositiveNumber(quantity, "quantity");
  const conversion = await getActiveConversion(
    materialId,
    fromUnitId,
    toUnitId,
    companyId,
    date
  );

  return {
    ...conversion,
    calculatedQuantity: normalizedQuantity * Number(conversion.conversionFactor),
  };
};

const convertToTon = async (materialId, quantity, fromUnitId, companyId = null, date = null) => {
  const tonUnit = await getUnitByCode("TON", companyId);
  return await convertMaterialQuantity(
    materialId,
    quantity,
    fromUnitId,
    tonUnit.id,
    companyId,
    date
  );
};

const convertFromTon = async (
  materialId,
  quantityTons,
  toUnitId,
  companyId = null,
  date = null
) => {
  const tonUnit = await getUnitByCode("TON", companyId);
  return await convertMaterialQuantity(
    materialId,
    quantityTons,
    tonUnit.id,
    toUnitId,
    companyId,
    date
  );
};

module.exports = {
  getUnitById,
  getUnitByCode,
  getActiveConversion,
  convertMaterialQuantity,
  convertToTon,
  convertFromTon,
};
