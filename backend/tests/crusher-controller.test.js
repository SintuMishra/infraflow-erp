const test = require("node:test");
const assert = require("node:assert/strict");

const withMockedModules = async (controllerRelativePath, mockEntries, run) => {
  const controllerPath = require.resolve(controllerRelativePath);
  const originalController = require.cache[controllerPath];
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

  delete require.cache[controllerPath];

  try {
    const controller = require(controllerPath);
    await run(controller);
  } finally {
    delete require.cache[controllerPath];

    if (originalController) {
      require.cache[controllerPath] = originalController;
    }

    for (const [dependencyPath, originalModule] of originals.entries()) {
      if (originalModule) {
        require.cache[dependencyPath] = originalModule;
      } else {
        delete require.cache[dependencyPath];
      }
    }
  }
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("getAllCrusherReports returns filtered report metadata from the service", async () => {
  let capturedFilters = null;

  await withMockedModules(
    "../src/modules/crusher/crusher.controller.js",
    [
      [
        "../src/modules/crusher/crusher.service",
        {
          getCrusherReports: async (filters) => {
            capturedFilters = filters;
            return {
              items: [
                {
                  id: 5,
                  reportDate: "2026-04-17",
                  crusherUnitName: "Primary Crusher 1",
                },
              ],
              summary: {
                total: 1,
                totalProduction: 240,
                topUnitName: "Primary Crusher 1",
              },
              lookups: {
                shifts: ["Morning"],
                crusherUnits: ["Primary Crusher 1"],
                materialTypes: ["40mm"],
                operationalStatuses: ["running"],
              },
              pagination: {
                total: 1,
                page: 2,
                limit: 25,
                totalPages: 1,
                hasPreviousPage: true,
                hasNextPage: false,
              },
            };
          },
          createCrusherReport: async () => {
            throw new Error("createCrusherReport should not be called");
          },
          editCrusherReport: async () => {
            throw new Error("editCrusherReport should not be called");
          },
          removeCrusherReport: async () => {
            throw new Error("removeCrusherReport should not be called");
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async () => {
            throw new Error("recordAuditEvent should not be called");
          },
        },
      ],
      [
        "../src/utils/http.util",
        {
          sendControllerError: () => {
            throw new Error("sendControllerError should not be called");
          },
        },
      ],
    ],
    async ({ getAllCrusherReports }) => {
      const req = {
        companyId: 11,
        query: {
          search: "primary",
          plantId: "4",
          shift: "Morning",
          crusherUnitName: "Primary Crusher 1",
          materialType: "40mm",
          operationalStatus: "running",
          startDate: "2026-04-10",
          endDate: "2026-04-17",
          page: "2",
          limit: "25",
        },
      };
      const res = createResponse();

      await getAllCrusherReports(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(capturedFilters, {
        companyId: 11,
        search: "primary",
        plantId: 4,
        shift: "Morning",
        crusherUnitName: "Primary Crusher 1",
        materialType: "40mm",
        operationalStatus: "running",
        startDate: "2026-04-10",
        endDate: "2026-04-17",
        page: 2,
        limit: 25,
      });
      assert.equal(res.body.meta.summary.totalProduction, 240);
      assert.deepEqual(res.body.meta.lookups.crusherUnits, ["Primary Crusher 1"]);
      assert.equal(res.body.meta.filters.search, "primary");
      assert.equal(res.body.meta.pagination.page, 2);
    }
  );
});

test("getAllCrusherReports rejects invalid filter dates with a 400 response", async () => {
  await withMockedModules(
    "../src/modules/crusher/crusher.controller.js",
    [
      [
        "../src/modules/crusher/crusher.service",
        {
          getCrusherReports: async () => {
            throw new Error("getCrusherReports should not be called");
          },
          createCrusherReport: async () => {
            throw new Error("createCrusherReport should not be called");
          },
          editCrusherReport: async () => {
            throw new Error("editCrusherReport should not be called");
          },
          removeCrusherReport: async () => {
            throw new Error("removeCrusherReport should not be called");
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async () => {
            throw new Error("recordAuditEvent should not be called");
          },
        },
      ],
      [
        "../src/utils/http.util",
        {
          sendControllerError: () => {
            throw new Error("sendControllerError should not be called");
          },
        },
      ],
    ],
    async ({ getAllCrusherReports }) => {
      const req = {
        companyId: 11,
        query: {
          startDate: "17-04-2026",
        },
      };
      const res = createResponse();

      await getAllCrusherReports(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /YYYY-MM-DD/);
    }
  );
});

test("deleteCrusherDailyReport records an audit event after successful deletion", async () => {
  let auditPayload = null;

  await withMockedModules(
    "../src/modules/crusher/crusher.controller.js",
    [
      [
        "../src/modules/crusher/crusher.service",
        {
          getCrusherReports: async () => {
            throw new Error("getCrusherReports should not be called");
          },
          createCrusherReport: async () => {
            throw new Error("createCrusherReport should not be called");
          },
          editCrusherReport: async () => {
            throw new Error("editCrusherReport should not be called");
          },
          removeCrusherReport: async () => ({
            id: 18,
            crusherUnitName: "Secondary Crusher",
            materialType: "Dust",
            reportDate: "2026-04-17",
            operationalStatus: "maintenance",
          }),
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async (payload) => {
            auditPayload = payload;
          },
        },
      ],
      [
        "../src/utils/http.util",
        {
          sendControllerError: () => {
            throw new Error("sendControllerError should not be called");
          },
        },
      ],
    ],
    async ({ deleteCrusherDailyReport }) => {
      const req = {
        params: { id: "18" },
        user: { userId: 7 },
        companyId: 11,
      };
      const res = createResponse();

      await deleteCrusherDailyReport(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(auditPayload.action, "crusher_report.deleted");
      assert.equal(auditPayload.targetId, 18);
      assert.equal(auditPayload.companyId, 11);
      assert.equal(auditPayload.details.crusherUnitName, "Secondary Crusher");
      assert.equal(auditPayload.details.operationalStatus, "maintenance");
    }
  );
});
