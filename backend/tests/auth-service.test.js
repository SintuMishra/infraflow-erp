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

const createMockEntries = ({
  authModel = {},
  companyProfile = { getCompanyProfile: async () => null },
  bcrypt = {
    hash: async (value) => `hashed:${value}`,
    compare: async (input, storedHash) => input === storedHash,
  },
  jwt = {
    sign: (payload) => JSON.stringify(payload),
  },
  credentials = {
    buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
    generatePasswordResetToken: () => "reset-token-123",
    generateSessionToken: () => "session-token-123",
    generateTemporaryPassword: () => "Temp!Pass123",
    hashSensitiveToken: (value) => `hashed:${value}`,
  },
  audit = {
    recordAuditEvent: async () => null,
  },
  env = {
    passwordResetTokenTtlMinutes: 15,
    accessTokenTtlMinutes: 30,
    refreshTokenTtlDays: 14,
  },
} = {}) => [
  [
    "../src/modules/auth/auth.model.js",
    {
      createAuthRefreshToken: async () => null,
      createPasswordResetToken: async () => null,
      findActiveCompanyLoginContextByCode: async () => null,
      findCompanyAccessById: async () => ({
        id: 1,
        companyCode: "TEST_COMPANY",
        companyName: "Test Company",
        isActive: true,
      }),
      findUsersByLoginIdentifier: async () => [],
      findValidAuthRefreshToken: async () => null,
      findUserForPasswordRecovery: async () => null,
      findValidPasswordResetToken: async () => null,
      findUserByEmployeeId: async () => null,
      findEmployeeById: async () => null,
      createUser: async () => null,
      markPasswordResetTokenUsed: async () => null,
      revokeActivePasswordResetTokensForUser: async () => null,
      revokeAllAuthRefreshTokensForUser: async () => null,
      revokeAuthRefreshTokenById: async () => null,
      setTemporaryPasswordByUserId: async () => null,
      updateLastLogin: async () => null,
      updatePasswordByUserId: async () => null,
      findUserById: async () => null,
      ...authModel,
    },
  ],
  [
    "../src/modules/company_profile/company_profile.service.js",
    companyProfile,
  ],
  ["bcryptjs", bcrypt],
  ["jsonwebtoken", jwt],
  ["../src/utils/loginCredentials.util", credentials],
  ["../src/utils/audit.util", audit],
  ["../src/config/env", env],
];

test("loginUser accepts legacy employee code identifier when password matches", async () => {
  let updateLastLoginUserId = null;
  let signedPayload = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findUsersByLoginIdentifier: async () => [
          {
            id: 12,
            employeeId: 44,
            employeeCode: "HR001",
            username: "HR0012026",
            passwordHash: "legacy-pass",
            role: "manager",
            isActive: true,
            mustChangePassword: false,
            fullName: "Aditi Sharma",
            department: "Admin",
            designation: "Manager",
            companyId: 3,
          },
        ],
        updateLastLogin: async (userId) => {
          updateLastLoginUserId = userId;
        },
      },
      companyProfile: {
        getCompanyProfile: async () => ({
          id: 3,
          companyName: "Sintu Infra",
          branchName: "Lucknow",
        }),
      },
      jwt: {
        sign: (payload) => {
          signedPayload = payload;
          return JSON.stringify(payload);
        },
      },
    }),
    async ({ loginUser }) => {
      const response = await loginUser({
        identifier: "HR001",
        password: "legacy-pass",
        jwtSecret: "test-secret",
        companyId: null,
      });

      assert.equal(response.user.username, "HR0012026");
      assert.equal(response.user.employeeCode, "HR001");
      assert.equal(response.user.companyId, 3);
      assert.equal(response.user.mustChangePassword, false);
      assert.equal(updateLastLoginUserId, 12);
      assert.equal(signedPayload.mustChangePassword, false);
    }
  );
});

