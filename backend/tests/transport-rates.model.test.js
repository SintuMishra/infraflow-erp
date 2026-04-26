const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedTransportRateModel = async ({ queryImpl, hasColumnImpl }, run) => {
  const modelPath = require.resolve(
    "../src/modules/transport_rates/transport_rates.model.js"
  );
  const dbPath = require.resolve("../src/config/db.js");
  const scopePath = require.resolve("../src/utils/companyScope.util.js");

  const originals = {
    model: require.cache[modelPath],
    db: require.cache[dbPath],
    scope: require.cache[scopePath],
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      pool: {
        query: queryImpl,
      },
    },
  };

  require.cache[scopePath] = {
    id: scopePath,
    filename: scopePath,
    loaded: true,
    exports: {
      hasColumn: hasColumnImpl,
    },
  };

  delete require.cache[modelPath];

  try {
    const model = require(modelPath);
    await run(model);
  } finally {
    delete require.cache[modelPath];

    for (const [key, path] of Object.entries({
      model: modelPath,
      db: dbPath,
      scope: scopePath,
    })) {
      if (originals[key]) require.cache[path] = originals[key];
      else delete require.cache[path];
    }
  }
};

test("findAllTransportRates stays compatible when unit-aware columns are missing", async () => {
  const capturedQueries = [];

  await withMockedTransportRateModel(
    {
      queryImpl: async (query, params) => {
        capturedQueries.push({ query, params });
        return {
          rows: [
            {
              id: 1,
              plantId: 11,
              plantName: "Alpha Plant",
              vendorId: 21,
              vendorName: "Fleet One",
              materialId: 31,
              materialName: "GSB",
              rateType: "per_ton",
              billingBasis: "per_ton",
              rateValue: 450,
              distanceKm: null,
              rateUnitId: null,
              minimumCharge: null,
              isActive: true,
              createdAt: null,
              updatedAt: null,
            },
          ],
        };
      },
      hasColumnImpl: async (tableName, columnName) => {
        if (tableName !== "transport_rates") {
          return true;
        }

        return !["billing_basis", "rate_unit_id", "minimum_charge"].includes(columnName);
      },
    },
    async ({ findAllTransportRates }) => {
      const rows = await findAllTransportRates(3);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].billingBasis, "per_ton");
      assert.equal(rows[0].rateUnitId, null);
      assert.equal(rows[0].minimumCharge, null);
      assert.match(capturedQueries[0].query, /tr\.rate_type AS "billingBasis"/);
      assert.doesNotMatch(capturedQueries[0].query, /tr\.billing_basis\b/);
    }
  );
});

test("findAllTransportRates selects new unit-aware transport fields when schema columns exist", async () => {
  const capturedQueries = [];

  await withMockedTransportRateModel(
    {
      queryImpl: async (query) => {
        capturedQueries.push(query);
        return { rows: [] };
      },
      hasColumnImpl: async () => true,
    },
    async ({ findAllTransportRates }) => {
      await findAllTransportRates(3);

      assert.match(
        capturedQueries[0],
        /COALESCE\(tr\.billing_basis, tr\.rate_type\) AS "billingBasis"/
      );
      assert.match(capturedQueries[0], /tr\.rate_unit_id AS "rateUnitId"/);
      assert.match(capturedQueries[0], /tr\.minimum_charge AS "minimumCharge"/);
    }
  );
});
