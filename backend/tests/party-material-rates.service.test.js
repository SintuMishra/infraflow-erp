const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedRateService = async (mocks, run) => {
  const servicePath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const scopePath = require.resolve("../src/utils/companyScope.util.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const partiesModelPath = require.resolve("../src/modules/parties/parties.model.js");
  const conversionsServicePath = require.resolve(
    "../src/modules/material_unit_conversions/material_unit_conversions.service.js"
  );

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    scope: require.cache[scopePath],
    dispatchModel: require.cache[dispatchModelPath],
    partiesModel: require.cache[partiesModelPath],
    conversionsService: require.cache[conversionsServicePath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      getAllRates: async () => [],
      findActiveRateConflict: async () => null,
      insertRate: async (payload) => payload,
      updateRate: async (_id, payload) => payload,
      toggleStatus: async () => null,
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
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 1 }),
      materialExists: async () => ({ id: 7 }),
      ...mocks.dispatchModel,
    },
  };

  require.cache[partiesModelPath] = {
    id: partiesModelPath,
    filename: partiesModelPath,
    loaded: true,
    exports: {
      getPartyById: async () => ({ id: 9 }),
      ...mocks.partiesModel,
    },
  };

  require.cache[conversionsServicePath] = {
    id: conversionsServicePath,
    filename: conversionsServicePath,
    loaded: true,
    exports: {
      getUnitById: async () => ({
        id: 12,
        unitCode: "CFT",
        unitName: "Cubic Feet",
        isActive: true,
      }),
      convertFromTon: async () => ({
        conversionId: 41,
        originalConversionId: 41,
        calculatedQuantity: 22.5,
      }),
      ...mocks.conversionsService,
    },
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    for (const [key, path] of Object.entries({
      service: servicePath,
      model: modelPath,
      scope: scopePath,
      dispatchModel: dispatchModelPath,
      partiesModel: partiesModelPath,
      conversionsService: conversionsServicePath,
    })) {
      if (originals[key]) require.cache[path] = originals[key];
      else delete require.cache[path];
    }
  }
};

test("createRate hydrates legacy fields from per_unit billing input", async () => {
  let insertedPayload = null;

  await withMockedRateService(
    {
      model: {
        insertRate: async (payload) => {
          insertedPayload = payload;
          return { id: 501, ...payload };
        },
      },
    },
    async ({ createRate }) => {
      await createRate({
        plantId: 1,
        partyId: 9,
        materialId: 7,
        billingBasis: "per_unit",
        rateUnitId: 12,
        pricePerUnit: 38,
        effectiveFrom: "2026-04-26",
        royaltyMode: "none",
        royaltyValue: 0,
        loadingChargeBasis: "fixed",
        loadingCharge: 0,
        notes: "Per CFT selling rate",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.billingBasis, "per_unit");
  assert.equal(insertedPayload.rateUnitId, 12);
  assert.equal(insertedPayload.pricePerUnit, 38);
  assert.equal(insertedPayload.ratePerTon, 38);
  assert.equal(insertedPayload.rateUnit, "per_cft");
  assert.equal(insertedPayload.rateUnitLabel, "CFT");
  assert.equal(insertedPayload.rateUnitsPerTon, 22.5);
  assert.equal(insertedPayload.conversionId, 41);
});

test("createRate accepts per_ton billing with pricePerUnit fallback", async () => {
  let insertedPayload = null;

  await withMockedRateService(
    {
      model: {
        insertRate: async (payload) => {
          insertedPayload = payload;
          return { id: 502, ...payload };
        },
      },
    },
    async ({ createRate }) => {
      await createRate({
        plantId: 1,
        partyId: 9,
        materialId: 7,
        billingBasis: "per_ton",
        pricePerUnit: 950,
        rateUnit: "per_ton",
        rateUnitsPerTon: 1,
        effectiveFrom: "2026-04-26",
        royaltyMode: "none",
        royaltyValue: 0,
        loadingChargeBasis: "fixed",
        loadingCharge: 0,
        notes: "",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.billingBasis, "per_ton");
  assert.equal(insertedPayload.pricePerUnit, 950);
  assert.equal(insertedPayload.ratePerTon, 950);
});
