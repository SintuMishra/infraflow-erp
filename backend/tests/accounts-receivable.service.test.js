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
          pool: {
            query: async (query, params) => {
              capturedUpdates.push({ query, params });
              if (/UPDATE dispatch_reports\s+SET\s+can_post_to_finance = TRUE/i.test(query)) {
                return {
                  rows: [
                    {
                      id: 99,
                      invoiceNumber: "INV-99",
                      invoiceDate: "2026-04-18",
                      totalInvoiceValue: 1000,
                      partyId: 45,
                      financeStatus: "ready",
                      canPostToFinance: true,
                      financePostingState: "queued",
                    },
                  ],
                };
              }

              return { rows: [] };
            },
          },
          withTransaction: async (work) => work({ query: async () => ({ rows: [] }) }),
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