test("loginUser rejects owner intent for non-super-admin accounts", async () => {
  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findUsersByLoginIdentifier: async () => [
          {
            id: 45,
            employeeId: 11,
            employeeCode: "MGR011",
            username: "MGR0112026",
            passwordHash: "manager-pass",
            role: "manager",
            isActive: true,
            mustChangePassword: false,
            fullName: "Manager User",
            department: "Ops",
            designation: "Manager",
            companyId: 8,
          },
        ],
      },
    }),
    async ({ loginUser }) => {
      await assert.rejects(
        () =>
          loginUser({
            identifier: "MGR011",
            password: "manager-pass",
            jwtSecret: "test-secret",
            companyId: 8,
            loginIntent: "owner",
          }),
        (error) => error.message === "OWNER_LOGIN_ONLY_SUPER_ADMIN"
      );
    }
  );
});

test("loginUser rejects client intent when selected company does not match user scope", async () => {
  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findUsersByLoginIdentifier: async () => [
          {
            id: 88,
            employeeId: 22,
            employeeCode: "HR022",
            username: "HR0222026",
            passwordHash: "hr-pass",
            role: "hr",
            isActive: true,
            mustChangePassword: false,
            fullName: "HR User",
            department: "HR",
            designation: "Executive",
            companyId: 5,
          },
        ],
      },
    }),
    async ({ loginUser }) => {
      await assert.rejects(
        () =>
          loginUser({
            identifier: "HR022",
            password: "hr-pass",
            jwtSecret: "test-secret",
            companyId: 6,
            loginIntent: "client",
            expectedCompanyId: 6,
          }),
        (error) => error.message === "CLIENT_LOGIN_COMPANY_MISMATCH"
      );
    }
  );
});

test("getCompanyLoginContext returns active company login metadata by company code", async () => {
  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findActiveCompanyLoginContextByCode: async (companyCode) => ({
          id: 14,
          companyCode: String(companyCode).toUpperCase(),
          companyName: "Acme Infra Projects",
          isActive: true,
        }),
      },
    }),
    async ({ getCompanyLoginContext }) => {
      const context = await getCompanyLoginContext({
        companyCode: "acme_infra",
      });

      assert.deepEqual(context, {
        id: 14,
        companyCode: "ACME_INFRA",
        companyName: "Acme Infra Projects",
        isActive: true,
      });
    }
  );
});

test("changePassword resolves the authenticated user by id and company scope", async () => {
  let updatedPayload = null;
  let signedPayload = null;
  let auditAction = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        updatePasswordByUserId: async (payload) => {
          updatedPayload = payload;
          return { id: payload.userId };
        },
        findUserById: async (userId, companyId) => ({
          id: userId,
          employeeId: 18,
          employeeCode: "HR018",
          username: "HR0182026",
          role: "manager",
          fullName: "Sintu Mishra",
          department: "Admin",
          designation: "Manager",
          companyId,
          passwordHash: "old-pass",
          mustChangePassword: false,
        }),
      },
      jwt: {
        sign: (payload) => {
          signedPayload = payload;
          return "signed-token";
        },
      },
      audit: {
        recordAuditEvent: async ({ action }) => {
          auditAction = action;
        },
      },
    }),
    async ({ changePassword }) => {
      const response = await changePassword({
        userId: 9,
        companyId: 4,
        currentPassword: "old-pass",
        newPassword: "new-pass",
        jwtSecret: "test-secret",
      });

      assert.deepEqual(updatedPayload, {
        userId: 9,
        passwordHash: "hashed:new-pass",
      });
      assert.equal(response.token, "signed-token");
      assert.equal(response.user.mustChangePassword, false);
      assert.equal(signedPayload.mustChangePassword, false);
      assert.equal(signedPayload.companyId, 4);
      assert.equal(auditAction, "auth.password_changed");
    }
  );
});

