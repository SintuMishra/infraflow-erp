const test = require("node:test");
const assert = require("node:assert/strict");

const withMockedModules = async (serviceRelativePath, mockEntries, run) => {
  const servicePath = require.resolve(serviceRelativePath);
  const originalService = require.cache[servicePath];
  const originals = new Map();

  for (const [dependencyRelativePath, mockExports] of mockEntries) {
    const dependencyPath = require.resolve(dependencyRelativePath);
    originals.set(dependencyPath, require.cache[dependencyPath]);
    require.cache[dependencyPath] = {
      id: dependencyPath,
      filename: dependencyPath,
      loaded: true,
      exports: mockExports,
    };
  }

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originalService) {
      require.cache[servicePath] = originalService;
    }

    for (const [dependencyPath, originalModule] of originals.entries()) {
      if (originalModule) {
        require.cache[dependencyPath] = originalModule;
      } else {
        delete require.cache[dependencyPath];
      }
    }
  }
};

test("markDispatchReadyForFinance updates dispatch state and source link", async () => {
  const capturedUpdates = [];

  await withMockedModules(
    "../src/modules/accounts_receivable/accounts_receivable.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query, params) => {
                capturedUpdates.push({ query, params });

                if (/FROM dispatch_reports/i.test(query) && /FOR UPDATE/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 99,
                        status: "completed",
                        invoiceNumber: "INV-99",
                        invoiceDate: "2026-04-18",
                        totalInvoiceValue: 1000,
                        partyId: 45,
                        financeStatus: "not_ready",
                        canPostToFinance: false,
                        financePostingState: "none",
                      },
                    ],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/modules/general_ledger/general_ledger.model",
        {
          findPostingRule: async () => null,
          createVoucher: async () => null,
          postVoucher: async () => null,
          upsertFinanceSourceLink: async () => ({ id: 501 }),
        },
      ],
    ],
    async ({ markDispatchReadyForFinance }) => {
      const output = await markDispatchReadyForFinance({
        companyId: 1,
        dispatchId: 99,
        financeNotes: "ready-for-ar",
        userId: 7,
      });

      assert.equal(output.id, 99);
      assert.equal(output.financeStatus, "ready");
      assert.equal(output.sourceLinkId, 501);
      assert.equal(
        capturedUpdates.some((entry) => /finance_source_link_id = \$1/i.test(entry.query)),
        true
      );
    }
  );
});

test("createReceivableFromDispatch returns idempotent response when receivable already exists", async () => {
  await withMockedModules(
    "../src/modules/accounts_receivable/accounts_receivable.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query) => {
                if (/FROM dispatch_reports/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 101,
                        companyId: 1,
                        status: "completed",
                        partyId: 45,
                        dispatchDate: "2026-04-18",
                        invoiceNumber: "INV-101",
                        invoiceDate: "2026-04-18",
                        invoiceAmount: 4200,
                        financeStatus: "ready",
                        canPostToFinance: true,
                        financePostingState: "queued",
                        plantId: null,
                        vehicleId: null,
                      },
                    ],
                  };
                }

                if (/FROM party_master/i.test(query)) {
                  return { rows: [{ id: 45 }] };
                }

                if (/FROM receivables/i.test(query) && /dispatch_report_id/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 501,
                        voucherId: 601,
                        amount: 4200,
                        outstandingAmount: 4200,
                        status: "open",
                      },
                    ],
                  };
                }

                if (/FROM vouchers/i.test(query) && /voucher_number/i.test(query)) {
                  return {
                    rows: [{ id: 601, voucherNumber: "SAL-20260418-0001", status: "posted" }],
                  };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/modules/general_ledger/general_ledger.model",
        {
          findPostingRule: async () => null,
          createVoucher: async () => null,
          postVoucher: async () => null,
          upsertFinanceSourceLink: async () => null,
        },
      ],
    ],
    async ({ createReceivableFromDispatch }) => {
      const result = await createReceivableFromDispatch({
        companyId: 1,
        dispatchId: 101,
        dueDate: "2026-04-25",
        userId: 7,
      });

      assert.equal(result.idempotent, true);
      assert.equal(result.receivable.id, 501);
      assert.equal(result.voucher.id, 601);
    }
  );
});

