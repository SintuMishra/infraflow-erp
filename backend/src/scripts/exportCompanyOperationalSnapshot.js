const fs = require("fs");
const path = require("path");
const { pool, closePool } = require("../config/db");

const DEFAULT_TABLES = [
  "company_profile",
  "shift_master",
  "master_config_options",
  "plant_master",
  "crusher_units",
  "vehicle_type_master",
  "vendor_master",
  "vehicles",
  "party_master",
  "employees",
  "material_master",
  "unit_master",
  "material_unit_conversions",
  "party_material_rates",
  "transport_rates",
];

const sqlLiteral = (value) => {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const valuesBlock = (rows, columns) =>
  rows
    .map(
      (row) =>
        `    (${columns.map((column) => sqlLiteral(row[column])).join(", ")})`
    )
    .join(",\n");

const buildTargetCompanyCte = (companyCode) => `WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = ${sqlLiteral(companyCode)}
  LIMIT 1
)`;

const buildUnitScopeSql = (scopeKey) =>
  scopeKey === "company"
    ? "(SELECT company_id FROM target_company)"
    : "NULL::BIGINT";

const section = (title, sql) => `\n-- ${title}\n${sql}\n`;

const buildUpdateThenInsert = ({
  title,
  companyCode,
  seedColumns,
  rows,
  updateSql,
  insertSql,
}) => {
  if (!rows.length) {
    return section(title, "-- No rows found in local snapshot.");
  }

  return section(
    title,
    `${buildTargetCompanyCte(companyCode)},
seed(${seedColumns.join(", ")}) AS (
  VALUES
${valuesBlock(rows, seedColumns)}
)
${updateSql}

${buildTargetCompanyCte(companyCode)},
seed(${seedColumns.join(", ")}) AS (
  VALUES
${valuesBlock(rows, seedColumns)}
)
${insertSql}`
  );
};

const fetchSingleRow = async (query, params = []) => {
  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const fetchRows = async (query, params = []) => {
  const result = await pool.query(query, params);
  return result.rows;
};

const main = async () => {
  const companyIdArg = process.argv[2];
  const companyId = Number(companyIdArg || 2);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("Company id must be a positive integer.");
  }

  const company = await fetchSingleRow(
    `
    SELECT id, company_name AS "companyName", company_code AS "companyCode"
    FROM public.companies
    WHERE id = $1
    LIMIT 1
    `,
    [companyId]
  );

  if (!company) {
    throw new Error(`Company ${companyId} not found.`);
  }

  const companyCode = company.companyCode;
  const today = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(
    process.cwd(),
    "db",
    "admin",
    `${today}_company_${companyId}_operational_master_snapshot.sql`
  );

  const companyProfileRows = await fetchRows(
    `
    SELECT
      company_name AS "companyName",
      branch_name AS "branchName",
      address_line1 AS "addressLine1",
      address_line2 AS "addressLine2",
      city,
      state_name AS "stateName",
      state_code AS "stateCode",
      pincode,
      gstin,
      pan,
      mobile,
      email,
      bank_name AS "bankName",
      bank_account AS "bankAccount",
      ifsc_code AS "ifscCode",
      terms_notes AS "termsNotes",
      is_active AS "isActive",
      company_logo_url AS "companyLogoUrl"
    FROM public.company_profile
    WHERE company_id = $1
    `,
    [companyId]
  );

  const shiftRows = await fetchRows(
    `
    SELECT
      shift_name AS "shiftName",
      start_time::text AS "startTime",
      end_time::text AS "endTime",
      is_active AS "isActive"
    FROM public.shift_master
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const configRows = await fetchRows(
    `
    SELECT
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.master_config_options
    WHERE company_id = $1
    ORDER BY config_type, sort_order, id
    `,
    [companyId]
  );

  const plantRows = await fetchRows(
    `
    SELECT
      plant_name AS "plantName",
      plant_code AS "plantCode",
      plant_type AS "plantType",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive"
    FROM public.plant_master
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const crusherRows = await fetchRows(
    `
    SELECT
      unit_name AS "unitName",
      unit_code AS "unitCode",
      location,
      power_source_type AS "powerSourceType",
      is_active AS "isActive",
      plant_type AS "plantType"
    FROM public.crusher_units
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const vehicleTypeRows = await fetchRows(
    `
    SELECT
      type_name AS "typeName",
      category,
      is_active AS "isActive"
    FROM public.vehicle_type_master
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const vendorRows = await fetchRows(
    `
    SELECT
      vendor_name AS "vendorName",
      vendor_type AS "vendorType",
      contact_person AS "contactPerson",
      mobile_number AS "mobileNumber",
      address,
      is_active AS "isActive"
    FROM public.vendor_master
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const vehicleRows = await fetchRows(
    `
    SELECT
      vh.vehicle_number AS "vehicleNumber",
      vh.vehicle_type AS "vehicleType",
      vh.assigned_driver AS "assignedDriver",
      vh.status,
      vh.ownership_type AS "ownershipType",
      vm.vendor_name AS "vendorName",
      pm.plant_code AS "plantCode",
      vh.vehicle_capacity_tons AS "vehicleCapacityTons"
    FROM public.vehicles vh
    LEFT JOIN public.vendor_master vm ON vm.id = vh.vendor_id
    LEFT JOIN public.plant_master pm ON pm.id = vh.plant_id
    WHERE vh.company_id = $1
    ORDER BY vh.id
    `,
    [companyId]
  );

  const partyRows = await fetchRows(
    `
    SELECT
      pm.party_name AS "partyName",
      pm.party_code AS "partyCode",
      pm.contact_person AS "contactPerson",
      pm.mobile_number AS "mobileNumber",
      pm.gstin,
      pm.pan,
      pm.address_line1 AS "addressLine1",
      pm.address_line2 AS "addressLine2",
      pm.city,
      pm.state_name AS "stateName",
      pm.state_code AS "stateCode",
      pm.pincode,
      pm.party_type AS "partyType",
      pm.is_active AS "isActive",
      pm.dispatch_quantity_mode AS "dispatchQuantityMode",
      um.unit_code AS "defaultDispatchUnitCode",
      pm.allow_manual_dispatch_conversion AS "allowManualDispatchConversion"
    FROM public.party_master pm
    LEFT JOIN public.unit_master um ON um.id = pm.default_dispatch_unit_id
    WHERE pm.company_id = $1
    ORDER BY pm.id
    `,
    [companyId]
  );

  const employeeRows = await fetchRows(
    `
    SELECT
      employee_code AS "employeeCode",
      full_name AS "fullName",
      department,
      designation,
      status,
      relieving_date::text AS "relievingDate",
      remarks,
      mobile_number AS "mobileNumber",
      joining_date::text AS "joiningDate",
      email,
      emergency_contact_number AS "emergencyContactNumber",
      address,
      employment_type AS "employmentType",
      id_proof_type AS "idProofType",
      id_proof_number AS "idProofNumber"
    FROM public.employees
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const materialRows = await fetchRows(
    `
    SELECT
      material_name AS "materialName",
      material_code AS "materialCode",
      category,
      unit,
      is_active AS "isActive",
      gst_rate AS "gstRate",
      hsn_sac_code AS "hsnSacCode"
    FROM public.material_master
    WHERE company_id = $1
    ORDER BY id
    `,
    [companyId]
  );

  const unitRows = await fetchRows(
    `
    WITH referenced_units AS (
      SELECT DISTINCT default_dispatch_unit_id AS unit_id
      FROM public.party_master
      WHERE company_id = $1 AND default_dispatch_unit_id IS NOT NULL
      UNION
      SELECT DISTINCT from_unit_id
      FROM public.material_unit_conversions muc
      JOIN public.material_master mm ON mm.id = muc.material_id
      WHERE mm.company_id = $1
      UNION
      SELECT DISTINCT to_unit_id
      FROM public.material_unit_conversions muc
      JOIN public.material_master mm ON mm.id = muc.material_id
      WHERE mm.company_id = $1
      UNION
      SELECT DISTINCT rate_unit_id
      FROM public.party_material_rates
      WHERE company_id = $1 AND rate_unit_id IS NOT NULL
      UNION
      SELECT DISTINCT rate_unit_id
      FROM public.transport_rates
      WHERE company_id = $1 AND rate_unit_id IS NOT NULL
    )
    SELECT
      CASE WHEN um.company_id IS NULL THEN 'global' ELSE 'company' END AS "scopeKey",
      um.unit_code AS "unitCode",
      um.unit_name AS "unitName",
      um.dimension_type AS "dimensionType",
      um.precision_scale AS "precisionScale",
      um.is_base_unit AS "isBaseUnit",
      um.is_active AS "isActive"
    FROM public.unit_master um
    JOIN referenced_units ru ON ru.unit_id = um.id
    ORDER BY um.company_id NULLS FIRST, um.id
    `,
    [companyId]
  );

  const conversionRows = await fetchRows(
    `
    SELECT
      mm.material_code AS "materialCode",
      fu.unit_code AS "fromUnitCode",
      tu.unit_code AS "toUnitCode",
      muc.conversion_factor AS "conversionFactor",
      muc.conversion_method AS "conversionMethod",
      muc.effective_from::text AS "effectiveFrom",
      muc.effective_to::text AS "effectiveTo",
      muc.notes,
      muc.is_active AS "isActive"
    FROM public.material_unit_conversions muc
    JOIN public.material_master mm ON mm.id = muc.material_id
    JOIN public.unit_master fu ON fu.id = muc.from_unit_id
    JOIN public.unit_master tu ON tu.id = muc.to_unit_id
    WHERE mm.company_id = $1
    ORDER BY mm.material_code, fu.unit_code, tu.unit_code, muc.id
    `,
    [companyId]
  );

  const partyRateRows = await fetchRows(
    `
    SELECT
      pl.plant_code AS "plantCode",
      pt.party_code AS "partyCode",
      mm.material_code AS "materialCode",
      pmr.effective_from::text AS "effectiveFrom",
      pmr.rate_per_ton AS "ratePerTon",
      pmr.royalty_mode AS "royaltyMode",
      pmr.royalty_value AS "royaltyValue",
      pmr.loading_charge AS "loadingCharge",
      pmr.notes,
      pmr.is_active AS "isActive",
      pmr.tons_per_brass AS "tonsPerBrass",
      pmr.rate_unit AS "rateUnit",
      pmr.rate_unit_label AS "rateUnitLabel",
      pmr.rate_units_per_ton AS "rateUnitsPerTon",
      pmr.loading_charge_basis AS "loadingChargeBasis",
      ru.unit_code AS "rateUnitCode",
      pmr.billing_basis AS "billingBasis",
      pmr.price_per_unit AS "pricePerUnit"
    FROM public.party_material_rates pmr
    JOIN public.plant_master pl ON pl.id = pmr.plant_id
    JOIN public.party_master pt ON pt.id = pmr.party_id
    JOIN public.material_master mm ON mm.id = pmr.material_id
    LEFT JOIN public.unit_master ru ON ru.id = pmr.rate_unit_id
    WHERE pmr.company_id = $1
    ORDER BY pmr.id
    `,
    [companyId]
  );

  const transportRateRows = await fetchRows(
    `
    SELECT
      pl.plant_code AS "plantCode",
      vm.vendor_name AS "vendorName",
      mm.material_code AS "materialCode",
      tr.rate_type AS "rateType",
      tr.rate_value AS "rateValue",
      tr.distance_km AS "distanceKm",
      tr.is_active AS "isActive",
      ru.unit_code AS "rateUnitCode",
      tr.billing_basis AS "billingBasis",
      tr.minimum_charge AS "minimumCharge"
    FROM public.transport_rates tr
    JOIN public.plant_master pl ON pl.id = tr.plant_id
    JOIN public.vendor_master vm ON vm.id = tr.vendor_id
    JOIN public.material_master mm ON mm.id = tr.material_id
    LEFT JOIN public.unit_master ru ON ru.id = tr.rate_unit_id
    WHERE tr.company_id = $1
    ORDER BY tr.id
    `,
    [companyId]
  );

  const chunks = [];

  chunks.push("BEGIN;");
  chunks.push(`
-- Operational master-data snapshot generated from local database.
-- Company: ${company.companyName}
-- Company Code: ${companyCode}
-- Source Company ID: ${companyId}
-- Purpose:
-- Recreate locally-fed operational master/rate data in another database
-- without manual re-entry. This script only updates/inserts matching rows.
-- It does not delete unrelated target-company data.
`);

  chunks.push(
    buildUpdateThenInsert({
      title: "Company Profile",
      companyCode,
      seedColumns: [
        "companyName",
        "branchName",
        "addressLine1",
        "addressLine2",
        "city",
        "stateName",
        "stateCode",
        "pincode",
        "gstin",
        "pan",
        "mobile",
        "email",
        "bankName",
        "bankAccount",
        "ifscCode",
        "termsNotes",
        "isActive",
        "companyLogoUrl",
      ],
      rows: companyProfileRows,
      updateSql: `UPDATE public.company_profile cp
SET
  company_name = seed.companyName,
  branch_name = seed.branchName,
  address_line1 = seed.addressLine1,
  address_line2 = seed.addressLine2,
  city = seed.city,
  state_name = seed.stateName,
  state_code = seed.stateCode,
  pincode = seed.pincode,
  gstin = seed.gstin,
  pan = seed.pan,
  mobile = seed.mobile,
  email = seed.email,
  bank_name = seed.bankName,
  bank_account = seed.bankAccount,
  ifsc_code = seed.ifscCode,
  terms_notes = seed.termsNotes,
  is_active = seed.isActive,
  company_logo_url = seed.companyLogoUrl,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE cp.company_id = (SELECT company_id FROM target_company);`,
      insertSql: `INSERT INTO public.company_profile (
  company_name,
  branch_name,
  address_line1,
  address_line2,
  city,
  state_name,
  state_code,
  pincode,
  gstin,
  pan,
  mobile,
  email,
  bank_name,
  bank_account,
  ifsc_code,
  terms_notes,
  is_active,
  company_logo_url,
  company_id
)
SELECT
  seed.companyName,
  seed.branchName,
  seed.addressLine1,
  seed.addressLine2,
  seed.city,
  seed.stateName,
  seed.stateCode,
  seed.pincode,
  seed.gstin,
  seed.pan,
  seed.mobile,
  seed.email,
  seed.bankName,
  seed.bankAccount,
  seed.ifscCode,
  seed.termsNotes,
  seed.isActive,
  seed.companyLogoUrl,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_profile existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Shift Master",
      companyCode,
      seedColumns: ["shiftName", "startTime", "endTime", "isActive"],
      rows: shiftRows,
      updateSql: `UPDATE public.shift_master sm
SET
  start_time = seed.startTime::time,
  end_time = seed.endTime::time,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE sm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(sm.shift_name)) = LOWER(BTRIM(seed.shiftName));`,
      insertSql: `INSERT INTO public.shift_master (
  shift_name,
  start_time,
  end_time,
  is_active,
  company_id
)
SELECT
  seed.shiftName,
  seed.startTime::time,
  seed.endTime::time,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shift_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.shift_name)) = LOWER(BTRIM(seed.shiftName))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Config Options",
      companyCode,
      seedColumns: ["configType", "optionLabel", "optionValue", "sortOrder", "isActive"],
      rows: configRows,
      updateSql: `UPDATE public.master_config_options mco
SET
  option_label = seed.optionLabel,
  sort_order = seed.sortOrder,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE mco.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(mco.config_type)) = LOWER(BTRIM(seed.configType))
  AND LOWER(BTRIM(COALESCE(mco.option_value, ''))) = LOWER(BTRIM(COALESCE(seed.optionValue, '')));`,
      insertSql: `INSERT INTO public.master_config_options (
  config_type,
  option_label,
  option_value,
  sort_order,
  is_active,
  company_id
)
SELECT
  seed.configType,
  seed.optionLabel,
  seed.optionValue,
  seed.sortOrder,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.master_config_options existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.config_type)) = LOWER(BTRIM(seed.configType))
    AND LOWER(BTRIM(COALESCE(existing.option_value, ''))) = LOWER(BTRIM(COALESCE(seed.optionValue, '')))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Plant Master",
      companyCode,
      seedColumns: [
        "plantName",
        "plantCode",
        "plantType",
        "location",
        "powerSourceType",
        "isActive",
      ],
      rows: plantRows,
      updateSql: `UPDATE public.plant_master pm
SET
  plant_name = seed.plantName,
  plant_type = seed.plantType,
  location = seed.location,
  power_source_type = seed.powerSourceType,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode));`,
      insertSql: `INSERT INTO public.plant_master (
  plant_name,
  plant_code,
  plant_type,
  location,
  power_source_type,
  is_active,
  company_id
)
SELECT
  seed.plantName,
  seed.plantCode,
  seed.plantType,
  seed.location,
  seed.powerSourceType,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.plant_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.plant_code)) = LOWER(BTRIM(seed.plantCode))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Crusher Units",
      companyCode,
      seedColumns: [
        "unitName",
        "unitCode",
        "location",
        "powerSourceType",
        "isActive",
        "plantType",
      ],
      rows: crusherRows,
      updateSql: `UPDATE public.crusher_units cu
SET
  unit_name = seed.unitName,
  location = seed.location,
  power_source_type = seed.powerSourceType,
  is_active = seed.isActive,
  plant_type = seed.plantType,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE cu.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(cu.unit_code)) = LOWER(BTRIM(seed.unitCode));`,
      insertSql: `INSERT INTO public.crusher_units (
  unit_name,
  unit_code,
  location,
  power_source_type,
  is_active,
  company_id,
  plant_type
)
SELECT
  seed.unitName,
  seed.unitCode,
  seed.location,
  seed.powerSourceType,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.plantType
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crusher_units existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.unit_code)) = LOWER(BTRIM(seed.unitCode))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Vehicle Type Master",
      companyCode,
      seedColumns: ["typeName", "category", "isActive"],
      rows: vehicleTypeRows,
      updateSql: `UPDATE public.vehicle_type_master vt
SET
  category = seed.category,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vt.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vt.type_name)) = LOWER(BTRIM(seed.typeName));`,
      insertSql: `INSERT INTO public.vehicle_type_master (
  type_name,
  category,
  is_active,
  company_id
)
SELECT
  seed.typeName,
  seed.category,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicle_type_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.type_name)) = LOWER(BTRIM(seed.typeName))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Vendor Master",
      companyCode,
      seedColumns: [
        "vendorName",
        "vendorType",
        "contactPerson",
        "mobileNumber",
        "address",
        "isActive",
      ],
      rows: vendorRows,
      updateSql: `UPDATE public.vendor_master vm
SET
  vendor_type = seed.vendorType,
  contact_person = seed.contactPerson,
  mobile_number = seed.mobileNumber,
  address = seed.address,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName));`,
      insertSql: `INSERT INTO public.vendor_master (
  vendor_name,
  vendor_type,
  contact_person,
  mobile_number,
  address,
  is_active,
  company_id
)
SELECT
  seed.vendorName,
  seed.vendorType,
  seed.contactPerson,
  seed.mobileNumber,
  seed.address,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.vendor_name)) = LOWER(BTRIM(seed.vendorName))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Vehicles",
      companyCode,
      seedColumns: [
        "vehicleNumber",
        "vehicleType",
        "assignedDriver",
        "status",
        "ownershipType",
        "vendorName",
        "plantCode",
        "vehicleCapacityTons",
      ],
      rows: vehicleRows,
      updateSql: `UPDATE public.vehicles vh
