const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedMastersModel = async ({ queryImpl, tableExistsImpl, hasColumnImpl }, run) => {
  const modelPath = require.resolve("../src/modules/masters/masters.model.js");
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
      hasColumn: hasColumnImpl || (async () => true),
      tableExists: tableExistsImpl || (async () => true),
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

test("updateUnit allows company-scoped updates for global seed units", async () => {
  const captured = [];

  await withMockedMastersModel(
    {
      queryImpl: async (query, params) => {
        captured.push({ query, params });
        return {
          rows: [
            {
              id: 1,
              companyId: null,
              unitCode: "TON",
              unitName: "Ton",
              dimensionType: "weight",
              precisionScale: 3,
              isBaseUnit: true,
              isActive: true,
            },
          ],
        };
      },
    },
    async ({ updateUnit }) => {
      const row = await updateUnit({
        id: 1,
        unitCode: "TON",
        unitName: "Ton",
        dimensionType: "weight",
        precisionScale: 3,
        isBaseUnit: true,
        isActive: true,
        companyId: 44,
      });

      assert.equal(row.id, 1);
      assert.equal(row.companyId, null);
    }
  );

  assert.match(captured[0].query, /AND \(company_id = \$8 OR company_id IS NULL\)/);
  assert.deepEqual(captured[0].params, [
    "TON",
    "Ton",
    "weight",
    3,
    true,
    true,
    1,
    44,
  ]);
});

