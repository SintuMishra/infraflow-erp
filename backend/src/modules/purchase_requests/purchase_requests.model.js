const { pool, withTransaction } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const buildSchemaMissingError = () => {
  const error = new Error(
    "Procurement schema is not available. Run migrations to enable purchase requests."
  );
  error.statusCode = 503;
  error.code = "PROCUREMENT_SCHEMA_MISSING";
  return error;
};

const ensurePurchaseRequestSchema = async () => {
  if (!(await tableExists("purchase_requests"))) {
    throw buildSchemaMissingError();
  }
};

let purchaseRequestVendorNullableCache = null;

const isPurchaseRequestVendorNullable = async (db = pool) => {
  if (purchaseRequestVendorNullableCache !== null) {
    return purchaseRequestVendorNullableCache;
  }

  const result = await db.query(
    `
      SELECT is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'purchase_requests'
        AND column_name = 'vendor_id'
      LIMIT 1
    `
  );

  const isNullable = String(result.rows[0]?.isNullable || "").toUpperCase() === "YES";
  purchaseRequestVendorNullableCache = isNullable;
  return isNullable;
};

const mapRequestHeader = (row) => ({
  id: row.id,
  companyId: row.companyId,
  requestNumber: row.requestNumber,
  requestDate: row.requestDate,
  requiredByDate: row.requiredByDate,
  requestedByEmployeeId: row.requestedByEmployeeId,
  requestPurpose: row.requestPurpose,
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

const getLineSupplierQuotes = async ({ purchaseRequestId, companyId }, db = pool) => {
  if (!(await tableExists("purchase_request_line_supplier_quotes", db))) {
    return new Map();
  }

  const result = await db.query(
    `
      SELECT
        id,
        purchase_request_line_id AS "purchaseRequestLineId",
        vendor_id AS "vendorId",
        supplier_name AS "supplierName",
        contact_person AS "contactPerson",
        contact_phone AS "contactPhone",
        quoted_unit_rate AS "quotedUnitRate",
        currency_code AS "currencyCode",
        lead_time_days AS "leadTimeDays",
        quote_notes AS "quoteNotes",
        is_selected AS "isSelected"
      FROM purchase_request_line_supplier_quotes
      WHERE company_id = $1
        AND purchase_request_id = $2
      ORDER BY id ASC
    `,
    [companyId, purchaseRequestId]
  );

  const quoteMap = new Map();
  for (const row of result.rows) {
    const lineId = Number(row.purchaseRequestLineId);
    if (!quoteMap.has(lineId)) {
      quoteMap.set(lineId, []);
    }
    quoteMap.get(lineId).push({
      id: Number(row.id),
      vendorId: row.vendorId ? Number(row.vendorId) : null,
      supplierName: row.supplierName,
      contactPerson: row.contactPerson,
      contactPhone: row.contactPhone,
      quotedUnitRate:
        row.quotedUnitRate === null || row.quotedUnitRate === undefined
          ? null
          : Number(row.quotedUnitRate),
      currencyCode: row.currencyCode || "INR",
      leadTimeDays:
        row.leadTimeDays === null || row.leadTimeDays === undefined
          ? null
          : Number(row.leadTimeDays),
      quoteNotes: row.quoteNotes,
      isSelected: Boolean(row.isSelected),
    });
  }

  return quoteMap;
};

const listPurchaseRequests = async ({ companyId, status = null }) => {
  await ensurePurchaseRequestSchema();
  const values = [companyId];
  let whereClause = "WHERE pr.company_id = $1";

  if (status) {
    values.push(status);
    whereClause += ` AND pr.status = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        pr.id,
        pr.company_id AS "companyId",
        pr.request_number AS "requestNumber",
        pr.request_date AS "requestDate",
        pr.required_by_date AS "requiredByDate",
        pr.requested_by_employee_id AS "requestedByEmployeeId",
        pr.request_purpose AS "requestPurpose",
        pr.vendor_id AS "vendorId",
        pr.status,
        pr.notes,
        pr.total_amount AS "totalAmount",
        pr.submitted_at AS "submittedAt",
        pr.approved_at AS "approvedAt",
        pr.closed_at AS "closedAt",
        pr.cancelled_at AS "cancelledAt",
        pr.created_by_user_id AS "createdByUserId",
        pr.approved_by_user_id AS "approvedByUserId",
        pr.created_at AS "createdAt",
        pr.updated_at AS "updatedAt"
      FROM purchase_requests pr
      ${whereClause}
      ORDER BY pr.request_date DESC, pr.id DESC
    `,
    values
  );

  return result.rows.map(mapRequestHeader);
};

const getPurchaseRequestLines = async ({ purchaseRequestId, companyId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        prl.id,
        prl.purchase_request_id AS "purchaseRequestId",
        prl.line_number AS "lineNumber",
        prl.material_id AS "materialId",
        prl.item_category AS "itemCategory",
        prl.custom_item_name AS "customItemName",
        prl.custom_item_uom AS "customItemUom",
        prl.custom_item_spec AS "customItemSpec",
        prl.description,
        prl.quantity,
        prl.unit_rate AS "unitRate",
        prl.line_amount AS "lineAmount"
      FROM purchase_request_lines prl
      WHERE prl.purchase_request_id = $1
        AND prl.company_id = $2
      ORDER BY prl.line_number ASC
    `,
    [purchaseRequestId, companyId]
  );

  const quoteMap = await getLineSupplierQuotes({ purchaseRequestId, companyId }, db);

  return result.rows.map((row) => ({
    id: row.id,
    purchaseRequestId: row.purchaseRequestId,
    lineNumber: Number(row.lineNumber),
    materialId:
      row.materialId === null || row.materialId === undefined
        ? null
        : Number(row.materialId),
    itemCategory: row.itemCategory || "material",
    customItemName: row.customItemName,
    customItemUom: row.customItemUom,
    customItemSpec: row.customItemSpec,
    description: row.description,
    quantity: Number(row.quantity || 0),
    unitRate: Number(row.unitRate || 0),
    lineAmount: Number(row.lineAmount || 0),
    supplierQuotes: quoteMap.get(Number(row.id)) || [],
  }));
};

const getPurchaseRequestById = async ({ id, companyId }) => {
  await ensurePurchaseRequestSchema();
  const result = await pool.query(
    `
      SELECT
        pr.id,
        pr.company_id AS "companyId",
        pr.request_number AS "requestNumber",
        pr.request_date AS "requestDate",
        pr.required_by_date AS "requiredByDate",
        pr.requested_by_employee_id AS "requestedByEmployeeId",
        pr.request_purpose AS "requestPurpose",
        pr.vendor_id AS "vendorId",
        pr.status,
        pr.notes,
        pr.total_amount AS "totalAmount",
        pr.submitted_at AS "submittedAt",
        pr.approved_at AS "approvedAt",
        pr.closed_at AS "closedAt",
        pr.cancelled_at AS "cancelledAt",
        pr.created_by_user_id AS "createdByUserId",
        pr.approved_by_user_id AS "approvedByUserId",
        pr.created_at AS "createdAt",
        pr.updated_at AS "updatedAt"
      FROM purchase_requests pr
      WHERE pr.id = $1
        AND pr.company_id = $2
      LIMIT 1
    `,
    [id, companyId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const lines = await getPurchaseRequestLines(
    { purchaseRequestId: row.id, companyId },
    pool
  );
  return {
    ...mapRequestHeader(row),
    lines,
  };
};

const insertPurchaseRequest = async ({
  companyId,
  requestNumber,
  requestDate,
  requiredByDate,
  requestedByEmployeeId,
  requestPurpose,
  vendorId,
  status,
  notes,
  totalAmount,
  lines,
  userId,
}) => {
  await ensurePurchaseRequestSchema();

  return withTransaction(async (client) => {
    const vendorNullable = await isPurchaseRequestVendorNullable(client);
    if (!vendorNullable && !vendorId) {
      const error = new Error(
        "Preferred supplier is required in this environment. Select a vendor in request header or supplier quotation."
      );
      error.statusCode = 400;
      error.code = "PURCHASE_REQUEST_VENDOR_REQUIRED";
      throw error;
    }

    const headerResult = await client.query(
      `
        INSERT INTO purchase_requests (
          company_id,
          request_number,
          request_date,
          required_by_date,
          requested_by_employee_id,
          request_purpose,
          vendor_id,
          status,
          notes,
          total_amount,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        companyId,
        requestNumber,
        requestDate,
        requiredByDate || null,
        requestedByEmployeeId || null,
        requestPurpose || null,
        vendorId,
        status,
        notes || null,
        totalAmount,
        userId || null,
      ]
    );

    const requestId = headerResult.rows[0].id;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineResult = await client.query(
        `
          INSERT INTO purchase_request_lines (
            company_id,
            purchase_request_id,
            line_number,
            material_id,
            item_category,
            custom_item_name,
            custom_item_uom,
            custom_item_spec,
            description,
            quantity,
            unit_rate,
            line_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `,
        [
          companyId,
          requestId,
          index + 1,
          line.materialId,
          line.itemCategory || "material",
          line.customItemName || null,
          line.customItemUom || null,
          line.customItemSpec || null,
          line.description || null,
          line.quantity,
          line.unitRate,
          line.lineAmount,
        ]
      );

      const lineId = lineResult.rows[0].id;
      if (Array.isArray(line.supplierQuotes) && line.supplierQuotes.length) {
        for (const quote of line.supplierQuotes) {
          await client.query(
            `
              INSERT INTO purchase_request_line_supplier_quotes (
                company_id,
                purchase_request_id,
                purchase_request_line_id,
                vendor_id,
                supplier_name,
                contact_person,
                contact_phone,
                quoted_unit_rate,
                lead_time_days,
                quote_notes,
                is_selected
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `,
            [
              companyId,
              requestId,
              lineId,
              quote.vendorId || null,
              quote.supplierName || (quote.vendorId ? `Vendor-${quote.vendorId}` : "Supplier"),
              quote.contactPerson || null,
              quote.contactPhone || null,
              quote.quotedUnitRate,
              quote.leadTimeDays,
              quote.quoteNotes || null,
              quote.isSelected === true,
            ]
          );
        }
      }
    }

    return requestId;
  });
};