SET
  vehicle_type = seed.vehicleType,
  assigned_driver = seed.assignedDriver,
  status = seed.status,
  ownership_type = seed.ownershipType,
  vendor_id = (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  plant_id = (
    SELECT pm.id
    FROM public.plant_master pm
    WHERE pm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  vehicle_capacity_tons = seed.vehicleCapacityTons,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vh.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vh.vehicle_number)) = LOWER(BTRIM(seed.vehicleNumber));`,
      insertSql: `INSERT INTO public.vehicles (
  vehicle_number,
  vehicle_type,
  assigned_driver,
  status,
  ownership_type,
  vendor_id,
  plant_id,
  vehicle_capacity_tons,
  company_id
)
SELECT
  seed.vehicleNumber,
  seed.vehicleType,
  seed.assignedDriver,
  seed.status,
  seed.ownershipType,
  (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  (
    SELECT pm.id
    FROM public.plant_master pm
    WHERE pm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  seed.vehicleCapacityTons,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicles existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.vehicle_number)) = LOWER(BTRIM(seed.vehicleNumber))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Party Master",
      companyCode,
      seedColumns: [
        "partyName",
        "partyCode",
        "contactPerson",
        "mobileNumber",
        "gstin",
        "pan",
        "addressLine1",
        "addressLine2",
        "city",
        "stateName",
        "stateCode",
        "pincode",
        "partyType",
        "isActive",
        "dispatchQuantityMode",
        "defaultDispatchUnitCode",
        "allowManualDispatchConversion",
      ],
      rows: partyRows,
      updateSql: `UPDATE public.party_master pm
SET
  party_name = seed.partyName,
  contact_person = seed.contactPerson,
  mobile_number = seed.mobileNumber,
  gstin = seed.gstin,
  pan = seed.pan,
  address_line1 = seed.addressLine1,
  address_line2 = seed.addressLine2,
  city = seed.city,
  state_name = seed.stateName,
  state_code = seed.stateCode,
  pincode = seed.pincode,
  party_type = seed.partyType,
  is_active = seed.isActive,
  dispatch_quantity_mode = seed.dispatchQuantityMode,
  default_dispatch_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.defaultDispatchUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  allow_manual_dispatch_conversion = seed.allowManualDispatchConversion,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(pm.party_code)) = LOWER(BTRIM(seed.partyCode));`,
      insertSql: `INSERT INTO public.party_master (
  party_name,
  party_code,
  contact_person,
  mobile_number,
  gstin,
  pan,
  address_line1,
  address_line2,
  city,
  state_name,
  state_code,
  pincode,
  party_type,
  is_active,
  company_id,
  dispatch_quantity_mode,
  default_dispatch_unit_id,
  allow_manual_dispatch_conversion
)
SELECT
  seed.partyName,
  seed.partyCode,
  seed.contactPerson,
  seed.mobileNumber,
  seed.gstin,
  seed.pan,
  seed.addressLine1,
  seed.addressLine2,
  seed.city,
  seed.stateName,
  seed.stateCode,
  seed.pincode,
  seed.partyType,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.dispatchQuantityMode,
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.defaultDispatchUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.allowManualDispatchConversion
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.party_code)) = LOWER(BTRIM(seed.partyCode))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Employees",
      companyCode,
      seedColumns: [
        "employeeCode",
        "fullName",
        "department",
        "designation",
        "status",
        "relievingDate",
        "remarks",
        "mobileNumber",
        "joiningDate",
        "email",
        "emergencyContactNumber",
        "address",
        "employmentType",
        "idProofType",
        "idProofNumber",
      ],
      rows: employeeRows,
      updateSql: `UPDATE public.employees emp
