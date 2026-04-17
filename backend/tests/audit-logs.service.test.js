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

test("getAuditLogs trims filter inputs before querying model", async () => {
  let capturedPayload = null;

  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.service.js",
    [
      [
        "../src/modules/audit_logs/audit_logs.model.js",
        {
          listAuditLogs: async (payload) => {
            capturedPayload = payload;
            return {
              items: [],
              total: 0,
              page: 1,
              limit: 25,
              summary: {},
              facets: {},
            };
          },
        },
      ],
    ],
    async ({ getAuditLogs }) => {
      await getAuditLogs({
        companyId: 9,
        action: "  dispatch.created  ",
        targetType: "  dispatch_report ",
        search: "  inv-22  ",
        startDate: " 2026-04-01 ",
        endDate: " 2026-04-16 ",
        page: "2",
        limit: "25",
      });

      assert.equal(capturedPayload.action, "dispatch.created");
      assert.equal(capturedPayload.targetType, "dispatch_report");
      assert.equal(capturedPayload.search, "inv-22");
      assert.equal(capturedPayload.startDate, "2026-04-01");
      assert.equal(capturedPayload.endDate, "2026-04-16");
      assert.equal(capturedPayload.companyId, 9);
    }
  );
});

test("getAuditLogs rejects invalid page values", async () => {
  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.service.js",
    [
      [
        "../src/modules/audit_logs/audit_logs.model.js",
        {
          listAuditLogs: async () => ({
            items: [],
            total: 0,
            page: 1,
            limit: 25,
            summary: {},
            facets: {},
          }),
        },
      ],
    ],
    async ({ getAuditLogs }) => {
      await assert.rejects(
        () => getAuditLogs({ page: "abc", limit: 25 }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /page must be a positive integer/i);
          return true;
        }
      );
    }
  );
});

test("getAuditLogs rejects limits above allowed maximum", async () => {
  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.service.js",
    [
      [
        "../src/modules/audit_logs/audit_logs.model.js",
        {
          listAuditLogs: async () => ({
            items: [],
            total: 0,
            page: 1,
            limit: 25,
            summary: {},
            facets: {},
          }),
        },
      ],
    ],
    async ({ getAuditLogs }) => {
      await assert.rejects(
        () => getAuditLogs({ page: 1, limit: 250 }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /limit cannot exceed 200/i);
          return true;
        }
      );
    }
  );
});

test("getAuditLogs rejects oversized search filter", async () => {
  await withMockedModules(
    "../src/modules/audit_logs/audit_logs.service.js",
    [
      [
        "../src/modules/audit_logs/audit_logs.model.js",
        {
          listAuditLogs: async () => ({
            items: [],
            total: 0,
            page: 1,
            limit: 25,
            summary: {},
            facets: {},
          }),
        },
      ],
    ],
    async ({ getAuditLogs }) => {
      await assert.rejects(
        () => getAuditLogs({ search: "x".repeat(201) }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /search filter cannot exceed 200 characters/i);
          return true;
        }
      );
    }
  );
});
