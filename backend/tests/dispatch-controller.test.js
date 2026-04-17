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

test("getAllDispatchReports returns filtered report metadata from the service", async () => {
  let capturedFilters = null;

  await withMockedModules(
    "../src/modules/dispatch/dispatch.controller.js",
    [
      [
        "../src/modules/dispatch/dispatch.service",
        {
          getDispatchReports: async (filters) => {
            capturedFilters = filters;
            return {
              items: [
                {
                  id: 1,
                  dispatchDate: "2026-04-17",
                  invoiceNumber: "INV-5001",
                },
              ],
              summary: {
                totalDispatches: 1,
                totalQuantity: 18,
                totalInvoiceValue: 24500,
                pending: 0,
                completed: 1,
                cancelled: 0,
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
          getDispatchReportById: async () => {
            throw new Error("getDispatchReportById should not be called");
          },
          createDispatchReport: async () => {
            throw new Error("createDispatchReport should not be called");
          },
          editDispatchReport: async () => {
            throw new Error("editDispatchReport should not be called");
          },
          updateDispatchStatus: async () => {
            throw new Error("updateDispatchStatus should not be called");
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
    async ({ getAllDispatchReports }) => {
      const req = {
        companyId: 14,
        query: {
          search: "invoice",
          plantId: "9",
          partyId: "12",
          materialId: "5",
          linkedOrderFilter: "linked",
          sourceType: "Plant",
          status: "completed",
          dateFrom: "2026-04-10",
          dateTo: "2026-04-17",
          page: "2",
          limit: "25",
        },
      };
      const res = createResponse();

      await getAllDispatchReports(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(capturedFilters, {
        companyId: 14,
        search: "invoice",
        plantId: 9,
        partyId: 12,
        materialId: 5,
        linkedOrderFilter: "linked",
        sourceType: "Plant",
        status: "completed",
        dateFrom: "2026-04-10",
        dateTo: "2026-04-17",
        page: 2,
        limit: 25,
      });
      assert.equal(res.body.meta.summary.totalDispatches, 1);
      assert.equal(res.body.meta.filters.search, "invoice");
      assert.equal(res.body.meta.pagination.page, 2);
    }
  );
});

test("getAllDispatchReports rejects invalid filter dates with a 400 response", async () => {
  await withMockedModules(
    "../src/modules/dispatch/dispatch.controller.js",
    [
      [
        "../src/modules/dispatch/dispatch.service",
        {
          getDispatchReports: async () => {
            throw new Error("getDispatchReports should not be called");
          },
          getDispatchReportById: async () => {
            throw new Error("getDispatchReportById should not be called");
          },
          createDispatchReport: async () => {
            throw new Error("createDispatchReport should not be called");
          },
          editDispatchReport: async () => {
            throw new Error("editDispatchReport should not be called");
          },
          updateDispatchStatus: async () => {
            throw new Error("updateDispatchStatus should not be called");
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
    async ({ getAllDispatchReports }) => {
      const req = {
        companyId: 14,
        query: {
          dateFrom: "17-04-2026",
        },
      };
      const res = createResponse();

      await getAllDispatchReports(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /YYYY-MM-DD/);
    }
  );
});