SET
  full_name = seed.fullName,
  department = seed.department,
  designation = seed.designation,
  status = seed.status,
  relieving_date = seed.relievingDate::date,
  remarks = seed.remarks,
  mobile_number = seed.mobileNumber,
  joining_date = seed.joiningDate::date,
  email = seed.email,
  emergency_contact_number = seed.emergencyContactNumber,
  address = seed.address,
  employment_type = seed.employmentType,
  id_proof_type = seed.idProofType,
  id_proof_number = seed.idProofNumber,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE emp.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(emp.employee_code)) = LOWER(BTRIM(seed.employeeCode));`,
      insertSql: `INSERT INTO public.employees (
  employee_code,
  full_name,
  department,
  designation,
  status,
  relieving_date,
  remarks,
  mobile_number,
  joining_date,
  email,
  emergency_contact_number,
  address,
  employment_type,
  id_proof_type,
  id_proof_number,
  company_id
)
SELECT
  seed.employeeCode,
  seed.fullName,
  seed.department,
  seed.designation,
  seed.status,
  seed.relievingDate::date,
  seed.remarks,
  seed.mobileNumber,
  seed.joiningDate::date,
  seed.email,
  seed.emergencyContactNumber,
  seed.address,
  seed.employmentType,
  seed.idProofType,
  seed.idProofNumber,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employees existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.employee_code)) = LOWER(BTRIM(seed.employeeCode))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Material Master",
      companyCode,
      seedColumns: [
        "materialName",
        "materialCode",
        "category",
        "unit",
        "isActive",
        "gstRate",
        "hsnSacCode",
      ],
      rows: materialRows,
      updateSql: `UPDATE public.material_master mm
SET
  material_name = seed.materialName,
  category = seed.category,
  unit = seed.unit,
  is_active = seed.isActive,
  gst_rate = seed.gstRate,
  hsn_sac_code = seed.hsnSacCode,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE mm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode));`,
      insertSql: `INSERT INTO public.material_master (
  material_name,
  material_code,
  category,
  unit,
  is_active,
  gst_rate,
  hsn_sac_code,
  company_id
)
SELECT
  seed.materialName,
  seed.materialCode,
  seed.category,
  seed.unit,
  seed.isActive,
  seed.gstRate,
  seed.hsnSacCode,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.material_code)) = LOWER(BTRIM(seed.materialCode))
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Referenced Units",
      companyCode,
      seedColumns: [
        "scopeKey",
        "unitCode",
        "unitName",
        "dimensionType",
        "precisionScale",
        "isBaseUnit",
        "isActive",
      ],
      rows: unitRows,
      updateSql: `UPDATE public.unit_master um
