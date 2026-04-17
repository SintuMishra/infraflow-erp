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

const expectJson = async (response, step, expectedStatuses = [200]) => {
  const body = await parseJson(response);

  if (!expectedStatuses.includes(response.status)) {
    fail(`Step failed: ${step}`, {
      status: response.status,
      expectedStatuses,
      body,
    });
  }

  return body;
};

const expectOk = async (response, step) => await expectJson(response, step, [200, 201]);

const loginAsBootstrapOperator = async () => {
  if (!SMOKE_ADMIN_USERNAME || !SMOKE_ADMIN_PASSWORD || !SMOKE_ADMIN_COMPANY_ID) {
    fail("Missing admin credentials for owner governance smoke run", {
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
      loginIntent: "owner",
      expectedCompanyId: Number(SMOKE_ADMIN_COMPANY_ID),
    }),
  });
  const loginJson = await expectOk(loginRes, "platform owner login");
  const token = loginJson?.data?.token;

  if (!token) {
    fail("Platform owner login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    fail("Platform owner smoke account must not require password rotation", {
      username: SMOKE_ADMIN_USERNAME,
      reason: "Use a stable owner account for smoke runs.",
    });
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": SMOKE_ADMIN_COMPANY_ID,
  };
};

const rotateOwnerPasswordIfRequired = async ({ companyId, username, temporaryPassword }) => {
  const loginRes = await smokeFetch("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-company-id": String(companyId),
    },
    body: JSON.stringify({
      username,
      password: temporaryPassword,
      loginIntent: "client",
      expectedCompanyId: Number(companyId),
    }),
  });

  const loginJson = await expectOk(loginRes, "new owner login");
  let token = loginJson?.data?.token;

  if (!token) {
    fail("New owner login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    const rotatedPassword = `OwnerGov#${Date.now()}Aa`;
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
    const changeJson = await expectOk(changeRes, "new owner password rotation");
    token = changeJson?.data?.token;

    if (!token) {
      fail("Owner password rotation response missing refreshed token");
    }
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": String(companyId),
  };
};

