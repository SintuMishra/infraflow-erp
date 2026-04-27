const { pool } = require("../../config/db");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");

const ORDER_STATUSES = ["open", "completed", "cancelled"];

const toNumberOrNull = (value) =>
  value === null || value === undefined ? null : Number(value);

const mapOrderRow = (row) => {
  if (!row) {
    return null;
  }

  const orderedQuantityTons = toNumberOrNull(row.orderedQuantityTons);
  const plannedQuantityTons = toNumberOrNull(row.plannedQuantityTons) || 0;
  const completedQuantityTons = toNumberOrNull(row.completedQuantityTons) || 0;
  const pendingQuantityTons = Math.max(
    0,
    Number((orderedQuantityTons || 0) - plannedQuantityTons)
  );

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderDate: row.orderDate,
    partyId: row.partyId,
    partyName: row.partyName,
    partyCode: row.partyCode,
    plantId: row.plantId,
    plantName: row.plantName,
    materialId: row.materialId,
    materialName: row.materialName,
    orderedQuantityTons,
    targetDispatchDate: row.targetDispatchDate,
    remarks: row.remarks,
    status: row.status,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    companyId: row.companyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    plannedQuantityTons,
    completedQuantityTons,
    inProgressQuantityTons: Math.max(
      0,
      Number(plannedQuantityTons - completedQuantityTons)
    ),
    pendingQuantityTons,
  };
};

const buildBaseQuery = ({
  companyScoped = false,
  dispatchScoped = false,
  excludeDispatchReportId = null,
} = {}) => `
  SELECT
    po.id,
    po.order_number AS "orderNumber",
    po.order_date AS "orderDate",
    po.party_id AS "partyId",
    p.party_name AS "partyName",
    p.party_code AS "partyCode",
    po.plant_id AS "plantId",
    pm.plant_name AS "plantName",
    po.material_id AS "materialId",
    mm.material_name AS "materialName",
    po.ordered_quantity_tons AS "orderedQuantityTons",
    po.target_dispatch_date AS "targetDispatchDate",
    po.remarks,
    po.status,
    po.created_by AS "createdBy",
    po.updated_by AS "updatedBy",
    po.company_id AS "companyId",
    po.created_at AS "createdAt",
    po.updated_at AS "updatedAt",
    COALESCE(fs.planned_quantity_tons, 0) AS "plannedQuantityTons",
    COALESCE(fs.completed_quantity_tons, 0) AS "completedQuantityTons"
  FROM party_orders po
  JOIN party_master p ON p.id = po.party_id
  JOIN plant_master pm ON pm.id = po.plant_id
  JOIN material_master mm ON mm.id = po.material_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        SUM(CASE WHEN dr.status IN ('pending', 'completed') THEN dr.quantity_tons ELSE 0 END),
        0
      ) AS planned_quantity_tons,
      COALESCE(
        SUM(CASE WHEN dr.status = 'completed' THEN dr.quantity_tons ELSE 0 END),
        0
      ) AS completed_quantity_tons
    FROM dispatch_reports dr
    WHERE dr.party_order_id = po.id
    ${dispatchScoped ? `AND dr.company_id = $1` : ""}
    ${excludeDispatchReportId !== null ? `AND dr.id <> $${dispatchScoped ? "2" : "1"}` : ""}
  ) fs ON TRUE
  ${companyScoped ? `WHERE po.company_id = $1` : ""}
`;

const buildFeatureUnavailableError = () => {
  const error = new Error(
    "Party order feature is not available until migration 003_party_orders_foundation.sql is applied"
  );
  error.statusCode = 503;
  return error;
};

const isPartyOrdersAvailable = async (db = pool) => {
  return await tableExists("party_orders", db);
};

