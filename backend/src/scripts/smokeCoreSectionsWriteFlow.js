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

const getData = (body, step) => {
  const data = body?.data;

  if (data === undefined || data === null) {
    fail(`Missing response data for ${step}`, { body });
  }

  return data;
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
    companyName: `Codex Write Smoke ${stamp}`,
    branchName: "HQ",
    ownerFullName: "Write Smoke Owner",
    ownerMobileNumber: "9999999999",
    ownerDesignation: "Director",
    ownerJoiningDate: "2026-04-17",
    companyProfile: {
      email: `write-smoke-${stamp}@example.com`,
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
    const rotatedPassword = `WriteSmoke#${stamp}Aa`;
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

  const post = async (path, payload, step) => {
    const res = await smokeFetch(path, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await expectOk(res, step);
  };

  const patch = async (path, payload, step) => {
    const res = await smokeFetch(path, {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await expectOk(res, step);
  };

  const put = async (path, payload, step) => {
    const res = await smokeFetch(path, {
      method: "PUT",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await expectOk(res, step);
  };

  const get = async (path, step) => {
    const res = await smokeFetch(path, { headers });
    return await expectOk(res, step);
  };

  const companyProfileBody = await post(
    "/company-profile",
    {
      companyName: `Codex Write Smoke ${stamp}`,
      branchName: "HQ",
      stateName: "Maharashtra",
      stateCode: "27",
      city: "Chandrapur",
      pincode: "442401",
      email: `write-smoke-${stamp}@example.com`,
      gstin: "27AABFG7700Q1Z3",
      pan: "AAOCS1420M",
    },
    "company profile save"
  );
  const companyProfile = getData(companyProfileBody, "company profile save");

  const plantBody = await post(
    "/plants",
    {
      plantName: `Smoke Plant ${stamp}`,
      plantCode: `SP${String(stamp).slice(-5)}`,
      plantType: "Crusher",
      location: "Chandrapur",
      powerSourceType: "diesel",
    },
    "plant create"
  );
  const plant = getData(plantBody, "plant create");

  await patch(
    `/plants/${plant.id}`,
    {
      plantName: `${plant.plantName} A`,
      plantCode: plant.plantCode,
      plantType: plant.plantType,
      location: "Chandrapur Yard",
      powerSourceType: "diesel",
    },
    "plant update"
  );

  await patch(`/plants/${plant.id}/status`, { isActive: false }, "plant status false");
  await patch(`/plants/${plant.id}/status`, { isActive: true }, "plant status true");

  const materialBody = await post(
    "/masters/materials",
    {
      materialName: `Smoke Material ${stamp}`,
      materialCode: `SM${String(stamp).slice(-4)}`,
      category: "Aggregates",
      unit: "tons",
      gstRate: 5,
    },
    "material create"
  );
  const material = getData(materialBody, "material create");

  const vendorBody = await post(
    "/vendors",
    {
      vendorName: `Smoke Vendor ${stamp}`,
      vendorType: "Transporter",
      contactPerson: "Smoke Contact",
      mobileNumber: "9876543210",
      address: "Transport Yard",
    },
    "vendor create"
  );
  const vendor = getData(vendorBody, "vendor create");

  await patch(
    `/vendors/${vendor.id}`,
    {
      vendorName: `${vendor.vendorName} Updated`,
      vendorType: "Transporter",
      contactPerson: "Smoke Contact 2",
      mobileNumber: "9876543210",
      address: "Updated Transport Yard",
    },
    "vendor update"
  );
  await patch(`/vendors/${vendor.id}/status`, { isActive: false }, "vendor status false");
  await patch(`/vendors/${vendor.id}/status`, { isActive: true }, "vendor status true");

  const partyBody = await post(
    "/parties",
    {
      partyName: `Smoke Party ${stamp}`,
      mobileNumber: "9123456789",
      partyType: "customer",
      gstin: "27ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      stateCode: "27",
      pincode: "442401",
      city: "Chandrapur",
      stateName: "Maharashtra",
      addressLine1: "Smoke Address 1",
    },
    "party create"
  );
  const party = getData(partyBody, "party create");

  await patch(
    `/parties/${party.id}`,
    {
      partyName: `${party.partyName} Updated`,
      mobileNumber: "9123456789",
      partyType: "customer",
      gstin: "27ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      stateCode: "27",
      pincode: "442401",
      city: "Chandrapur",
      stateName: "Maharashtra",
      addressLine1: "Smoke Address 1 Updated",
    },
    "party update"
  );
  await patch(`/parties/${party.id}/status`, { isActive: false }, "party status false");
  await patch(`/parties/${party.id}/status`, { isActive: true }, "party status true");

  const vehicleBody = await post(
    "/vehicles",
    {
      vehicleNumber: `MH34SM${String(stamp).slice(-4)}`,
      vehicleType: "Tipper",
      ownershipType: "company",
      status: "active",
      plantId: plant.id,
      vehicleCapacityTons: 16,
    },
    "vehicle create"
  );
  const vehicle = getData(vehicleBody, "vehicle create");

  await patch(
    `/vehicles/${vehicle.id}`,
    {
      vehicleNumber: `MH34SX${String(stamp).slice(-4)}`,
      vehicleType: "Tipper",
      ownershipType: "company",
      vendorId: null,
      status: "active",
      vehicleCapacityTons: 16,
      plantId: plant.id,
    },
    "vehicle update"
  );
  await patch(`/vehicles/${vehicle.id}/status`, { status: "maintenance" }, "vehicle status maintenance");
  await patch(`/vehicles/${vehicle.id}/status`, { status: "active" }, "vehicle status active");

  const employeeBody = await post(
    "/employees",
    {
      fullName: `Smoke Employee ${stamp}`,
      mobileNumber: "9000000000",
      department: "Operations",
      designation: "Coordinator",
      joiningDate: "2026-04-17",
    },
    "employee create"
  );
  const employee = getData(employeeBody, "employee create");

  await post(
    "/auth/register",
    {
      employeeId: employee.id,
      role: "manager",
    },
    "employee login register"
  );

  await patch(
    `/employees/${employee.id}/login-status`,
    { enableLogin: false },
    "employee login disable"
  );
  await patch(
    `/employees/${employee.id}/login-status`,
    { enableLogin: true },
    "employee login enable"
  );

  await patch(
    `/employees/${employee.id}/status`,
    {
      status: "inactive",
      remarks: "Smoke check",
    },
    "employee status inactive"
  );
  await patch(
    `/employees/${employee.id}/status`,
    {
      status: "active",
      remarks: "Smoke check restore",
    },
    "employee status active"
  );

  const rateBody = await post(
    "/party-material-rates",
    {
      plantId: plant.id,
      partyId: party.id,
      materialId: material.id,
      ratePerTon: 1200,
      royaltyMode: "none",
      royaltyValue: 0,
      loadingCharge: 0,
      effectiveFrom: "2026-04-17",
      notes: "Smoke rate",
    },
    "party material rate create"
  );
  const rate = getData(rateBody, "party material rate create");

  await patch(
    `/party-material-rates/${rate.id}`,
    {
      plantId: plant.id,
      partyId: party.id,
      materialId: material.id,
      ratePerTon: 1250,
      royaltyMode: "none",
      royaltyValue: 0,
      loadingCharge: 0,
      effectiveFrom: "2026-04-17",
      notes: "Smoke rate updated",
    },
    "party material rate update"
  );
  await patch(`/party-material-rates/${rate.id}/status`, { isActive: false }, "party material rate status false");
  await patch(`/party-material-rates/${rate.id}/status`, { isActive: true }, "party material rate status true");

  const orderBody = await post(
    "/party-orders",
    {
      orderDate: "2026-04-17",
      partyId: party.id,
      plantId: plant.id,
      materialId: material.id,
      orderedQuantityTons: 100,
      status: "open",
      notes: "Smoke order",
    },
    "party order create"
  );
  const order = getData(orderBody, "party order create");

  await patch(
    `/party-orders/${order.id}`,
    {
      orderDate: "2026-04-17",
      partyId: party.id,
      plantId: plant.id,
      materialId: material.id,
      orderedQuantityTons: 120,
      status: "open",
      notes: "Smoke order updated",
    },
    "party order update"
  );
  await patch(`/party-orders/${order.id}/status`, { status: "cancelled" }, "party order status cancelled");

  const projectBody = await post(
    "/project-reports",
    {
      reportDate: "2026-04-17",
      plantId: plant.id,
      projectName: "Smoke Project",
      siteName: "Smoke Site",
      workDone: "Initial setup",
      labourCount: 12,
      machineCount: 3,
      progressPercent: 15,
      reportStatus: "on_track",
      shift: "day",
    },
    "project report create"
  );
  const projectReport = getData(projectBody, "project report create");

  await put(
    `/project-reports/${projectReport.id}`,
    {
      reportDate: "2026-04-17",
      plantId: plant.id,
      projectName: "Smoke Project Updated",
      siteName: "Smoke Site",
      workDone: "Initial setup plus review",
      labourCount: 13,
      machineCount: 3,
      progressPercent: 20,
      reportStatus: "watch",
      shift: "day",
    },
    "project report update"
  );

  const crusherBody = await post(
    "/plant-unit-reports",
    {
      reportDate: "2026-04-17",
      plantId: plant.id,
      shift: "day",
      crusherUnitName: "Smoke Unit",
      materialType: "GSB",
      productionTons: 10,
      dispatchTons: 8,
      machineHours: 7.5,
      dieselUsed: 25,
      operationalStatus: "running",
    },
    "crusher report create"
  );
  const crusherReport = getData(crusherBody, "crusher report create");

  await put(
    `/plant-unit-reports/${crusherReport.id}`,
    {
      reportDate: "2026-04-17",
      plantId: plant.id,
      shift: "day",
      crusherUnitName: "Smoke Unit",
      materialType: "GSB",
      productionTons: 12,
      dispatchTons: 9,
      machineHours: 8,
      dieselUsed: 28,
      operationalStatus: "watch",
    },
    "crusher report update"
  );

  const dispatchBody = await post(
    "/dispatch-reports",
    {
      dispatchDate: "2026-04-17",
      sourceType: "Plant",
      plantId: plant.id,
      materialId: material.id,
      vehicleId: vehicle.id,
      partyId: party.id,
      destinationName: "Smoke Site Delivery",
      quantityTons: 5,
      status: "pending",
      distanceKm: 12,
      otherCharge: 0,
      billingNotes: "Smoke dispatch",
    },
    "dispatch create"
  );
  const dispatchReport = getData(dispatchBody, "dispatch create");

  await patch(
    `/dispatch-reports/${dispatchReport.id}`,
    {
      dispatchDate: "2026-04-17",
      sourceType: "Plant",
      plantId: plant.id,
      materialId: material.id,
      vehicleId: vehicle.id,
      partyId: party.id,
      destinationName: "Smoke Site Delivery Updated",
      quantityTons: 5,
      status: "pending",
      distanceKm: 14,
      otherCharge: 0,
      billingNotes: "Smoke dispatch updated",
    },
    "dispatch update"
  );
  await patch(`/dispatch-reports/${dispatchReport.id}/status`, { status: "cancelled" }, "dispatch status cancelled");

  const auditBody = await get(
    "/audit-logs?search=smoke&includeReviewed=true&limit=50",
    "audit logs fetch"
  );
  const auditData = getData(auditBody, "audit logs fetch");

  if (!Array.isArray(auditData) || auditData.length === 0) {
    fail("Expected audit logs for write flow but found none");
  }

  const readChecks = {
    dashboard: await get("/dashboard/summary", "dashboard summary"),
    plantUnits: await get("/plant-unit-reports", "plant-unit reports list"),
    projectReports: await get("/project-reports", "project reports list"),
    dispatchReports: await get("/dispatch-reports", "dispatch reports list"),
    vehicles: await get("/vehicles", "vehicles list"),
    partyMaterialRates: await get("/party-material-rates", "party material rates list"),
    partyOrders: await get("/party-orders", "party orders list"),
    employees: await get("/employees", "employees list"),
    companyProfile: await get("/company-profile", "company profile read"),
    auditLogs: await get("/audit-logs?limit=25", "audit logs list"),
  };

  console.log(
    JSON.stringify(
      {
        success: true,
        companyId,
        ownerUsername: username,
        entities: {
          companyProfileId: companyProfile.id || null,
          plantId: plant.id,
          materialId: material.id,
          vendorId: vendor.id,
          partyId: party.id,
          vehicleId: vehicle.id,
          employeeId: employee.id,
          partyMaterialRateId: rate.id,
          partyOrderId: order.id,
          projectReportId: projectReport.id,
          crusherReportId: crusherReport.id,
          dispatchReportId: dispatchReport.id,
          auditEventsObserved: auditData.length,
        },
        readChecks: {
          dashboardSummarySuccess: Boolean(readChecks.dashboard?.success),
          plantUnitsSuccess: Boolean(readChecks.plantUnits?.success),
          projectReportsSuccess: Boolean(readChecks.projectReports?.success),
          dispatchReportsSuccess: Boolean(readChecks.dispatchReports?.success),
          vehiclesSuccess: Boolean(readChecks.vehicles?.success),
          partyMaterialRatesSuccess: Boolean(readChecks.partyMaterialRates?.success),
          partyOrdersSuccess: Boolean(readChecks.partyOrders?.success),
          employeesSuccess: Boolean(readChecks.employees?.success),
          companyProfileSuccess: Boolean(readChecks.companyProfile?.success),
          auditLogsSuccess: Boolean(readChecks.auditLogs?.success),
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
