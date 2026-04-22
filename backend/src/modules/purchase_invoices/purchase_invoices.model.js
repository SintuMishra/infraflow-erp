const { pool, withTransaction } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const buildSchemaMissingError = () => {
  const error = new Error("Procurement invoice schema is not available. Run migrations to enable purchase invoices.");
  error.statusCode = 503;
  error.code = "PROCUREMENT_INVOICE_SCHEMA_MISSING";
  return error;
};

const ensureSchema = async () => {
  if (!(await tableExists("purchase_invoices"))) {
    throw buildSchemaMissingError();
  }
};

const mapHeader = (row) => ({
  id: row.id,
  companyId: row.companyId,
  invoiceNumber: row.invoiceNumber,
  purchaseOrderId: row.purchaseOrderId,
  poNumber: row.poNumber,
  goodsReceiptId: row.goodsReceiptId,
  grnNumber: row.grnNumber,
  vendorId: row.vendorId,
  vendorName: row.vendorName,
  payableId: row.payableId,
  invoiceDate: row.invoiceDate,
  dueDate: row.dueDate,
  status: row.status,
  matchStatus: row.matchStatus,
  mismatchNotes: row.mismatchNotes,
  totalAmount: Number(row.totalAmount || 0),
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listPurchaseInvoices = async ({ companyId, status = null, matchStatus = null }) => {
  await ensureSchema();
  const values = [companyId];
  let whereClause = "WHERE pi.company_id = $1";

  if (status) {
    values.push(status);
    whereClause += ` AND pi.status = $${values.length}`;
  }

  if (matchStatus) {
    values.push(matchStatus);
    whereClause += ` AND pi.match_status = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        pi.id,
        pi.company_id AS "companyId",
        pi.invoice_number AS "invoiceNumber",
        pi.purchase_order_id AS "purchaseOrderId",
        po.po_number AS "poNumber",
        pi.goods_receipt_id AS "goodsReceiptId",
        gr.grn_number AS "grnNumber",
        pi.vendor_id AS "vendorId",
        vm.vendor_name AS "vendorName",
        pi.payable_id AS "payableId",
        pi.invoice_date AS "invoiceDate",
        pi.due_date AS "dueDate",
        pi.status,
        pi.match_status AS "matchStatus",
        pi.mismatch_notes AS "mismatchNotes",
        pi.total_amount AS "totalAmount",
        pi.created_by_user_id AS "createdByUserId",
        pi.created_at AS "createdAt",
        pi.updated_at AS "updatedAt"
      FROM purchase_invoices pi
      INNER JOIN purchase_orders po ON po.id = pi.purchase_order_id
      LEFT JOIN goods_receipts gr ON gr.id = pi.goods_receipt_id
      LEFT JOIN vendor_master vm ON vm.id = pi.vendor_id
      ${whereClause}
      ORDER BY pi.invoice_date DESC, pi.id DESC
    `,
    values
  );

  return result.rows.map(mapHeader);
};

const getInvoiceLines = async ({ purchaseInvoiceId, companyId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        pil.id,
        pil.purchase_invoice_id AS "purchaseInvoiceId",
        pil.purchase_order_line_id AS "purchaseOrderLineId",
        pil.goods_receipt_line_id AS "goodsReceiptLineId",
        pil.line_number AS "lineNumber",
        pil.material_id AS "materialId",
        pil.item_category AS "itemCategory",
        mm.material_name AS "materialName",
        pil.billed_quantity AS "billedQuantity",
        pil.unit_rate AS "unitRate",
        pil.line_amount AS "lineAmount",
        pil.match_status AS "matchStatus",
        pil.variance_qty AS "varianceQty",
        pil.variance_rate AS "varianceRate",
        pil.variance_amount AS "varianceAmount",
        pil.remarks
      FROM purchase_invoice_lines pil
      LEFT JOIN material_master mm ON mm.id = pil.material_id
      WHERE pil.purchase_invoice_id = $1
        AND pil.company_id = $2
      ORDER BY pil.line_number ASC
    `,
    [purchaseInvoiceId, companyId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    purchaseInvoiceId: row.purchaseInvoiceId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    goodsReceiptLineId: row.goodsReceiptLineId,
    lineNumber: Number(row.lineNumber),
    materialId: Number(row.materialId),
    itemCategory: row.itemCategory || "material",
    materialName: row.materialName,
    billedQuantity: Number(row.billedQuantity || 0),
    unitRate: Number(row.unitRate || 0),
    lineAmount: Number(row.lineAmount || 0),
    matchStatus: row.matchStatus,
    varianceQty: Number(row.varianceQty || 0),
    varianceRate: Number(row.varianceRate || 0),
    varianceAmount: Number(row.varianceAmount || 0),
    remarks: row.remarks,
  }));
};

const getPurchaseInvoiceById = async ({ id, companyId }) => {
  await ensureSchema();
  const result = await pool.query(
    `
      SELECT
        pi.id,
        pi.company_id AS "companyId",
        pi.invoice_number AS "invoiceNumber",
        pi.purchase_order_id AS "purchaseOrderId",
        po.po_number AS "poNumber",
        pi.goods_receipt_id AS "goodsReceiptId",
        gr.grn_number AS "grnNumber",
        pi.vendor_id AS "vendorId",
        vm.vendor_name AS "vendorName",
        pi.payable_id AS "payableId",
        pi.invoice_date AS "invoiceDate",
        pi.due_date AS "dueDate",
        pi.status,
        pi.match_status AS "matchStatus",
        pi.mismatch_notes AS "mismatchNotes",
        pi.total_amount AS "totalAmount",
        pi.created_by_user_id AS "createdByUserId",
        pi.created_at AS "createdAt",
        pi.updated_at AS "updatedAt"
      FROM purchase_invoices pi
      INNER JOIN purchase_orders po ON po.id = pi.purchase_order_id
      LEFT JOIN goods_receipts gr ON gr.id = pi.goods_receipt_id
      LEFT JOIN vendor_master vm ON vm.id = pi.vendor_id
      WHERE pi.id = $1
        AND pi.company_id = $2
      LIMIT 1
    `,
    [id, companyId]
  );

  const row = result.rows[0] || null;
  if (!row) {
    return null;
  }

  const lines = await getInvoiceLines({ purchaseInvoiceId: row.id, companyId }, pool);
  return {
    ...mapHeader(row),
    lines,
  };
};

const getInvoiceWithMetrics = async ({ id, companyId }) => {
  await ensureSchema();
  const invoice = await getPurchaseInvoiceById({ id, companyId });
  if (!invoice) {
    return null;
  }

  const metricsResult = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE pil.match_status = 'matched') AS "matchedLines",
        COUNT(*) FILTER (WHERE pil.match_status = 'variance') AS "varianceLines",
        COUNT(*) FILTER (WHERE pil.match_status = 'blocked') AS "blockedLines",
        COUNT(*) AS "totalLines"
      FROM purchase_invoice_lines pil
      WHERE pil.purchase_invoice_id = $1
        AND pil.company_id = $2
    `,
    [id, companyId]
  );

  const metrics = metricsResult.rows[0] || {};
  return {
    ...invoice,
    matchMetrics: {
      matchedLines: Number(metrics.matchedLines || 0),
      varianceLines: Number(metrics.varianceLines || 0),
      blockedLines: Number(metrics.blockedLines || 0),
      totalLines: Number(metrics.totalLines || 0),
    },
  };
};

const insertPurchaseInvoice = async ({
  companyId,
  invoiceNumber,
  purchaseOrderId,
  goodsReceiptId,
  vendorId,
  invoiceDate,
  dueDate,
  status,
  matchStatus,
  mismatchNotes,
  totalAmount,
  lines,
  userId,
}) => {
  await ensureSchema();

  return withTransaction(async (db) => {
    const poResult = await db.query(
      `
        SELECT id, vendor_id AS "vendorId", status
        FROM purchase_orders
        WHERE id = $1
          AND company_id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [purchaseOrderId, companyId]
    );

    const po = poResult.rows[0] || null;
    if (!po) {
      const error = new Error("Purchase order not found");
      error.statusCode = 404;
      throw error;
    }

    if (Number(po.vendorId) !== Number(vendorId)) {
      const error = new Error("Vendor does not match purchase order vendor");
      error.statusCode = 400;
      throw error;
    }

    if (goodsReceiptId) {
      const grnResult = await db.query(
        `
          SELECT id
          FROM goods_receipts
          WHERE id = $1
            AND company_id = $2
            AND purchase_order_id = $3
            AND vendor_id = $4
          LIMIT 1
        `,
        [goodsReceiptId, companyId, purchaseOrderId, vendorId]
      );
      if (!grnResult.rows[0]?.id) {
        const error = new Error("goodsReceiptId is not valid for this purchase order/vendor");
        error.statusCode = 400;
        throw error;
      }
    }

    const headerResult = await db.query(
      `
        INSERT INTO purchase_invoices (
          company_id,
          invoice_number,
          purchase_order_id,
          goods_receipt_id,
          vendor_id,
          invoice_date,
          due_date,
          status,
          match_status,
          mismatch_notes,
          total_amount,
          created_by_user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
      `,
      [
        companyId,
        invoiceNumber,
        purchaseOrderId,
        goodsReceiptId || null,
        vendorId,
        invoiceDate,
        dueDate,
        status,
        matchStatus,
        mismatchNotes || null,
        totalAmount,
        userId || null,
      ]
    );

    const invoiceId = headerResult.rows[0].id;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      await db.query(
        `
          INSERT INTO purchase_invoice_lines (
            company_id,
            purchase_invoice_id,
            purchase_order_line_id,
            goods_receipt_line_id,
            line_number,
            material_id,
            item_category,
            billed_quantity,
            unit_rate,
            line_amount,
            match_status,
            variance_qty,
            variance_rate,
            variance_amount,
            remarks
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          companyId,
          invoiceId,
          Number(line.purchaseOrderLineId),
          line.goodsReceiptLineId || null,
          index + 1,
          Number(line.materialId),
          line.itemCategory || "material",
          Number(line.billedQuantity),
          Number(line.unitRate),
          Number(line.lineAmount),
          line.matchStatus,
          Number(line.varianceQty || 0),
          Number(line.varianceRate || 0),
          Number(line.varianceAmount || 0),
          line.remarks || null,
        ]
      );
    }

    return invoiceId;
  });
};

const updateInvoicePosting = async ({ id, companyId, payableId }) => {
  await ensureSchema();
  const result = await pool.query(
    `
      UPDATE purchase_invoices
      SET
        payable_id = $1,
        status = 'posted',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND company_id = $3
      RETURNING id
    `,
    [payableId, id, companyId]
  );

  return result.rows[0]?.id || null;
};

const getPostedInvoiceQtyByPoLine = async ({ companyId, purchaseOrderId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        pil.purchase_order_line_id AS "purchaseOrderLineId",
        COALESCE(SUM(pil.billed_quantity), 0) AS "invoicedQty"
      FROM purchase_invoice_lines pil
      INNER JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      WHERE pi.company_id = $1
        AND pi.purchase_order_id = $2
        AND pi.status <> 'cancelled'
      GROUP BY pil.purchase_order_line_id
    `,
    [companyId, purchaseOrderId]
  );

  return new Map(
    result.rows.map((row) => [Number(row.purchaseOrderLineId), Number(row.invoicedQty || 0)])
  );
};

const getPoLineSnapshot = async ({ companyId, purchaseOrderId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        pol.id,
        pol.material_id AS "materialId",
        pol.ordered_quantity AS "orderedQuantity",
        pol.received_quantity AS "receivedQuantity",
        pol.unit_rate AS "unitRate"
      FROM purchase_order_lines pol
      WHERE pol.company_id = $1
        AND pol.purchase_order_id = $2
    `,
    [companyId, purchaseOrderId]
  );

  return new Map(result.rows.map((row) => [Number(row.id), row]));
};

module.exports = {
  getInvoiceWithMetrics,
  getPoLineSnapshot,
  getPostedInvoiceQtyByPoLine,
  getPurchaseInvoiceById,
  insertPurchaseInvoice,
  listPurchaseInvoices,
  updateInvoicePosting,
};
