const { pool } = require("../../config/db");
const { formatRowsDateField } = require("../../utils/date.util");
const { hasColumn } = require("../../utils/companyScope.util");

const baseVehicleSelect = `
  SELECT
    v.id,
    v.vehicle_number AS "vehicleNumber",
    v.vehicle_type AS "vehicleType",
    v.assigned_driver AS "assignedDriver",
    v.status,
    v.ownership_type AS "ownershipType",
    v.vendor_id AS "vendorId",
    vm.vendor_name AS "vendorName",
    v.plant_id AS "plantId",
    p.plant_name AS "plantName",
    p.plant_type AS "plantType",
    v.vehicle_capacity_tons AS "vehicleCapacityTons",
    v.created_at AS "createdAt",
    v.updated_at AS "updatedAt"
  FROM vehicles v
  LEFT JOIN vendor_master vm ON vm.id = v.vendor_id
  LEFT JOIN plant_master p ON p.id = v.plant_id
`;

const normalizeVehicleRow = (row) => ({
  ...row,
  vehicleCapacityTons:
    row.vehicleCapacityTons !== null && row.vehicleCapacityTons !== undefined
      ? Number(row.vehicleCapacityTons)
      : null,
});

const normalizeEquipmentLogRow = (row) => ({
  ...row,
  usageHours:
    row.usageHours !== null && row.usageHours !== undefined
      ? Number(row.usageHours)
      : null,
  fuelUsed:
    row.fuelUsed !== null && row.fuelUsed !== undefined
      ? Number(row.fuelUsed)
      : null,
  openingMeterReading:
    row.openingMeterReading !== null && row.openingMeterReading !== undefined
      ? Number(row.openingMeterReading)
      : null,
  closingMeterReading:
    row.closingMeterReading !== null && row.closingMeterReading !== undefined
      ? Number(row.closingMeterReading)
      : null,
  meterUnit: row.meterUnit || "hours",
  manualVehicleNumber: row.manualVehicleNumber || null,
  driverOperatorName: row.driverOperatorName || null,
});

const getEquipmentSchemaColumns = async () => {
  const openingMeterReadingColumn = (await hasColumn(
    "equipment_logs",
    "opening_meter_reading"
  ))
    ? "opening_meter_reading"
    : (await hasColumn("equipment_logs", "opening_meter"))
      ? "opening_meter"
      : null;
  const closingMeterReadingColumn = (await hasColumn(
    "equipment_logs",
    "closing_meter_reading"
  ))
    ? "closing_meter_reading"
    : (await hasColumn("equipment_logs", "closing_meter"))
      ? "closing_meter"
      : null;
  const meterUnitColumn = (await hasColumn("equipment_logs", "meter_unit"))
    ? "meter_unit"
    : null;

  return {
    openingMeterReadingColumn,
    closingMeterReadingColumn,
    meterUnitColumn,
  };
};

const formatEquipmentLogRows = (rows) =>
  formatRowsDateField(rows.map((row) => normalizeEquipmentLogRow(row)), "usageDate");

const buildEquipmentLogsSelect = ({
  openingMeterReadingColumn,
  closingMeterReadingColumn,
  meterUnitColumn,
}) => `
  SELECT
    el.id,
    el.usage_date AS "usageDate",
    el.equipment_name AS "equipmentName",
    el.equipment_type AS "equipmentType",
    el.site_name AS "siteName",
    el.usage_hours AS "usageHours",
    el.fuel_used AS "fuelUsed",
    ${
      openingMeterReadingColumn
        ? `el.${openingMeterReadingColumn} AS "openingMeterReading",`
        : `NULL::numeric AS "openingMeterReading",`
    }
    ${
      closingMeterReadingColumn
        ? `el.${closingMeterReadingColumn} AS "closingMeterReading",`
        : `NULL::numeric AS "closingMeterReading",`
    }
    ${
      meterUnitColumn
        ? `COALESCE(el.${meterUnitColumn}, 'hours') AS "meterUnit",`
        : `'hours'::text AS "meterUnit",`
    }
    el.remarks,
    el.manual_vehicle_number AS "manualVehicleNumber",
    el.driver_operator_name AS "driverOperatorName",
    el.created_by AS "createdBy",
    el.plant_id AS "plantId",
    p.plant_name AS "plantName",
    p.plant_type AS "plantType",
    el.created_at AS "createdAt",
    el.updated_at AS "updatedAt"
  FROM equipment_logs el
  LEFT JOIN plant_master p ON p.id = el.plant_id
`;

const findAllVehicles = async (companyId = null) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    ${baseVehicleSelect}
    ${vehiclesHasCompany && companyId !== null ? `WHERE v.company_id = $1` : ""}
    ORDER BY v.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows.map((row) => normalizeVehicleRow(row));
};

