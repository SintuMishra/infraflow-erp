const { createSmokeFetch, resolveSmokeBaseUrls } = require("./smokeHttp.util");
const BOOTSTRAP_SECRET =
  process.env.SMOKE_BOOTSTRAP_SECRET || process.env.ONBOARDING_BOOTSTRAP_SECRET || "";
const SMOKE_ADMIN_USERNAME = String(process.env.SMOKE_ADMIN_USERNAME || "").trim();
const SMOKE_ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || "").trim();
const SMOKE_ADMIN_COMPANY_ID = String(process.env.SMOKE_ADMIN_COMPANY_ID || "").trim();
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
  if (!SMOKE_ADMIN_USERNAME || !SMOKE_ADMIN_PASSWORD || !SMOKE_ADMIN_COMPANY_ID) {
    fail("Missing admin credentials for authenticated onboarding smoke run", {
      requiredEnv:
        "Set SMOKE_ADMIN_USERNAME, SMOKE_ADMIN_PASSWORD, and SMOKE_ADMIN_COMPANY_ID.",
    });
  }

  const loginRes = await smokeFetch("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-company-id": SMOKE_ADMIN_COMPANY_ID,
    },
    body: JSON.stringify({
      username: SMOKE_ADMIN_USERNAME,
      password: SMOKE_ADMIN_PASSWORD,
    }),
  });
  const loginJson = await expectOk(loginRes, "bootstrap operator login");
  const token = loginJson?.data?.token;

  if (!token) {
    fail("Bootstrap operator login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    fail("Bootstrap operator account must not require password rotation", {
      username: SMOKE_ADMIN_USERNAME,
      reason:
        "Use a stable super_admin account for smoke runs, not a temporary-password account.",
    });
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": SMOKE_ADMIN_COMPANY_ID,
  };
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
    companyName: `Codex QA Infra ${stamp}`,
    branchName: "Main Branch",
    ownerFullName: "Codex Owner",
    ownerMobileNumber: "9876543210",
    ownerDesignation: "Director",
    ownerJoiningDate: "2026-04-17",
    companyProfile: {
      email: `ops${stamp}@example.com`,
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
    const rotatedPassword = `Codex#${stamp}Aa`;
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

  const scopedHeaders = {
    authorization: `Bearer ${token}`,
    "x-company-id": String(companyId),
  };

  const [summaryRes, exceptionsRes, reviewedOnlyRes, auditRes] = await Promise.all([
    smokeFetch("/dashboard/summary", { headers: scopedHeaders }),
    smokeFetch("/dashboard/commercial-exceptions?includeReviewed=true&limit=20", {
      headers: scopedHeaders,
    }),
    smokeFetch(
      "/dashboard/commercial-exceptions?includeReviewed=true&reviewedOnly=true&limit=20",
      {
        headers: scopedHeaders,
      }
    ),
    smokeFetch("/audit-logs?targetType=onboarding&limit=25", {
      headers: scopedHeaders,
    }),
  ]);

  const [summaryJson, exceptionsJson, reviewedOnlyJson, auditJson] = await Promise.all([
    expectOk(summaryRes, "dashboard summary"),
    expectOk(exceptionsRes, "commercial exceptions"),
    expectOk(reviewedOnlyRes, "commercial exceptions reviewed-only"),
    expectOk(auditRes, "audit logs"),
  ]);

  const hasSummaryShape = typeof summaryJson?.data?.employees?.total === "number";
  const hasReviewedOnlyFlag = reviewedOnlyJson?.data?.meta?.reviewedOnly === true;
  const auditItems = auditJson?.data || [];
  const hasOnboardingAuditEvent = auditItems.some((item) =>
    String(item?.action || "").startsWith("onboarding.")
  );

  if (!hasSummaryShape || !hasReviewedOnlyFlag || !hasOnboardingAuditEvent) {
    fail("Smoke checks returned unexpected payload shape", {
      hasSummaryShape,
      hasReviewedOnlyFlag,
      hasOnboardingAuditEvent,
      auditCount: auditJson?.meta?.total || 0,
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        companyId,
        ownerUsername: username,
        checks: {
          dashboardSummaryStatus: summaryRes.status,
          exceptionsStatus: exceptionsRes.status,
          reviewedOnlyStatus: reviewedOnlyRes.status,
          auditLogsStatus: auditRes.status,
          reviewedOnlyFlag: hasReviewedOnlyFlag,
          auditCount: auditJson?.meta?.total || 0,
          onboardingAuditEventsSeen: hasOnboardingAuditEvent,
        },
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
