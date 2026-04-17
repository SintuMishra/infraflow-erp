const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const router = require("../src/modules/auth/auth.routes");

const getRouteLayer = (method, path) => {
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

test("auth me route uses authenticate -> controller sequence", () => {
  const layer = getRouteLayer("get", "/me");
  const middlewareNames = layer.route.stack.map((item) => item?.name || "");

  assert.deepEqual(middlewareNames, [
    "authenticate",
    "getAuthenticatedProfileController",
  ]);
});

test("auth me profile update route uses authenticate -> validate -> controller sequence", () => {
  const layer = getRouteLayer("patch", "/me/profile");
  const middlewareNames = layer.route.stack.map((item) => item?.name || "");

  assert.deepEqual(middlewareNames, [
    "authenticate",
    "validateUpdateSelfProfileInput",
    "updateAuthenticatedProfileController",
  ]);
});