const updatePurchaseRequest = async ({
  id,
  companyId,
  requestDate,
  requiredByDate,
  requestedByEmployeeId,
  requestPurpose,
  vendorId,
  notes,
  totalAmount,
  lines,
}) => {
  await ensurePurchaseRequestSchema();

  return withTransaction(async (client) => {
    const headerResult = await client.query(
      `
        UPDATE purchase_requests
        SET
          request_date = COALESCE($1, request_date),
          required_by_date = COALESCE($2, required_by_date),
          requested_by_employee_id = COALESCE($3, requested_by_employee_id),
          request_purpose = COALESCE($4, request_purpose),
          vendor_id = COALESCE($5, vendor_id),
          notes = COALESCE($6, notes),
          total_amount = COALESCE($7, total_amount),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
          AND company_id = $9
        RETURNING id
      `,
      [
        requestDate,
        requiredByDate,
        requestedByEmployeeId,
        requestPurpose,
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
      if (await tableExists("purchase_request_line_supplier_quotes", client)) {
        await client.query(
          `
            DELETE FROM purchase_request_line_supplier_quotes
            WHERE purchase_request_id = $1
              AND company_id = $2
          `,
          [id, companyId]
        );
      }

      await client.query(
        `
          DELETE FROM purchase_request_lines
          WHERE purchase_request_id = $1
            AND company_id = $2
        `,
        [id, companyId]
      );

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const lineResult = await client.query(
          `
            INSERT INTO purchase_request_lines (
              company_id,
              purchase_request_id,
              line_number,
              material_id,
              item_category,
              custom_item_name,
              custom_item_uom,
              custom_item_spec,
              description,
              quantity,
              unit_rate,
              line_amount
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `,
          [
            companyId,
            id,
            index + 1,
            line.materialId,
            line.itemCategory || "material",
            line.customItemName || null,
            line.customItemUom || null,
            line.customItemSpec || null,
            line.description || null,
            line.quantity,
            line.unitRate,
            line.lineAmount,
          ]
        );

        const lineId = lineResult.rows[0].id;
        if (Array.isArray(line.supplierQuotes) && line.supplierQuotes.length) {
          for (const quote of line.supplierQuotes) {
            await client.query(
              `
                INSERT INTO purchase_request_line_supplier_quotes (
                  company_id,
                  purchase_request_id,
                  purchase_request_line_id,
                  vendor_id,
                  supplier_name,
                  contact_person,
                  contact_phone,
                  quoted_unit_rate,
                  lead_time_days,
                  quote_notes,
                  is_selected
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              `,
              [
                companyId,
                id,
                lineId,
                quote.vendorId || null,
                quote.supplierName || (quote.vendorId ? `Vendor-${quote.vendorId}` : "Supplier"),
                quote.contactPerson || null,
                quote.contactPhone || null,
                quote.quotedUnitRate,
                quote.leadTimeDays,
                quote.quoteNotes || null,
                quote.isSelected === true,
              ]
            );
          }
        }
      }
    }

    return id;
  });
};

const updatePurchaseRequestStatus = async ({
  id,
  companyId,
  status,
  userId = null,
}) => {
  await ensurePurchaseRequestSchema();

  const result = await pool.query(
    `
      UPDATE purchase_requests
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
  getPurchaseRequestById,
  getPurchaseRequestLines,
  insertPurchaseRequest,
  listPurchaseRequests,
  updatePurchaseRequest,
  updatePurchaseRequestStatus,
};
