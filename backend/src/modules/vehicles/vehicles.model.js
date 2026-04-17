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

const findAllVehicles = async (companyId = null) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    ${baseVehicleSelect}
    ${vehiclesHasCompany && companyId !== null ? `WHERE v.company_id = $1` : ""}
    ORDER BY v.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return result.rows.map((row) => ({
    ...row,
    vehicleCapacityTons:
      row.vehicleCapacityTons !== null ? Number(row.vehicleCapacityTons) : null,
  }));
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
      ${vehiclesHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8${vehiclesHasCompany ? `, $9` : ""})
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
  const row = fetchResult.rows[0];

  return {
    ...row,
    vehicleCapacityTons:
      row.vehicleCapacityTons !== null ? Number(row.vehicleCapacityTons) : null,
  };
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
  const row = fetchResult.rows[0];

  return {
    ...row,
    vehicleCapacityTons:
      row.vehicleCapacityTons !== null ? Number(row.vehicleCapacityTons) : null,
  };
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
  const row = fetchResult.rows[0];

  return {
    ...row,
    vehicleCapacityTons:
      row.vehicleCapacityTons !== null ? Number(row.vehicleCapacityTons) : null,
  };
};

const findAllEquipmentLogs = async (companyId = null) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const query = `
    SELECT
      el.id,
      el.usage_date AS "usageDate",
      el.equipment_name AS "equipmentName",
      el.equipment_type AS "equipmentType",
      el.site_name AS "siteName",
      el.usage_hours AS "usageHours",
      el.fuel_used AS "fuelUsed",
      el.remarks,
      el.created_by AS "createdBy",
      el.plant_id AS "plantId",
      p.plant_name AS "plantName",
      p.plant_type AS "plantType",
      el.created_at AS "createdAt",
      el.updated_at AS "updatedAt"
    FROM equipment_logs el
    LEFT JOIN plant_master p ON p.id = el.plant_id
    ${equipmentLogsHasCompany && companyId !== null ? `WHERE el.company_id = $1` : ""}
    ORDER BY el.id DESC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);
  return formatRowsDateField(result.rows, "usageDate");
};

const insertEquipmentLog = async ({
  usageDate,
  equipmentName,
  equipmentType,
  siteName,
  usageHours,
  fuelUsed,
  remarks,
  createdBy,
  plantId,
  companyId,
}) => {
  const equipmentLogsHasCompany = await hasColumn("equipment_logs", "company_id");
  const query = `
    INSERT INTO equipment_logs (
      usage_date,
      equipment_name,
      equipment_type,
      site_name,
      usage_hours,
      fuel_used,
      remarks,
      created_by,
      plant_id
      ${equipmentLogsHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${equipmentLogsHasCompany ? `, $10` : ""})
    RETURNING
      id,
      usage_date AS "usageDate",
      equipment_name AS "equipmentName",
      equipment_type AS "equipmentType",
      site_name AS "siteName",
      usage_hours AS "usageHours",
      fuel_used AS "fuelUsed",
      remarks,
      created_by AS "createdBy",
      plant_id AS "plantId",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [
    usageDate,
    equipmentName,
    equipmentType,
    siteName || null,
    usageHours,
    fuelUsed,
    remarks || null,
    createdBy,
    plantId || null,
    ...(equipmentLogsHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const plantExists = async (plantId, companyId = null) => {
  if (!plantId) return false;
  const plantsHasCompany = await hasColumn("plant_master", "company_id");

  const query = `
    SELECT id
    FROM plant_master
    WHERE id = $1
    ${plantsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    plantsHasCompany && companyId !== null ? [plantId, companyId] : [plantId]
  );
  return result.rows.length > 0;
};

module.exports = {
  findAllVehicles,
  insertVehicle,
  editVehicle,
  setVehicleStatus,
  findAllEquipmentLogs,
  insertEquipmentLog,
  plantExists,
};
