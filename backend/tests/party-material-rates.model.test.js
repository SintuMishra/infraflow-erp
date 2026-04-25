const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedRateModel = async ({ queryImpl, hasColumnImpl }, run) => {
  const modelPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const dbPath = require.resolve("../src/config/db.js");
  const scopePath = require.resolve("../src/utils/companyScope.util.js");

  const originalModel = require.cache[modelPath];
  const originalDb = require.cache[dbPath];
  const originalScope = require.cache[scopePath];

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

    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];

    if (originalDb) require.cache[dbPath] = originalDb;
    else delete require.cache[dbPath];

    if (originalScope) require.cache[scopePath] = originalScope;
    else delete require.cache[scopePath];
  }
};

test("getAllRates stays compatible when rate unit columns are missing", async () => {
  const capturedQueries = [];

  await withMockedRateModel(
    {
      queryImpl: async (query, params) => {
        capturedQueries.push({ query, params });
        return {
          rows: [
            {
              id: 1,
              plantId: 11,
              plantName: "Alpha Plant",
              partyId: 21,
              partyName: "Acme Infra",
              materialId: 31,
              materialName: "GSB",
              ratePerTon: 900,
              rateUnit: "per_ton",
              rateUnitLabel: null,
              rateUnitsPerTon: 1,
              royaltyMode: "fixed",
              royaltyValue: 0,
              tonsPerBrass: null,
              loadingCharge: 50,
              loadingChargeBasis: "fixed",
              notes: "",
              effectiveFrom: null,
              isActive: true,
            },
          ],
        };
      },
      hasColumnImpl: async (tableName, columnName) => {
        if (tableName !== "party_material_rates") {
          return true;
        }

        return !["rate_unit", "rate_unit_label", "rate_units_per_ton"].includes(
          columnName
        );
      },
    },
    async ({ getAllRates }) => {
      const rows = await getAllRates(2);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].rateUnit, "per_ton");
      assert.equal(rows[0].rateUnitLabel, null);
      assert.equal(Number(rows[0].rateUnitsPerTon), 1);
      assert.match(capturedQueries[0].query, /'per_ton'::text AS "rateUnit"/);
      assert.doesNotMatch(capturedQueries[0].query, /pmr\.rate_unit\b/);
    }
  );
});
