const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const purchaseRequestsRouter = require("../src/modules/purchase_requests/purchase_requests.routes");
const purchaseOrdersRouter = require("../src/modules/purchase_orders/purchase_orders.routes");

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

const getRouteLayer = (router, method, path) => {
  const normalizedMethod = String(method || "").toLowerCase();
  const layer = router.stack.find(
    (item) =>
      item.route &&
      item.route.path === path &&
      Boolean(item.route.methods?.[normalizedMethod])
  );

  assert.ok(layer, `Expected ${normalizedMethod.toUpperCase()} ${path} route to exist`);
  return layer;
};

const evaluateRoleGuard = ({ router, method, path, role }) => {
  const layer = getRouteLayer(router, method, path);
  const authzGuard = layer.route.stack[1]?.handle;
  const req = { user: role ? { role } : null };
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

test("purchase request and order routes keep authenticate then authorize as first two middlewares", () => {
  const checks = [
    [purchaseRequestsRouter, "get", "/"],
    [purchaseRequestsRouter, "post", "/"],
    [purchaseRequestsRouter, "patch", "/:id/status"],
    [purchaseOrdersRouter, "get", "/"],
    [purchaseOrdersRouter, "post", "/"],
    [purchaseOrdersRouter, "patch", "/:id/status"],
  ];

  checks.forEach(([router, method, path]) => {
    const layer = getRouteLayer(router, method, path);
    const middlewareNames = layer.route.stack.map((item) => item?.name || "");
    assert.equal(middlewareNames[0], "authenticate");
    assert.equal(middlewareNames[1], "<anonymous>");
  });
});

test("purchase request read routes allow operations and admin roles", () => {
  const readRoutes = [
    { router: purchaseRequestsRouter, method: "get", path: "/" },
    { router: purchaseRequestsRouter, method: "get", path: "/:id" },
  ];

  const allowedRoles = [
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer",
    "operator",
  ];
  const deniedRoles = ["viewer"];

  readRoutes.forEach((route) => {
    allowedRoles.forEach((role) => {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(outcome.nextCalled, true);
    });

    deniedRoles.forEach((role) => {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(outcome.statusCode, 403);
    });
  });
});

test("purchase order read routes allow only super_admin, manager, and hr", () => {
  const readRoutes = [
    { router: purchaseOrdersRouter, method: "get", path: "/" },
    { router: purchaseOrdersRouter, method: "get", path: "/:id" },
  ];

  const allowedRoles = ["super_admin", "manager", "hr"];
  const deniedRoles = ["crusher_supervisor", "site_engineer", "operator", "viewer"];

  readRoutes.forEach((route) => {
    allowedRoles.forEach((role) => {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(outcome.nextCalled, true);
    });

    deniedRoles.forEach((role) => {
      const outcome = evaluateRoleGuard({ ...route, role });
      assert.equal(outcome.statusCode, 403);
    });
  });
});

test("purchase request create route allows operations and admin roles", () => {
  const route = { router: purchaseRequestsRouter, method: "post", path: "/" };
  ["super_admin", "manager", "hr", "crusher_supervisor", "site_engineer", "operator"].forEach(
    (role) => {
      const allowed = evaluateRoleGuard({ ...route, role });
      assert.equal(allowed.nextCalled, true);
    }
  );

  ["viewer"].forEach((role) => {
    const denied = evaluateRoleGuard({ ...route, role });
    assert.equal(denied.statusCode, 403);
  });
});

test("purchase update and status routes allow only super_admin and manager", () => {
  const writeRoutes = [
    { router: purchaseRequestsRouter, method: "patch", path: "/:id" },
    { router: purchaseRequestsRouter, method: "patch", path: "/:id/status" },
    { router: purchaseOrdersRouter, method: "post", path: "/" },
    { router: purchaseOrdersRouter, method: "patch", path: "/:id" },
    { router: purchaseOrdersRouter, method: "patch", path: "/:id/status" },
  ];

  writeRoutes.forEach((route) => {
    const superAdminAllowed = evaluateRoleGuard({ ...route, role: "super_admin" });
    assert.equal(superAdminAllowed.nextCalled, true);

    const managerAllowed = evaluateRoleGuard({ ...route, role: "manager" });
    assert.equal(managerAllowed.nextCalled, true);

    ["hr", "crusher_supervisor", "site_engineer", "operator", "viewer"].forEach((role) => {
      const denied = evaluateRoleGuard({ ...route, role });
      assert.equal(denied.statusCode, 403);
    });
  });
});

test("purchase routes reject unauthenticated requests", () => {
  const routes = [
    { router: purchaseRequestsRouter, method: "get", path: "/" },
    { router: purchaseRequestsRouter, method: "post", path: "/" },
    { router: purchaseOrdersRouter, method: "get", path: "/" },
    { router: purchaseOrdersRouter, method: "post", path: "/" },
  ];

  routes.forEach((route) => {
    const outcome = evaluateRoleGuard({ ...route, role: null });
    assert.equal(outcome.statusCode, 401);
  });
});
