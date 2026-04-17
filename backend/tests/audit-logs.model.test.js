const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedModules = async (moduleRelativePath, mockEntries, run) => {
  const modulePath = require.resolve(moduleRelativePath);
  const originalModule = require.cache[modulePath];
  const originals = new Map();

  for (const [dependencyRelativePath, mockExports] of mockEntries) {
    const dependencyPath = require.resolve(dependencyRelativePath);
    originals.set(dependencyPath, require.cache[dependencyPath]);
    require.cache[dependencyPath] = {
      id: dependencyPath,
      filename: dependencyPath,
      loaded: true,
      exports: mockExports,
    };
  }

  delete require.cache[modulePath];

  try {
    const loadedModule = require(modulePath);
    await run(loadedModule);
  } finally {
    delete require.cache[modulePath];

    if (originalModule) {
      require.cache[modulePath] = originalModule;
    }

    for (const [dependencyPath, originalDependency] of originals.entries()) {
      if (originalDependency) {
        require.cache[dependencyPath] = originalDependency;
      } else {
        delete require.cache[dependencyPath];
      }
    }
  }
};

test("listAuditLogs returns empty list when audit table does not exist", async () => {
  let queryCalled = false;

  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.model.js",
    [
      [
        "../src/config/db",
        {
          pool: {
            query: async () => {
              queryCalled = true;
              return { rows: [] };
            },
          },
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          tableExists: async () => false,
          hasColumn: async () => false,
        },
      ],
    ],
    async ({ listAuditLogs }) => {
      const result = await listAuditLogs({ companyId: 5 });

      assert.deepEqual(result.items, []);
      assert.equal(result.total, 0);
      assert.equal(queryCalled, false);
    }
  );
});

test("listAuditLogs applies company and search filters when schema supports them", async () => {
  let capturedQuery = "";
  let capturedParams = [];

  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.model.js",
    [
      [
        "../src/config/db",
        {
          pool: {
            query: async (query, params) => {
              capturedQuery = query;
              capturedParams = params;
              return {
                rows: [
                  {
                    id: 1,
                    action: "dispatch.created",
                    actorUserId: 9,
                    targetType: "dispatch_report",
                    targetId: 22,
                    companyId: 5,
                    details: { invoiceNumber: "INV-22" },
                    createdAt: "2026-04-16T10:00:00.000Z",
                    actorUsername: "EMP00012026",
                    actorFullName: "Test Manager",
                    actorEmployeeCode: "EMP0001",
                  },
                ],
              };
            },
          },
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          tableExists: async () => true,
          hasColumn: async (tableName, columnName) => {
            if (tableName === "audit_logs" && columnName === "company_id") {
              return true;
            }

            if (tableName === "audit_logs" && columnName === "details") {
              return true;
            }

            if (columnName === "company_id") {
              return true;
            }

            return false;
          },
        },
      ],
    ],
    async ({ listAuditLogs }) => {
      const result = await listAuditLogs({
        companyId: 5,
        action: "dispatch.created",
        targetType: "dispatch_report",
        search: "inv-22",
        startDate: "2026-04-01",
        endDate: "2026-04-16",
        page: 2,
        limit: 50,
      });

      assert.equal(result.items.length, 1);
      assert.equal(result.page, 2);
      assert.equal(result.limit, 50);
      assert.match(capturedQuery, /a\.company_id = \$1/);
      assert.match(capturedQuery, /a\.action = \$2/);
      assert.match(capturedQuery, /a\.target_type = \$3/);
      assert.match(capturedQuery, /a\.details::text/);
      assert.match(capturedQuery, /a\.created_at >= \$5::date/);
      assert.match(capturedQuery, /a\.created_at < \(\$6::date \+ INTERVAL '1 day'\)/);
      assert.match(capturedQuery, /COUNT\(\*\) OVER\(\)::int AS "totalCount"/);
      assert.match(capturedQuery, /OFFSET \$8/);
      assert.deepEqual(capturedParams, [
        5,
        "dispatch.created",
        "dispatch_report",
        "%inv-22%",
        "2026-04-01",
        "2026-04-16",
        50,
        50,
      ]);
    }
  );
});