SET
  unit_name = seed.unitName,
  dimension_type = seed.dimensionType,
  precision_scale = seed.precisionScale,
  is_base_unit = seed.isBaseUnit,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  AND COALESCE(um.company_id, 0) = COALESCE(${buildUnitScopeSql("company")}, 0)
  AND seed.scopeKey = 'company';

UPDATE public.unit_master um
SET
  unit_name = seed.unitName,
  dimension_type = seed.dimensionType,
  precision_scale = seed.precisionScale,
  is_base_unit = seed.isBaseUnit,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  AND um.company_id IS NULL
  AND seed.scopeKey = 'global';`,
      insertSql: `INSERT INTO public.unit_master (
  company_id,
  unit_code,
  unit_name,
  dimension_type,
  precision_scale,
  is_base_unit,
  is_active
)
SELECT
  CASE WHEN seed.scopeKey = 'company' THEN (SELECT company_id FROM target_company) ELSE NULL::BIGINT END,
  seed.unitCode,
  seed.unitName,
  seed.dimensionType,
  seed.precisionScale,
  seed.isBaseUnit,
  seed.isActive
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.unit_master existing
  WHERE LOWER(BTRIM(existing.unit_code)) = LOWER(BTRIM(seed.unitCode))
    AND (
      (seed.scopeKey = 'global' AND existing.company_id IS NULL)
      OR (seed.scopeKey = 'company' AND existing.company_id = (SELECT company_id FROM target_company))
    )
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Material Unit Conversions",
      companyCode,
      seedColumns: [
        "materialCode",
        "fromUnitCode",
        "toUnitCode",
        "conversionFactor",
        "conversionMethod",
        "effectiveFrom",
        "effectiveTo",
        "notes",
        "isActive",
      ],
      rows: conversionRows,
      updateSql: `UPDATE public.material_unit_conversions muc
SET
  conversion_factor = seed.conversionFactor,
  conversion_method = seed.conversionMethod,
  effective_to = seed.effectiveTo::date,
  notes = seed.notes,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE muc.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  )
  AND muc.from_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  )
  AND muc.to_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  )
  AND COALESCE(muc.effective_from::text, '') = COALESCE(seed.effectiveFrom, '');`,
      insertSql: `INSERT INTO public.material_unit_conversions (
  company_id,
  material_id,
  from_unit_id,
  to_unit_id,
  conversion_factor,
  conversion_method,
  effective_from,
  effective_to,
  notes,
  is_active
)
SELECT
  (SELECT company_id FROM target_company),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  ),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.conversionFactor,
  seed.conversionMethod,
  seed.effectiveFrom::date,
  seed.effectiveTo::date,
  seed.notes,
  seed.isActive
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_unit_conversions existing
  WHERE existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
      LIMIT 1
    )
    AND existing.from_unit_id = (
      SELECT um.id
      FROM public.unit_master um
      WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
        AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
      ORDER BY um.company_id NULLS FIRST, um.id
      LIMIT 1
    )
    AND existing.to_unit_id = (
      SELECT um.id
      FROM public.unit_master um
      WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
        AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
      ORDER BY um.company_id NULLS FIRST, um.id
      LIMIT 1
    )
    AND COALESCE(existing.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Party Material Rates",
      companyCode,
      seedColumns: [
        "plantCode",
        "partyCode",
        "materialCode",
        "effectiveFrom",
        "ratePerTon",
        "royaltyMode",
        "royaltyValue",
        "loadingCharge",
        "notes",
        "isActive",
        "tonsPerBrass",
        "rateUnit",
        "rateUnitLabel",
        "rateUnitsPerTon",
        "loadingChargeBasis",
        "rateUnitCode",
        "billingBasis",
        "pricePerUnit",
      ],
      rows: partyRateRows,
      updateSql: `UPDATE public.party_material_rates pmr
