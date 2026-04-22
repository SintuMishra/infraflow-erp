const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withPurchaseInvoiceServiceMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/purchase_invoices/purchase_invoices.service.js");
  const modelPath = require.resolve("../src/modules/purchase_invoices/purchase_invoices.model.js");
  const payableServicePath = require.resolve("../src/modules/accounts_payable/accounts_payable.service.js");

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    payable: require.cache[payableServicePath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: mocks.model,
  };

  require.cache[payableServicePath] = {
    id: payableServicePath,
    filename: payableServicePath,
    loaded: true,
    exports: mocks.payable,
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originals.service) require.cache[servicePath] = originals.service;
    if (originals.model) require.cache[modelPath] = originals.model;
    else delete require.cache[modelPath];
    if (originals.payable) require.cache[payableServicePath] = originals.payable;
    else delete require.cache[payableServicePath];
  }
};

const baseModelMocks = {
  getInvoiceWithMetrics: async ({ id }) => ({ id, matchStatus: "matched", payableId: 111 }),
  getPoLineSnapshot: async () =>
    new Map([
      [
        1,
        {
          id: 1,
          materialId: 10,
          receivedQuantity: 5,
          unitRate: 100,
        },
      ],
    ]),
  getPostedInvoiceQtyByPoLine: async () => new Map([[1, 0]]),
  getPurchaseInvoiceById: async ({ id }) => ({ id, matchStatus: "matched", payableId: null }),
  insertPurchaseInvoice: async () => 901,
  listPurchaseInvoices: async () => [],
  updateInvoicePosting: async () => 901,
};

test("createInvoice marks blocked and skips payable creation when billed qty exceeds received balance", async () => {
  let insertPayload = null;
  let payableCalled = false;

  await withPurchaseInvoiceServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPostedInvoiceQtyByPoLine: async () => new Map([[1, 4]]),
        insertPurchaseInvoice: async (payload) => {
          insertPayload = payload;
          return 501;
        },
        getInvoiceWithMetrics: async ({ id }) => ({
          id,
          matchStatus: "blocked",
          payableId: null,
          totalAmount: 200,
        }),
      },
      payable: {
        createPayable: async () => {
          payableCalled = true;
          return { payable: { id: 1 } };
        },
      },
    },
    async ({ createInvoice }) => {
      const result = await createInvoice({
        companyId: 1,
        purchaseOrderId: 11,
        vendorId: 22,
        invoiceDate: "2026-04-22",
        dueDate: "2026-04-25",
        lines: [
          {
            purchaseOrderLineId: 1,
            materialId: 10,
            billedQuantity: 2,
            unitRate: 100,
          },
        ],
      });

      assert.equal(result.matchStatus, "blocked");
    }
  );

  assert.equal(insertPayload.matchStatus, "blocked");
  assert.equal(insertPayload.lines[0].matchStatus, "blocked");
  assert.equal(payableCalled, false);
});

test("createInvoice auto-posts matched invoice to payables", async () => {
  let payableInput = null;
  let updatePostingInput = null;

  await withPurchaseInvoiceServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPostedInvoiceQtyByPoLine: async () => new Map([[1, 1]]),
        getPoLineSnapshot: async () =>
          new Map([
            [
              1,
              {
                id: 1,
                materialId: 10,
                receivedQuantity: 5,
                unitRate: 100,
              },
            ],
          ]),
        insertPurchaseInvoice: async () => 601,
        updateInvoicePosting: async (payload) => {
          updatePostingInput = payload;
          return payload.id;
        },
        getInvoiceWithMetrics: async ({ id }) => ({
          id,
          matchStatus: "matched",
          payableId: 8001,
          totalAmount: 200,
        }),
      },
      payable: {
        createPayable: async (payload) => {
          payableInput = payload;
          return { payable: { id: 8001 } };
        },
      },
    },
    async ({ createInvoice }) => {
      const result = await createInvoice({
        companyId: 1,
        purchaseOrderId: 11,
        vendorId: 22,
        invoiceDate: "2026-04-22",
        dueDate: "2026-04-25",
        lines: [
          {
            purchaseOrderLineId: 1,
            materialId: 10,
            billedQuantity: 2,
            unitRate: 100,
          },
        ],
      });

      assert.equal(result.payableId, 8001);
    }
  );

  assert.equal(payableInput.vendorId, 22);
  assert.equal(payableInput.amount, 200);
  assert.equal(updatePostingInput.payableId, 8001);
});

test("postInvoiceToPayables blocks invoices in blocked match status", async () => {
  await withPurchaseInvoiceServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPurchaseInvoiceById: async ({ id }) => ({
          id,
          companyId: 1,
          matchStatus: "blocked",
          payableId: null,
          vendorId: 22,
          invoiceNumber: "PINV-1",
          invoiceDate: "2026-04-22",
          dueDate: "2026-04-25",
          totalAmount: 100,
          mismatchNotes: "qty mismatch",
        }),
      },
      payable: {
        createPayable: async () => ({ payable: { id: 1 } }),
      },
    },
    async ({ postInvoiceToPayables }) => {
      await assert.rejects(
        () =>
          postInvoiceToPayables({
            id: 99,
            companyId: 1,
            userId: 7,
          }),
        /Blocked invoice cannot be posted to payable/i
      );
    }
  );
});
