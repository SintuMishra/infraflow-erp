const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedConversionService = async (mocks, run) => {
  const servicePath = require.resolve(
    "../src/modules/material_unit_conversions/material_unit_conversions.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/material_unit_conversions/material_unit_conversions.model.js"
  );
  const scopePath = require.resolve("../src/utils/companyScope.util.js");

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    scope: require.cache[scopePath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findUnitById: async () => null,
      findUnitByCode: async () => null,
      findConversionCandidates: async () => [],
      ...mocks.model,
    },
  };

  require.cache[scopePath] = {
    id: scopePath,
    filename: scopePath,
    loaded: true,
    exports: {
      normalizeCompanyId: (value) => {
        if (value === undefined || value === null || value === "") {
          return null;
        }

        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
      },
      tableExists: async () => true,
      ...mocks.scope,
    },
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originals.service) require.cache[servicePath] = originals.service;
    else delete require.cache[servicePath];

    if (originals.model) require.cache[modelPath] = originals.model;
    else delete require.cache[modelPath];

    if (originals.scope) require.cache[scopePath] = originals.scope;
    else delete require.cache[scopePath];
  }
};

const makeUnit = (overrides = {}) => ({
  id: 1,
  companyId: null,
  unitCode: "TON",
  unitName: "Ton",
  dimensionType: "weight",
  precisionScale: 3,
  isBaseUnit: true,
  isActive: true,
  ...overrides,
});

const makeConversion = (overrides = {}) => ({
  id: 501,
  companyId: null,
  materialId: 77,
  fromUnitId: 2,
  toUnitId: 1,
  conversionFactor: 0.044444,
  conversionMethod: "density_based",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  isActive: true,
  ...overrides,
});

test("same-unit conversion returns identity snapshot with factor 1", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          makeUnit({ id: Number(unitId), unitCode: "TON", isActive: true }),
      },
    },
    async ({ convertMaterialQuantity }) => {
      const result = await convertMaterialQuantity(77, 12.5, 1, 1, null, "2026-04-26");

      assert.deepEqual(result, {
        conversionId: null,
        originalConversionId: null,
        fromUnitId: 1,
        originalFromUnitId: 1,
        toUnitId: 1,
        originalToUnitId: 1,
        conversionFactor: 1,
        effectiveConversionFactor: 1,
        conversionMethod: "identity",
        isReciprocal: false,
        calculatedQuantity: 12.5,
      });
    }
  );
});

test("convertToTon resolves CFT to TON conversion", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          unitId === 2
            ? makeUnit({ id: 2, unitCode: "CFT", dimensionType: "volume" })
            : makeUnit({ id: 1, unitCode: "TON" }),
        findUnitByCode: async (unitCode) =>
          unitCode === "TON" ? makeUnit({ id: 1, unitCode: "TON" }) : null,
        findConversionCandidates: async () => [makeConversion()],
      },
    },
    async ({ convertToTon }) => {
      const result = await convertToTon(77, 225, 2, null, "2026-04-26");

      assert.equal(result.fromUnitId, 2);
      assert.equal(result.toUnitId, 1);
      assert.equal(result.conversionId, 501);
      assert.equal(result.originalConversionId, 501);
      assert.equal(result.originalFromUnitId, 2);
      assert.equal(result.originalToUnitId, 1);
      assert.equal(result.conversionMethod, "density_based");
      assert.equal(result.isReciprocal, false);
      assert.equal(result.conversionFactor, 0.044444);
      assert.equal(result.effectiveConversionFactor, 0.044444);
      assert.equal(result.calculatedQuantity, 9.9999);
    }
  );
});

