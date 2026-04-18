const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'construction_erp_db';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

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

test('getFinancePolicySettings reads company-scoped policy controls', async () => {
  await withMockedModules(
    '../src/modules/general_ledger/general_ledger.service.js',
    [
      [
        '../src/config/db',
        {
          pool: {},
          withTransaction: async (work) => work({}),
        },
      ],
      [
        '../src/modules/general_ledger/general_ledger.model',
        {
          getFinancePolicyControls: async ({ companyId }) => ({
            companyId,
            allowSubmitterSelfApproval: false,
            allowMakerSelfApproval: false,
            allowApproverSelfPosting: false,
            allowMakerSelfPosting: false,
          }),
          updateFinancePolicyControls: async () => null,
          createVoucher: async () => null,
          submitVoucher: async () => null,
          approveVoucher: async () => null,
          rejectVoucher: async () => null,
          postVoucher: async () => null,
          reverseVoucher: async () => null,
          listVouchers: async () => ({ items: [], total: 0, page: 1, limit: 10 }),
          getVoucherById: async () => null,
          getWorkflowInbox: async () => ({ pendingSubmissions: [], approvedForPosting: [], rejectedItems: [], recentActivity: [] }),
          listFinanceTransitionHistory: async () => ({ items: [], total: 0, page: 1, limit: 50 }),
        },
      ],
    ],
    async ({ getFinancePolicySettings }) => {
      const data = await getFinancePolicySettings({ companyId: 15 });
      assert.equal(data.companyId, 15);
      assert.equal(data.allowMakerSelfPosting, false);
    }
  );
});

test('updateFinancePolicySettings writes toggles in transaction', async () => {
  let withTransactionCalled = false;
  let payloadCaptured = null;

  await withMockedModules(
    '../src/modules/general_ledger/general_ledger.service.js',
    [
      [
        '../src/config/db',
        {
          pool: {},
          withTransaction: async (work) => {
            withTransactionCalled = true;
            return work({});
          },
        },
      ],
      [
        '../src/modules/general_ledger/general_ledger.model',
        {
          getFinancePolicyControls: async () => null,
          updateFinancePolicyControls: async (payload) => {
            payloadCaptured = payload;
            return {
              allowSubmitterSelfApproval: payload.allowSubmitterSelfApproval,
              allowMakerSelfApproval: payload.allowMakerSelfApproval,
              allowApproverSelfPosting: payload.allowApproverSelfPosting,
              allowMakerSelfPosting: payload.allowMakerSelfPosting,
            };
          },
          createVoucher: async () => null,
          submitVoucher: async () => null,
          approveVoucher: async () => null,
          rejectVoucher: async () => null,
          postVoucher: async () => null,
          reverseVoucher: async () => null,
          listVouchers: async () => ({ items: [], total: 0, page: 1, limit: 10 }),
          getVoucherById: async () => null,
          getWorkflowInbox: async () => ({ pendingSubmissions: [], approvedForPosting: [], rejectedItems: [], recentActivity: [] }),
          listFinanceTransitionHistory: async () => ({ items: [], total: 0, page: 1, limit: 50 }),
        },
      ],
    ],
    async ({ updateFinancePolicySettings }) => {
      const data = await updateFinancePolicySettings({
        companyId: 9,
        userId: 44,
        allowSubmitterSelfApproval: false,
        allowMakerSelfApproval: true,
        allowApproverSelfPosting: false,
        allowMakerSelfPosting: true,
        lastUpdateNotes: 'controlled exception',
      });

      assert.equal(withTransactionCalled, true);
      assert.equal(payloadCaptured.companyId, 9);
      assert.equal(payloadCaptured.userId, 44);
      assert.equal(data.allowMakerSelfApproval, true);
      assert.equal(data.allowMakerSelfPosting, true);
    }
  );
});
