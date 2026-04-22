const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const { pool } = require("../src/config/db");
const {
  bootstrapDefaultAccounts,
  syncPartyAndVendorLedgers,
} = require("../src/modules/accounts_masters/accounts_masters.service");
const { createVendor } = require("../src/modules/vendors/vendors.service");
const { createMaterial } = require("../src/modules/masters/masters.service");
const { createRequest, changeRequestStatus } = require("../src/modules/purchase_requests/purchase_requests.service");
const { createOrder, changeOrderStatus, getOrder } = require("../src/modules/purchase_orders/purchase_orders.service");
const { createReceipt } = require("../src/modules/goods_receipts/goods_receipts.service");
const { createInvoice } = require("../src/modules/purchase_invoices/purchase_invoices.service");
const { settlePayable } = require("../src/modules/accounts_payable/accounts_payable.service");
const { postVoucher } = require("../src/modules/general_ledger/general_ledger.model");

const TEST_DATE = "2026-04-22";
const TEST_DUE_DATE = "2026-04-29";

const makeCode = (prefix) =>
  `${prefix}${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 24);

const ensureProcurementPrerequisites = async (t) => {
  const integrationEnabled = ["1", "true", "yes"].includes(
    String(process.env.PROCUREMENT_DB_INTEGRATION_TESTS || "").trim().toLowerCase()
  );

  if (!integrationEnabled) {
    t.skip("Set PROCUREMENT_DB_INTEGRATION_TESTS=true to run DB procurement integration tests");
    return false;
  }

  let check;
  try {
    check = await pool.query(
      `
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_requests'
        ) AS "hasPurchaseRequests",
        EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders'
        ) AS "hasPurchaseOrders",
        EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'goods_receipts'
        ) AS "hasGoodsReceipts",
        EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_invoices'
        ) AS "hasPurchaseInvoices",
        EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_posting_rules'
        ) AS "hasPostingRules"
      `
    );
  } catch (error) {
    t.skip(`DB integration is not reachable in this environment (${error.code || "unknown"})`);
    return false;
  }

  if (
    !check.rows[0]?.hasPurchaseRequests ||
    !check.rows[0]?.hasPurchaseOrders ||
    !check.rows[0]?.hasGoodsReceipts ||
    !check.rows[0]?.hasPurchaseInvoices ||
    !check.rows[0]?.hasPostingRules
  ) {
    t.skip("Required procurement/accounting migrations are not applied in local DB");
    return false;
  }

  return true;
};

const createCompanyFixture = async () => {
  const code = makeCode("PRC");
  const companyResult = await pool.query(
    `
    INSERT INTO companies (company_code, company_name, is_active)
    VALUES ($1, $2, TRUE)
    RETURNING id
    `,
    [code, `Procurement Test ${code}`]
  );

  const companyId = companyResult.rows[0].id;

  await bootstrapDefaultAccounts({ companyId, userId: 1 });

  const yearResult = await pool.query(
    `
    INSERT INTO financial_years (company_id, fy_code, fy_name, start_date, end_date, is_closed, is_active)
    VALUES ($1, $2, $3, DATE '2026-04-01', DATE '2027-03-31', FALSE, TRUE)
    RETURNING id
    `,
    [companyId, makeCode("FY"), `FY ${code}`]
  );

  await pool.query(
    `
    INSERT INTO accounting_periods (
      company_id,
      financial_year_id,
      period_code,
      period_name,
      period_start,
      period_end,
      status
    )
    VALUES ($1, $2, $3, $4, DATE '2026-04-01', DATE '2027-03-31', 'open')
    `,
    [companyId, yearResult.rows[0].id, makeCode("PER"), `Period ${code}`]
  );

  const vendor = await createVendor({
    companyId,
    vendorName: `Vendor ${code}`,
    vendorType: "supplier",
    contactPerson: "Test Vendor",
    mobileNumber: "9999999999",
    address: "Test Address",
  });

  const material = await createMaterial({
    companyId,
    materialName: `Material ${code}`,
    materialCode: `MAT-${code}`,
    category: "aggregate",
    unit: "tons",
    gstRate: 5,
  });

  await syncPartyAndVendorLedgers({ companyId });

  return {
    companyId,
    vendorId: vendor.id,
    materialId: material.id,
  };
};

const resolveWorkflowActors = async (t) => {
  const usersResult = await pool.query(
    `
    SELECT id
    FROM users
    ORDER BY id ASC
    LIMIT 2
    `
  );

  if (usersResult.rows.length < 2) {
    t.skip("Need at least 2 users for maker-checker integration flow");
    return null;
  }

  return {
    makerUserId: Number(usersResult.rows[0].id),
    posterUserId: Number(usersResult.rows[1].id),
  };
};

test("integration: PR -> PO -> GRN -> Invoice -> AP -> Settlement full chain succeeds", async (t) => {
  if (!(await ensureProcurementPrerequisites(t))) {
    return;
  }

  const actors = await resolveWorkflowActors(t);
  if (!actors) {
    return;
  }

  const { makerUserId, posterUserId } = actors;
  const fx = await createCompanyFixture();

  const purchaseRequest = await createRequest({
    companyId: fx.companyId,
    requestDate: TEST_DATE,
    requiredByDate: TEST_DUE_DATE,
    vendorId: fx.vendorId,
    notes: "Integration PR",
    lines: [
      {
        materialId: fx.materialId,
        quantity: 10,
        unitRate: 100,
        description: "Material demand",
      },
    ],
    userId: makerUserId,
  });

  const prSubmitted = await changeRequestStatus({
    id: purchaseRequest.id,
    companyId: fx.companyId,
    status: "submitted",
    userId: makerUserId,
  });
  const prApproved = await changeRequestStatus({
    id: purchaseRequest.id,
    companyId: fx.companyId,
    status: "approved",
    userId: posterUserId,
  });

  assert.equal(prSubmitted.status, "submitted");
  assert.equal(prApproved.status, "approved");

  const requestLine = purchaseRequest.lines[0];

  const purchaseOrder = await createOrder({
    companyId: fx.companyId,
    purchaseRequestId: purchaseRequest.id,
    poDate: TEST_DATE,
    expectedDeliveryDate: TEST_DUE_DATE,
    vendorId: fx.vendorId,
    notes: "Integration PO",
    lines: [
      {
        purchaseRequestLineId: requestLine.id,
        materialId: fx.materialId,
        orderedQuantity: 10,
        unitRate: 100,
        description: "PO line",
      },
    ],
    userId: makerUserId,
  });

  await changeOrderStatus({
    id: purchaseOrder.id,
    companyId: fx.companyId,
    status: "submitted",
    userId: makerUserId,
  });
  await changeOrderStatus({
    id: purchaseOrder.id,
    companyId: fx.companyId,
    status: "approved",
    userId: posterUserId,
  });

  const approvedOrder = await getOrder({ id: purchaseOrder.id, companyId: fx.companyId });
  const poLine = approvedOrder.lines[0];

  const goodsReceipt = await createReceipt({
    companyId: fx.companyId,
    purchaseOrderId: approvedOrder.id,
    vendorId: fx.vendorId,
    receiptDate: TEST_DATE,
    notes: "Integration GRN",
    lines: [
      {
        purchaseOrderLineId: poLine.id,
        materialId: fx.materialId,
        receivedQuantity: 10,
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        unitRate: 100,
        remarks: "full receipt",
      },
    ],
    userId: makerUserId,
  });

  assert.equal(goodsReceipt.lines.length, 1);

  const orderAfterReceipt = await getOrder({ id: purchaseOrder.id, companyId: fx.companyId });
  assert.equal(orderAfterReceipt.status, "closed");
  assert.equal(Number(orderAfterReceipt.lines[0].receivedQuantity), 10);

  const purchaseInvoice = await createInvoice({
    companyId: fx.companyId,
    purchaseOrderId: purchaseOrder.id,
    goodsReceiptId: goodsReceipt.id,
    vendorId: fx.vendorId,
    invoiceDate: TEST_DATE,
    dueDate: TEST_DUE_DATE,
    notes: "Integration invoice",
    lines: [
      {
        purchaseOrderLineId: poLine.id,
        goodsReceiptLineId: goodsReceipt.lines[0].id,
        materialId: fx.materialId,
        billedQuantity: 10,
        unitRate: 100,
      },
    ],
    postToPayables: true,
    userId: makerUserId,
  });

  assert.equal(purchaseInvoice.matchStatus, "matched");
  assert.equal(Number(purchaseInvoice.totalAmount), 1000);
  assert.equal(Boolean(purchaseInvoice.payableId), true);

  const payableResult = await pool.query(
    `
    SELECT
      id,
      voucher_id AS "voucherId",
      outstanding_amount AS "outstandingAmount",
      status
    FROM payables
    WHERE id = $1
      AND company_id = $2
    LIMIT 1
    `,
    [purchaseInvoice.payableId, fx.companyId]
  );

  assert.equal(Boolean(payableResult.rows[0]?.id), true);
  assert.equal(Number(payableResult.rows[0].outstandingAmount), 1000);
  assert.equal(payableResult.rows[0].status, "open");
  assert.equal(Boolean(payableResult.rows[0].voucherId), true);

  await postVoucher({
    voucherId: payableResult.rows[0].voucherId,
    companyId: fx.companyId,
    postedByUserId: posterUserId,
  });

  const settlement = await settlePayable({
    companyId: fx.companyId,
    payableId: purchaseInvoice.payableId,
    amount: 1000,
    settlementDate: TEST_DATE,
    referenceNumber: `PAY-${makeCode("SET")}`,
    notes: "Integration settlement",
    userId: posterUserId,
  });

  assert.equal(settlement.payableStatus, "settled");
  assert.equal(Number(settlement.outstandingAmount), 0);

  const settlementCountResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM settlements
    WHERE company_id = $1
      AND source_document_type = 'payable'
      AND source_document_id = $2
    `,
    [fx.companyId, purchaseInvoice.payableId]
  );

  assert.equal(Number(settlementCountResult.rows[0].total), 1);
});

