const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withDashboardServiceMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/dashboard/dashboard.service.js");
  const dbPath = require.resolve("../src/config/db.js");
  const companyScopePath = require.resolve("../src/utils/companyScope.util.js");

  const originals = {
    service: require.cache[servicePath],
    db: require.cache[dbPath],
    companyScope: require.cache[companyScopePath],
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mocks.db,
  };
  require.cache[companyScopePath] = {
    id: companyScopePath,
    filename: companyScopePath,
    loaded: true,
    exports: mocks.companyScope,
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originals.service) require.cache[servicePath] = originals.service;
    if (originals.db) require.cache[dbPath] = originals.db;
    else delete require.cache[dbPath];
    if (originals.companyScope) require.cache[companyScopePath] = originals.companyScope;
    else delete require.cache[companyScopePath];
  }
};

test("getDashboardSummary applies company-scoped queries when companyId is provided", async () => {
  const queries = [];

  await withDashboardServiceMocks(
    {
      db: {
        pool: {
          query: async (query, params = []) => {
            queries.push({ query, params });

            if (query.includes('AS "todayDispatchTons"')) {
              return {
                rows: [
                  { id: 1, plantName: "Alpha", todayDispatchTons: "42", dispatchCount: 3 },
                ],
              };
            }

            if (query.includes('AS "activeVehicles"')) {
              return {
                rows: [{ id: 1, plantName: "Alpha", activeVehicles: 5 }],
              };
            }

            if (query.includes('AS "dispatchDate"')) {
              return {
                rows: [
                  {
                    id: 91,
                    dispatchDate: "2026-04-16",
                    plantName: "Alpha",
                    materialType: "GSB",
                    vehicleNumber: "UP32AB1234",
                    destinationName: "Site A",
                    quantityTons: "12.5",
                  },
                ],
              };
            }

            if (query.includes("COALESCE(SUM")) {
              return { rows: [{ total: "10" }] };
            }

            return { rows: [{ count: 2 }] };
          },
        },
      },
      companyScope: {
        hasColumn: async () => true,
      },
    },
    async ({ getDashboardSummary }) => {
      const summary = await getDashboardSummary(77);

      assert.equal(summary.employees.total, 2);
      assert.equal(summary.plants.dispatchSummary[0].todayDispatchTons, 42);
      assert.equal(summary.dispatch.recentActivity[0].quantityTons, 12.5);
    }
  );

  assert.equal(queries.length, 16);
  for (const entry of queries) {
    assert.deepEqual(entry.params, [77]);
  }

  assert.match(queries[0].query, /FROM employees[\s\S]*company_id = \$1/i);
  assert.match(queries[5].query, /FROM dispatch_reports[\s\S]*company_id = \$1/i);
  assert.match(queries[13].query, /dr\.company_id = \$1/i);
  assert.match(queries[14].query, /v\.company_id = \$1/i);
  assert.match(queries[15].query, /WHERE dr\.company_id = \$1/i);
});

test("getDashboardSummary stays schema-compatible without company columns", async () => {
  const queries = [];

  await withDashboardServiceMocks(
    {
      db: {
        pool: {
          query: async (query, params = []) => {
            queries.push({ query, params });

            if (query.includes('AS "todayDispatchTons"')) {
              return { rows: [] };
            }

            if (query.includes('AS "activeVehicles"')) {
              return { rows: [] };
            }

            if (query.includes('AS "dispatchDate"')) {
              return { rows: [] };
            }

            if (query.includes("COALESCE(SUM")) {
              return { rows: [{ total: "0" }] };
            }

            return { rows: [{ count: 0 }] };
          },
        },
      },
      companyScope: {
        hasColumn: async () => false,
      },
    },
    async ({ getDashboardSummary }) => {
      const summary = await getDashboardSummary(77);

      assert.equal(summary.employees.total, 0);
      assert.equal(summary.dispatch.todayQuantity, 0);
    }
  );

  for (const entry of queries) {
    assert.deepEqual(entry.params, [77]);
    assert.doesNotMatch(entry.query, /company_id = \$1/i);
  }
});
