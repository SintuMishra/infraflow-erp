const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const router = require("../src/modules/onboarding/onboarding.routes");

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

const evaluateRoleGuard = ({ method, path, role }) => {
  const layer = getRouteLayer(method, path);
  const authzGuard = layer.route.stack[1]?.handle;
  assert.equal(typeof authzGuard, "function");

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

test("onboarding bootstrap route keeps authenticate -> authorize -> rate-limit -> validate -> controller sequence", () => {
  const layer = getRouteLayer("post", "/bootstrap-company-owner");
  const middlewareNames = layer.route.stack.map((item) => item?.name || "");

  assert.deepEqual(middlewareNames, [
    "authenticate",
    "<anonymous>",
    "<anonymous>",
    "validateBootstrapCompanyInput",
    "bootstrapCompanyOwnerController",
  ]);
});

test("onboarding bootstrap role guard allows only super_admin", () => {
  const allowedOutcome = evaluateRoleGuard({
    method: "post",
    path: "/bootstrap-company-owner",
    role: "super_admin",
  });
  assert.equal(allowedOutcome.nextCalled, true);

  const deniedRoles = ["manager", "hr", "crusher_supervisor", "site_engineer"];
  deniedRoles.forEach((role) => {
    const deniedOutcome = evaluateRoleGuard({
      method: "post",
      path: "/bootstrap-company-owner",
      role,
    });
    assert.equal(deniedOutcome.statusCode, 403);
  });
});

test("onboarding bootstrap role guard rejects unauthenticated requests", () => {
  const outcome = evaluateRoleGuard({
    method: "post",
    path: "/bootstrap-company-owner",
    role: null,
  });
  assert.equal(outcome.statusCode, 401);
});

test("onboarding governance routes keep authenticate -> authorize -> validate/controller sequence", () => {
  const routeExpectations = [
    {
      method: "get",
      path: "/companies/:companyId/invoices",
      expected: ["authenticate", "<anonymous>", "listManagedCompanyBillingInvoicesController"],
    },
    {
      method: "post",
      path: "/companies/:companyId/invoices",
      expected: [
        "authenticate",
        "<anonymous>",
        "validateManagedCompanyBillingInvoiceInput",
        "createManagedCompanyBillingInvoiceController",
      ],
    },
    {
      method: "delete",
      path: "/companies/:companyId/permanent",
      expected: [
        "authenticate",
        "<anonymous>",
        "validateManagedCompanyPermanentDeleteInput",
        "permanentlyDeleteManagedCompanyController",
      ],
    },
  ];

  routeExpectations.forEach(({ method, path, expected }) => {
    const layer = getRouteLayer(method, path);
    const middlewareNames = layer.route.stack.map((item) => item?.name || "");
    assert.deepEqual(
      middlewareNames,
      expected,
      `Unexpected middleware chain for ${method.toUpperCase()} ${path}`
    );
  });
});

test("onboarding governance routes allow only super_admin", () => {
  const governanceRoutes = [
    { method: "get", path: "/companies/:companyId/invoices" },
    { method: "post", path: "/companies/:companyId/invoices" },
    { method: "delete", path: "/companies/:companyId/permanent" },
  ];

  const deniedRoles = ["manager", "hr", "crusher_supervisor", "site_engineer", "operator"];

  governanceRoutes.forEach((route) => {
    const allowedOutcome = evaluateRoleGuard({ ...route, role: "super_admin" });
    assert.equal(
      allowedOutcome.nextCalled,
      true,
      `Expected super_admin to access ${route.method.toUpperCase()} ${route.path}`
    );

    deniedRoles.forEach((role) => {
      const deniedOutcome = evaluateRoleGuard({ ...route, role });
      assert.equal(
        deniedOutcome.statusCode,
        403,
        `Expected ${role} to be denied on ${route.method.toUpperCase()} ${route.path}`
      );
    });
  });
});

test("onboarding governance routes reject unauthenticated access", () => {
  const governanceRoutes = [
    { method: "get", path: "/companies/:companyId/invoices" },
    { method: "post", path: "/companies/:companyId/invoices" },
    { method: "delete", path: "/companies/:companyId/permanent" },
  ];

  governanceRoutes.forEach((route) => {
    const deniedOutcome = evaluateRoleGuard({ ...route, role: null });
    assert.equal(
      deniedOutcome.statusCode,
      401,
      `Expected unauthenticated request to be denied on ${route.method.toUpperCase()} ${route.path}`
    );
  });
});
