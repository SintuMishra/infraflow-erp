const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const env = require("../src/config/env");
const authModel = require("../src/modules/auth/auth.model");
const { authenticate } = require("../src/middlewares/auth.middleware");
const {
  authorizeAnyCompanyModules,
  authorizeRoles,
  authorizeCompanyModules,
} = require("../src/middlewares/role.middleware");

authModel.findCompanyAccessById = async () => ({
  id: 1,
  isActive: true,
  enabledModules: ["operations", "commercial", "procurement", "accounts"],
});

const createResponse = () => {
  const response = {
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
  };

  return response;
};

test("authenticate rejects requests without authorization header", async () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test("authenticate accepts valid bearer token", async () => {
  const token = jwt.sign(
    { userId: 1, username: "tester", role: "manager" },
    env.jwtSecret
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.username, "tester");
  assert.equal(req.user.role, "manager");
});

test("authenticate rejects mismatched company scope header for token-bound session", async () => {
  const token = jwt.sign(
    { userId: 1, username: "tester", role: "manager", companyId: 7 },
    env.jwtSecret
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
      "x-company-id": "9",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Company scope mismatch for this session");
});

test("authenticate assigns companyId from token when company scope matches header", async () => {
  const token = jwt.sign(
    { userId: 1, username: "tester", role: "manager", companyId: 7 },
    env.jwtSecret
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
      "x-company-id": "7",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.companyId, 7);
  assert.equal(req.user.companyId, 7);
});

test("authenticate restricts temporary-password sessions to password reset endpoints", async () => {
  const token = jwt.sign(
    {
      userId: 1,
      username: "tester",
      role: "manager",
      companyId: 7,
      mustChangePassword: true,
    },
    env.jwtSecret
  );

  const req = {
    originalUrl: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`,
      "x-company-id": "7",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "PASSWORD_CHANGE_REQUIRED");
});

test("authenticate allows temporary-password sessions to reach change-password endpoint", async () => {
  const token = jwt.sign(
    {
      userId: 1,
      username: "tester",
      role: "manager",
      companyId: 7,
      mustChangePassword: true,
    },
    env.jwtSecret
  );

  const req = {
    originalUrl: "/api/auth/change-password",
    headers: {
      authorization: `Bearer ${token}`,
      "x-company-id": "7",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("authenticate blocks sessions for suspended companies", async () => {
  authModel.findCompanyAccessById = async () => ({
    id: 7,
    isActive: false,
  });

  const token = jwt.sign(
    {
      userId: 1,
      username: "tester",
      role: "manager",
      companyId: 7,
    },
    env.jwtSecret
  );

  const req = {
    originalUrl: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`,
      "x-company-id": "7",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "COMPANY_ACCESS_DISABLED");

  authModel.findCompanyAccessById = async () => ({
    id: 1,
    isActive: true,
  });
});

test("authorizeRoles rejects unauthorized role", async () => {
  const req = {
    user: {
      role: "viewer",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeRoles("manager", "super_admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test("authorizeRoles allows matching role", async () => {
  const req = {
    user: {
      role: "manager",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeRoles("manager", "super_admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("authorizeRoles treats legacy admin role as manager role", async () => {
  const req = {
    user: {
      role: "admin",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeRoles("manager", "super_admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("authorizeRoles normalizes super admin role aliases", async () => {
  for (const alias of ["super admin", "super-admin", "superadmin", "owner"]) {
    const req = {
      user: {
        role: alias,
      },
    };
    const res = createResponse();
    let nextCalled = false;

    authorizeRoles("super_admin")(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.body, null);
  }
});

test("authorizeCompanyModules blocks client access when a module is disabled", async () => {
  const req = {
    user: {
      role: "manager",
    },
    companyId: 9,
    companyAccess: {
      enabledModules: ["procurement"],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeCompanyModules("accounts")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "COMPANY_MODULE_DISABLED");
});

test("authorizeCompanyModules allows enabled client modules", async () => {
  const req = {
    user: {
      role: "manager",
    },
    companyId: 9,
    companyAccess: {
      enabledModules: ["procurement", "accounts"],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeCompanyModules("accounts")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("authorizeAnyCompanyModules allows access when one candidate module is enabled", async () => {
  const req = {
    user: {
      role: "manager",
    },
    companyId: 9,
    companyAccess: {
      enabledModules: ["procurement"],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeAnyCompanyModules("operations", "procurement")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("authorizeAnyCompanyModules blocks access when all candidate modules are disabled", async () => {
  const req = {
    user: {
      role: "manager",
    },
    companyId: 9,
    companyAccess: {
      enabledModules: ["accounts"],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  authorizeAnyCompanyModules("operations", "procurement")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "COMPANY_MODULE_DISABLED");
});