test("createReceivableFromDispatch posts receivable using total invoice value from dispatch", async () => {
  const voucherCalls = [];
  const dispatchUpdates = [];

  await withMockedModules(
    "../src/modules/accounts_receivable/accounts_receivable.service.js",
    [
      [
        "../src/config/db",
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (query, params) => {
                if (/FROM dispatch_reports/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 102,
                        companyId: 1,
                        status: "completed",
                        partyId: 45,
                        dispatchDate: "2026-04-18",
                        invoiceNumber: "INV-102",
                        invoiceDate: "2026-04-18",
                        invoiceAmount: 5678.9,
                        financeStatus: "ready",
                        canPostToFinance: true,
                        financePostingState: "queued",
                        plantId: 11,
                        vehicleId: 22,
                      },
                    ],
                  };
                }

                if (/FROM party_master/i.test(query)) {
                  return { rows: [{ id: 45 }] };
                }

                if (/FROM receivables/i.test(query) && /dispatch_report_id/i.test(query)) {
                  return { rows: [] };
                }

                if (/FROM ledgers/i.test(query)) {
                  if (Array.isArray(params) && Number(params[1]) === 501) {
                    return {
                      rows: [
                        {
                          id: 301,
                          accountId: 501,
                          ledgerName: "Party Receivable Ledger",
                          partyId: 45,
                          vendorId: null,
                        },
                      ],
                    };
                  }

                  if (Array.isArray(params) && Number(params[1]) === 601) {
                    return {
                      rows: [
                        {
                          id: 302,
                          accountId: 601,
                          ledgerName: "Dispatch Revenue Ledger",
                          partyId: null,
                          vendorId: null,
                        },
                      ],
                    };
                  }
                }

                if (/INSERT INTO receivables/i.test(query)) {
                  return {
                    rows: [
                      {
                        id: 701,
                        partyId: 45,
                        dispatchReportId: 102,
                        invoiceNumber: "INV-102",
                        invoiceDate: "2026-04-18",
                        dueDate: "2026-04-25",
                        voucherId: 801,
                        amount: 5678.9,
                        outstandingAmount: 5678.9,
                        status: "open",
                        notes: "unit-aware dispatch",
                      },
                    ],
                  };
                }

                if (/UPDATE dispatch_reports/i.test(query)) {
                  dispatchUpdates.push({ query, params });
                  return { rows: [] };
                }

                return { rows: [] };
              },
            }),
        },
      ],
      [
        "../src/modules/general_ledger/general_ledger.model",
        {
          findPostingRule: async () => ({
            ruleCode: "DISPATCH_TO_RECEIVABLE",
            voucherType: "sales_invoice",
            debitAccountId: 501,
            creditAccountId: 601,
            requiresApproval: false,
          }),
          createVoucher: async (payload) => {
            voucherCalls.push(payload);
            return { id: 801, status: "draft" };
          },
          postVoucher: async () => ({
            id: 801,
            status: "posted",
            voucherNumber: "SAL-20260418-0002",
          }),
          upsertFinanceSourceLink: async () => ({ id: 901 }),
        },
      ],
    ],
    async ({ createReceivableFromDispatch }) => {
      const result = await createReceivableFromDispatch({
        companyId: 1,
        dispatchId: 102,
        dueDate: "2026-04-25",
        notes: "unit-aware dispatch",
        userId: 7,
      });

      assert.equal(result.receivable.id, 701);
      assert.equal(result.receivable.amount, 5678.9);
      assert.equal(voucherCalls.length, 1);
      assert.equal(voucherCalls[0].lines[0].debit, 5678.9);
      assert.equal(voucherCalls[0].lines[1].credit, 5678.9);
      assert.equal(dispatchUpdates.length, 1);
    }
  );
});
