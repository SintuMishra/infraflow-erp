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

const expectOk = async (response, step) => expectJson(response, step, [200, 201]);

const getData = (body, step) => {
  const data = body?.data;
  if (data === undefined || data === null) {
    fail(`Missing response data for ${step}`, { body });
  }
  return data;
};

const loginAsBootstrapOperator = async () => {
  const credentials = await resolveSmokeAdminCredentials();
  const companyId = String(credentials.companyId || "").trim();

  const loginRes = await smokeFetch("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-company-id": companyId,
    },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  });

  const loginJson = await expectOk(loginRes, "platform owner login");
  const token = loginJson?.data?.token;
  if (!token) {
    fail("Platform owner login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    fail("Platform owner smoke account must not require password rotation", {
      username: credentials.username,
    });
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": companyId,
  };
};

const loginAsClientOwner = async ({ companyId, username, temporaryPassword, stamp }) => {
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
  const loginJson = await expectOk(loginRes, "client owner login");
  let token = loginJson?.data?.token;
  if (!token) {
    fail("Client owner login response missing token");
  }

  if (loginJson?.data?.user?.mustChangePassword) {
    const newPassword = `ProcSmoke#${stamp}Aa`;
    const changeRes = await smokeFetch("/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-company-id": String(companyId),
      },
      body: JSON.stringify({
        currentPassword: temporaryPassword,
        newPassword,
      }),
    });
    const changeJson = await expectOk(changeRes, "client owner password rotation");
    token = changeJson?.data?.token;
    if (!token) {
      fail("Client owner change-password response missing token");
    }
  }

  return {
    authorization: `Bearer ${token}`,
    "x-company-id": String(companyId),
  };
};