const getDataArray = (body, step) => {
  if (!Array.isArray(body?.data)) {
    fail(`Unexpected response shape for ${step}`, { body });
  }
  return body.data;
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

  const platformOwnerHeaders = await loginAsBootstrapOperator();
  const stamp = Date.now();
  const onboardingPayload = {
    companyName: `Codex Governance Smoke ${stamp}`,
    branchName: "Owner Governance Branch",
    ownerFullName: "Governance Smoke Owner",
    ownerMobileNumber: "9999999999",
    ownerDesignation: "Director",
    ownerJoiningDate: "2026-04-17",
    companyProfile: {
      email: `owner-gov-smoke-${stamp}@example.com`,
      stateName: "Maharashtra",
      stateCode: "27",
      city: "Chandrapur",
      pincode: "442401",
    },
  };

  const bootstrapRes = await smokeFetch("/onboarding/bootstrap-company-owner", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...platformOwnerHeaders,
      "x-bootstrap-secret": BOOTSTRAP_SECRET,
    },
    body: JSON.stringify(onboardingPayload),
  });

  const bootstrapJson = await expectOk(bootstrapRes, "bootstrap client company");
  const companyId = bootstrapJson?.data?.company?.id;
  const companyCode = bootstrapJson?.data?.company?.companyCode;
  const ownerUsername = bootstrapJson?.data?.owner?.username;
  const ownerTempPassword = bootstrapJson?.data?.owner?.temporaryPassword;

  if (!companyId || !companyCode || !ownerUsername || !ownerTempPassword) {
    fail("Bootstrap response missing required tenant details", {
      companyId,
      companyCode,
      ownerUsername,
      hasTempPassword: Boolean(ownerTempPassword),
    });
  }

  const ownerHeaders = await rotateOwnerPasswordIfRequired({
    companyId,
    username: ownerUsername,
    temporaryPassword: ownerTempPassword,
  });

  const selfProfileUpdateRes = await smokeFetch("/auth/me/profile", {
    method: "PATCH",
    headers: {
      ...ownerHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fullName: "Governance Smoke Owner Updated",
      mobileNumber: "9999999999",
      email: `owner-gov-profile-${stamp}@example.com`,
      emergencyContactNumber: "9888888888",
      address: "Owner Governance HQ",
      department: "Admin",
      designation: "Platform Owner",
    }),
  });
  const selfProfileUpdateJson = await expectOk(selfProfileUpdateRes, "owner self profile update");

  if (selfProfileUpdateJson?.data?.fullName !== "Governance Smoke Owner Updated") {
    fail("Owner self profile update did not persist expected fullName", {
      fullName: selfProfileUpdateJson?.data?.fullName || null,
    });
  }

  const billingUpdateRes = await smokeFetch(`/onboarding/companies/${companyId}/billing`, {
    method: "PATCH",
    headers: {
      ...platformOwnerHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      billingStatus: "overdue",
      billingCycle: "custom",
      customCycleLabel: "45-day project cycle",
      customCycleDays: 45,
      subscriptionPlan: "Enterprise Project",
      planAmount: 25000,
      outstandingAmount: 9000,
      currencyCode: "INR",
      nextDueDate: "2026-05-31",
      graceUntilDate: "2026-06-07",
      paymentReference: `SMOKE-${stamp}`,
      paymentTerms: "Payment due in 15 days",
      internalNotes: "Owner governance smoke update",
    }),
  });

  const billingUpdateJson = await expectOk(billingUpdateRes, "client billing update");
  if (billingUpdateJson?.data?.billing?.billingCycle !== "custom") {
    fail("Billing cycle was not persisted as custom", {
      billingCycle: billingUpdateJson?.data?.billing?.billingCycle || null,
    });
  }

  const invoiceCreateRes = await smokeFetch(`/onboarding/companies/${companyId}/invoices`, {
    method: "POST",
    headers: {
      ...platformOwnerHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      invoiceDate: "2026-04-17",
      periodStartDate: "2026-04-01",
      periodEndDate: "2026-04-30",
      dueDate: "2026-05-31",
      subscriptionPlan: "Enterprise Project",
      planAmount: 25000,
      outstandingAmount: 9000,
      currencyCode: "INR",
      notes: "Governance smoke invoice",
      paymentReference: `INVREF-${stamp}`,
      paymentTerms: "Payable within 15 days",
    }),
  });

  const invoiceCreateJson = await expectOk(invoiceCreateRes, "invoice generation");
  const invoiceNumber = invoiceCreateJson?.data?.invoice?.invoiceNumber;
  if (!invoiceNumber) {
    fail("Generated invoice response missing invoiceNumber");
  }

  const invoiceListRes = await smokeFetch(`/onboarding/companies/${companyId}/invoices?limit=20`, {
    headers: platformOwnerHeaders,
  });
  const invoiceListJson = await expectOk(invoiceListRes, "invoice list");
  const invoiceRows = getDataArray(invoiceListJson, "invoice list");
  if (!invoiceRows.some((row) => row?.invoiceNumber === invoiceNumber)) {
    fail("Generated invoice not found in invoice history", {
      invoiceNumber,
      invoiceCount: invoiceRows.length,
    });
  }

  const filteredCompanyListRes = await smokeFetch(
    `/onboarding/companies?search=${encodeURIComponent(companyCode)}&includeInactive=true&status=active&billingStatus=overdue`,
    { headers: platformOwnerHeaders }
  );
  const filteredCompanyListJson = await expectOk(
    filteredCompanyListRes,
    "server-backed managed company filters"
  );
  const filteredCompanies = getDataArray(filteredCompanyListJson, "server-backed managed company filters");

  if (!filteredCompanies.some((company) => Number(company?.id) === Number(companyId))) {
    fail("Server-backed filters did not return expected client company", {
      companyId,
      companyCode,
      filterCount: filteredCompanies.length,
    });
  }

  const loginContextRes = await smokeFetch(`/auth/login-context/${encodeURIComponent(companyCode)}`);
  await expectJson(loginContextRes, "client login context before deletion", [200]);

  const deleteRes = await smokeFetch(`/onboarding/companies/${companyId}/permanent`, {
    method: "DELETE",
    headers: {
      ...platformOwnerHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      reason: "Owner governance smoke cleanup",
    }),
  });
  await expectOk(deleteRes, "permanent client deletion");

  const loginContextAfterDeleteRes = await smokeFetch(
    `/auth/login-context/${encodeURIComponent(companyCode)}`
  );
  await expectJson(loginContextAfterDeleteRes, "client login context after deletion", [404]);

  const searchAfterDeleteRes = await smokeFetch(
    `/onboarding/companies?search=${encodeURIComponent(companyCode)}&includeInactive=true&status=all&billingStatus=all`,
    { headers: platformOwnerHeaders }
  );
  const searchAfterDeleteJson = await expectOk(searchAfterDeleteRes, "deleted company list search");
  const companiesAfterDelete = getDataArray(searchAfterDeleteJson, "deleted company list search");
  const stillExists = companiesAfterDelete.some((company) => Number(company?.id) === Number(companyId));

  if (stillExists) {
    fail("Deleted company still appears in managed company list", {
      companyId,
      companyCode,
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        companyId,
        companyCode,
        ownerUsername,
        invoiceNumber,
        checks: {
          ownerSelfProfileUpdated: true,
          customBillingCyclePersisted: true,
          invoicePersisted: true,
          serverBackedFiltersValidated: true,
          permanentDeleteValidated: true,
          loginContextRemovedAfterDelete: true,
        },
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  fail("Owner governance smoke script crashed", {
    message: error?.message || String(error),
    details: error?.details || null,
    baseUrlsTried: BASE_URLS,
  });
});
