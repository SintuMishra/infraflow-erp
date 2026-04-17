const test = require("node:test");
const assert = require("node:assert/strict");

const withMockedAuthModel = async ({ hasColumnImpl, queryImpl }, run) => {
  const modelPath = require.resolve("../src/modules/auth/auth.model.js");
  const dbPath = require.resolve("../src/config/db");
  const scopePath = require.resolve("../src/utils/companyScope.util");

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

    if (originalModel) {
      require.cache[modelPath] = originalModel;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }

    if (originalScope) {
      require.cache[scopePath] = originalScope;
    } else {
      delete require.cache[scopePath];
    }
  }
};

test("buildEmployeeCodeAlias strips trailing year from employee-style login ids", async () => {
  const {
    buildEmployeeCodeAlias,
  } = require("../src/modules/auth/auth.model.js");

  assert.equal(buildEmployeeCodeAlias("EMP00072026"), "EMP0007");
  assert.equal(buildEmployeeCodeAlias(" emp00072026 "), "emp0007");
  assert.equal(buildEmployeeCodeAlias("9876543210"), "");
  assert.equal(buildEmployeeCodeAlias("EMP0007"), "");
});

test("findUsersByLoginIdentifier includes employee-code alias for year-suffixed login ids", async () => {
  let capturedSql = "";
  let capturedParams = [];

  await withMockedAuthModel(
    {
      hasColumnImpl: async () => false,
      queryImpl: async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      },
    },
    async ({ findUsersByLoginIdentifier }) => {
      await findUsersByLoginIdentifier("EMP00072026");
    }
  );

  assert.match(capturedSql, /LOWER\(e\.employee_code\) = LOWER\(\$3\)/);
  assert.deepEqual(capturedParams, ["EMP00072026", "00072026", "EMP0007"]);
});
