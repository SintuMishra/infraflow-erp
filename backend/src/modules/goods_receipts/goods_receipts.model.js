const { pool, withTransaction } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const buildSchemaMissingError = () => {
  const error = new Error("Procurement GRN schema is not available. Run migrations to enable goods receipts.");
  error.statusCode = 503;
  error.code = "PROCUREMENT_GRN_SCHEMA_MISSING";
  return error;
};

const ensureSchema = async () => {
  if (!(await tableExists("goods_receipts"))) {
    throw buildSchemaMissingError();
  }
};

const mapHeader = (row) => ({
  id: row.id,
  companyId: row.companyId,
  grnNumber: row.grnNumber,
  purchaseOrderId: row.purchaseOrderId,
  poNumber: row.poNumber,
  vendorId: row.vendorId,
  vendorName: row.vendorName,
  receiptDate: row.receiptDate,
  status: row.status,
  notes: row.notes,
  receivedByUserId: row.receivedByUserId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listGoodsReceipts = async ({ companyId, status = null }) => {
  await ensureSchema();
  const values = [companyId];
  let whereClause = "WHERE gr.company_id = $1";

  if (status) {
    values.push(status);
    whereClause += ` AND gr.status = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        gr.id,
        gr.company_id AS "companyId",
        gr.grn_number AS "grnNumber",
        gr.purchase_order_id AS "purchaseOrderId",
        po.po_number AS "poNumber",
        gr.vendor_id AS "vendorId",
        vm.vendor_name AS "vendorName",
        gr.receipt_date AS "receiptDate",
        gr.status,
        gr.notes,
        gr.received_by_user_id AS "receivedByUserId",
        gr.created_at AS "createdAt",
        gr.updated_at AS "updatedAt"
      FROM goods_receipts gr
      INNER JOIN purchase_orders po ON po.id = gr.purchase_order_id
      LEFT JOIN vendor_master vm ON vm.id = gr.vendor_id
      ${whereClause}
      ORDER BY gr.receipt_date DESC, gr.id DESC
    `,
    values
  );

  return result.rows.map(mapHeader);
};

const getGoodsReceiptLines = async ({ goodsReceiptId, companyId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        grl.id,
        grl.goods_receipt_id AS "goodsReceiptId",
        grl.purchase_order_line_id AS "purchaseOrderLineId",
        grl.line_number AS "lineNumber",
        grl.material_id AS "materialId",
        grl.item_category AS "itemCategory",
        mm.material_name AS "materialName",
        grl.received_quantity AS "receivedQuantity",
        grl.accepted_quantity AS "acceptedQuantity",
        grl.rejected_quantity AS "rejectedQuantity",
        grl.unit_rate AS "unitRate",
        grl.line_amount AS "lineAmount",
        grl.remarks
      FROM goods_receipt_lines grl
      LEFT JOIN material_master mm ON mm.id = grl.material_id
      WHERE grl.goods_receipt_id = $1
        AND grl.company_id = $2
      ORDER BY grl.line_number ASC
    `,
    [goodsReceiptId, companyId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    goodsReceiptId: row.goodsReceiptId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    lineNumber: Number(row.lineNumber),
    materialId: Number(row.materialId),
    itemCategory: row.itemCategory || "material",
    materialName: row.materialName,
    receivedQuantity: Number(row.receivedQuantity || 0),
    acceptedQuantity: Number(row.acceptedQuantity || 0),
    rejectedQuantity: Number(row.rejectedQuantity || 0),
    unitRate: Number(row.unitRate || 0),
    lineAmount: Number(row.lineAmount || 0),
    remarks: row.remarks,
  }));
};

const getGoodsReceiptById = async ({ id, companyId }) => {
  await ensureSchema();
  const result = await pool.query(
    `
      SELECT
        gr.id,
        gr.company_id AS "companyId",
        gr.grn_number AS "grnNumber",
        gr.purchase_order_id AS "purchaseOrderId",
        po.po_number AS "poNumber",
        gr.vendor_id AS "vendorId",
        vm.vendor_name AS "vendorName",
        gr.receipt_date AS "receiptDate",
        gr.status,
        gr.notes,
        gr.received_by_user_id AS "receivedByUserId",
        gr.created_at AS "createdAt",
        gr.updated_at AS "updatedAt"
      FROM goods_receipts gr
      INNER JOIN purchase_orders po ON po.id = gr.purchase_order_id
      LEFT JOIN vendor_master vm ON vm.id = gr.vendor_id
      WHERE gr.id = $1
        AND gr.company_id = $2
      LIMIT 1
    `,
    [id, companyId]
  );

  const row = result.rows[0] || null;
  if (!row) {
    return null;
  }

  const lines = await getGoodsReceiptLines({ goodsReceiptId: row.id, companyId }, pool);
  return {
    ...mapHeader(row),
    lines,
  };
};

const insertGoodsReceipt = async ({
  companyId,
  grnNumber,
  purchaseOrderId,
  vendorId,
  receiptDate,
  notes,
  lines,
  userId,
}) => {
  await ensureSchema();

  return withTransaction(async (db) => {
    const poResult = await db.query(
      `
        SELECT
          po.id,
          po.vendor_id AS "vendorId",
          po.status
        FROM purchase_orders po
        WHERE po.id = $1
          AND po.company_id = $2
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

    const poStatus = String(po.status || "").toLowerCase();
    if (!["approved", "partially_received"].includes(poStatus)) {
      const error = new Error("Only approved or partially received purchase orders can be received");
      error.statusCode = 409;
      throw error;
    }

    if (Number(po.vendorId) !== Number(vendorId)) {
      const error = new Error("Vendor does not match purchase order vendor");
      error.statusCode = 400;
      throw error;
    }

    const poLinesResult = await db.query(
      `
        SELECT
          pol.id,
          pol.material_id AS "materialId",
          pol.ordered_quantity AS "orderedQuantity",
          pol.received_quantity AS "receivedQuantity",
          pol.unit_rate AS "unitRate"
        FROM purchase_order_lines pol
        WHERE pol.purchase_order_id = $1
          AND pol.company_id = $2
        FOR UPDATE
      `,
      [purchaseOrderId, companyId]
    );

    const poLineMap = new Map(poLinesResult.rows.map((row) => [Number(row.id), row]));

    const headerResult = await db.query(
      `
        INSERT INTO goods_receipts (
          company_id,
          grn_number,
          purchase_order_id,
          vendor_id,
          receipt_date,
          status,
          notes,
          received_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, 'received', $6, $7)
        RETURNING id
      `,
      [
        companyId,
        grnNumber,
        purchaseOrderId,
        vendorId,
        receiptDate,
        notes || null,
        userId || null,
      ]
    );

    const grnId = headerResult.rows[0].id;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const poLine = poLineMap.get(Number(line.purchaseOrderLineId));

      if (!poLine) {
        const error = new Error(`purchaseOrderLineId ${line.purchaseOrderLineId} is not valid for this PO`);
        error.statusCode = 400;
        throw error;
      }

      if (Number(poLine.materialId) !== Number(line.materialId)) {
        const error = new Error(`materialId mismatch for purchaseOrderLineId ${line.purchaseOrderLineId}`);
        error.statusCode = 400;
        throw error;
      }

      const remainingQty = Number(poLine.orderedQuantity || 0) - Number(poLine.receivedQuantity || 0);
      if (Number(line.acceptedQuantity || 0) > remainingQty + 0.00001) {
        const error = new Error(`acceptedQuantity exceeds pending quantity for PO line ${line.purchaseOrderLineId}`);
        error.statusCode = 400;
        throw error;
      }

      await db.query(
        `
          INSERT INTO goods_receipt_lines (
            company_id,
            goods_receipt_id,
            purchase_order_line_id,
            line_number,
            material_id,
            item_category,
            received_quantity,
            accepted_quantity,
            rejected_quantity,
            unit_rate,
            line_amount,
            remarks
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `,
        [
          companyId,
          grnId,
          Number(line.purchaseOrderLineId),
          index + 1,
          Number(line.materialId),
          line.itemCategory || "material",
          Number(line.receivedQuantity),
          Number(line.acceptedQuantity),
          Number(line.rejectedQuantity || 0),
          Number(line.unitRate || poLine.unitRate || 0),
          Number(line.lineAmount || 0),
          line.remarks || null,
        ]
      );

      await db.query(
        `
          UPDATE purchase_order_lines
          SET
            received_quantity = received_quantity + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND company_id = $3
        `,
        [Number(line.acceptedQuantity), Number(line.purchaseOrderLineId), companyId]
      );
    }

    const completionResult = await db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE received_quantity >= ordered_quantity) AS "fullyReceived",
          COUNT(*) FILTER (WHERE received_quantity > 0) AS "anyReceived",
          COUNT(*) AS "totalLines"
        FROM purchase_order_lines
        WHERE purchase_order_id = $1
          AND company_id = $2
      `,
      [purchaseOrderId, companyId]
    );

    const completion = completionResult.rows[0] || null;
    const fullyReceived = Number(completion?.fullyReceived || 0);
    const anyReceived = Number(completion?.anyReceived || 0);
    const totalLines = Number(completion?.totalLines || 0);

    let nextPoStatus = poStatus;
    if (totalLines > 0 && fullyReceived === totalLines) {
      nextPoStatus = "closed";
    } else if (anyReceived > 0) {
      nextPoStatus = "partially_received";
    }

    if (nextPoStatus !== poStatus) {
      await db.query(
        `
          UPDATE purchase_orders
          SET
            status = CAST($1 AS VARCHAR(32)),
            closed_at = CASE WHEN CAST($1 AS VARCHAR(32)) = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND company_id = $3
        `,
        [nextPoStatus, purchaseOrderId, companyId]
      );
    }

    return grnId;
  });
};

module.exports = {
  getGoodsReceiptById,
  insertGoodsReceipt,
  listGoodsReceipts,
};
