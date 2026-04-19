const { createSmokeFetch, resolveSmokeBaseUrls } = require("./smokeHttp.util");
const { resolveSmokeAdminCredentials } = require("./smokeAdminCredentials.util");
const BOOTSTRAP_SECRET =
  process.env.SMOKE_BOOTSTRAP_SECRET || process.env.ONBOARDING_BOOTSTRAP_SECRET || "";
const BASE_URLS = resolveSmokeBaseUrls();
const smokeFetch = createSmokeFetch(BASE_URLS);

const fail = (message, details = {}) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message,
        details,
      },
      null,
      2
    )
  );
  process.exit(1);
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const expectOk = async (response, step) => {
  const body = await parseJson(response);

  if (!response.ok) {
    fail(`Step failed: ${step}`, {
      status: response.status,
      body,
    });
  }

  return body;
};

const loginAsBootstrapOperator = async () => {
  const credentials = await resolveSmokeAdminCredentials();
  const smokeAdminCompanyId = String(credentials.companyId || "").trim();

  const loginRes = await smokeFetch("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-company-id": smokeAdminCompanyId,
    },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  });
  const loginJson = await expectOk(loginRes, "bootstrap operator login");
  const token = loginJson?.data?.token;

  if (!token) {
    fail("Bootstrap operator login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    fail("Bootstrap operator account must not require password rotation", {
      username: credentials.username,
      reason:
        "Use a stable super_admin account for smoke runs, not a temporary-password account.",
    });
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": smokeAdminCompanyId,
  };
};

const toLength = (value) => {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (Array.isArray(value?.items)) {
    return value.items.length;
  }

  return null;
};

const run = async () => {
  if (!BOOTSTRAP_SECRET) {
    fail("Missing bootstrap secret", {
      requiredEnv:
        "Set SMOKE_BOOTSTRAP_SECRET or ONBOARDING_BOOTSTRAP_SECRET before running smoke flow.",
    });
  }

  const healthRes = await smokeFetch("/health");
  if (!healthRes.ok) {
    fail("Smoke preflight failed: API health check is not healthy", {
      status: healthRes.status,
      activeBaseUrl: smokeFetch.getActiveBaseUrl(),
      baseUrlsTried: BASE_URLS,
    });
  }

  const bootstrapOperatorHeaders = await loginAsBootstrapOperator();

  const stamp = Date.now();
  const onboardingPayload = {
    companyName: `Codex Core Smoke ${stamp}`,
    branchName: "HQ",
    ownerFullName: "Core Smoke Owner",
    ownerMobileNumber: "9999999999",
    ownerDesignation: "Director",
    ownerJoiningDate: "2026-04-17",
    companyProfile: {
      email: `core-smoke-${stamp}@example.com`,
      stateName: "Maharashtra",
      stateCode: "27",
    },
  };

  const bootstrapRes = await smokeFetch("/onboarding/bootstrap-company-owner", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...bootstrapOperatorHeaders,
      "x-bootstrap-secret": BOOTSTRAP_SECRET,
    },
    body: JSON.stringify(onboardingPayload),
  });
  const bootstrapJson = await expectOk(bootstrapRes, "bootstrap");

  const companyId = bootstrapJson?.data?.company?.id;
  const username = bootstrapJson?.data?.owner?.username;
  const temporaryPassword = bootstrapJson?.data?.owner?.temporaryPassword;

  if (!companyId || !username || !temporaryPassword) {
    fail("Bootstrap response missing owner login details", {
      companyId,
      username,
      hasTemporaryPassword: Boolean(temporaryPassword),
    });
  }

  const loginRes = await smokeFetch("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-company-id": String(companyId),
    },
    body: JSON.stringify({
      username,
      password: temporaryPassword,
    }),
  });
  const loginJson = await expectOk(loginRes, "login");
  let token = loginJson?.data?.token;

  if (!token) {
    fail("Login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    const rotatedPassword = `CoreSmoke#${stamp}Aa`;
    const changeRes = await smokeFetch("/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-company-id": String(companyId),
      },
      body: JSON.stringify({
        currentPassword: temporaryPassword,
        newPassword: rotatedPassword,
      }),
    });
    const changeJson = await expectOk(changeRes, "change password");
    token = changeJson?.data?.token;

    if (!token) {
      fail("Change-password response missing refreshed token");
    }
  }

  const headers = {
    authorization: `Bearer ${token}`,
    "x-company-id": String(companyId),
  };

  const endpointChecks = [
    { key: "dashboardSummary", path: "/dashboard/summary", validator: (body) => body?.data?.employees?.total !== undefined },
    { key: "plantUnitReports", path: "/plant-unit-reports", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "projectReports", path: "/project-reports", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "dispatchReports", path: "/dispatch-reports", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "vehicles", path: "/vehicles", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "partyMaterialRates", path: "/party-material-rates", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "partyOrders", path: "/party-orders", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "employees", path: "/employees", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
    { key: "companyProfile", path: "/company-profile", validator: (body) => body?.success === true },
    { key: "auditLogs", path: "/audit-logs?limit=25", validator: (body) => Array.isArray(body?.data) },
    { key: "plants", path: "/plants", validator: (body) => Array.isArray(body?.data) || Array.isArray(body?.data?.items) },
  ];

  const checkResults = {};

  for (const check of endpointChecks) {
    const response = await smokeFetch(check.path, { headers });
    const body = await expectOk(response, check.key);

    if (!check.validator(body)) {
      fail(`Endpoint returned unexpected shape: ${check.key}`, {
        path: check.path,
        sample: body,
      });
    }

    checkResults[check.key] = {
      status: response.status,
      count: toLength(body?.data),
    };
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        companyId,
        ownerUsername: username,
        checks: checkResults,
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  fail("Smoke script crashed", {
    message: error?.message || String(error),
    details: error?.details || null,
    baseUrlsTried: BASE_URLS,
  });
});
