const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const goodsReceiptsRouter = require("../src/modules/goods_receipts/goods_receipts.routes");
const purchaseInvoicesRouter = require("../src/modules/purchase_invoices/purchase_invoices.routes");

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
    (item) => item.route && item.route.path === path && Boolean(item.route.methods?.[normalizedMethod])
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

test("goods receipt and purchase invoice routes keep authenticate then authorize as first two middlewares", () => {
  const checks = [
    [goodsReceiptsRouter, "get", "/"],
    [goodsReceiptsRouter, "post", "/"],
    [purchaseInvoicesRouter, "get", "/"],
    [purchaseInvoicesRouter, "post", "/"],
    [purchaseInvoicesRouter, "post", "/:id/post"],
  ];

  checks.forEach(([router, method, path]) => {
    const layer = getRouteLayer(router, method, path);
    const middlewareNames = layer.route.stack.map((item) => item?.name || "");
    assert.equal(middlewareNames[0], "authenticate");
    assert.equal(middlewareNames[1], "<anonymous>");
  });
});

test("phase2 procurement read routes allow super_admin, manager, and hr", () => {
  const readRoutes = [
    { router: goodsReceiptsRouter, method: "get", path: "/" },
    { router: goodsReceiptsRouter, method: "get", path: "/:id" },
    { router: purchaseInvoicesRouter, method: "get", path: "/" },
    { router: purchaseInvoicesRouter, method: "get", path: "/:id" },
  ];

  const allowedRoles = ["super_admin", "manager", "hr"];
  const deniedRoles = ["crusher_supervisor", "site_engineer", "viewer"];

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

test("phase2 procurement write routes allow only super_admin and manager", () => {
  const writeRoutes = [
    { router: goodsReceiptsRouter, method: "post", path: "/" },
    { router: purchaseInvoicesRouter, method: "post", path: "/" },
    { router: purchaseInvoicesRouter, method: "post", path: "/:id/post" },
  ];

  writeRoutes.forEach((route) => {
    const superAdminAllowed = evaluateRoleGuard({ ...route, role: "super_admin" });
    assert.equal(superAdminAllowed.nextCalled, true);

    const managerAllowed = evaluateRoleGuard({ ...route, role: "manager" });
    assert.equal(managerAllowed.nextCalled, true);

    ["hr", "crusher_supervisor", "site_engineer", "viewer"].forEach((role) => {
      const denied = evaluateRoleGuard({ ...route, role });
      assert.equal(denied.statusCode, 403);
    });
  });
});

