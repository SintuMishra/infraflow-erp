const { pool } = require("../../config/db");

const toNumberOrNull = (value) =>
  value === null || value === undefined ? null : Number(value);

const mapVehicleRow = (row) => ({
  id: row.id,
  companyId: row.companyId,
  vehicleNumber: row.vehicleNumber,
  contractorName: row.contractorName,
  vehicleType: row.vehicleType,
  notes: row.notes,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapReportRow = (row) => ({
  id: row.id,
  companyId: row.companyId,
  reportDate: row.reportDate,
  plantId: row.plantId,
  plantName: row.plantName,
  shiftId: row.shiftId,
  shift: row.shift,
  crusherUnitId: row.crusherUnitId,
  crusherUnitNameSnapshot: row.crusherUnitNameSnapshot,
  sourceMineName: row.sourceMineName,
  vehicleId: row.vehicleId,
  vehicleNumberSnapshot: row.vehicleNumberSnapshot,
  contractorNameSnapshot: row.contractorNameSnapshot,
  routeType: row.routeType,
  openingStockTons: toNumberOrNull(row.openingStockTons),
  inwardWeightTons: toNumberOrNull(row.inwardWeightTons),
  directToCrusherTons: toNumberOrNull(row.directToCrusherTons),
  crusherConsumptionTons: toNumberOrNull(row.crusherConsumptionTons),
  closingStockTons: toNumberOrNull(row.closingStockTons),
  finishedOutputTons: toNumberOrNull(row.finishedOutputTons),
  yieldPercent: toNumberOrNull(row.yieldPercent),
  processLossTons: toNumberOrNull(row.processLossTons),
  processLossPercent: toNumberOrNull(row.processLossPercent),
  remarks: row.remarks,
  createdBy: row.createdBy,
  updatedBy: row.updatedBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listBoulderVehicles = async (companyId) => {
  const result = await pool.query(
    `
      SELECT
        id,
        company_id AS "companyId",
        vehicle_number AS "vehicleNumber",
        contractor_name AS "contractorName",
        vehicle_type AS "vehicleType",
        notes,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM boulder_logistics_vehicles
      WHERE company_id = $1
      ORDER BY is_active DESC, vehicle_number ASC, id DESC
    `,
    [companyId]
  );

  return result.rows.map(mapVehicleRow);
};

const insertBoulderVehicle = async ({ companyId, vehicleNumber, contractorName, vehicleType, notes }) => {
  const result = await pool.query(
    `
      INSERT INTO boulder_logistics_vehicles (
        company_id,
        vehicle_number,
        contractor_name,
        vehicle_type,
        notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        company_id AS "companyId",
        vehicle_number AS "vehicleNumber",
        contractor_name AS "contractorName",
        vehicle_type AS "vehicleType",
        notes,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [companyId, vehicleNumber, contractorName, vehicleType, notes]
  );

  return result.rows[0] ? mapVehicleRow(result.rows[0]) : null;
};

const updateBoulderVehicle = async ({ id, companyId, vehicleNumber, contractorName, vehicleType, notes }) => {
  const result = await pool.query(
    `
      UPDATE boulder_logistics_vehicles
      SET
        vehicle_number = $3,
        contractor_name = $4,
        vehicle_type = $5,
        notes = $6,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING
        id,
        company_id AS "companyId",
        vehicle_number AS "vehicleNumber",
        contractor_name AS "contractorName",
        vehicle_type AS "vehicleType",
        notes,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [id, companyId, vehicleNumber, contractorName, vehicleType, notes]
  );

  return result.rows[0] ? mapVehicleRow(result.rows[0]) : null;
};

const updateBoulderVehicleStatus = async ({ id, companyId, isActive }) => {
  const result = await pool.query(
    `
      UPDATE boulder_logistics_vehicles
      SET
        is_active = $3,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING
        id,
        company_id AS "companyId",
        vehicle_number AS "vehicleNumber",
        contractor_name AS "contractorName",
        vehicle_type AS "vehicleType",
        notes,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [id, companyId, Boolean(isActive)]
  );

  return result.rows[0] ? mapVehicleRow(result.rows[0]) : null;
};

const buildReportFilters = ({
  companyId,
  search = "",
  plantId = null,
  shiftId = null,
  crusherUnitId = null,
  vehicleId = null,
  contractorName = "",
  routeType = "",
  startDate = "",
  endDate = "",
}) => {
  const values = [companyId];
  const conditions = ["br.company_id = $1"];
  let idx = 2;

  if (plantId) {
    values.push(Number(plantId));
    conditions.push(`br.plant_id = $${idx++}`);
  }

  if (shiftId) {
    values.push(Number(shiftId));
    conditions.push(`br.shift_id = $${idx++}`);
  }

  if (crusherUnitId) {
    values.push(Number(crusherUnitId));
    conditions.push(`br.crusher_unit_id = $${idx++}`);
  }

  if (vehicleId) {
    values.push(Number(vehicleId));
    conditions.push(`br.vehicle_id = $${idx++}`);
  }

  if (contractorName) {
    values.push(`%${String(contractorName).trim().toLowerCase()}%`);
    conditions.push(`LOWER(COALESCE(br.contractor_name_snapshot, '')) LIKE $${idx++}`);
  }

  if (routeType) {
    values.push(routeType);
    conditions.push(`br.route_type = $${idx++}`);
  }

  if (startDate) {
    values.push(startDate);
    conditions.push(`br.report_date >= $${idx++}::date`);
  }

  if (endDate) {
    values.push(endDate);
    conditions.push(`br.report_date <= $${idx++}::date`);
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const p = `$${idx++}`;
    conditions.push(`(
      LOWER(COALESCE(pm.plant_name, '')) LIKE ${p}
      OR LOWER(COALESCE(br.shift, '')) LIKE ${p}
      OR LOWER(COALESCE(br.crusher_unit_name_snapshot, '')) LIKE ${p}
      OR LOWER(COALESCE(br.source_mine_name, '')) LIKE ${p}
      OR LOWER(COALESCE(br.vehicle_number_snapshot, '')) LIKE ${p}
      OR LOWER(COALESCE(br.contractor_name_snapshot, '')) LIKE ${p}
      OR LOWER(COALESCE(br.remarks, '')) LIKE ${p}
    )`);
  }

  return { whereClause: `WHERE ${conditions.join(" AND ")}`, values };
};

const listBoulderReports = async ({
  companyId,
  search,
  plantId,
  shiftId,
  crusherUnitId,
  vehicleId,
  contractorName,
  routeType,
  startDate,
  endDate,
  page = 1,
  limit = 25,
}) => {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  const { whereClause, values } = buildReportFilters({
    companyId,
    search,
    plantId,
    shiftId,
    crusherUnitId,
    vehicleId,
    contractorName,
    routeType,
    startDate,
    endDate,
  });

  const queryValues = [...values, normalizedLimit, offset];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const listResult = await pool.query(
    `
      SELECT
        br.id,
        br.company_id AS "companyId",
        br.report_date AS "reportDate",
        br.plant_id AS "plantId",
        pm.plant_name AS "plantName",
        br.shift_id AS "shiftId",
        br.shift,
        br.crusher_unit_id AS "crusherUnitId",
        br.crusher_unit_name_snapshot AS "crusherUnitNameSnapshot",
        br.source_mine_name AS "sourceMineName",
        br.vehicle_id AS "vehicleId",
        br.vehicle_number_snapshot AS "vehicleNumberSnapshot",
        br.contractor_name_snapshot AS "contractorNameSnapshot",
        br.route_type AS "routeType",
        br.opening_stock_tons AS "openingStockTons",
        br.inward_weight_tons AS "inwardWeightTons",
        br.direct_to_crusher_tons AS "directToCrusherTons",
        br.crusher_consumption_tons AS "crusherConsumptionTons",
        br.closing_stock_tons AS "closingStockTons",
        br.finished_output_tons AS "finishedOutputTons",
        br.yield_percent AS "yieldPercent",
        br.process_loss_tons AS "processLossTons",
        br.process_loss_percent AS "processLossPercent",
        br.remarks,
        br.created_by AS "createdBy",
        br.updated_by AS "updatedBy",
        br.created_at AS "createdAt",
        br.updated_at AS "updatedAt"
      FROM boulder_daily_reports br
      LEFT JOIN plant_master pm ON pm.id = br.plant_id
      ${whereClause}
      ORDER BY br.report_date DESC, br.id DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    queryValues
  );

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM boulder_daily_reports br
      LEFT JOIN plant_master pm ON pm.id = br.plant_id
      ${whereClause}
    `,
    values
  );

  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(*)::int AS "total",
        COALESCE(SUM(br.inward_weight_tons), 0)::numeric AS "totalInwardWeight",
        COALESCE(SUM(br.direct_to_crusher_tons), 0)::numeric AS "totalDirectToCrusher",
        COALESCE(SUM(br.crusher_consumption_tons), 0)::numeric AS "totalCrusherConsumption",
        COALESCE(SUM(br.finished_output_tons), 0)::numeric AS "totalFinishedOutput",
        COALESCE(AVG(br.yield_percent), 0)::numeric AS "averageYieldPercent",
        COALESCE(SUM(br.process_loss_tons), 0)::numeric AS "totalProcessLoss",
        MAX(br.report_date) AS "latestDate"
      FROM boulder_daily_reports br
      LEFT JOIN plant_master pm ON pm.id = br.plant_id
      ${whereClause}
    `,
    values
  );

  return {
    items: listResult.rows.map(mapReportRow),
    total: Number(countResult.rows[0]?.total || 0),
    page: normalizedPage,
    limit: normalizedLimit,
    summary: summaryResult.rows[0] || null,
  };
};

const insertBoulderReport = async (payload) => {
  const result = await pool.query(
    `
      INSERT INTO boulder_daily_reports (
        company_id,
        report_date,
        plant_id,
        shift_id,
        shift,
        crusher_unit_id,
        crusher_unit_name_snapshot,
        source_mine_name,
        vehicle_id,
        vehicle_number_snapshot,
        contractor_name_snapshot,
        route_type,
        opening_stock_tons,
        inward_weight_tons,
        direct_to_crusher_tons,
        crusher_consumption_tons,
        closing_stock_tons,
        finished_output_tons,
        yield_percent,
        process_loss_tons,
        process_loss_percent,
        remarks,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      RETURNING id
    `,
    [
      payload.companyId,
      payload.reportDate,
      payload.plantId,
      payload.shiftId,
      payload.shift,
      payload.crusherUnitId,
      payload.crusherUnitNameSnapshot,
      payload.sourceMineName,
      payload.vehicleId,
      payload.vehicleNumberSnapshot,
      payload.contractorNameSnapshot,
      payload.routeType,
      payload.openingStockTons,
      payload.inwardWeightTons,
      payload.directToCrusherTons,
      payload.crusherConsumptionTons,
      payload.closingStockTons,
      payload.finishedOutputTons,
      payload.yieldPercent,
      payload.processLossTons,
      payload.processLossPercent,
      payload.remarks,
      payload.createdBy,
      payload.updatedBy,
    ]
  );

  return result.rows[0]?.id || null;
};

const updateBoulderReport = async (payload) => {
  const result = await pool.query(
    `
      UPDATE boulder_daily_reports
      SET
        report_date = $3,
        plant_id = $4,
        shift_id = $5,
        shift = $6,
        crusher_unit_id = $7,
        crusher_unit_name_snapshot = $8,
        source_mine_name = $9,
        vehicle_id = $10,
        vehicle_number_snapshot = $11,
        contractor_name_snapshot = $12,
        route_type = $13,
        opening_stock_tons = $14,
        inward_weight_tons = $15,
        direct_to_crusher_tons = $16,
        crusher_consumption_tons = $17,
        closing_stock_tons = $18,
        finished_output_tons = $19,
        yield_percent = $20,
        process_loss_tons = $21,
        process_loss_percent = $22,
        remarks = $23,
        updated_by = $24,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `,
    [
      payload.id,
      payload.companyId,
      payload.reportDate,
      payload.plantId,
      payload.shiftId,
      payload.shift,
      payload.crusherUnitId,
      payload.crusherUnitNameSnapshot,
      payload.sourceMineName,
      payload.vehicleId,
      payload.vehicleNumberSnapshot,
      payload.contractorNameSnapshot,
      payload.routeType,
      payload.openingStockTons,
      payload.inwardWeightTons,
      payload.directToCrusherTons,
      payload.crusherConsumptionTons,
      payload.closingStockTons,
      payload.finishedOutputTons,
      payload.yieldPercent,
      payload.processLossTons,
      payload.processLossPercent,
      payload.remarks,
      payload.updatedBy,
    ]
  );

  return result.rows[0]?.id || null;
};

const deleteBoulderReport = async ({ id, companyId }) => {
  const result = await pool.query(
    `
      DELETE FROM boulder_daily_reports
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `,
    [id, companyId]
  );

  return result.rows[0]?.id || null;
};

const getBoulderReportById = async ({ id, companyId }) => {
  const result = await pool.query(
    `
      SELECT
        br.id,
        br.company_id AS "companyId",
        br.report_date AS "reportDate",
        br.plant_id AS "plantId",
        pm.plant_name AS "plantName",
        br.shift_id AS "shiftId",
        br.shift,
        br.crusher_unit_id AS "crusherUnitId",
        br.crusher_unit_name_snapshot AS "crusherUnitNameSnapshot",
        br.source_mine_name AS "sourceMineName",
        br.vehicle_id AS "vehicleId",
        br.vehicle_number_snapshot AS "vehicleNumberSnapshot",
        br.contractor_name_snapshot AS "contractorNameSnapshot",
        br.route_type AS "routeType",
        br.opening_stock_tons AS "openingStockTons",
        br.inward_weight_tons AS "inwardWeightTons",
        br.direct_to_crusher_tons AS "directToCrusherTons",
        br.crusher_consumption_tons AS "crusherConsumptionTons",
        br.closing_stock_tons AS "closingStockTons",
        br.finished_output_tons AS "finishedOutputTons",
        br.yield_percent AS "yieldPercent",
        br.process_loss_tons AS "processLossTons",
        br.process_loss_percent AS "processLossPercent",
        br.remarks,
        br.created_by AS "createdBy",
        br.updated_by AS "updatedBy",
        br.created_at AS "createdAt",
        br.updated_at AS "updatedAt"
      FROM boulder_daily_reports br
      LEFT JOIN plant_master pm ON pm.id = br.plant_id
      WHERE br.id = $1 AND br.company_id = $2
      LIMIT 1
    `,
    [id, companyId]
  );

  return result.rows[0] ? mapReportRow(result.rows[0]) : null;
};

module.exports = {
  listBoulderVehicles,
  insertBoulderVehicle,
  updateBoulderVehicle,
  updateBoulderVehicleStatus,
  listBoulderReports,
  insertBoulderReport,
  updateBoulderReport,
  deleteBoulderReport,
  getBoulderReportById,
};
