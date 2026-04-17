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

test("getAllProjectReports returns filtered report metadata from the service", async () => {
  let capturedFilters = null;

  await withMockedModules(
    "../src/modules/projects/projects.controller.js",
    [
      [
        "../src/modules/projects/projects.service",
        {
          getProjectReports: async (filters) => {
            capturedFilters = filters;
            return {
              items: [
                {
                  id: 1,
                  reportDate: "2026-04-17",
                  projectName: "Riverfront Bridge",
                },
              ],
              summary: {
                total: 1,
                totalLabour: 24,
                topProjectName: "Riverfront Bridge",
              },
              lookups: {
                projectNames: ["Riverfront Bridge"],
                siteNames: ["Pier Zone 2"],
                reportStatuses: ["on_track"],
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
          createProjectReport: async () => {
            throw new Error("createProjectReport should not be called");
          },
          editProjectReport: async () => {
            throw new Error("editProjectReport should not be called");
          },
          removeProjectReport: async () => {
            throw new Error("removeProjectReport should not be called");
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
    async ({ getAllProjectReports }) => {
      const req = {
        companyId: 14,
        query: {
          search: "bridge",
          plantId: "9",
          projectName: "Riverfront Bridge",
          siteName: "Pier Zone 2",
          reportStatus: "on_track",
          startDate: "2026-04-10",
          endDate: "2026-04-17",
          page: "2",
          limit: "25",
        },
      };
      const res = createResponse();

      await getAllProjectReports(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(capturedFilters, {
        companyId: 14,
        search: "bridge",
        plantId: 9,
        projectName: "Riverfront Bridge",
        siteName: "Pier Zone 2",
        reportStatus: "on_track",
        startDate: "2026-04-10",
        endDate: "2026-04-17",
        page: 2,
        limit: 25,
      });
      assert.equal(res.body.meta.summary.total, 1);
      assert.deepEqual(res.body.meta.lookups.projectNames, ["Riverfront Bridge"]);
      assert.equal(res.body.meta.filters.search, "bridge");
      assert.equal(res.body.meta.filters.page, 2);
      assert.equal(res.body.meta.pagination.page, 2);
    }
  );
});

test("getAllProjectReports rejects invalid filter dates with a 400 response", async () => {
  await withMockedModules(
    "../src/modules/projects/projects.controller.js",
    [
      [
        "../src/modules/projects/projects.service",
        {
          getProjectReports: async () => {
            throw new Error("getProjectReports should not be called");
          },
          createProjectReport: async () => {
            throw new Error("createProjectReport should not be called");
          },
          editProjectReport: async () => {
            throw new Error("editProjectReport should not be called");
          },
          removeProjectReport: async () => {
            throw new Error("removeProjectReport should not be called");
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
    async ({ getAllProjectReports }) => {
      const req = {
        companyId: 14,
        query: {
          startDate: "17-04-2026",
        },
      };
      const res = createResponse();

      await getAllProjectReports(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /YYYY-MM-DD/);
    }
  );
});

test("updateProjectDailyReport returns 404 when the target report is missing", async () => {
  await withMockedModules(
    "../src/modules/projects/projects.controller.js",
    [
      [
        "../src/modules/projects/projects.service",
        {
          getProjectReports: async () => {
            throw new Error("getProjectReports should not be called");
          },
          createProjectReport: async () => {
            throw new Error("createProjectReport should not be called");
          },
          editProjectReport: async () => null,
          removeProjectReport: async () => {
            throw new Error("removeProjectReport should not be called");
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
    async ({ updateProjectDailyReport }) => {
      const req = {
        params: { id: "17" },
        body: {},
        user: { userId: 3 },
        companyId: 14,
      };
      const res = createResponse();

      await updateProjectDailyReport(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.success, false);
    }
  );
});

test("deleteProjectDailyReport records an audit event after deleting a report", async () => {
  let auditPayload = null;

  await withMockedModules(
    "../src/modules/projects/projects.controller.js",
    [
      [
        "../src/modules/projects/projects.service",
        {
          getProjectReports: async () => {
            throw new Error("getProjectReports should not be called");
          },
          createProjectReport: async () => {
            throw new Error("createProjectReport should not be called");
          },
          editProjectReport: async () => {
            throw new Error("editProjectReport should not be called");
          },
          removeProjectReport: async () => ({
            id: 44,
            projectName: "Riverfront Bridge",
            siteName: "Pier Zone 2",
            reportDate: "2026-04-17",
            reportStatus: "blocked",
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
    async ({ deleteProjectDailyReport }) => {
      const req = {
        params: { id: "44" },
        user: { userId: 9 },
        companyId: 14,
      };
      const res = createResponse();

      await deleteProjectDailyReport(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(auditPayload.action, "project_report.deleted");
      assert.equal(auditPayload.targetId, 44);
      assert.equal(auditPayload.actorUserId, 9);
      assert.equal(auditPayload.details.reportStatus, "blocked");
    }
  );
});
