const { pool, withTransaction } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const buildSchemaMissingError = () => {
  const error = new Error(
    "Procurement schema is not available. Run migrations to enable purchase orders."
  );
  error.statusCode = 503;
  error.code = "PROCUREMENT_SCHEMA_MISSING";
  return error;
};

const ensurePurchaseOrderSchema = async () => {
  if (!(await tableExists("purchase_orders"))) {
    throw buildSchemaMissingError();
  }
};

const mapOrderHeader = (row) => ({
  id: row.id,
  companyId: row.companyId,
  poNumber: row.poNumber,
  purchaseRequestId: row.purchaseRequestId,
  poDate: row.poDate,
  expectedDeliveryDate: row.expectedDeliveryDate,
  vendorId: row.vendorId,
  status: row.status,
  notes: row.notes,
  totalAmount: Number(row.totalAmount || 0),
  submittedAt: row.submittedAt,
  approvedAt: row.approvedAt,
  closedAt: row.closedAt,
  cancelledAt: row.cancelledAt,
  createdByUserId: row.createdByUserId,
  approvedByUserId: row.approvedByUserId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listPurchaseOrders = async ({ companyId, status = null }) => {
  await ensurePurchaseOrderSchema();
  const values = [companyId];
  let whereClause = "WHERE po.company_id = $1";

  if (status) {
    values.push(status);
    whereClause += ` AND po.status = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        po.id,
        po.company_id AS "companyId",
        po.po_number AS "poNumber",
        po.purchase_request_id AS "purchaseRequestId",
        po.po_date AS "poDate",
        po.expected_delivery_date AS "expectedDeliveryDate",
        po.vendor_id AS "vendorId",
        po.status,
        po.notes,
        po.total_amount AS "totalAmount",
        po.submitted_at AS "submittedAt",
        po.approved_at AS "approvedAt",
        po.closed_at AS "closedAt",
        po.cancelled_at AS "cancelledAt",
        po.created_by_user_id AS "createdByUserId",
        po.approved_by_user_id AS "approvedByUserId",
        po.created_at AS "createdAt",
        po.updated_at AS "updatedAt"
      FROM purchase_orders po
      ${whereClause}
      ORDER BY po.po_date DESC, po.id DESC
    `,
    values
  );

  return result.rows.map(mapOrderHeader);
};

const getPurchaseOrderLines = async ({ purchaseOrderId, companyId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        pol.id,
        pol.purchase_order_id AS "purchaseOrderId",
        pol.purchase_request_line_id AS "purchaseRequestLineId",
        pol.line_number AS "lineNumber",
        pol.material_id AS "materialId",
        pol.item_category AS "itemCategory",
        pol.description,
        pol.ordered_quantity AS "orderedQuantity",
        pol.received_quantity AS "receivedQuantity",
        pol.unit_rate AS "unitRate",
        pol.line_amount AS "lineAmount"
      FROM purchase_order_lines pol
      WHERE pol.purchase_order_id = $1
        AND pol.company_id = $2
      ORDER BY pol.line_number ASC
    `,
    [purchaseOrderId, companyId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    purchaseRequestLineId: row.purchaseRequestLineId,
    lineNumber: Number(row.lineNumber),
    materialId: Number(row.materialId),
    itemCategory: row.itemCategory || "material",
    description: row.description,
    orderedQuantity: Number(row.orderedQuantity || 0),
    receivedQuantity: Number(row.receivedQuantity || 0),
    unitRate: Number(row.unitRate || 0),
    lineAmount: Number(row.lineAmount || 0),
  }));
};

const getPurchaseOrderById = async ({ id, companyId }) => {
  await ensurePurchaseOrderSchema();
  const result = await pool.query(
    `
      SELECT
        po.id,
        po.company_id AS "companyId",
        po.po_number AS "poNumber",
        po.purchase_request_id AS "purchaseRequestId",
        po.po_date AS "poDate",
        po.expected_delivery_date AS "expectedDeliveryDate",
        po.vendor_id AS "vendorId",
        po.status,
        po.notes,
        po.total_amount AS "totalAmount",
        po.submitted_at AS "submittedAt",
        po.approved_at AS "approvedAt",
        po.closed_at AS "closedAt",
        po.cancelled_at AS "cancelledAt",
        po.created_by_user_id AS "createdByUserId",
        po.approved_by_user_id AS "approvedByUserId",
        po.created_at AS "createdAt",
        po.updated_at AS "updatedAt"
      FROM purchase_orders po
      WHERE po.id = $1
        AND po.company_id = $2
      LIMIT 1
    `,
    [id, companyId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const lines = await getPurchaseOrderLines({ purchaseOrderId: row.id, companyId }, pool);
  return {
    ...mapOrderHeader(row),
    lines,
  };
};

const insertPurchaseOrder = async ({
  companyId,
  poNumber,
  purchaseRequestId,
  poDate,
  expectedDeliveryDate,
  vendorId,
  status,
  notes,
  totalAmount,
  lines,
  userId,
}) => {
  await ensurePurchaseOrderSchema();

  return withTransaction(async (client) => {
    const headerResult = await client.query(
      `
        INSERT INTO purchase_orders (
          company_id,
          po_number,
          purchase_request_id,
          po_date,
          expected_delivery_date,
          vendor_id,
          status,
          notes,
          total_amount,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        companyId,
        poNumber,
        purchaseRequestId || null,
        poDate,
        expectedDeliveryDate || null,
        vendorId,
        status,
        notes || null,
        totalAmount,
        userId || null,
      ]
    );

    const poId = headerResult.rows[0].id;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      await client.query(
        `
          INSERT INTO purchase_order_lines (
            company_id,
            purchase_order_id,
            purchase_request_line_id,
            line_number,
            material_id,
            item_category,
            description,
            ordered_quantity,
            received_quantity,
            unit_rate,
            line_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)
        `,
        [
          companyId,
          poId,
          line.purchaseRequestLineId || null,
          index + 1,
          line.materialId,
          line.itemCategory || "material",
          line.description || null,
          line.orderedQuantity,
          line.unitRate,
          line.lineAmount,
        ]
      );
    }

    return poId;
  });
};

