const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const router = require("../src/modules/masters/masters.routes");

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

const getRouteLayer = (method, path) => {
  const normalizedMethod = String(method || "").toLowerCase();

  const layer = router.stack.find(
    (item) =>
      item.route &&
      item.route.path === path &&
      Boolean(item.route.methods?.[normalizedMethod])
  );

  assert.ok(layer, `Expected route ${normalizedMethod.toUpperCase()} ${path} to exist`);
  return layer;
};

const evaluateRoleGuard = ({ method, path, role }) => {
  const layer = getRouteLayer(method, path);
  const authzGuard = layer.route.stack[1]?.handle;
  assert.equal(typeof authzGuard, "function");

  const req = {
    user: role ? { role } : null,
  };
  const res = createResponse();
  let nextCalled = false;

  authzGuard(req, res, () => {
    nextCalled = true;
  });

  return {
    nextCalled,
    statusCode: res.statusCode,
  };
};

test("masters routes keep authenticate -> authorizeRoles -> controller middleware sequence", () => {
  for (const layer of router.stack) {
    if (!layer.route) {
      continue;
    }

    assert.equal(layer.route.stack.length, 3);
    assert.equal(layer.route.stack[0]?.name, "authenticate");
    assert.equal(layer.route.stack[1]?.name, "<anonymous>");
  }
});

test("masters read routes allow admin and read-only operational roles", () => {
  const readRoutes = router.stack
    .filter((layer) => layer.route && Object.keys(layer.route.methods || {})[0] === "get")
    .map((layer) => ({
      method: "get",
      path: layer.route.path,
    }));
  const allowedRoles = [
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer",
  ];
  const deniedRoles = ["viewer", "operator", "accountant"];

  for (const route of readRoutes) {
    for (const role of allowedRoles) {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(
        outcome.nextCalled,
        true,
        `Expected ${role} to access ${route.method.toUpperCase()} ${route.path}`
      );
    }

    for (const role of deniedRoles) {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(
        outcome.statusCode,
        403,
        `Expected ${role} to be denied on ${route.method.toUpperCase()} ${route.path}`
      );
    }
  }
});

test("masters write routes are restricted to super_admin, manager, and hr", () => {
  const writeRoutes = router.stack
    .filter((layer) => {
      if (!layer.route) {
        return false;
      }

      const method = Object.keys(layer.route.methods || {})[0];
      return method !== "get";
    })
    .map((layer) => ({
      method: Object.keys(layer.route.methods || {})[0],
      path: layer.route.path,
    }));

  const allowedRoles = ["super_admin", "manager", "hr"];
  const deniedRoles = ["crusher_supervisor", "site_engineer", "viewer"];

  for (const route of writeRoutes) {
    for (const role of allowedRoles) {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(
        outcome.nextCalled,
        true,
        `Expected ${role} to access ${route.method.toUpperCase()} ${route.path}`
      );
    }

    for (const role of deniedRoles) {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(
        outcome.statusCode,
        403,
        `Expected ${role} to be denied on ${route.method.toUpperCase()} ${route.path}`
      );
    }
  }
});

test("authorizeRoles middleware rejects unauthenticated requests on masters routes", () => {
  const routes = [
    { method: "get", path: "/" },
    { method: "post", path: "/materials" },
    { method: "patch", path: "/materials/:id/status" },
  ];

  for (const route of routes) {
    const outcome = evaluateRoleGuard({ ...route, role: null });
    assert.equal(outcome.statusCode, 401);
  }
});
