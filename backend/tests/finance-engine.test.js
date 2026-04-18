const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const { ensureVoucherBalanced } = require("../src/modules/general_ledger/general_ledger.model");

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

test("ensureVoucherBalanced validates balanced debit/credit totals", () => {
  const totals = ensureVoucherBalanced([
    { accountId: 1, ledgerId: 10, debit: 1200, credit: 0 },
    { accountId: 2, ledgerId: 20, debit: 0, credit: 1200 },
  ]);

  assert.equal(totals.totalDebit, 1200);
  assert.equal(totals.totalCredit, 1200);
});

test("ensureVoucherBalanced rejects unbalanced entries", () => {
  assert.throws(
    () =>
      ensureVoucherBalanced([
        { accountId: 1, ledgerId: 10, debit: 1250, credit: 0 },
        { accountId: 2, ledgerId: 20, debit: 0, credit: 1200 },
      ]),
    /unbalanced/i
  );
});

test("createVoucherEntry autoPost posts created draft voucher", async () => {
  let createCalled = false;
  let postCalled = false;

  await withMockedModules(
    "../src/modules/general_ledger/general_ledger.service.js",
    [
      [
        "../src/config/db",
        {
          pool: {},
          withTransaction: async (work) => work({}),
        },
      ],
      [
        "../src/modules/general_ledger/general_ledger.model",
        {
          createVoucher: async () => {
            createCalled = true;
            return { id: 55, voucherNumber: "JOU-20260418-0001", status: "draft" };
          },
          postVoucher: async () => {
            postCalled = true;
            return { id: 55, voucherNumber: "JOU-20260418-0001", status: "posted" };
          },
          listVouchers: async () => ({ items: [], total: 0, page: 1, limit: 10 }),
          getVoucherById: async () => null,
          reverseVoucher: async () => null,
        },
      ],
    ],
    async ({ createVoucherEntry }) => {
      const result = await createVoucherEntry({
        companyId: 1,
        voucherType: "journal",
        voucherDate: "2026-04-18",
        lines: [
          { accountId: 1, ledgerId: 11, debit: 500, credit: 0 },
          { accountId: 2, ledgerId: 22, debit: 0, credit: 500 },
        ],
        autoPost: true,
      });

      assert.equal(createCalled, true);
      assert.equal(postCalled, true);
      assert.equal(result.status, "posted");
    }
  );
});