const findVehiclesPage = async ({ companyId = null, page = 1, limit = 25, search = "" } = {}) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const values = [];
  const conditions = [];
  let parameterIndex = 1;

  if (vehiclesHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`v.company_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (String(search || "").trim()) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    conditions.push(
      `(
        LOWER(COALESCE(v.vehicle_number, '')) LIKE $${parameterIndex}
        OR LOWER(COALESCE(v.vehicle_type, '')) LIKE $${parameterIndex}
        OR LOWER(COALESCE(v.assigned_driver, '')) LIKE $${parameterIndex}
      )`
    );
    parameterIndex += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const queryValues = [...values, limit, offset];
  const result = await pool.query(
    `
      ${baseVehicleSelect}
      ${whereClause}
      ORDER BY v.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `,
    queryValues
  );

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM vehicles v
      ${whereClause}
    `,
    values
  );

  return {
    items: result.rows.map((row) => normalizeVehicleRow(row)),
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findVehicleLookup = async (companyId = null) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const result = await pool.query(
    `
      SELECT
        v.id,
        v.vehicle_number AS label,
        v.vehicle_type AS code,
        v.status,
        v.vehicle_capacity_tons AS "vehicleCapacityTons"
      FROM vehicles v
      WHERE v.status <> 'inactive'
      ${vehiclesHasCompany && companyId !== null ? `AND v.company_id = $1` : ""}
      ORDER BY v.vehicle_number ASC, v.id DESC
    `,
    vehiclesHasCompany && companyId !== null ? [companyId] : []
  );

  return result.rows;
};

const insertVehicle = async ({
  vehicleNumber,
  vehicleType,
  assignedDriver,
  status,
  ownershipType,
  vendorId,
  plantId,
  vehicleCapacityTons,
  companyId,
}) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    INSERT INTO vehicles (
      vehicle_number,
      vehicle_type,
      assigned_driver,
      status,
      ownership_type,
      vendor_id,
      plant_id,
      vehicle_capacity_tons
      ${vehiclesHasCompany ? ", company_id" : ""}
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8${vehiclesHasCompany ? ", $9" : ""})
    RETURNING id
  `;

  const values = [
    vehicleNumber,
    vehicleType,
    assignedDriver || null,
    status || "active",
    ownershipType || "company",
    vendorId || null,
    plantId || null,
    vehicleCapacityTons ?? null,
    ...(vehiclesHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);
  const vehicleId = result.rows[0].id;

  const fetchQuery = `
    ${baseVehicleSelect}
    WHERE v.id = $1
    ${vehiclesHasCompany && companyId !== null ? `AND v.company_id = $2` : ""}
  `;

  const fetchResult = await pool.query(
    fetchQuery,
    vehiclesHasCompany && companyId !== null ? [vehicleId, companyId] : [vehicleId]
  );

  return normalizeVehicleRow(fetchResult.rows[0]);
};

const editVehicle = async ({
  vehicleId,
  vehicleNumber,
  vehicleType,
  assignedDriver,
  status,
  ownershipType,
  vendorId,
  plantId,
  vehicleCapacityTons,
  companyId,
}) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    UPDATE vehicles
    SET
      vehicle_number = $1,
      vehicle_type = $2,
      assigned_driver = $3,
      status = $4,
      ownership_type = $5,
      vendor_id = $6,
      plant_id = $7,
      vehicle_capacity_tons = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    ${vehiclesHasCompany && companyId !== null ? `AND company_id = $10` : ""}
    RETURNING id
  `;

  const values = [
    vehicleNumber,
    vehicleType,
    assignedDriver || null,
    status || "active",
    ownershipType || "company",
    vendorId || null,
    plantId || null,
    vehicleCapacityTons ?? null,
    vehicleId,
    ...(vehiclesHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    const error = new Error("Vehicle not found");
    error.statusCode = 404;
    throw error;
  }

  const fetchQuery = `
    ${baseVehicleSelect}
    WHERE v.id = $1
    ${vehiclesHasCompany && companyId !== null ? `AND v.company_id = $2` : ""}
  `;

  const fetchResult = await pool.query(
    fetchQuery,
    vehiclesHasCompany && companyId !== null ? [vehicleId, companyId] : [vehicleId]
  );

  return normalizeVehicleRow(fetchResult.rows[0]);
};

