const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedModules = async (serviceRelativePath, mockEntries, run) => {
  const servicePath = require.resolve(serviceRelativePath);
  const originalService = require.cache[servicePath];
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

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originalService) {
      require.cache[servicePath] = originalService;
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

test("buildCompanyCodeBase normalizes company names for onboarding", async () => {
  const { buildCompanyCodeBase } = require("../src/modules/onboarding/onboarding.service");
  assert.equal(buildCompanyCodeBase("Apex Build Infra Pvt. Ltd."), "APEX_BUILD_INFRA_PVT_LTD");
});

test("bootstrapCompanyOwner creates company, profile, owner employee, and super admin login", async () => {
  const capturedQueries = [];
  let employeePayload = null;
  let userPayload = null;
  let profilePayload = null;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query, params) => {
                capturedQueries.push({ query, params });

                if (/FROM companies\s+WHERE LOWER\(company_name\)/i.test(query)) {
                  return { rows: [] };
                }

                if (/SELECT id FROM companies/i.test(query)) {
                  return { rows: [] };
                }

                if (/INSERT INTO companies/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 41,
                        companyCode: "APEX_BUILD_INFRA",
                        companyName: "Apex Build Infra",
                        isActive: true,
                      },
                    ],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          hasColumn: async (tableName, columnName) =>
            (tableName === "employees" || tableName === "users") &&
            columnName === "company_id",
          tableExists: async (tableName) => tableName === "companies",
        },
      ],
      [
        "../src/modules/employees/employees.service",
        {
          createEmployeeRecord: async (payload) => {
            employeePayload = payload;
            return {
              id: 77,
              employeeCode: "ADM0077",
              fullName: payload.fullName,
            };
          },
        },
      ],
      [
        "../src/modules/auth/auth.model",
        {
          createUser: async (payload) => {
            userPayload = payload;
            return {
              username: payload.username,
              role: payload.role,
              mustChangePassword: true,
            };
          },
        },
      ],
      [
        "../src/modules/company_profile/company_profile.service",
        {
          saveCompanyProfile: async (payload, companyId) => {
            profilePayload = { payload, companyId };
            return {
              id: 12,
              companyName: payload.companyName,
            };
          },
        },
      ],
      [
        "../src/utils/loginCredentials.util",
        {
          buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
          generateTemporaryPassword: () => "Temp!Pass123",
        },
      ],
      [
        "bcryptjs",
        {
          hash: async (value) => `hashed:${value}`,
        },
      ],
    ],
    async ({ bootstrapCompanyOwner }) => {
      const response = await bootstrapCompanyOwner({
        companyName: "Apex Build Infra",
        branchName: "Head Office",
        ownerFullName: "Amit Sharma",
        ownerDesignation: "Managing Director",
        ownerMobileNumber: "9999999999",
      });

      assert.equal(response.company.id, 41);
      assert.equal(employeePayload.companyId, 41);
      assert.equal(userPayload.role, "super_admin");
      assert.equal(userPayload.companyId, 41);
      assert.equal(profilePayload.companyId, 41);
      assert.equal(response.owner.temporaryPassword, "Temp!Pass123");
      assert.ok(
        capturedQueries.some((entry) => /INSERT INTO companies/i.test(entry.query))
      );
    }
  );
});