test("convertFromTon resolves TON to CFT conversion through reciprocal factor", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          unitId === 2
            ? makeUnit({ id: 2, unitCode: "CFT", dimensionType: "volume" })
            : makeUnit({ id: 1, unitCode: "TON" }),
        findUnitByCode: async (unitCode) =>
          unitCode === "TON" ? makeUnit({ id: 1, unitCode: "TON" }) : null,
        findConversionCandidates: async () => [makeConversion()],
      },
    },
    async ({ convertFromTon }) => {
      const result = await convertFromTon(77, 10, 2, null, "2026-04-26");

      assert.equal(result.fromUnitId, 1);
      assert.equal(result.toUnitId, 2);
      assert.equal(result.conversionId, 501);
      assert.equal(result.originalConversionId, 501);
      assert.equal(result.originalFromUnitId, 2);
      assert.equal(result.originalToUnitId, 1);
      assert.equal(result.conversionMethod, "density_based");
      assert.equal(result.isReciprocal, true);
      assert.ok(Math.abs(result.conversionFactor - 22.500225002250022) < 1e-9);
      assert.ok(Math.abs(result.effectiveConversionFactor - 22.500225002250022) < 1e-9);
      assert.ok(Math.abs(result.calculatedQuantity - 225.00225002250023) < 1e-9);
    }
  );
});

test("missing conversion throws a clear validation error", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          unitId === 2 ? makeUnit({ id: 2, unitCode: "CFT" }) : makeUnit({ id: 1, unitCode: "TON" }),
        findConversionCandidates: async () => [],
      },
    },
    async ({ getActiveConversion }) => {
      await assert.rejects(
        () => getActiveConversion(77, 2, 1, null, "2026-04-26"),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, "MATERIAL_CONVERSION_NOT_FOUND");
          assert.match(error.message, /No active material conversion found/i);
          assert.match(error.message, /CFT to TON/i);
          return true;
        }
      );
    }
  );
});

test("inactive unit throws a clear validation error", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          unitId === 2
            ? makeUnit({ id: 2, unitCode: "CFT", isActive: false })
            : makeUnit({ id: 1, unitCode: "TON" }),
      },
    },
    async ({ getActiveConversion }) => {
      await assert.rejects(
        () => getActiveConversion(77, 2, 1, null, "2026-04-26"),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "UNIT_INACTIVE");
          assert.match(error.message, /inactive/i);
          return true;
        }
      );
    }
  );
});

test("effective date selection uses the date passed to the lookup", async () => {
  let capturedLookup = null;

  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId) =>
          unitId === 2 ? makeUnit({ id: 2, unitCode: "CFT" }) : makeUnit({ id: 1, unitCode: "TON" }),
        findConversionCandidates: async (payload) => {
          capturedLookup = payload;
          return [makeConversion({ effectiveFrom: "2026-04-01" })];
        },
      },
    },
    async ({ getActiveConversion }) => {
      const result = await getActiveConversion(77, 2, 1, null, "2026-04-15");

      assert.equal(capturedLookup.effectiveDate, "2026-04-15");
      assert.equal(result.conversionId, 501);
    }
  );
});

test("company-specific override is preferred over global conversion", async () => {
  await withMockedConversionService(
    {
      model: {
        findUnitById: async (unitId, companyId) =>
          unitId === 2
            ? makeUnit({ id: 2, unitCode: "CFT", companyId })
            : makeUnit({ id: 1, unitCode: "TON", companyId }),
        findUnitByCode: async (unitCode, companyId) =>
          unitCode === "TON" ? makeUnit({ id: 1, unitCode: "TON", companyId }) : null,
        findConversionCandidates: async () => [
          makeConversion({ id: 600, companyId: 44, conversionFactor: 0.05 }),
          makeConversion({ id: 501, companyId: null, conversionFactor: 0.044444 }),
        ],
      },
    },
    async ({ convertToTon }) => {
      const result = await convertToTon(77, 200, 2, 44, "2026-04-26");

      assert.equal(result.conversionId, 600);
      assert.equal(result.conversionFactor, 0.05);
      assert.equal(result.calculatedQuantity, 10);
    }
  );
});