const setVehicleStatus = async ({ vehicleId, status, companyId }) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    UPDATE vehicles
    SET
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${vehiclesHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING id
  `;

  const result = await pool.query(
    query,
    vehiclesHasCompany && companyId !== null ? [status, vehicleId, companyId] : [status, vehicleId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Vehicle not found");
    error.statusCode = 404;
    throw error;
  }

  const fetchQuery = `
    ${baseVehicleSelect}
    WHERE v.id = $1
    ${vehiclesHasCompany && companyId !== null ? `AND v.company_id = $2` : ""}
  `;

  const fetchResult = await pool.query(
    fetchQuery,
    vehiclesHasCompany && companyId !== null ? [vehicleId, companyId] : [vehicleId]
  );

  return normalizeVehicleRow(fetchResult.rows[0]);
};

const findAllEquipmentLogs = async (companyId = null) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const meterColumns = await getEquipmentSchemaColumns();
  const query = `
    ${buildEquipmentLogsSelect(meterColumns)}
    ${equipmentLogsHasCompany && companyId !== null ? `WHERE el.company_id = $1` : ""}
    ORDER BY el.usage_date DESC, el.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return formatEquipmentLogRows(result.rows);
};

const findLatestEquipmentLog = async ({
  equipmentName,
  equipmentType,
  plantId,
  companyId = null,
  db = pool,
}) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const meterColumns = await getEquipmentSchemaColumns();
  const values = [equipmentName.trim(), equipmentType.trim()];
  const conditions = [
    `LOWER(TRIM(el.equipment_name)) = LOWER(TRIM($1))`,
    `LOWER(TRIM(el.equipment_type)) = LOWER(TRIM($2))`,
  ];
  let parameterIndex = values.length;

  if (plantId) {
    parameterIndex += 1;
    values.push(plantId);
    conditions.push(`el.plant_id = $${parameterIndex}`);
  }

  if (equipmentLogsHasCompany && companyId !== null) {
    parameterIndex += 1;
    values.push(companyId);
    conditions.push(`el.company_id = $${parameterIndex}`);
  }

  const query = `
    ${buildEquipmentLogsSelect(meterColumns)}
    WHERE ${conditions.join(" AND ")}
    ORDER BY el.usage_date DESC, el.id DESC
    LIMIT 1
  `;

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    return null;
  }

  return formatEquipmentLogRows(result.rows)[0];
};

const findEquipmentLogChain = async ({
  equipmentName,
  equipmentType,
  plantId,
  companyId = null,
  db = pool,
}) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const meterColumns = await getEquipmentSchemaColumns();
  const values = [equipmentName.trim(), equipmentType.trim()];
  const conditions = [
    `LOWER(TRIM(el.equipment_name)) = LOWER(TRIM($1))`,
    `LOWER(TRIM(el.equipment_type)) = LOWER(TRIM($2))`,
  ];
  let parameterIndex = values.length;

  if (plantId) {
    parameterIndex += 1;
    values.push(plantId);
    conditions.push(`el.plant_id = $${parameterIndex}`);
  }

  if (equipmentLogsHasCompany && companyId !== null) {
    parameterIndex += 1;
    values.push(companyId);
    conditions.push(`el.company_id = $${parameterIndex}`);
  }

  const query = `
    ${buildEquipmentLogsSelect(meterColumns)}
    WHERE ${conditions.join(" AND ")}
    ORDER BY el.usage_date ASC, el.id ASC
  `;

  const result = await db.query(query, values);
  return formatEquipmentLogRows(result.rows);
};

const findEquipmentLogById = async ({ logId, companyId = null, db = pool }) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const meterColumns = await getEquipmentSchemaColumns();
  const query = `
    ${buildEquipmentLogsSelect(meterColumns)}
    WHERE el.id = $1
    ${equipmentLogsHasCompany && companyId !== null ? `AND el.company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await db.query(
    query,
    equipmentLogsHasCompany && companyId !== null ? [logId, companyId] : [logId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatEquipmentLogRows(result.rows)[0];
};

const insertEquipmentLog = async ({
  usageDate,
  equipmentName,
  equipmentType,
  siteName,
  usageHours,
  fuelUsed,
  openingMeterReading,
  closingMeterReading,
  meterUnit,
  manualVehicleNumber,
  driverOperatorName,
  remarks,
  createdBy,
  plantId,
  companyId,
  db = pool,
}) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const { openingMeterReadingColumn, closingMeterReadingColumn, meterUnitColumn } =
    await getEquipmentSchemaColumns();

  const insertColumns = [
    "usage_date",
    "equipment_name",
    "equipment_type",
    "site_name",
    "usage_hours",
    "fuel_used",
    "remarks",
    "manual_vehicle_number",
    "driver_operator_name",
    "created_by",
    "plant_id",
  ];

  const values = [
    usageDate,
    equipmentName,
    equipmentType,
    siteName || null,
    usageHours,
    fuelUsed,
    remarks || null,
    manualVehicleNumber || null,
    driverOperatorName || null,
    createdBy,
    plantId || null,
  ];

  if (openingMeterReadingColumn) {
    insertColumns.push(openingMeterReadingColumn);
    values.push(openingMeterReading);
  }

  if (closingMeterReadingColumn) {
    insertColumns.push(closingMeterReadingColumn);
    values.push(closingMeterReading);
  }

  if (meterUnitColumn) {
    insertColumns.push(meterUnitColumn);
    values.push(meterUnit || "hours");
  }

  if (equipmentLogsHasCompany) {
    insertColumns.push("company_id");
    values.push(companyId || null);
  }

  const query = `
    INSERT INTO equipment_logs (${insertColumns.join(", ")})
    VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(", ")})
    RETURNING id
  `;

  const result = await db.query(query, values);
  const logId = result.rows[0].id;
  const fetchQuery = `
    ${buildEquipmentLogsSelect({
      openingMeterReadingColumn,
      closingMeterReadingColumn,
      meterUnitColumn,
    })}
    WHERE el.id = $1
    ${equipmentLogsHasCompany && companyId !== null ? `AND el.company_id = $2` : ""}
  `;

  const fetchResult = await db.query(
    fetchQuery,
    equipmentLogsHasCompany && companyId !== null ? [logId, companyId] : [logId]
  );

  return formatEquipmentLogRows(fetchResult.rows)[0];
};