test("bootstrapCompanyOwner stores selected enabledModules when company entitlements are configured", async () => {
  let insertedModules = null;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query, params) => {
                if (/FROM companies\s+WHERE LOWER\(BTRIM\(company_name\)\)/i.test(query)) {
                  return { rows: [] };
                }

                if (/SELECT id FROM companies/i.test(query)) {
                  return { rows: [] };
                }

                if (/INSERT INTO companies/i.test(query)) {
                  insertedModules = params[2] || null;
                  return {
                    rows: [
                      {
                        id: 55,
                        companyCode: "NEXA_PROCURE",
                        companyName: "Nexa Procure",
                        isActive: true,
                        enabledModules: ["procurement", "accounts"],
                      },
                    ],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          hasColumn: async (tableName, columnName) =>
            (tableName === "employees" || tableName === "users") &&
              columnName === "company_id"
              ? true
              : tableName === "companies" && columnName === "enabled_modules",
          tableExists: async (tableName) => tableName === "companies",
        },
      ],
      [
        "../src/modules/employees/employees.service",
        {
          createEmployeeRecord: async (payload) => ({
            id: 77,
            employeeCode: "ADM0077",
            fullName: payload.fullName,
          }),
        },
      ],
      [
        "../src/modules/auth/auth.model",
        {
          createUser: async (payload) => ({
            username: payload.username,
            role: payload.role,
            mustChangePassword: true,
          }),
        },
      ],
      [
        "../src/modules/company_profile/company_profile.service",
        {
          saveCompanyProfile: async (payload) => ({
            id: 12,
            companyName: payload.companyName,
          }),
        },
      ],
      [
        "../src/utils/loginCredentials.util",
        {
          buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
          generateTemporaryPassword: () => "Temp!Pass123",
        },
      ],
      [
        "bcryptjs",
        {
          hash: async (value) => `hashed:${value}`,
        },
      ],
    ],
    async ({ bootstrapCompanyOwner }) => {
      const response = await bootstrapCompanyOwner({
        companyName: "Nexa Procure",
        ownerFullName: "Riya Mehta",
        ownerDesignation: "Director",
        enabledModules: ["procurement", "accounts"],
      });

      assert.equal(insertedModules, JSON.stringify(["procurement", "accounts"]));
      assert.deepEqual(response.company.enabledModules, ["procurement", "accounts"]);
    }
  );
});

test("bootstrapCompanyOwner rejects duplicate company names before creating owner records", async () => {
  let employeeCreated = false;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query) => {
                if (/FROM companies\s+WHERE LOWER\(BTRIM\(company_name\)\)/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 7,
                        companyCode: "APEX_BUILD_INFRA",
                        companyName: "Apex Build Infra",
                        isActive: true,
                      },
                    ],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          hasColumn: async (tableName, columnName) =>
            (tableName === "employees" || tableName === "users") &&
            columnName === "company_id",
          tableExists: async (tableName) => tableName === "companies",
        },
      ],
      [
        "../src/modules/employees/employees.service",
        {
          createEmployeeRecord: async () => {
            employeeCreated = true;
            return null;
          },
        },
      ],
      [
        "../src/modules/auth/auth.model",
        {
          createUser: async () => null,
        },
      ],
      [
        "../src/modules/company_profile/company_profile.service",
        {
          saveCompanyProfile: async () => null,
        },
      ],
      [
        "../src/utils/loginCredentials.util",
        {
          buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
          generateTemporaryPassword: () => "Temp!Pass123",
        },
      ],
      [
        "bcryptjs",
        {
          hash: async (value) => `hashed:${value}`,
        },
      ],
      [
        "../src/utils/date.util",
        {
          formatDateOnly: (value) => value,
        },
      ],
    ],
    async ({ bootstrapCompanyOwner }) => {
      await assert.rejects(
        bootstrapCompanyOwner({
          companyName: "Apex Build Infra",
          ownerFullName: "Amit Sharma",
          ownerDesignation: "Managing Director",
        }),
        /COMPANY_ALREADY_EXISTS/
      );

      assert.equal(employeeCreated, false);
    }
  );
});

