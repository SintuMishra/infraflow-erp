const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const app = require("../src/app");
const apiRouter = require("../src/routes");

test("app registers root GET route", async () => {
  const rootLayer = app.router.stack.find(
    (layer) => layer.route?.path === "/" && layer.route?.methods?.get
  );

  assert.ok(rootLayer, "expected root GET route to be registered");
});

test("app mounts api router under /api", async () => {
  const apiLayer = app.router.stack.find(
    (layer) => layer.name === "router" && layer.matchers?.[0]?.("/api/health")
  );

  assert.ok(apiLayer, "expected /api router mount to exist");
});

test("api router registers health GET route", async () => {
  const healthLayer = apiRouter.stack.find(
    (layer) => layer.route?.path === "/health" && layer.route?.methods?.get
  );

  assert.ok(healthLayer, "expected /api/health GET route to be registered");
});

test("api router mounts audit logs routes", async () => {
  const auditLogsLayer = apiRouter.stack.find(
    (layer) => layer.name === "router" && layer.matchers?.[0]?.("/audit-logs")
  );

  assert.ok(
    auditLogsLayer,
    "expected /api/audit-logs router mount to exist"
  );
});

test("api router mounts party orders routes", async () => {
  const partyOrdersLayer = apiRouter.stack.find(
    (layer) => layer.name === "router" && layer.matchers?.[0]?.("/party-orders")
  );

  assert.ok(
    partyOrdersLayer,
    "expected /api/party-orders router mount to exist"
  );
});