const updatePurchaseOrder = async ({
  id,
  companyId,
  purchaseRequestId,
  poDate,
  expectedDeliveryDate,
  vendorId,
  notes,
  totalAmount,
  lines,
}) => {
  await ensurePurchaseOrderSchema();

  return withTransaction(async (client) => {
    const headerResult = await client.query(
      `
        UPDATE purchase_orders
        SET
          purchase_request_id = COALESCE($1, purchase_request_id),
          po_date = COALESCE($2, po_date),
          expected_delivery_date = COALESCE($3, expected_delivery_date),
          vendor_id = COALESCE($4, vendor_id),
          notes = COALESCE($5, notes),
          total_amount = COALESCE($6, total_amount),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
          AND company_id = $8
        RETURNING id
      `,
      [
        purchaseRequestId,
        poDate,
        expectedDeliveryDate,
        vendorId,
        notes,
        totalAmount,
        id,
        companyId,
      ]
    );

    if (!headerResult.rows[0]) {
      return null;
    }

    if (Array.isArray(lines)) {
      await client.query(
        `
          DELETE FROM purchase_order_lines
          WHERE purchase_order_id = $1
            AND company_id = $2
        `,
        [id, companyId]
      );

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        await client.query(
          `
            INSERT INTO purchase_order_lines (
              company_id,
              purchase_order_id,
              purchase_request_line_id,
              line_number,
              material_id,
              item_category,
              description,
              ordered_quantity,
              received_quantity,
              unit_rate,
              line_amount
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)
          `,
          [
            companyId,
            id,
            line.purchaseRequestLineId || null,
            index + 1,
            line.materialId,
            line.itemCategory || "material",
            line.description || null,
            line.orderedQuantity,
            line.unitRate,
            line.lineAmount,
          ]
        );
      }
    }

    return id;
  });
};

const updatePurchaseOrderStatus = async ({
  id,
  companyId,
  status,
  userId = null,
}) => {
  await ensurePurchaseOrderSchema();

  const result = await pool.query(
    `
      UPDATE purchase_orders
      SET
        status = CAST($1 AS VARCHAR(32)),
        submitted_at = CASE WHEN CAST($1 AS VARCHAR(32)) = 'submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
        approved_at = CASE WHEN CAST($1 AS VARCHAR(32)) = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
        closed_at = CASE WHEN CAST($1 AS VARCHAR(32)) = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        cancelled_at = CASE WHEN CAST($1 AS VARCHAR(32)) = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
        approved_by_user_id = CASE WHEN CAST($1 AS VARCHAR(32)) = 'approved' THEN $2 ELSE approved_by_user_id END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND company_id = $4
      RETURNING id
    `,
    [status, userId, id, companyId]
  );

  return result.rows[0]?.id || null;
};

module.exports = {
  getPurchaseOrderById,
  insertPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
};
