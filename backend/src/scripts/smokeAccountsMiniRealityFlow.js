const { createSmokeFetch, resolveSmokeBaseUrls } = require("./smokeHttp.util");
const { resolveSmokeAdminCredentials } = require("./smokeAdminCredentials.util");

const BOOTSTRAP_SECRET =
  process.env.SMOKE_BOOTSTRAP_SECRET || process.env.ONBOARDING_BOOTSTRAP_SECRET || "";
const BASE_URLS = resolveSmokeBaseUrls();
const smokeFetch = createSmokeFetch(BASE_URLS);

const fail = (message, details = {}) => {
  const error = new Error(message);
  error.details = details;
  throw error;
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const expectOk = async (response, step, statuses = [200, 201]) => {
  const body = await parseJson(response);
  if (!statuses.includes(response.status)) {
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
      loginIntent: "owner",
      expectedCompanyId: Number(smokeAdminCompanyId),
    }),
  });
  const loginJson = await expectOk(loginRes, "platform owner login");
  const token = loginJson?.data?.token;
  if (!token) {
    fail("Missing platform owner token");
  }
  return {
    authorization: `Bearer ${token}`,
    "x-company-id": smokeAdminCompanyId,
  };
};

const run = async () => {
  if (!BOOTSTRAP_SECRET) {
    fail("Missing bootstrap secret");
  }

  const healthRes = await smokeFetch("/health");
  await expectOk(healthRes, "health");

  const ownerHeaders = await loginAsBootstrapOperator();
  const stamp = Date.now();

  let companyId = null;

  try {
    const bootstrapRes = await smokeFetch("/onboarding/bootstrap-company-owner", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...ownerHeaders,
        "x-bootstrap-secret": BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({
        companyName: `Codex Accounts Smoke ${stamp}`,
        branchName: "HQ",
        ownerFullName: "Accounts Smoke Owner",
        ownerMobileNumber: "9999999999",
        ownerDesignation: "Director",
        ownerJoiningDate: "2026-04-19",
        companyProfile: {
          email: `accounts-smoke-${stamp}@example.com`,
          stateName: "Maharashtra",
          stateCode: "27",
        },
      }),
    });
    const bootstrapJson = await expectOk(bootstrapRes, "bootstrap client");
    companyId = bootstrapJson?.data?.company?.id;
    const username = bootstrapJson?.data?.owner?.username;
    const temporaryPassword = bootstrapJson?.data?.owner?.temporaryPassword;

    if (!companyId || !username || !temporaryPassword) {
      fail("Bootstrap response missing owner credentials", {
        companyId,
        username,
        hasPassword: Boolean(temporaryPassword),
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
    const loginJson = await expectOk(loginRes, "client owner login");
    let companyToken = loginJson?.data?.token;
    if (!companyToken) {
      fail("Client owner login missing token");
    }

    if (loginJson?.data?.user?.mustChangePassword) {
      const rotatedPassword = `AccSmoke#${stamp}Aa`;
      const changeRes = await smokeFetch("/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${companyToken}`,
          "x-company-id": String(companyId),
        },
        body: JSON.stringify({
          currentPassword: temporaryPassword,
          newPassword: rotatedPassword,
        }),
      });
      const changeJson = await expectOk(changeRes, "rotate client owner password");
      companyToken = changeJson?.data?.token;
      if (!companyToken) {
        fail("Password rotate did not return token");
      }
    }

    const scopedHeaders = {
      authorization: `Bearer ${companyToken}`,
      "x-company-id": String(companyId),
      "content-type": "application/json",
    };

    const post = async (path, body, step) => {
      const res = await smokeFetch(path, {
        method: "POST",
        headers: scopedHeaders,
        body: JSON.stringify(body),
      });
      return expectOk(res, step);
    };

    const patch = async (path, body, step) => {
      const res = await smokeFetch(path, {
        method: "PATCH",
        headers: scopedHeaders,
        body: JSON.stringify(body),
      });
      return expectOk(res, step);
    };

    const get = async (path, step) => {
      const res = await smokeFetch(path, { headers: scopedHeaders });
      return expectOk(res, step);
    };

    await post("/accounts/masters/bootstrap-defaults", {}, "bootstrap defaults");
    await post("/accounts/masters/sync-party-ledgers", {}, "sync party/vendor ledgers");
    const fy = await post(
      "/accounts/masters/financial-years",
      {
        fyCode: `FY${String(stamp).slice(-4)}`,
        fyName: `FY Smoke ${stamp}`,
        startDate: "2026-04-01",
        endDate: "2027-03-31",
      },
      "create smoke financial year"
    );

    await post(
      "/accounts/masters/accounting-periods",
      {
        financialYearId: fy.data.id,
        periodCode: `APR-${String(stamp).slice(-4)}`,
        periodName: `April Smoke ${stamp}`,
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        status: "open",
      },
      "create smoke accounting period"
    );

    const txnDate = "2026-04-15";

    const expGroup = await post(
      "/accounts/masters/account-groups",
      {
        groupCode: `SGE${String(stamp).slice(-4)}`,
        groupName: `Smoke Expense ${stamp}`,
        nature: "expense",
      },
      "create expense group"
    );
    const incGroup = await post(
      "/accounts/masters/account-groups",
      {
        groupCode: `SGI${String(stamp).slice(-4)}`,
        groupName: `Smoke Income ${stamp}`,
        nature: "income",
      },
      "create income group"
    );
    const bankGroup = await post(
      "/accounts/masters/account-groups",
      {
        groupCode: `SGB${String(stamp).slice(-4)}`,
        groupName: `Smoke Bank ${stamp}`,
        nature: "asset",
      },
      "create bank group"
    );

    const expAccount = await post(
      "/accounts/masters/chart-of-accounts",
      {
        accountGroupId: expGroup.data.id,
        accountCode: `SEA${String(stamp).slice(-5)}`,
        accountName: `Smoke Expense Account ${stamp}`,
        accountType: "ledger",
        normalBalance: "debit",
      },
      "create expense account"
    );
    const incAccount = await post(
      "/accounts/masters/chart-of-accounts",
      {
        accountGroupId: incGroup.data.id,
        accountCode: `SIA${String(stamp).slice(-5)}`,
        accountName: `Smoke Income Account ${stamp}`,
        accountType: "ledger",
        normalBalance: "credit",
      },
      "create income account"
    );
    const bankAccountType = await post(
      "/accounts/masters/chart-of-accounts",
      {
        accountGroupId: bankGroup.data.id,
        accountCode: `SBA${String(stamp).slice(-5)}`,
        accountName: `Smoke Bank Account ${stamp}`,
        accountType: "bank",
        normalBalance: "debit",
      },
      "create bank account type"
    );

    const expLedger = await post(
      "/accounts/masters/ledgers",
      {
        accountId: expAccount.data.id,
        ledgerCode: `SEL${String(stamp).slice(-5)}`,
        ledgerName: `Smoke Expense Ledger ${stamp}`,
      },
      "create expense ledger"
    );
    const incLedger = await post(
      "/accounts/masters/ledgers",
      {
        accountId: incAccount.data.id,
        ledgerCode: `SIL${String(stamp).slice(-5)}`,
        ledgerName: `Smoke Income Ledger ${stamp}`,
      },
      "create income ledger"
    );
    const bankLedger = await post(
      "/accounts/masters/ledgers",
      {
        accountId: bankAccountType.data.id,
        ledgerCode: `SBL${String(stamp).slice(-5)}`,
        ledgerName: `Smoke Bank Ledger ${stamp}`,
      },
      "create bank ledger"
    );

    await patch(
      `/accounts/masters/ledgers/${incLedger.data.id}/status`,
      { isActive: false },
      "deactivate income ledger"
    );
    await patch(
      `/accounts/masters/ledgers/${incLedger.data.id}/status`,
      { isActive: true },
      "reactivate income ledger"
    );

    await patch(
      "/accounts/general-ledger/policies",
      {
        allowSubmitterSelfApproval: true,
        allowMakerSelfApproval: true,
        allowApproverSelfPosting: true,
        allowMakerSelfPosting: true,
        lastUpdateNotes: "Smoke policy override for end-to-end validation",
      },
      "update finance policy"
    );

    const glVoucher = await post(
      "/accounts/general-ledger/vouchers",
      {
        voucherType: "journal",
        voucherDate: txnDate,
        narration: "GL smoke voucher",
        lines: [
          {
            accountId: expAccount.data.id,
            ledgerId: expLedger.data.id,
            debit: 1000,
            credit: 0,
            lineNarration: "Smoke expense debit",
          },
          {
            accountId: incAccount.data.id,
            ledgerId: incLedger.data.id,
            debit: 0,
            credit: 1000,
            lineNarration: "Smoke income credit",
          },
        ],
      },
      "create GL voucher"
    );

    const voucherId = glVoucher.data.id;
    await post(`/accounts/general-ledger/vouchers/${voucherId}/submit`, {}, "submit GL voucher");
    await post(`/accounts/general-ledger/vouchers/${voucherId}/approve`, {}, "approve GL voucher");
    await post(`/accounts/general-ledger/vouchers/${voucherId}/post`, {}, "post GL voucher");
    await post(
      `/accounts/general-ledger/vouchers/${voucherId}/reverse`,
      {
        voucherDate: txnDate,
        narration: "GL smoke reverse",
      },
      "reverse GL voucher"
    );

    const bankAccount = await post(
      "/accounts/cash-bank/bank-accounts",
      {
        accountName: `Smoke Current ${stamp}`,
        bankName: "State Bank of India",
        branchName: "Chandrapur",
        accountNumber: `00123456${String(stamp).slice(-4)}`,
        ifscCode: "SBIN0000123",
        ledgerId: bankLedger.data.id,
        isDefault: true,
        isActive: true,
      },
      "create bank account"
    );
    await post(
      "/accounts/cash-bank/vouchers",
      {
        voucherType: "receipt",
        voucherDate: txnDate,
        amount: 500,
        cashOrBankLedgerId: bankLedger.data.id,
        counterAccountId: incAccount.data.id,
        counterLedgerId: incLedger.data.id,
        narration: "Cash-bank smoke receipt",
      },
      "create cash-bank voucher"
    );
    await patch(
      `/accounts/cash-bank/bank-accounts/${bankAccount.data.id}/status`,
      { isActive: true, isDefault: true },
      "bank account status update"
    );

    const vendorRes = await post(
      "/vendors",
      {
        vendorName: `Accounts Smoke Vendor ${stamp}`,
        vendorType: "Transporter",
        contactPerson: "Smoke Vendor Contact",
        mobileNumber: "9876543210",
      },
      "create vendor"
    );
    await post("/accounts/masters/sync-party-ledgers", {}, "resync party/vendor ledgers");

    const payableRes = await post(
      "/accounts/payables",
      {
        vendorId: vendorRes.data.id,
        referenceNumber: `BILL-${stamp}`,
        billDate: txnDate,
        dueDate: txnDate,
        amount: 300,
        notes: "Smoke payable",
      },
      "create payable"
    );
    const payableId = payableRes?.data?.payable?.id || null;
    if (!payableId) {
      fail("Payable response missing payable.id", {
        payableRes,
      });
    }

    await post(
      `/accounts/payables/${payableId}/settle`,
      {
        amount: 300,
        settlementDate: txnDate,
        referenceNumber: `SETTLE-${stamp}`,
      },
      "settle payable"
    );

    const checks = {
      accountGroups: await get("/accounts/masters/account-groups", "list groups"),
      chart: await get("/accounts/masters/chart-of-accounts", "list chart"),
      ledgers: await get("/accounts/masters/ledgers", "list ledgers"),
      vouchers: await get("/accounts/general-ledger/vouchers", "list vouchers"),
      workflowInbox: await get("/accounts/general-ledger/workflow/inbox", "workflow inbox"),
      transitionHistory: await get(
        "/accounts/general-ledger/workflow/history?entityType=voucher&limit=50",
        "transition history"
      ),
      receivables: await get("/accounts/receivables", "list receivables"),
      payables: await get("/accounts/payables", "list payables"),
      cashBank: await get("/accounts/cash-bank/bank-accounts", "list bank accounts"),
      postingRules: await get("/accounts/posting-rules", "list posting rules"),
      trialBalance: await get(
        "/accounts/reports/trial-balance?dateFrom=2026-04-01&dateTo=2026-04-30",
        "trial balance"
      ),
      voucherRegister: await get(
        "/accounts/reports/voucher-register?dateFrom=2026-04-01&dateTo=2026-04-30",
        "voucher register"
      ),
    };

    console.log(
      JSON.stringify(
        {
          success: true,
          companyId,
          ownerUsername: username,
          checks: {
            accountGroupsCount: Array.isArray(checks.accountGroups?.data)
              ? checks.accountGroups.data.length
              : null,
            chartCount: Array.isArray(checks.chart?.data) ? checks.chart.data.length : null,
            ledgersCount: Array.isArray(checks.ledgers?.data) ? checks.ledgers.data.length : null,
            vouchersCount: Number(checks.vouchers?.meta?.total || 0),
            payablesCount: Array.isArray(checks.payables?.data) ? checks.payables.data.length : null,
            bankAccountsCount: Array.isArray(checks.cashBank?.data) ? checks.cashBank.data.length : null,
            postingRulesCount: Array.isArray(checks.postingRules?.data)
              ? checks.postingRules.data.length
              : null,
            trialBalanceRows: Array.isArray(checks.trialBalance?.data?.rows)
              ? checks.trialBalance.data.rows.length
              : null,
            voucherRegisterRows: Array.isArray(checks.voucherRegister?.data)
              ? checks.voucherRegister.data.length
              : null,
          },
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
          reason: "Accounts mini smoke cleanup",
        }),
      });

      if (!cleanupRes.ok) {
        const cleanupBody = await parseJson(cleanupRes);
        fail("Cleanup failed for accounts mini smoke company", {
          companyId,
          status: cleanupRes.status,
          body: cleanupBody,
        });
      }
    }
  }
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message: "Accounts mini smoke crashed",
        details: {
          message: error?.message || String(error),
          details: error?.details || null,
          baseUrlsTried: BASE_URLS,
        },
      },
      null,
      2
    )
  );
  process.exit(1);
});