const generatePartyOrderNumber = async (
  { orderDate, companyId = null },
  db = pool
) => {
  if (!(await isPartyOrdersAvailable(db))) {
    throw buildFeatureUnavailableError();
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const dateToken = String(orderDate || "").replace(/-/g, "");
  const prefix = `PO-${dateToken}-`;
  const query = `
    SELECT order_number AS "orderNumber"
    FROM party_orders
    WHERE order_number LIKE $1
    ${ordersHasCompany && companyId !== null ? `AND company_id = $2` : ""}
  `;

  const result = await db.query(
    query,
    ordersHasCompany && companyId !== null ? [`${prefix}%`, companyId] : [`${prefix}%`]
  );

  const maxSequence = result.rows.reduce((max, row) => {
    const match = String(row.orderNumber || "").match(/^PO-\d{8}-(\d+)$/);
    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
};

const getAllPartyOrders = async (companyId = null, db = pool) => {
  if (!(await isPartyOrdersAvailable(db))) {
    return [];
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dispatchHasPartyOrder = await hasColumn("dispatch_reports", "party_order_id", db);

  const result = await db.query(
    `
    ${
      dispatchHasPartyOrder
        ? buildBaseQuery({
            companyScoped: ordersHasCompany && companyId !== null,
            dispatchScoped: dispatchHasCompany && companyId !== null,
          })
        : `
          SELECT
            po.id,
            po.order_number AS "orderNumber",
            po.order_date AS "orderDate",
            po.party_id AS "partyId",
            p.party_name AS "partyName",
            p.party_code AS "partyCode",
            po.plant_id AS "plantId",
            pm.plant_name AS "plantName",
            po.material_id AS "materialId",
            mm.material_name AS "materialName",
            po.ordered_quantity_tons AS "orderedQuantityTons",
            po.target_dispatch_date AS "targetDispatchDate",
            po.remarks,
            po.status,
            po.created_by AS "createdBy",
            po.updated_by AS "updatedBy",
            po.company_id AS "companyId",
            po.created_at AS "createdAt",
            po.updated_at AS "updatedAt",
            0::numeric AS "plannedQuantityTons",
            0::numeric AS "completedQuantityTons"
          FROM party_orders po
          JOIN party_master p ON p.id = po.party_id
          JOIN plant_master pm ON pm.id = po.plant_id
          JOIN material_master mm ON mm.id = po.material_id
          ${ordersHasCompany && companyId !== null ? `WHERE po.company_id = $1` : ""}
        `
    }
    ORDER BY po.order_date DESC, po.id DESC
    `,
    ordersHasCompany && companyId !== null ? [companyId] : []
  );

  return result.rows.map(mapOrderRow);
};

const getPartyOrdersPage = async ({ companyId = null, page = 1, limit = 25 } = {}, db = pool) => {
  if (!(await isPartyOrdersAvailable(db))) {
    return {
      items: [],
      total: 0,
      page,
      limit,
    };
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dispatchHasPartyOrder = await hasColumn("dispatch_reports", "party_order_id", db);
  const values = [];

  if (ordersHasCompany && companyId !== null) {
    values.push(companyId);
  }

  const offset = (page - 1) * limit;
  const limitPlaceholder = `$${values.length + 1}`;
  const offsetPlaceholder = `$${values.length + 2}`;

  const listQuery = dispatchHasPartyOrder
    ? `
      ${buildBaseQuery({
        companyScoped: ordersHasCompany && companyId !== null,
        dispatchScoped: dispatchHasCompany && companyId !== null,
      })}
      ORDER BY po.order_date DESC, po.id DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `
    : `
      SELECT
        po.id,
        po.order_number AS "orderNumber",
        po.order_date AS "orderDate",
        po.party_id AS "partyId",
        p.party_name AS "partyName",
        p.party_code AS "partyCode",
        po.plant_id AS "plantId",
        pm.plant_name AS "plantName",
        po.material_id AS "materialId",
        mm.material_name AS "materialName",
        po.ordered_quantity_tons AS "orderedQuantityTons",
        po.target_dispatch_date AS "targetDispatchDate",
        po.remarks,
        po.status,
        po.created_by AS "createdBy",
        po.updated_by AS "updatedBy",
        po.company_id AS "companyId",
        po.created_at AS "createdAt",
        po.updated_at AS "updatedAt",
        0::numeric AS "plannedQuantityTons",
        0::numeric AS "completedQuantityTons"
      FROM party_orders po
      JOIN party_master p ON p.id = po.party_id
      JOIN plant_master pm ON pm.id = po.plant_id
      JOIN material_master mm ON mm.id = po.material_id
      ${ordersHasCompany && companyId !== null ? `WHERE po.company_id = $1` : ""}
      ORDER BY po.order_date DESC, po.id DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM party_orders po
    ${ordersHasCompany && companyId !== null ? `WHERE po.company_id = $1` : ""}
  `;

  const [listResult, countResult] = await Promise.all([
    db.query(listQuery, [...values, limit, offset]),
    db.query(countQuery, values),
  ]);

  return {
    items: listResult.rows.map(mapOrderRow),
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const getPartyOrderById = async (
  orderId,
  companyId = null,
  { db = pool, excludeDispatchReportId = null } = {}
) => {
  if (!(await isPartyOrdersAvailable(db))) {
    return null;
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dispatchHasPartyOrder = await hasColumn("dispatch_reports", "party_order_id", db);

  const params = [orderId];
  let companyParamForOrders = "";
  let companyParamForDispatch = "";
  let excludeParamForDispatch = "";

  if (ordersHasCompany && companyId !== null) {
    params.push(companyId);
    companyParamForOrders = `AND po.company_id = $${params.length}`;
  }

  if (dispatchHasPartyOrder) {
    if (dispatchHasCompany && companyId !== null) {
      companyParamForDispatch = `AND dr.company_id = $${ordersHasCompany && companyId !== null ? 2 : 2}`;
      if (!(ordersHasCompany && companyId !== null)) {
        params.push(companyId);
      }
    }

    if (excludeDispatchReportId !== null) {
      params.push(excludeDispatchReportId);
      excludeParamForDispatch = `AND dr.id <> $${params.length}`;
    }
  }

  const query = `
    SELECT
      po.id,
      po.order_number AS "orderNumber",
      po.order_date AS "orderDate",
      po.party_id AS "partyId",
      p.party_name AS "partyName",
      p.party_code AS "partyCode",
      po.plant_id AS "plantId",
      pm.plant_name AS "plantName",
      po.material_id AS "materialId",
      mm.material_name AS "materialName",
      po.ordered_quantity_tons AS "orderedQuantityTons",
      po.target_dispatch_date AS "targetDispatchDate",
      po.remarks,
      po.status,
      po.created_by AS "createdBy",
      po.updated_by AS "updatedBy",
      po.company_id AS "companyId",
      po.created_at AS "createdAt",
      po.updated_at AS "updatedAt",
      ${
        dispatchHasPartyOrder
          ? `
        COALESCE(fs.planned_quantity_tons, 0) AS "plannedQuantityTons",
        COALESCE(fs.completed_quantity_tons, 0) AS "completedQuantityTons"
      `
          : `
        0::numeric AS "plannedQuantityTons",
        0::numeric AS "completedQuantityTons"
      `
      }
    FROM party_orders po
    JOIN party_master p ON p.id = po.party_id
    JOIN plant_master pm ON pm.id = po.plant_id
    JOIN material_master mm ON mm.id = po.material_id
    ${
      dispatchHasPartyOrder
        ? `
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(CASE WHEN dr.status IN ('pending', 'completed') THEN dr.quantity_tons ELSE 0 END),
            0
          ) AS planned_quantity_tons,
          COALESCE(
            SUM(CASE WHEN dr.status = 'completed' THEN dr.quantity_tons ELSE 0 END),
            0
          ) AS completed_quantity_tons
        FROM dispatch_reports dr
        WHERE dr.party_order_id = po.id
        ${companyParamForDispatch}
        ${excludeParamForDispatch}
      ) fs ON TRUE
    `
        : ""
    }
    WHERE po.id = $1
    ${companyParamForOrders}
    LIMIT 1
  `;

  const result = await db.query(query, params);
  return result.rows[0] ? mapOrderRow(result.rows[0]) : null;
};

const insertPartyOrder = async (
  {
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    targetDispatchDate,
    remarks,
    status,
    createdBy,
    updatedBy,
    companyId,
  },
  db = pool
) => {
  if (!(await isPartyOrdersAvailable(db))) {
    throw buildFeatureUnavailableError();
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const query = `
    INSERT INTO party_orders (
      order_number,
      order_date,
      party_id,
      plant_id,
      material_id,
      ordered_quantity_tons,
      target_dispatch_date,
      remarks,
      status,
      created_by,
      updated_by
      ${ordersHasCompany ? `, company_id` : ""}
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ${ordersHasCompany ? `, $12` : ""}
    )
    RETURNING id
  `;

  const result = await db.query(query, [
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    targetDispatchDate || null,
    remarks || null,
    status || "open",
    createdBy || null,
    updatedBy || createdBy || null,
    ...(ordersHasCompany ? [companyId || null] : []),
  ]);

  return await getPartyOrderById(result.rows[0].id, companyId || null, { db });
};

const updatePartyOrder = async (
  orderId,
  {
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    targetDispatchDate,
    remarks,
    status,
    updatedBy,
    companyId,
  },
  db = pool
) => {
  if (!(await isPartyOrdersAvailable(db))) {
    throw buildFeatureUnavailableError();
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const query = `
    UPDATE party_orders
    SET
      order_number = $1,
      order_date = $2,
      party_id = $3,
      plant_id = $4,
      material_id = $5,
      ordered_quantity_tons = $6,
      target_dispatch_date = $7,
      remarks = $8,
      status = $9,
      updated_by = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
    ${ordersHasCompany && companyId !== null ? `AND company_id = $12` : ""}
    RETURNING id
  `;

  const result = await db.query(query, [
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    targetDispatchDate || null,
    remarks || null,
    status || "open",
    updatedBy || null,
    orderId,
    ...(ordersHasCompany && companyId !== null ? [companyId] : []),
  ]);

  if (!result.rows[0]) {
    return null;
  }

  return await getPartyOrderById(orderId, companyId || null, { db });
};

const updatePartyOrderStatus = async (
  orderId,
  status,
  { updatedBy = null, companyId = null, db = pool } = {}
) => {
  if (!(await isPartyOrdersAvailable(db))) {
    throw buildFeatureUnavailableError();
  }

  const ordersHasCompany = await hasColumn("party_orders", "company_id", db);
  const result = await db.query(
    `
    UPDATE party_orders
    SET
      status = $1,
      updated_by = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    ${ordersHasCompany && companyId !== null ? `AND company_id = $4` : ""}
    RETURNING id
    `,
    [
      status,
      updatedBy || null,
      orderId,
      ...(ordersHasCompany && companyId !== null ? [companyId] : []),
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return await getPartyOrderById(orderId, companyId || null, { db });
};

module.exports = {
  ORDER_STATUSES,
  getAllPartyOrders,
  getPartyOrdersPage,
  getPartyOrderById,
  insertPartyOrder,
  updatePartyOrder,
  updatePartyOrderStatus,
  isPartyOrdersAvailable,
  generatePartyOrderNumber,
};