test("createUserAccount generates a strong temporary password and records audit", async () => {
  let createdUserPayload = null;
  let recordedAudit = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findEmployeeById: async () => ({
          id: 7,
          employeeCode: "EMP0007",
          fullName: "Test User",
          department: "Admin",
          designation: "Supervisor",
          status: "active",
          companyId: 11,
        }),
        findUserByEmployeeId: async () => null,
        createUser: async (payload) => {
          createdUserPayload = payload;
          return {
            id: 501,
            employeeId: payload.employeeId,
            username: payload.username,
            role: payload.role,
            isActive: true,
            mustChangePassword: true,
            companyId: payload.companyId,
          };
        },
      },
      credentials: {
        buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
        generatePasswordResetToken: () => "reset-token-123",
        generateTemporaryPassword: () => "Rst!92QaLm1Z",
        hashSensitiveToken: (value) => `hashed:${value}`,
      },
      audit: {
        recordAuditEvent: async (payload) => {
          recordedAudit = payload;
        },
      },
    }),
    async ({ createUserAccount }) => {
      const response = await createUserAccount({
        employeeId: 7,
        role: "manager",
        companyId: 11,
        actorUserId: 99,
        actorRole: "super_admin",
      });

      assert.equal(response.temporaryPassword, "Rst!92QaLm1Z");
      assert.equal(createdUserPayload.username, "EMP00072026");
      assert.equal(createdUserPayload.companyId, 11);
      assert.equal(recordedAudit.action, "auth.login_account_created");
      assert.equal(recordedAudit.actorUserId, 99);
    }
  );
});

test("createUserAccount rejects protected or out-of-scope role assignment", async () => {
  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries(),
    async ({ createUserAccount }) => {
      await assert.rejects(
        () =>
          createUserAccount({
            employeeId: 7,
            role: "super_admin",
            companyId: 11,
            actorUserId: 99,
            actorRole: "hr",
          }),
        /ROLE_ASSIGNMENT_NOT_ALLOWED/
      );
    }
  );
});

test("initiatePasswordReset creates a reset token and returns it when exposure is enabled", async () => {
  let revokedUserId = null;
  let savedResetToken = null;
  let recordedAudit = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findUserForPasswordRecovery: async () => ({
          id: 8,
          isActive: true,
          companyId: 4,
        }),
        revokeActivePasswordResetTokensForUser: async (userId) => {
          revokedUserId = userId;
        },
        createPasswordResetToken: async (payload) => {
          savedResetToken = payload;
        },
      },
      credentials: {
        buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
        generatePasswordResetToken: () => "plain-reset-token",
        generateTemporaryPassword: () => "Temp!Pass123",
        hashSensitiveToken: (value) => `hashed:${value}`,
      },
      audit: {
        recordAuditEvent: async (payload) => {
          recordedAudit = payload;
        },
      },
      env: {
        passwordResetTokenTtlMinutes: 20,
      },
    }),
    async ({ initiatePasswordReset }) => {
      const response = await initiatePasswordReset({
        identifier: "EMP0008",
        mobileNumber: "9999999999",
        companyId: 4,
        requestedByIp: "127.0.0.1",
        requestedByUserAgent: "test-agent",
        exposeToken: true,
      });

      assert.equal(response.resetToken, "plain-reset-token");
      assert.equal(revokedUserId, 8);
      assert.equal(savedResetToken.tokenHash, "hashed:plain-reset-token");
      assert.equal(recordedAudit.action, "auth.password_reset_requested");
    }
  );
});

test("resetForgottenPassword updates the user password and marks token as used", async () => {
  let temporaryPasswordPayload = null;
  let usedTokenId = null;
  let recordedAudit = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findValidPasswordResetToken: async () => ({
          id: 77,
          userId: 23,
          companyId: 6,
        }),
        setTemporaryPasswordByUserId: async (payload) => {
          temporaryPasswordPayload = payload;
        },
        markPasswordResetTokenUsed: async (tokenId) => {
          usedTokenId = tokenId;
        },
      },
      credentials: {
        buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
        generatePasswordResetToken: () => "plain-reset-token",
        generateTemporaryPassword: () => "Temp!Pass123",
        hashSensitiveToken: (value) => `hashed:${value}`,
      },
      audit: {
        recordAuditEvent: async (payload) => {
          recordedAudit = payload;
        },
      },
    }),
    async ({ resetForgottenPassword }) => {
      await resetForgottenPassword({
        resetToken: "plain-reset-token",
        newPassword: "BrandNew!123",
        companyId: 6,
      });

      assert.deepEqual(temporaryPasswordPayload, {
        userId: 23,
        passwordHash: "hashed:BrandNew!123",
        mustChangePassword: false,
      });
      assert.equal(usedTokenId, 77);
      assert.equal(recordedAudit.action, "auth.password_reset_completed");
    }
  );
});

