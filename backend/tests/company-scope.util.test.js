const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasColumn,
  resetCompanyScopeCache,
  tableExists,
  verifyCompanyScopeFoundation,
} = require("../src/utils/companyScope.util");

const buildDb = ({ tables = [], columns = [] }) => ({
  async query(sql, params) {
    if (sql.includes("information_schema.tables")) {
      return {
        rows: [
          {
            exists: tables.includes(params[0]),
          },
        ],
      };
    }

    if (sql.includes("information_schema.columns")) {
      const [tableName, columnName] = params;
      return {
        rows: [
          {
            exists: columns.some(
              (entry) =>
                entry.tableName === tableName && entry.columnName === columnName
            ),
          },
        ],
      };
    }

    throw new Error(`Unexpected query: ${sql}`);
  },
});

test("verifyCompanyScopeFoundation skips validation before companies table exists", async () => {
  resetCompanyScopeCache();
  await verifyCompanyScopeFoundation(
    buildDb({
      tables: ["dispatch_reports"],
      columns: [],
    })
  );
});

test("verifyCompanyScopeFoundation fails when company scope rollout is incomplete", async () => {
  resetCompanyScopeCache();
  await assert.rejects(
    verifyCompanyScopeFoundation(
      buildDb({
        tables: ["companies", "dispatch_reports", "vehicles"],
        columns: [{ tableName: "dispatch_reports", columnName: "company_id" }],
      })
    ),
    /vehicles/
  );
});

test("schema capability cache is scoped per db handle", async () => {
  resetCompanyScopeCache();

  const dbWithoutColumn = buildDb({
    tables: ["dispatch_reports"],
    columns: [],
  });
  const dbWithColumn = buildDb({
    tables: ["dispatch_reports"],
    columns: [{ tableName: "dispatch_reports", columnName: "company_id" }],
  });

  assert.equal(await hasColumn("dispatch_reports", "company_id", dbWithoutColumn), false);
  assert.equal(await hasColumn("dispatch_reports", "company_id", dbWithColumn), true);
});

test("schema cache prevents duplicate introspection queries for the same db handle", async () => {
  resetCompanyScopeCache();
  const calls = {
    tableQueries: 0,
    columnQueries: 0,
  };
  const db = {
    async query(sql) {
      if (sql.includes("information_schema.tables")) {
        calls.tableQueries += 1;
        return { rows: [{ exists: true }] };
      }

      if (sql.includes("information_schema.columns")) {
        calls.columnQueries += 1;
        return { rows: [{ exists: true }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  assert.equal(await tableExists("dispatch_reports", db), true);
  assert.equal(await tableExists("dispatch_reports", db), true);
  assert.equal(await hasColumn("dispatch_reports", "company_id", db), true);
  assert.equal(await hasColumn("dispatch_reports", "company_id", db), true);

  assert.equal(calls.tableQueries, 1);
  assert.equal(calls.columnQueries, 1);
});
