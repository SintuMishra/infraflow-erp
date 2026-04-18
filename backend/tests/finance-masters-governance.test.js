const test = require('node:test');
const assert = require('node:assert/strict');

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

test('updateLedgerStatus blocks deactivation when posted voucher usage exists', async () => {
  await withMockedModules(
    '../src/modules/accounts_masters/accounts_masters.service.js',
    [
      [
        '../src/config/db',
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (sql) => {
                if (/FROM ledgers/i.test(sql) && /FOR UPDATE/i.test(sql)) {
                  return {
                    rows: [
                      {
                        id: 22,
                        accountId: 11,
                        isActive: true,
                        accountIsActive: true,
                      },
                    ],
                  };
                }

                if (/FROM voucher_lines vl/i.test(sql)) {
                  return { rows: [{ '?column?': 1 }] };
                }

                return { rows: [] };
              },
            }),
        },
      ],
    ],
    async ({ updateLedgerStatus }) => {
      await assert.rejects(
        () => updateLedgerStatus({ companyId: 1, ledgerId: 22, isActive: false }),
        /posted voucher usage/i
      );
    }
  );
});

test('updateAccountingPeriodStatus blocks invalid closed->soft_closed transition', async () => {
  await withMockedModules(
    '../src/modules/accounts_masters/accounts_masters.service.js',
    [
      [
        '../src/config/db',
        {
          pool: { query: async () => ({ rows: [] }) },
          withTransaction: async (work) =>
            work({
              query: async (sql) => {
                if (/FROM accounting_periods/i.test(sql) && /FOR UPDATE/i.test(sql)) {
                  return { rows: [{ id: 15, status: 'closed' }] };
                }
                return { rows: [] };
              },
            }),
        },
      ],
    ],
    async ({ updateAccountingPeriodStatus }) => {
      await assert.rejects(
        () =>
          updateAccountingPeriodStatus({
            companyId: 1,
            periodId: 15,
            status: 'soft_closed',
            userId: 7,
          }),
        /only to open/i
      );
    }
  );
});