SET
  rate_per_ton = seed.ratePerTon,
  royalty_mode = seed.royaltyMode,
  royalty_value = seed.royaltyValue,
  loading_charge = seed.loadingCharge,
  notes = seed.notes,
  is_active = seed.isActive,
  tons_per_brass = seed.tonsPerBrass,
  rate_unit = seed.rateUnit,
  rate_unit_label = seed.rateUnitLabel,
  rate_units_per_ton = seed.rateUnitsPerTon,
  loading_charge_basis = seed.loadingChargeBasis,
  rate_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  billing_basis = seed.billingBasis,
  price_per_unit = seed.pricePerUnit,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pmr.company_id = (SELECT company_id FROM target_company)
  AND pmr.plant_id = (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  )
  AND pmr.party_id = (
    SELECT pt.id
    FROM public.party_master pt
    WHERE pt.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
    LIMIT 1
  )
  AND pmr.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  )
  AND COALESCE(pmr.effective_from::text, '') = COALESCE(seed.effectiveFrom, '');`,
      insertSql: `INSERT INTO public.party_material_rates (
  plant_id,
  party_id,
  material_id,
  rate_per_ton,
  royalty_mode,
  royalty_value,
  loading_charge,
  notes,
  is_active,
  company_id,
  tons_per_brass,
  rate_unit,
  rate_unit_label,
  rate_units_per_ton,
  effective_from,
  loading_charge_basis,
  rate_unit_id,
  billing_basis,
  price_per_unit
)
SELECT
  (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  (
    SELECT pt.id
    FROM public.party_master pt
    WHERE pt.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
    LIMIT 1
  ),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  ),
  seed.ratePerTon,
  seed.royaltyMode,
  seed.royaltyValue,
  seed.loadingCharge,
  seed.notes,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.tonsPerBrass,
  seed.rateUnit,
  seed.rateUnitLabel,
  seed.rateUnitsPerTon,
  seed.effectiveFrom::date,
  seed.loadingChargeBasis,
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.billingBasis,
  seed.pricePerUnit
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_material_rates existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND existing.plant_id = (
      SELECT pl.id
      FROM public.plant_master pl
      WHERE pl.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
      LIMIT 1
    )
    AND existing.party_id = (
      SELECT pt.id
      FROM public.party_master pt
      WHERE pt.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
      LIMIT 1
    )
    AND existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
      LIMIT 1
    )
    AND COALESCE(existing.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
);`,
    })
  );

  chunks.push(
    buildUpdateThenInsert({
      title: "Transport Rates",
      companyCode,
      seedColumns: [
        "plantCode",
        "vendorName",
        "materialCode",
        "rateType",
        "rateValue",
        "distanceKm",
        "isActive",
        "rateUnitCode",
        "billingBasis",
        "minimumCharge",
      ],
      rows: transportRateRows,
      updateSql: `UPDATE public.transport_rates tr
