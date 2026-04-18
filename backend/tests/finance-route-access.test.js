const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const accountsMastersRouter = require("../src/modules/accounts_masters/accounts_masters.routes");
const generalLedgerRouter = require("../src/modules/general_ledger/general_ledger.routes");
const journalVouchersRouter = require("../src/modules/journal_vouchers/journal_vouchers.routes");
const receivablesRouter = require("../src/modules/accounts_receivable/accounts_receivable.routes");
const payablesRouter = require("../src/modules/accounts_payable/accounts_payable.routes");
const cashBankRouter = require("../src/modules/cash_bank/cash_bank.routes");
const reportsRouter = require("../src/modules/financial_reports/financial_reports.routes");

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

test("accounts routes keep authenticate then authorize as first two middlewares", () => {
  const checks = [
    [accountsMastersRouter, "post", "/bootstrap-defaults"],
    [accountsMastersRouter, "patch", "/accounting-periods/:periodId/status"],
    [generalLedgerRouter, "patch", "/policies"],
    [generalLedgerRouter, "get", "/workflow/history"],
    [journalVouchersRouter, "post", "/"],
    [receivablesRouter, "post", "/dispatch/:dispatchId/create"],
    [payablesRouter, "post", "/"],
    [cashBankRouter, "post", "/vouchers"],
    [reportsRouter, "get", "/trial-balance"],
  ];

  checks.forEach(([router, method, path]) => {
    const layer = getRouteLayer(router, method, path);
    const middlewareNames = layer.route.stack.map((item) => item?.name || "");
    assert.equal(middlewareNames[0], "authenticate");
    assert.equal(middlewareNames[1], "<anonymous>");
  });
});

test("finance write routes allow super_admin/manager and block non-finance ops roles", () => {
  const writeRoutes = [
    { router: accountsMastersRouter, method: "post", path: "/bootstrap-defaults" },
    { router: accountsMastersRouter, method: "patch", path: "/accounting-periods/:periodId/status" },
    { router: generalLedgerRouter, method: "patch", path: "/policies" },
    { router: journalVouchersRouter, method: "post", path: "/" },
    { router: receivablesRouter, method: "post", path: "/dispatch/:dispatchId/create" },
    { router: payablesRouter, method: "post", path: "/" },
    { router: cashBankRouter, method: "post", path: "/vouchers" },
  ];

  writeRoutes.forEach((route) => {
    const allowedSuperAdmin = evaluateRoleGuard({ ...route, role: "super_admin" });
    assert.equal(allowedSuperAdmin.nextCalled, true);

    const allowedManager = evaluateRoleGuard({ ...route, role: "manager" });
    assert.equal(allowedManager.nextCalled, true);

    const deniedOps = evaluateRoleGuard({ ...route, role: "crusher_supervisor" });
    assert.equal(deniedOps.statusCode, 403);

    const deniedHr = evaluateRoleGuard({ ...route, role: "hr" });
    assert.equal(deniedHr.statusCode, 403);
  });
});

test("finance read/report routes allow hr and deny unauthenticated users", () => {
  const readRoutes = [
    { router: reportsRouter, method: "get", path: "/trial-balance" },
    { router: generalLedgerRouter, method: "get", path: "/policies" },
    { router: generalLedgerRouter, method: "get", path: "/workflow/history" },
    { router: accountsMastersRouter, method: "get", path: "/accounting-periods" },
    { router: accountsMastersRouter, method: "get", path: "/chart-of-accounts" },
    { router: payablesRouter, method: "get", path: "/" },
  ];

  readRoutes.forEach((route) => {
    const allowedHr = evaluateRoleGuard({ ...route, role: "hr" });
    assert.equal(allowedHr.nextCalled, true);

    const deniedUnauth = evaluateRoleGuard({ ...route, role: null });
    assert.equal(deniedUnauth.statusCode, 401);
  });
});