test("adminResetPassword issues a temporary password and forces password change", async () => {
  let temporaryPasswordPayload = null;
  let revokedUserId = null;
  let recordedAudit = null;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findUserByEmployeeId: async () => ({
          id: 33,
          employeeId: 14,
          companyId: 5,
        }),
        setTemporaryPasswordByUserId: async (payload) => {
          temporaryPasswordPayload = payload;
        },
        revokeActivePasswordResetTokensForUser: async (userId) => {
          revokedUserId = userId;
        },
        findUserById: async () => ({
          id: 33,
          employeeId: 14,
          employeeCode: "EMP0014",
          username: "EMP00142026",
          fullName: "Reset User",
          companyId: 5,
        }),
      },
      credentials: {
        buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
        generatePasswordResetToken: () => "plain-reset-token",
        generateTemporaryPassword: () => "New!Temp778Q",
        hashSensitiveToken: (value) => `hashed:${value}`,
      },
      audit: {
        recordAuditEvent: async (payload) => {
          recordedAudit = payload;
        },
      },
    }),
    async ({ adminResetPassword }) => {
      const response = await adminResetPassword({
        employeeId: 14,
        actorUserId: 100,
        companyId: 5,
      });

      assert.deepEqual(temporaryPasswordPayload, {
        userId: 33,
        passwordHash: "hashed:New!Temp778Q",
        mustChangePassword: true,
      });
      assert.equal(revokedUserId, 33);
      assert.equal(response.temporaryPassword, "New!Temp778Q");
      assert.equal(response.mustChangePassword, true);
      assert.equal(recordedAudit.action, "auth.admin_password_reset");
    }
  );
});

test("refreshAuthSession allows only one success when same refresh token is replayed concurrently", async () => {
  let revokeAttempts = 0;

  await withMockedModules(
    "../src/modules/auth/auth.service.js",
    createMockEntries({
      authModel: {
        findValidAuthRefreshToken: async () => ({
          id: 901,
          userId: 51,
          companyId: 7,
          userIsActive: true,
        }),
        findUserById: async () => ({
          id: 51,
          employeeId: 18,
          employeeCode: "EMP0018",
          fullName: "Refresh User",
          username: "EMP00182026",
          role: "manager",
          department: "Admin",
          designation: "Manager",
          companyId: 7,
          isActive: true,
          mustChangePassword: false,
        }),
        revokeAuthRefreshTokenById: async () => {
          revokeAttempts += 1;
          return revokeAttempts === 1;
        },
        createAuthRefreshToken: async () => ({
          id: 999,
        }),
      },
      jwt: {
        sign: () => "next-access-token",
      },
      credentials: {
        buildUsernameFromEmployeeCode: (employeeCode) => `${employeeCode}2026`,
        generatePasswordResetToken: () => "reset-token-123",
        generateSessionToken: () => "next-refresh-token",
        generateTemporaryPassword: () => "Temp!Pass123",
        hashSensitiveToken: (value) => `hashed:${value}`,
      },
    }),
    async ({ refreshAuthSession }) => {
      const [first, second] = await Promise.allSettled([
        refreshAuthSession({
          refreshToken: "same-refresh-token",
          companyId: 7,
        }),
        refreshAuthSession({
          refreshToken: "same-refresh-token",
          companyId: 7,
        }),
      ]);

      const results = [first, second];
      const fulfilled = results.filter((entry) => entry.status === "fulfilled");
      const rejected = results.filter((entry) => entry.status === "rejected");

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason?.message, "INVALID_REFRESH_TOKEN");
      assert.equal(revokeAttempts, 2);
      assert.equal(fulfilled[0].value.token, "next-access-token");
      assert.equal(fulfilled[0].value.refreshToken, "next-refresh-token");
    }
  );
});