SET
  rate_value = seed.rateValue,
  is_active = seed.isActive,
  rate_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  billing_basis = seed.billingBasis,
  minimum_charge = seed.minimumCharge,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE tr.company_id = (SELECT company_id FROM target_company)
  AND tr.plant_id = (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  )
  AND tr.vendor_id = (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  )
  AND tr.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  )
  AND COALESCE(LOWER(BTRIM(tr.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
  AND COALESCE(tr.distance_km, -1) = COALESCE(seed.distanceKm, -1);`,
      insertSql: `INSERT INTO public.transport_rates (
  plant_id,
  vendor_id,
  material_id,
  rate_type,
  rate_value,
  distance_km,
  is_active,
  company_id,
  rate_unit_id,
  billing_basis,
  minimum_charge
)
SELECT
  (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  ),
  seed.rateType,
  seed.rateValue,
  seed.distanceKm,
  seed.isActive,
  (SELECT company_id FROM target_company),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.billingBasis,
  seed.minimumCharge
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transport_rates existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND existing.plant_id = (
      SELECT pl.id
      FROM public.plant_master pl
      WHERE pl.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
      LIMIT 1
    )
    AND existing.vendor_id = (
      SELECT vm.id
      FROM public.vendor_master vm
      WHERE vm.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
      LIMIT 1
    )
    AND existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
      LIMIT 1
    )
    AND COALESCE(LOWER(BTRIM(existing.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
    AND COALESCE(existing.distance_km, -1) = COALESCE(seed.distanceKm, -1)
);`,
    })
  );

  chunks.push("\nCOMMIT;\n");

  fs.writeFileSync(outputPath, chunks.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        success: true,
        companyId,
        companyCode,
        companyName: company.companyName,
        outputPath,
        tablesIncluded: DEFAULT_TABLES,
        counts: {
          companyProfile: companyProfileRows.length,
          shiftMaster: shiftRows.length,
          masterConfigOptions: configRows.length,
          plantMaster: plantRows.length,
          crusherUnits: crusherRows.length,
          vehicleTypeMaster: vehicleTypeRows.length,
          vendorMaster: vendorRows.length,
          vehicles: vehicleRows.length,
          partyMaster: partyRows.length,
          employees: employeeRows.length,
          materialMaster: materialRows.length,
          unitMaster: unitRows.length,
          materialUnitConversions: conversionRows.length,
          partyMaterialRates: partyRateRows.length,
          transportRates: transportRateRows.length,
        },
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          success: false,
          message: error?.message || String(error),
          stack: error?.stack || null,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
