const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
process.env.ONBOARDING_BOOTSTRAP_SECRET =
  process.env.ONBOARDING_BOOTSTRAP_SECRET || "bootstrap-secret";

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

test("bootstrapCompanyOwnerController records an audit event after successful onboarding", async () => {
  let auditPayload = null;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.controller.js",
    [
      [
        "../src/config/env",
        {
          onboardingBootstrapSecret: "bootstrap-secret",
        },
      ],
      [
        "../src/modules/onboarding/onboarding.service",
        {
          bootstrapCompanyOwner: async () => ({
            company: {
              id: 41,
              companyCode: "APEX_BUILD_INFRA",
              companyName: "Apex Build Infra",
            },
            owner: {
              employeeId: 77,
              username: "ADM00772026",
            },
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
    async ({ bootstrapCompanyOwnerController }) => {
      const req = {
        headers: {
          "x-bootstrap-secret": "bootstrap-secret",
        },
        body: {
          companyName: "Apex Build Infra",
        },
        requestId: "req_123",
      };
      const res = createResponse();

      await bootstrapCompanyOwnerController(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(auditPayload.action, "onboarding.company_owner_bootstrapped");
      assert.equal(auditPayload.targetId, 41);
      assert.equal(auditPayload.companyId, 41);
      assert.equal(auditPayload.details.companyCode, "APEX_BUILD_INFRA");
      assert.equal(auditPayload.details.companyName, "Apex Build Infra");
      assert.equal(auditPayload.details.ownerEmployeeId, 77);
      assert.equal(auditPayload.details.requestId, "req_123");
    }
  );
});

test("bootstrapCompanyOwnerController audits rejected bootstrap secrets without leaking the secret", async () => {
  const auditPayloads = [];

  await withMockedModules(
    "../src/modules/onboarding/onboarding.controller.js",
    [
      [
        "../src/config/env",
        {
          onboardingBootstrapSecret: "bootstrap-secret",
        },
      ],
      [
        "../src/modules/onboarding/onboarding.service",
        {
          bootstrapCompanyOwner: async () => {
            throw new Error("bootstrap should not be called");
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async (payload) => {
            auditPayloads.push(payload);
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
    async ({ bootstrapCompanyOwnerController }) => {
      const req = {
        headers: {
          "x-bootstrap-secret": "wrong-secret",
        },
        body: {
          companyName: "Apex Build Infra",
          ownerFullName: "Amit Sharma",
        },
        requestId: "req_secret_rejected",
      };
      const res = createResponse();

      await bootstrapCompanyOwnerController(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(auditPayloads.length, 1);
      assert.equal(
        auditPayloads[0].action,
        "onboarding.bootstrap_secret_rejected"
      );
      assert.equal(auditPayloads[0].details.companyName, "Apex Build Infra");
      assert.equal(auditPayloads[0].details.ownerFullName, "Amit Sharma");
      assert.equal(
        Object.prototype.hasOwnProperty.call(auditPayloads[0].details, "providedSecret"),
        false
      );
    }
  );
});

test("bootstrapCompanyOwnerController audits duplicate-company failures", async () => {
  const auditPayloads = [];

  await withMockedModules(
    "../src/modules/onboarding/onboarding.controller.js",
    [
      [
        "../src/config/env",
        {
          onboardingBootstrapSecret: "bootstrap-secret",
        },
      ],
      [
        "../src/modules/onboarding/onboarding.service",
        {
          bootstrapCompanyOwner: async () => {
            throw new Error("COMPANY_ALREADY_EXISTS");
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async (payload) => {
            auditPayloads.push(payload);
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
    async ({ bootstrapCompanyOwnerController }) => {
      const req = {
        headers: {
          "x-bootstrap-secret": "bootstrap-secret",
        },
        body: {
          companyName: "Apex Build Infra",
          ownerFullName: "Amit Sharma",
        },
        requestId: "req_duplicate_company",
      };
      const res = createResponse();

      await bootstrapCompanyOwnerController(req, res);

      assert.equal(res.statusCode, 409);
      assert.equal(auditPayloads.length, 1);
      assert.equal(
        auditPayloads[0].action,
        "onboarding.bootstrap_failed_duplicate_company"
      );
      assert.equal(auditPayloads[0].details.companyName, "Apex Build Infra");
      assert.equal(auditPayloads[0].details.requestId, "req_duplicate_company");
    }
  );
});

test("bootstrapCompanyOwnerController blocks tenant bootstrap for non-platform-owner company scope", async () => {
  const auditPayloads = [];

  await withMockedModules(
    "../src/modules/onboarding/onboarding.controller.js",
    [
      [
        "../src/config/env",
        {
          onboardingBootstrapSecret: "bootstrap-secret",
          platformOwnerCompanyId: 1,
        },
      ],
      [
        "../src/modules/onboarding/onboarding.service",
        {
          bootstrapCompanyOwner: async () => {
            throw new Error("bootstrap should not be called");
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async (payload) => {
            auditPayloads.push(payload);
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
    async ({ bootstrapCompanyOwnerController }) => {
      const req = {
        headers: {
          "x-bootstrap-secret": "bootstrap-secret",
        },
        user: {
          companyId: 9,
        },
        companyId: 9,
        body: {
          companyName: "Apex Build Infra",
          ownerFullName: "Amit Sharma",
          ownerDesignation: "Managing Director",
        },
        requestId: "req_forbidden_scope",
      };
      const res = createResponse();

      await bootstrapCompanyOwnerController(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(auditPayloads.length, 1);
      assert.equal(
        auditPayloads[0].action,
        "onboarding.bootstrap_forbidden_company_scope"
      );
      assert.equal(auditPayloads[0].details.actorCompanyId, 9);
      assert.equal(auditPayloads[0].details.platformOwnerCompanyId, 1);
    }
  );
});

test("listManagedCompaniesController forwards server-side filter params", async () => {
  let capturedArgs = null;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.controller.js",
    [
      [
        "../src/config/env",
        {
          onboardingBootstrapSecret: "bootstrap-secret",
          platformOwnerCompanyId: 1,
        },
      ],
      [
        "../src/modules/onboarding/onboarding.service",
        {
          bootstrapCompanyOwner: async () => {
            throw new Error("bootstrap should not be called");
          },
          listManagedCompanies: async (args) => {
            capturedArgs = args;
            return [];
          },
        },
      ],
      [
        "../src/utils/audit.util",
        {
          recordAuditEvent: async () => {},
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
    async ({ listManagedCompaniesController }) => {
      const req = {
        user: {
          companyId: 1,
        },
        companyId: 1,
        query: {
          search: "acme",
          includeInactive: "true",
          status: "suspended",
          billingStatus: "overdue",
        },
      };
      const res = createResponse();

      await listManagedCompaniesController(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(capturedArgs, {
        search: "acme",
        includeInactive: true,
        status: "suspended",
        billingStatus: "overdue",
      });
      assert.deepEqual(res.body?.data, []);
    }
  );
});