const updateEquipmentLog = async ({
  logId,
  usageDate,
  siteName,
  usageHours,
  fuelUsed,
  openingMeterReading,
  closingMeterReading,
  meterUnit,
  manualVehicleNumber,
  driverOperatorName,
  remarks,
  plantId,
  companyId,
  db = pool,
}) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const { openingMeterReadingColumn, closingMeterReadingColumn, meterUnitColumn } =
    await getEquipmentSchemaColumns();

  const updateAssignments = [
    `usage_date = $1`,
    `site_name = $2`,
    `usage_hours = $3`,
    `fuel_used = $4`,
    `remarks = $5`,
    `plant_id = $6`,
    `manual_vehicle_number = $7`,
    `driver_operator_name = $8`,
    `updated_at = NOW()`,
  ];
  const values = [
    usageDate,
    siteName || null,
    usageHours,
    fuelUsed,
    remarks || null,
    plantId || null,
    manualVehicleNumber || null,
    driverOperatorName || null,
  ];

  if (openingMeterReadingColumn) {
    updateAssignments.push(
      `${openingMeterReadingColumn} = $${values.length + 1}`
    );
    values.push(openingMeterReading);
  }

  if (closingMeterReadingColumn) {
    updateAssignments.push(
      `${closingMeterReadingColumn} = $${values.length + 1}`
    );
    values.push(closingMeterReading);
  }

  if (meterUnitColumn) {
    updateAssignments.push(`${meterUnitColumn} = $${values.length + 1}`);
    values.push(meterUnit || "hours");
  }

  values.push(logId);

  if (equipmentLogsHasCompany && companyId !== null) {
    values.push(companyId);
  }

  const query = `
    UPDATE equipment_logs
    SET ${updateAssignments.join(", ")}
    WHERE id = $${values.length - (equipmentLogsHasCompany && companyId !== null ? 1 : 0)}
    ${equipmentLogsHasCompany && companyId !== null ? `AND company_id = $${values.length}` : ""}
    RETURNING id
  `;

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    return null;
  }

  return await findEquipmentLogById({ logId, companyId, db });
};

const removeEquipmentLog = async ({ logId, companyId = null, db = pool }) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const query = `
    DELETE FROM equipment_logs
    WHERE id = $1
    ${equipmentLogsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    RETURNING id
  `;

  const result = await db.query(
    query,
    equipmentLogsHasCompany && companyId !== null ? [logId, companyId] : [logId]
  );

  return result.rows.length > 0;
};

const plantExists = async (plantId, companyId = null) => {
  if (!plantId) {
    return false;
  }

  const plantsHaveCompany = await hasColumn("plant_master", "company_id");
  const query = `
    SELECT id
    FROM plant_master
    WHERE id = $1
    ${plantsHaveCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    plantsHaveCompany && companyId !== null ? [plantId, companyId] : [plantId]
  );

  return result.rows.length > 0;
};

module.exports = {
  findAllVehicles,
  findVehiclesPage,
  findVehicleLookup,
  insertVehicle,
  editVehicle,
  setVehicleStatus,
  findAllEquipmentLogs,
  findEquipmentLogById,
  findEquipmentLogChain,
  findLatestEquipmentLog,
  insertEquipmentLog,
  removeEquipmentLog,
  updateEquipmentLog,
  plantExists,
};