test("integration: blocked invoice does not create payable when billed qty exceeds received", async (t) => {
  if (!(await ensureProcurementPrerequisites(t))) {
    return;
  }

  const actors = await resolveWorkflowActors(t);
  if (!actors) {
    return;
  }

  const { makerUserId, posterUserId } = actors;
  const fx = await createCompanyFixture();

  const purchaseOrder = await createOrder({
    companyId: fx.companyId,
    poDate: TEST_DATE,
    expectedDeliveryDate: TEST_DUE_DATE,
    vendorId: fx.vendorId,
    notes: "Blocked invoice setup",
    lines: [
      {
        materialId: fx.materialId,
        orderedQuantity: 10,
        unitRate: 100,
        description: "PO line",
      },
    ],
    userId: makerUserId,
  });

  await changeOrderStatus({
    id: purchaseOrder.id,
    companyId: fx.companyId,
    status: "approved",
    userId: posterUserId,
  });

  const orderBeforeReceipt = await getOrder({ id: purchaseOrder.id, companyId: fx.companyId });
  const poLine = orderBeforeReceipt.lines[0];

  await createReceipt({
    companyId: fx.companyId,
    purchaseOrderId: purchaseOrder.id,
    vendorId: fx.vendorId,
    receiptDate: TEST_DATE,
    notes: "Partial receipt",
    lines: [
      {
        purchaseOrderLineId: poLine.id,
        materialId: fx.materialId,
        receivedQuantity: 5,
        acceptedQuantity: 5,
        rejectedQuantity: 0,
        unitRate: 100,
      },
    ],
    userId: makerUserId,
  });

  const blockedInvoice = await createInvoice({
    companyId: fx.companyId,
    purchaseOrderId: purchaseOrder.id,
    vendorId: fx.vendorId,
    invoiceDate: TEST_DATE,
    dueDate: TEST_DUE_DATE,
    notes: "Should block",
    lines: [
      {
        purchaseOrderLineId: poLine.id,
        materialId: fx.materialId,
        billedQuantity: 6,
        unitRate: 100,
      },
    ],
    postToPayables: true,
    userId: makerUserId,
  });

  assert.equal(blockedInvoice.matchStatus, "blocked");
  assert.equal(blockedInvoice.payableId, null);
});