const run = async () => {
  if (!BOOTSTRAP_SECRET) {
    fail("Missing bootstrap secret", {
      requiredEnv:
        "Set SMOKE_BOOTSTRAP_SECRET or ONBOARDING_BOOTSTRAP_SECRET before running procurement smoke.",
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

  const ownerHeaders = await loginAsBootstrapOperator();
  const stamp = Date.now();

  let companyId = null;
  let ownerUsername = null;
  const result = {
    procurement: {},
  };

  const ownerPost = async (path, payload, step) => {
    const res = await smokeFetch(path, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await expectOk(res, step);
  };

  try {
    const bootstrapRes = await smokeFetch("/onboarding/bootstrap-company-owner", {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "content-type": "application/json",
        "x-bootstrap-secret": BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({
        companyName: `Procurement Smoke ${stamp}`,
        branchName: "HQ",
        ownerFullName: "Procurement Smoke Owner",
        ownerMobileNumber: "9999999999",
        ownerDesignation: "Director",
        ownerJoiningDate: "2026-04-22",
        companyProfile: {
          email: `proc-smoke-${stamp}@example.com`,
          stateName: "Maharashtra",
          stateCode: "27",
          city: "Chandrapur",
          pincode: "442401",
        },
      }),
    });

    const bootstrapJson = await expectOk(bootstrapRes, "bootstrap client company");
    companyId = bootstrapJson?.data?.company?.id;
    ownerUsername = bootstrapJson?.data?.owner?.username || null;
    const temporaryPassword = bootstrapJson?.data?.owner?.temporaryPassword || null;
    if (!companyId || !ownerUsername || !temporaryPassword) {
      fail("Bootstrap response missing owner details", {
        companyId,
        ownerUsername,
        hasTemporaryPassword: Boolean(temporaryPassword),
      });
    }

    const clientHeaders = await loginAsClientOwner({
      companyId,
      username: ownerUsername,
      temporaryPassword,
      stamp,
    });

    const post = async (path, payload, step) => {
      const res = await smokeFetch(path, {
        method: "POST",
        headers: {
          ...clientHeaders,
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
          ...clientHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return await expectOk(res, step);
    };

    const get = async (path, step) => {
      const res = await smokeFetch(path, {
        method: "GET",
        headers: clientHeaders,
      });
      return await expectOk(res, step);
    };

    await post("/accounts/masters/bootstrap-defaults", {}, "bootstrap finance defaults");
    await post("/accounts/masters/sync-party-ledgers", {}, "sync party/vendor ledgers");

    const years = getData(
      await get("/accounts/masters/financial-years", "list financial years"),
      "list financial years"
    );
    let fy = Array.isArray(years) && years.length ? years[0] : null;

    if (!fy?.id) {
      fy = getData(
        await post(
          "/accounts/masters/financial-years",
          {
            fyCode: `FY${String(stamp).slice(-6)}`,
            fyName: "FY 2026-27",
            startDate: "2026-04-01",
            endDate: "2027-03-31",
          },
          "create financial year"
        ),
        "create financial year"
      );
    }

    const periods = getData(
      await get(`/accounts/masters/accounting-periods?financialYearId=${fy.id}`, "list accounting periods"),
      "list accounting periods"
    );

    if (!Array.isArray(periods) || !periods.length) {
      const fyStart = String(fy.startDate || fy.periodStart || "2026-04-01").slice(0, 10);
      const fyEnd = String(fy.endDate || fy.periodEnd || "2027-03-31").slice(0, 10);
      await post(
        "/accounts/masters/accounting-periods",
        {
          financialYearId: fy.id,
          periodCode: `PER${String(stamp).slice(-6)}`,
          periodName: "Main procurement smoke period",
          periodStart: fyStart,
          periodEnd: fyEnd,
        },
        "create accounting period"
      );
    }

    const material = getData(
      await post(
        "/masters/materials",
        {
          materialName: `Proc Material ${stamp}`,
          materialCode: `PM${String(stamp).slice(-5)}`,
          category: "Aggregates",
          unit: "tons",
          gstRate: 5,
        },
        "create material"
      ),
      "create material"
    );

    const vendor = getData(
      await post(
        "/vendors",
        {
          vendorName: `Proc Vendor ${stamp}`,
          vendorType: "Transporter",
          contactPerson: "Proc Contact",
          mobileNumber: "9876543210",
          address: "Proc Vendor Yard",
        },
        "create vendor"
      ),
      "create vendor"
    );

    await post("/accounts/masters/sync-party-ledgers", {}, "re-sync vendor ledgers");

    const purchaseRequest = getData(
      await post(
        "/purchase-requests",
        {
          requestDate: "2026-04-22",
          requiredByDate: "2026-04-29",
          vendorId: vendor.id,
          notes: "Procurement smoke PR",
          lines: [
            {
              materialId: material.id,
              quantity: 10,
              unitRate: 100,
              description: "PR line smoke",
            },
          ],
        },
        "create purchase request"
      ),
      "create purchase request"
    );

    await patch(
      `/purchase-requests/${purchaseRequest.id}/status`,
      { status: "submitted" },
      "submit purchase request"
    );
    const approvedPr = getData(
      await patch(
        `/purchase-requests/${purchaseRequest.id}/status`,
        { status: "approved" },
        "approve purchase request"
      ),
      "approve purchase request"
    );

    const requestLine = approvedPr?.lines?.[0];
    if (!requestLine?.id) {
      fail("Purchase request response missing line id");
    }

    const purchaseOrder = getData(
      await post(
        "/purchase-orders",
        {
          purchaseRequestId: purchaseRequest.id,
          poDate: "2026-04-22",
          expectedDeliveryDate: "2026-04-29",
          vendorId: vendor.id,
          notes: "Procurement smoke PO",
          lines: [
            {
              purchaseRequestLineId: requestLine.id,
              materialId: material.id,
              orderedQuantity: 10,
              unitRate: 100,
              description: "PO line smoke",
            },
          ],
        },
        "create purchase order"
      ),
      "create purchase order"
    );

    await patch(
      `/purchase-orders/${purchaseOrder.id}/status`,
      { status: "submitted" },
      "submit purchase order"
    );
    await patch(
      `/purchase-orders/${purchaseOrder.id}/status`,
      { status: "approved" },
      "approve purchase order"
    );

    const poDetails = getData(
      await get(`/purchase-orders/${purchaseOrder.id}`, "fetch purchase order details"),
      "fetch purchase order details"
    );
    const poLine = poDetails?.lines?.[0];
    if (!poLine?.id) {
      fail("Purchase order details missing line id");
    }

    const goodsReceipt = getData(
      await post(
        "/goods-receipts",
        {
          purchaseOrderId: purchaseOrder.id,
          vendorId: vendor.id,
          receiptDate: "2026-04-22",
          notes: "Procurement smoke GRN",
          lines: [
            {
              purchaseOrderLineId: poLine.id,
              materialId: material.id,
              receivedQuantity: 10,
              acceptedQuantity: 10,
              rejectedQuantity: 0,
              unitRate: 100,
              remarks: "Full receipt",
            },
          ],
        },
        "create goods receipt"
      ),
      "create goods receipt"
    );

    const grnLine = goodsReceipt?.lines?.[0];
    if (!grnLine?.id) {
      fail("Goods receipt response missing line id");
    }

    const purchaseInvoice = getData(
      await post(
        "/purchase-invoices",
        {
          purchaseOrderId: purchaseOrder.id,
          goodsReceiptId: goodsReceipt.id,
          vendorId: vendor.id,
          invoiceDate: "2026-04-22",
          dueDate: "2026-04-29",
          notes: "Procurement smoke invoice",
          lines: [
            {
              purchaseOrderLineId: poLine.id,
              goodsReceiptLineId: grnLine.id,
              materialId: material.id,
              billedQuantity: 10,
              unitRate: 100,
            },
          ],
          postToPayables: true,
        },
        "create purchase invoice"
      ),
      "create purchase invoice"
    );

    if (!purchaseInvoice.payableId) {
      fail("Purchase invoice did not link payable", {
        invoiceId: purchaseInvoice.id,
        matchStatus: purchaseInvoice.matchStatus,
      });
    }

    await post(`/purchase-invoices/${purchaseInvoice.id}/post`, {}, "post purchase invoice to payable");

    const payables = getData(await get("/accounts/payables", "list payables"), "list payables");
    const payableMatch = Array.isArray(payables)
      ? payables.find((item) => Number(item.id) === Number(purchaseInvoice.payableId))
      : null;

    if (!payableMatch) {
      fail("Payable linked from purchase invoice not found in list", {
        payableId: purchaseInvoice.payableId,
      });
    }

    result.procurement = {
      purchaseRequestId: purchaseRequest.id,
      purchaseOrderId: purchaseOrder.id,
      goodsReceiptId: goodsReceipt.id,
      purchaseInvoiceId: purchaseInvoice.id,
      payableId: purchaseInvoice.payableId,
      invoiceMatchStatus: purchaseInvoice.matchStatus,
      payableStatus: payableMatch.status || null,
      payableOutstandingAmount: Number(payableMatch.outstandingAmount || 0),
    };

    console.log(
      JSON.stringify(
        {
          success: true,
          companyId,
          ownerUsername,
          checks: result,
        },
        null,
        2
      )
    );
  } finally {
    if (companyId) {
      const cleanupRes = await smokeFetch(`/onboarding/companies/${companyId}/permanent`, {
        method: "DELETE",
        headers: {
          ...ownerHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Procurement smoke cleanup",
        }),
      });

      if (!cleanupRes.ok) {
        const cleanupBody = await parseJson(cleanupRes);
        fail("Cleanup failed for procurement smoke company", {
          companyId,
          status: cleanupRes.status,
          body: cleanupBody,
        });
      }
    }
  }
};

run().catch((error) => {
  fail("Procurement smoke script crashed", {
    message: error?.message || String(error),
    details: error?.details || null,
    baseUrlsTried: BASE_URLS,
  });
});
