const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedTransportRateService = async (mocks, run) => {
  const servicePath = require.resolve(
    "../src/modules/transport_rates/transport_rates.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/transport_rates/transport_rates.model.js"
  );

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllTransportRates: async () => [],
      insertTransportRate: async (payload) => ({ id: 501, ...payload }),
      updateTransportRate: async (payload) => ({ id: 501, ...payload }),
      updateTransportRateStatus: async () => null,
      plantExists: async () => true,
      vendorExists: async () => true,
      materialExists: async () => true,
      ...mocks.model,
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
    })) {
      if (originals[key]) require.cache[path] = originals[key];
      else delete require.cache[path];
    }
  }
};

test("createTransportRateRecord falls back billingBasis from legacy rateType", async () => {
  let insertedPayload = null;

  await withMockedTransportRateService(
    {
      model: {
        insertTransportRate: async (payload) => {
          insertedPayload = payload;
          return { id: 910, ...payload };
        },
      },
    },
    async ({ createTransportRateRecord }) => {
      await createTransportRateRecord({
        plantId: 1,
        vendorId: 2,
        materialId: 3,
        rateType: "per_km",
        rateValue: 45,
        distanceKm: 18,
        companyId: 99,
      });
    }
  );

  assert.equal(insertedPayload.billingBasis, "per_km");
  assert.equal(insertedPayload.rateType, "per_km");
  assert.equal(insertedPayload.distanceKm, 18);
});

test("createTransportRateRecord stores per_unit billing with legacy-compatible rateType", async () => {
  let insertedPayload = null;

  await withMockedTransportRateService(
    {
      model: {
        insertTransportRate: async (payload) => {
          insertedPayload = payload;
          return { id: 911, ...payload };
        },
      },
    },
    async ({ createTransportRateRecord }) => {
      await createTransportRateRecord({
        plantId: 1,
        vendorId: 2,
        materialId: 3,
        billingBasis: "per_unit",
        rateUnitId: 12,
        rateValue: 275,
        minimumCharge: 1000,
        companyId: 99,
      });
    }
  );

  assert.equal(insertedPayload.billingBasis, "per_unit");
  assert.equal(insertedPayload.rateType, "per_ton");
  assert.equal(insertedPayload.rateUnitId, 12);
  assert.equal(insertedPayload.minimumCharge, 1000);
});

test("createTransportRateRecord requires rateUnitId for per_unit billing", async () => {
  await withMockedTransportRateService({}, async ({ createTransportRateRecord }) => {
    await assert.rejects(
      () =>
        createTransportRateRecord({
          plantId: 1,
          vendorId: 2,
          materialId: 3,
          billingBasis: "per_unit",
          rateValue: 275,
          companyId: 99,
        }),
      /rateUnitId/i
    );
  });
});

test("createTransportRateRecord rejects negative minimumCharge", async () => {
  await withMockedTransportRateService({}, async ({ createTransportRateRecord }) => {
    await assert.rejects(
      () =>
        createTransportRateRecord({
          plantId: 1,
          vendorId: 2,
          materialId: 3,
          billingBasis: "per_trip",
          rateValue: 2750,
          minimumCharge: -1,
          companyId: 99,
        }),
      /minimumCharge/i
    );
  });
});