test("bootstrapCompanyOwner maps database duplicate-name conflicts to COMPANY_ALREADY_EXISTS", async () => {
  let insertAttempts = 0;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query) => {
                if (/FROM companies\s+WHERE LOWER\(BTRIM\(company_name\)\)/i.test(query)) {
                  return { rows: [] };
                }

                if (/SELECT id FROM companies/i.test(query)) {
                  return { rows: [] };
                }

                if (/INSERT INTO companies/i.test(query)) {
                  insertAttempts += 1;
                  const error = new Error("duplicate company name");
                  error.code = "23505";
                  error.constraint = "uq_companies_company_name_normalized";
                  throw error;
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          hasColumn: async (tableName, columnName) =>
            (tableName === "employees" || tableName === "users") &&
            columnName === "company_id",
          tableExists: async (tableName) => tableName === "companies",
        },
      ],
      [
        "../src/modules/employees/employees.service",
        {
          createEmployeeRecord: async () => {
            throw new Error("employee should not be created");
          },
        },
      ],
      [
        "../src/modules/auth/auth.model",
        {
          createUser: async () => null,
        },
      ],
      [
        "../src/modules/company_profile/company_profile.service",
        {
          saveCompanyProfile: async () => null,
        },
      ],
      [
        "../src/utils/loginCredentials.util",
        {
          buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
          generateTemporaryPassword: () => "Temp!Pass123",
        },
      ],
      [
        "bcryptjs",
        {
          hash: async (value) => `hashed:${value}`,
        },
      ],
      [
        "../src/utils/date.util",
        {
          formatDateOnly: (value) => value,
        },
      ],
    ],
    async ({ bootstrapCompanyOwner }) => {
      await assert.rejects(
        bootstrapCompanyOwner({
          companyName: "Apex Build Infra",
          ownerFullName: "Amit Sharma",
          ownerDesignation: "Managing Director",
        }),
        /COMPANY_ALREADY_EXISTS/
      );

      assert.equal(insertAttempts, 1);
    }
  );
});

test("bootstrapCompanyOwner retries when company_code collides during insert", async () => {
  let insertAttempts = 0;
  let companyCodeLookups = 0;

  await withMockedModules(
    "../src/modules/onboarding/onboarding.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query, params) => {
                if (/FROM companies\s+WHERE LOWER\(BTRIM\(company_name\)\)/i.test(query)) {
                  return { rows: [] };
                }

                if (/SELECT id FROM companies/i.test(query)) {
                  companyCodeLookups += 1;
                  return {
                    rows:
                      companyCodeLookups === 1
                        ? []
                        : params[0] === "APEX_BUILD_INFRA_01"
                        ? []
                        : [{ id: 99 }],
                  };
                }

                if (/INSERT INTO companies/i.test(query)) {
                  insertAttempts += 1;

                  if (insertAttempts === 1) {
                    const error = new Error("duplicate company code");
                    error.code = "23505";
                    error.constraint = "companies_company_code_key";
                    throw error;
                  }

                  return {
                    rows: [
                      {
                        id: 41,
                        companyCode: params[0],
                        companyName: params[1],
                        isActive: true,
                      },
                    ],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/utils/companyScope.util",
        {
          hasColumn: async (tableName, columnName) =>
            (tableName === "employees" || tableName === "users") &&
            columnName === "company_id",
          tableExists: async (tableName) => tableName === "companies",
        },
      ],
      [
        "../src/modules/employees/employees.service",
        {
          createEmployeeRecord: async (payload) => ({
            id: 77,
            employeeCode: "ADM0077",
            fullName: payload.fullName,
          }),
        },
      ],
      [
        "../src/modules/auth/auth.model",
        {
          createUser: async (payload) => ({
            username: payload.username,
            role: payload.role,
            mustChangePassword: true,
          }),
        },
      ],
      [
        "../src/modules/company_profile/company_profile.service",
        {
          saveCompanyProfile: async (payload) => ({
            id: 12,
            companyName: payload.companyName,
          }),
        },
      ],
      [
        "../src/utils/loginCredentials.util",
        {
          buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
          generateTemporaryPassword: () => "Temp!Pass123",
        },
      ],
      [
        "bcryptjs",
        {
          hash: async (value) => `hashed:${value}`,
        },
      ],
      [
        "../src/utils/date.util",
        {
          formatDateOnly: (value) => value,
        },
      ],
    ],
    async ({ bootstrapCompanyOwner }) => {
      const result = await bootstrapCompanyOwner({
        companyName: "Apex Build Infra",
        ownerFullName: "Amit Sharma",
        ownerDesignation: "Managing Director",
      });

      assert.equal(insertAttempts, 2);
      assert.equal(result.company.companyCode, "APEX_BUILD_INFRA_01");
    }
  );
});
