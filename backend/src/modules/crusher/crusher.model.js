const { pool } = require("../../config/db");
const {
  formatRowsDateField,
  formatRowDateField,
} = require("../../utils/date.util");
const { hasColumn } = require("../../utils/companyScope.util");

const getCrusherSchemaSupport = async () => {
  const [
    reportsHasCompany,
    hasPlantId,
    hasOperationalStatus,
    hasBreakdownHours,
    hasDowntimeReason,
    hasOpeningStockTons,
    hasClosingStockTons,
    hasOperatorsCount,
    hasMaintenanceNotes,
    hasElectricityKwh,
    hasElectricityOpeningReading,
    hasElectricityClosingReading,
    hasDieselRatePerLitre,
    hasElectricityRatePerKwh,
    hasDieselCost,
    hasElectricityCost,
    hasLabourExpense,
    hasMaintenanceExpense,
    hasOtherExpense,
    hasTotalExpense,
    hasExpenseRemarks,
  ] = await Promise.all([
    hasColumn("crusher_daily_reports", "company_id"),
    hasColumn("crusher_daily_reports", "plant_id"),
    hasColumn("crusher_daily_reports", "operational_status"),
    hasColumn("crusher_daily_reports", "breakdown_hours"),
    hasColumn("crusher_daily_reports", "downtime_reason"),
    hasColumn("crusher_daily_reports", "opening_stock_tons"),
    hasColumn("crusher_daily_reports", "closing_stock_tons"),
    hasColumn("crusher_daily_reports", "operators_count"),
    hasColumn("crusher_daily_reports", "maintenance_notes"),
    hasColumn("crusher_daily_reports", "electricity_kwh"),
    hasColumn("crusher_daily_reports", "electricity_opening_reading"),
    hasColumn("crusher_daily_reports", "electricity_closing_reading"),
    hasColumn("crusher_daily_reports", "diesel_rate_per_litre"),
    hasColumn("crusher_daily_reports", "electricity_rate_per_kwh"),
    hasColumn("crusher_daily_reports", "diesel_cost"),
    hasColumn("crusher_daily_reports", "electricity_cost"),
    hasColumn("crusher_daily_reports", "labour_expense"),
    hasColumn("crusher_daily_reports", "maintenance_expense"),
    hasColumn("crusher_daily_reports", "other_expense"),
    hasColumn("crusher_daily_reports", "total_expense"),
    hasColumn("crusher_daily_reports", "expense_remarks"),
  ]);

  return {
    reportsHasCompany,
    hasPlantId,
    hasOperationalStatus,
    hasBreakdownHours,
    hasDowntimeReason,
    hasOpeningStockTons,
    hasClosingStockTons,
    hasOperatorsCount,
    hasMaintenanceNotes,
    hasElectricityKwh,
    hasElectricityOpeningReading,
    hasElectricityClosingReading,
    hasDieselRatePerLitre,
    hasElectricityRatePerKwh,
    hasDieselCost,
    hasElectricityCost,
    hasLabourExpense,
    hasMaintenanceExpense,
    hasOtherExpense,
    hasTotalExpense,
    hasExpenseRemarks,
  };
};

const getCrusherSelectClause = (schema) => `
  cdr.id,
  cdr.report_date AS "reportDate",
  cdr.shift,
  cdr.crusher_unit_name AS "crusherUnitName",
  cdr.material_type AS "materialType",
  cdr.production_tons AS "productionTons",
  cdr.dispatch_tons AS "dispatchTons",
  cdr.machine_hours AS "machineHours",
  cdr.diesel_used AS "dieselUsed",
  cdr.remarks,
  ${schema.hasPlantId ? `cdr.plant_id AS "plantId",` : `NULL::bigint AS "plantId",`}
  ${schema.hasPlantId ? `pm.plant_name AS "plantName",` : `NULL::text AS "plantName",`}
  ${schema.hasPlantId ? `pm.plant_type AS "plantType",` : `NULL::text AS "plantType",`}
  ${
    schema.hasOperationalStatus
      ? `cdr.operational_status AS "operationalStatus",`
      : `NULL::text AS "operationalStatus",`
  }
  ${
    schema.hasBreakdownHours
      ? `cdr.breakdown_hours AS "breakdownHours",`
      : `NULL::numeric AS "breakdownHours",`
  }
  ${
    schema.hasDowntimeReason
      ? `cdr.downtime_reason AS "downtimeReason",`
      : `NULL::text AS "downtimeReason",`
  }
  ${
    schema.hasOpeningStockTons
      ? `cdr.opening_stock_tons AS "openingStockTons",`
      : `NULL::numeric AS "openingStockTons",`
  }
  ${
    schema.hasClosingStockTons
      ? `cdr.closing_stock_tons AS "closingStockTons",`
      : `NULL::numeric AS "closingStockTons",`
  }
  ${
    schema.hasOperatorsCount
      ? `cdr.operators_count AS "operatorsCount",`
      : `NULL::int AS "operatorsCount",`
  }
  ${
    schema.hasMaintenanceNotes
      ? `cdr.maintenance_notes AS "maintenanceNotes",`
      : `NULL::text AS "maintenanceNotes",`
  }
  ${schema.hasElectricityKwh ? `cdr.electricity_kwh AS "electricityKwh",` : `NULL::numeric AS "electricityKwh",`}
  ${
    schema.hasElectricityOpeningReading
      ? `cdr.electricity_opening_reading AS "electricityOpeningReading",`
      : `NULL::numeric AS "electricityOpeningReading",`
  }
  ${
    schema.hasElectricityClosingReading
      ? `cdr.electricity_closing_reading AS "electricityClosingReading",`
      : `NULL::numeric AS "electricityClosingReading",`
  }
  ${
    schema.hasDieselRatePerLitre
      ? `cdr.diesel_rate_per_litre AS "dieselRatePerLitre",`
      : `NULL::numeric AS "dieselRatePerLitre",`
  }
  ${
    schema.hasElectricityRatePerKwh
      ? `cdr.electricity_rate_per_kwh AS "electricityRatePerKwh",`
      : `NULL::numeric AS "electricityRatePerKwh",`
  }
  ${schema.hasDieselCost ? `cdr.diesel_cost AS "dieselCost",` : `NULL::numeric AS "dieselCost",`}
  ${
    schema.hasElectricityCost
      ? `cdr.electricity_cost AS "electricityCost",`
      : `NULL::numeric AS "electricityCost",`
  }
  ${
    schema.hasLabourExpense
      ? `cdr.labour_expense AS "labourExpense",`
      : `NULL::numeric AS "labourExpense",`
  }
  ${
    schema.hasMaintenanceExpense
      ? `cdr.maintenance_expense AS "maintenanceExpense",`
      : `NULL::numeric AS "maintenanceExpense",`
  }
  ${schema.hasOtherExpense ? `cdr.other_expense AS "otherExpense",` : `NULL::numeric AS "otherExpense",`}
  ${schema.hasTotalExpense ? `cdr.total_expense AS "totalExpense",` : `NULL::numeric AS "totalExpense",`}
  ${
    schema.hasExpenseRemarks
      ? `cdr.expense_remarks AS "expenseRemarks",`
      : `NULL::text AS "expenseRemarks",`
  }
  cdr.created_by AS "createdBy",
  cdr.created_at AS "createdAt",
  cdr.updated_at AS "updatedAt"
`;

const normalizeCrusherRow = (row) =>
  formatRowDateField(
    row
      ? {
          ...row,
          plantId: row.plantId === null || row.plantId === undefined ? null : Number(row.plantId),
          productionTons: row.productionTons === null ? null : Number(row.productionTons),
          dispatchTons: row.dispatchTons === null ? null : Number(row.dispatchTons),
          machineHours: row.machineHours === null ? null : Number(row.machineHours),
          dieselUsed: row.dieselUsed === null ? null : Number(row.dieselUsed),
          electricityKwh: row.electricityKwh === null ? null : Number(row.electricityKwh),
          electricityOpeningReading:
            row.electricityOpeningReading === null ? null : Number(row.electricityOpeningReading),
          electricityClosingReading:
            row.electricityClosingReading === null ? null : Number(row.electricityClosingReading),
          dieselRatePerLitre:
            row.dieselRatePerLitre === null ? null : Number(row.dieselRatePerLitre),
          electricityRatePerKwh:
            row.electricityRatePerKwh === null ? null : Number(row.electricityRatePerKwh),
          dieselCost: row.dieselCost === null ? null : Number(row.dieselCost),
          electricityCost:
            row.electricityCost === null ? null : Number(row.electricityCost),
          labourExpense: row.labourExpense === null ? null : Number(row.labourExpense),
          maintenanceExpense:
            row.maintenanceExpense === null ? null : Number(row.maintenanceExpense),
          otherExpense: row.otherExpense === null ? null : Number(row.otherExpense),
          totalExpense: row.totalExpense === null ? null : Number(row.totalExpense),
          breakdownHours: row.breakdownHours === null ? null : Number(row.breakdownHours),
          openingStockTons: row.openingStockTons === null ? null : Number(row.openingStockTons),
          closingStockTons: row.closingStockTons === null ? null : Number(row.closingStockTons),
          operatorsCount: row.operatorsCount === null ? null : Number(row.operatorsCount),
        }
      : null,
    "reportDate"
  );

const buildCrusherFilters = async ({
  companyId = null,
  search = "",
  shift = "",
  plantId = null,
  crusherUnitName = "",
  materialType = "",
  operationalStatus = "",
  startDate = "",
  endDate = "",
} = {}) => {
  const schema = await getCrusherSchemaSupport();
  const values = [];
  const conditions = [];
  let parameterIndex = 1;

  if (schema.reportsHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`cdr.company_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (schema.hasPlantId && plantId !== null && plantId !== undefined && plantId !== "") {
    values.push(Number(plantId));
    conditions.push(`cdr.plant_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (shift) {
    values.push(shift);
    conditions.push(`cdr.shift = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (crusherUnitName) {
    values.push(crusherUnitName);
    conditions.push(`cdr.crusher_unit_name = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (materialType) {
    values.push(materialType);
    conditions.push(`cdr.material_type = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (operationalStatus && schema.hasOperationalStatus) {
    values.push(operationalStatus);
    conditions.push(`cdr.operational_status = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (startDate) {
    values.push(startDate);
    conditions.push(`cdr.report_date >= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (endDate) {
    values.push(endDate);
    conditions.push(`cdr.report_date <= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const searchParam = `$${parameterIndex}`;
    const searchColumns = [
      "LOWER(COALESCE(cdr.shift, ''))",
      "LOWER(COALESCE(cdr.crusher_unit_name, ''))",
      "LOWER(COALESCE(cdr.material_type, ''))",
      "LOWER(COALESCE(cdr.remarks, ''))",
    ];

    if (schema.hasPlantId) {
      searchColumns.push("LOWER(COALESCE(pm.plant_name, ''))");
      searchColumns.push("LOWER(COALESCE(pm.plant_type, ''))");
    }

    if (schema.hasOperationalStatus) {
      searchColumns.push("LOWER(COALESCE(cdr.operational_status, ''))");
    }

    if (schema.hasDowntimeReason) {
      searchColumns.push("LOWER(COALESCE(cdr.downtime_reason, ''))");
    }

    if (schema.hasMaintenanceNotes) {
      searchColumns.push("LOWER(COALESCE(cdr.maintenance_notes, ''))");
    }

    conditions.push(`(${searchColumns.map((column) => `${column} LIKE ${searchParam}`).join(" OR ")})`);
    parameterIndex += 1;
  }

  return {
    schema,
    values,
    joinClause: schema.hasPlantId
      ? "LEFT JOIN plant_master pm ON pm.id = cdr.plant_id"
      : "",
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
  };
};

const findAllCrusherReports = async (filters = {}) => {
  const normalizedLimit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
  const normalizedPage = Math.max(Number(filters.page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;
  const { schema, values, joinClause, whereClause } = await buildCrusherFilters(filters);
  const queryValues = [...values, normalizedLimit, offset];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const result = await pool.query(
    `
    SELECT
      ${getCrusherSelectClause(schema)},
      COUNT(*) OVER()::int AS "totalCount"
    FROM crusher_daily_reports cdr
    ${joinClause}
    ${whereClause}
    ORDER BY cdr.report_date DESC, cdr.id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    queryValues
  );

  return {
    items: formatRowsDateField(
      result.rows.map(({ totalCount, ...row }) => normalizeCrusherRow(row)),
      "reportDate"
    ),
    total: result.rows[0]?.totalCount || 0,
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const findCrusherReportSummary = async (filters = {}) => {
  const { schema, values, joinClause, whereClause } = await buildCrusherFilters(filters);
  const result = await pool.query(
    `
    WITH filtered_reports AS (
      SELECT
        cdr.*,
        ${schema.hasPlantId ? `pm.plant_name AS plant_name,` : `NULL::text AS plant_name,`}
        ${schema.hasPlantId ? `pm.plant_type AS plant_type` : `NULL::text AS plant_type`}
      FROM crusher_daily_reports cdr
      ${joinClause}
      ${whereClause}
    )
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(production_tons), 0)::numeric AS "totalProduction",
      COALESCE(SUM(dispatch_tons), 0)::numeric AS "totalDispatch",
      COALESCE(SUM(diesel_used), 0)::numeric AS "totalDiesel",
      ${schema.hasElectricityKwh ? `COALESCE(SUM(electricity_kwh), 0)::numeric AS "totalElectricityKwh",` : `0::numeric AS "totalElectricityKwh",`}
      ${schema.hasElectricityCost ? `COALESCE(SUM(electricity_cost), 0)::numeric AS "totalElectricityCost",` : `0::numeric AS "totalElectricityCost",`}
      ${schema.hasTotalExpense ? `COALESCE(SUM(total_expense), 0)::numeric AS "totalExpense",` : `0::numeric AS "totalExpense",`}
      COALESCE(SUM(machine_hours), 0)::numeric AS "totalMachineHours",
      COUNT(DISTINCT COALESCE(NULLIF(BTRIM(plant_name), ''), NULLIF(BTRIM(crusher_unit_name), '')))::int AS "uniqueUnits",
      COUNT(DISTINCT material_type)::int AS "uniqueMaterials",
      MAX(report_date)::date AS "latestDate",
      (
        SELECT COALESCE(NULLIF(BTRIM(plant_name), ''), NULLIF(BTRIM(crusher_unit_name), ''), 'Unknown Unit')
        FROM filtered_reports
        GROUP BY COALESCE(NULLIF(BTRIM(plant_name), ''), NULLIF(BTRIM(crusher_unit_name), ''), 'Unknown Unit')
        ORDER BY COALESCE(SUM(production_tons), 0) DESC, COALESCE(NULLIF(BTRIM(plant_name), ''), NULLIF(BTRIM(crusher_unit_name), ''), 'Unknown Unit') ASC
        LIMIT 1
      ) AS "topUnitName"
      ${
        schema.hasBreakdownHours
          ? `, COALESCE(SUM(breakdown_hours), 0)::numeric AS "totalBreakdownHours"`
          : `, 0::numeric AS "totalBreakdownHours"`
      }
    FROM filtered_reports
    `,
    values
  );

  return result.rows[0] || {
    total: 0,
    totalProduction: 0,
    totalDispatch: 0,
    totalDiesel: 0,
    totalElectricityKwh: 0,
    totalElectricityCost: 0,
    totalExpense: 0,
    totalMachineHours: 0,
    uniqueUnits: 0,
    uniqueMaterials: 0,
    latestDate: null,
    totalBreakdownHours: 0,
    topUnitName: null,
  };
};

const findCrusherReportLookups = async (companyId = null) => {
  const schema = await getCrusherSchemaSupport();
  const whereClause = schema.reportsHasCompany && companyId !== null ? "WHERE cdr.company_id = $1" : "";
  const values = schema.reportsHasCompany && companyId !== null ? [companyId] : [];

  const result = await pool.query(
    `
    SELECT
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT cdr.shift ORDER BY cdr.shift), NULL) AS "shifts",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT cdr.crusher_unit_name ORDER BY cdr.crusher_unit_name), NULL) AS "crusherUnits",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT cdr.material_type ORDER BY cdr.material_type), NULL) AS "materialTypes"
      ${
        schema.hasPlantId
          ? `,
      COALESCE(
        JSONB_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id',
            cdr.plant_id,
            'plantName',
            pm.plant_name,
            'plantType',
            pm.plant_type
          )
        ) FILTER (WHERE cdr.plant_id IS NOT NULL),
        '[]'::jsonb
      ) AS "plants"`
          : `, '[]'::jsonb AS "plants"`
      }
      ${
        schema.hasOperationalStatus
          ? `, ARRAY_REMOVE(ARRAY_AGG(DISTINCT cdr.operational_status ORDER BY cdr.operational_status), NULL) AS "operationalStatuses"`
          : `, ARRAY[]::text[] AS "operationalStatuses"`
      }
    FROM crusher_daily_reports cdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = cdr.plant_id" : ""}
    ${whereClause}
    `,
    values
  );

  return {
    shifts: result.rows[0]?.shifts || [],
    crusherUnits: result.rows[0]?.crusherUnits || [],
    materialTypes: result.rows[0]?.materialTypes || [],
    plants: result.rows[0]?.plants || [],
    operationalStatuses: result.rows[0]?.operationalStatuses || [],
  };
};

const insertCrusherReport = async (payload) => {
  const schema = await getCrusherSchemaSupport();
  const columns = [
    "report_date",
    "shift",
    "crusher_unit_name",
    "material_type",
    "production_tons",
    "dispatch_tons",
    "machine_hours",
    "diesel_used",
    "remarks",
    "created_by",
  ];
  const values = [
    payload.reportDate,
    payload.shift,
    payload.crusherUnitName,
    payload.materialType,
    payload.productionTons,
    payload.dispatchTons,
    payload.machineHours,
    payload.dieselUsed,
    payload.remarks || null,
    payload.createdBy || null,
  ];

  if (schema.hasPlantId) {
    columns.push("plant_id");
    values.push(payload.plantId ?? null);
  }
  if (schema.hasOperationalStatus) {
    columns.push("operational_status");
    values.push(payload.operationalStatus || null);
  }
  if (schema.hasBreakdownHours) {
    columns.push("breakdown_hours");
    values.push(payload.breakdownHours ?? null);
  }
  if (schema.hasDowntimeReason) {
    columns.push("downtime_reason");
    values.push(payload.downtimeReason || null);
  }
  if (schema.hasOpeningStockTons) {
    columns.push("opening_stock_tons");
    values.push(payload.openingStockTons ?? null);
  }
  if (schema.hasClosingStockTons) {
    columns.push("closing_stock_tons");
    values.push(payload.closingStockTons ?? null);
  }
  if (schema.hasOperatorsCount) {
    columns.push("operators_count");
    values.push(payload.operatorsCount ?? null);
  }
  if (schema.hasMaintenanceNotes) {
    columns.push("maintenance_notes");
    values.push(payload.maintenanceNotes || null);
  }
  if (schema.hasElectricityKwh) {
    columns.push("electricity_kwh");
    values.push(payload.electricityKwh ?? null);
  }
  if (schema.hasElectricityOpeningReading) {
    columns.push("electricity_opening_reading");
    values.push(payload.electricityOpeningReading ?? null);
  }
  if (schema.hasElectricityClosingReading) {
    columns.push("electricity_closing_reading");
    values.push(payload.electricityClosingReading ?? null);
  }
  if (schema.hasDieselRatePerLitre) {
    columns.push("diesel_rate_per_litre");
    values.push(payload.dieselRatePerLitre ?? null);
  }
  if (schema.hasElectricityRatePerKwh) {
    columns.push("electricity_rate_per_kwh");
    values.push(payload.electricityRatePerKwh ?? null);
  }
  if (schema.hasDieselCost) {
    columns.push("diesel_cost");
    values.push(payload.dieselCost ?? null);
  }
  if (schema.hasElectricityCost) {
    columns.push("electricity_cost");
    values.push(payload.electricityCost ?? null);
  }
  if (schema.hasLabourExpense) {
    columns.push("labour_expense");
    values.push(payload.labourExpense ?? null);
  }
  if (schema.hasMaintenanceExpense) {
    columns.push("maintenance_expense");
    values.push(payload.maintenanceExpense ?? null);
  }
  if (schema.hasOtherExpense) {
    columns.push("other_expense");
    values.push(payload.otherExpense ?? null);
  }
  if (schema.hasTotalExpense) {
    columns.push("total_expense");
    values.push(payload.totalExpense ?? null);
  }
  if (schema.hasExpenseRemarks) {
    columns.push("expense_remarks");
    values.push(payload.expenseRemarks || null);
  }
  if (schema.reportsHasCompany) {
    columns.push("company_id");
    values.push(payload.companyId || null);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await pool.query(
    `
    INSERT INTO crusher_daily_reports (${columns.join(", ")})
    VALUES (${placeholders})
    RETURNING ctid
    `,
    values
  );

  const created = await pool.query(
    `
    SELECT ${getCrusherSelectClause(schema)}
    FROM crusher_daily_reports cdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = cdr.plant_id" : ""}
    WHERE cdr.ctid = $1
    LIMIT 1
    `,
    [result.rows[0].ctid]
  );

  return normalizeCrusherRow(created.rows[0]);
};

const updateCrusherReportById = async (payload) => {
  const schema = await getCrusherSchemaSupport();
  const values = [
    payload.reportDate,
    payload.shift,
    payload.crusherUnitName,
    payload.materialType,
    payload.productionTons,
    payload.dispatchTons,
    payload.machineHours,
    payload.dieselUsed,
    payload.remarks || null,
  ];
  const assignments = [
    "report_date = $1",
    "shift = $2",
    "crusher_unit_name = $3",
    "material_type = $4",
    "production_tons = $5",
    "dispatch_tons = $6",
    "machine_hours = $7",
    "diesel_used = $8",
    "remarks = $9",
  ];

  if (schema.hasPlantId) {
    values.push(payload.plantId ?? null);
    assignments.push(`plant_id = $${values.length}`);
  }
  if (schema.hasOperationalStatus) {
    values.push(payload.operationalStatus || null);
    assignments.push(`operational_status = $${values.length}`);
  }
  if (schema.hasBreakdownHours) {
    values.push(payload.breakdownHours ?? null);
    assignments.push(`breakdown_hours = $${values.length}`);
  }
  if (schema.hasDowntimeReason) {
    values.push(payload.downtimeReason || null);
    assignments.push(`downtime_reason = $${values.length}`);
  }
  if (schema.hasOpeningStockTons) {
    values.push(payload.openingStockTons ?? null);
    assignments.push(`opening_stock_tons = $${values.length}`);
  }
  if (schema.hasClosingStockTons) {
    values.push(payload.closingStockTons ?? null);
    assignments.push(`closing_stock_tons = $${values.length}`);
  }
  if (schema.hasOperatorsCount) {
    values.push(payload.operatorsCount ?? null);
    assignments.push(`operators_count = $${values.length}`);
  }
  if (schema.hasMaintenanceNotes) {
    values.push(payload.maintenanceNotes || null);
    assignments.push(`maintenance_notes = $${values.length}`);
  }
  if (schema.hasElectricityKwh) {
    values.push(payload.electricityKwh ?? null);
    assignments.push(`electricity_kwh = $${values.length}`);
  }
  if (schema.hasElectricityOpeningReading) {
    values.push(payload.electricityOpeningReading ?? null);
    assignments.push(`electricity_opening_reading = $${values.length}`);
  }
  if (schema.hasElectricityClosingReading) {
    values.push(payload.electricityClosingReading ?? null);
    assignments.push(`electricity_closing_reading = $${values.length}`);
  }
  if (schema.hasDieselRatePerLitre) {
    values.push(payload.dieselRatePerLitre ?? null);
    assignments.push(`diesel_rate_per_litre = $${values.length}`);
  }
  if (schema.hasElectricityRatePerKwh) {
    values.push(payload.electricityRatePerKwh ?? null);
    assignments.push(`electricity_rate_per_kwh = $${values.length}`);
  }
  if (schema.hasDieselCost) {
    values.push(payload.dieselCost ?? null);
    assignments.push(`diesel_cost = $${values.length}`);
  }
  if (schema.hasElectricityCost) {
    values.push(payload.electricityCost ?? null);
    assignments.push(`electricity_cost = $${values.length}`);
  }
  if (schema.hasLabourExpense) {
    values.push(payload.labourExpense ?? null);
    assignments.push(`labour_expense = $${values.length}`);
  }
  if (schema.hasMaintenanceExpense) {
    values.push(payload.maintenanceExpense ?? null);
    assignments.push(`maintenance_expense = $${values.length}`);
  }
  if (schema.hasOtherExpense) {
    values.push(payload.otherExpense ?? null);
    assignments.push(`other_expense = $${values.length}`);
  }
  if (schema.hasTotalExpense) {
    values.push(payload.totalExpense ?? null);
    assignments.push(`total_expense = $${values.length}`);
  }
  if (schema.hasExpenseRemarks) {
    values.push(payload.expenseRemarks || null);
    assignments.push(`expense_remarks = $${values.length}`);
  }

  values.push(payload.id);
  let whereClause = `id = $${values.length}`;

  if (schema.reportsHasCompany && payload.companyId !== null) {
    values.push(payload.companyId);
    whereClause += ` AND company_id = $${values.length}`;
  }

  const result = await pool.query(
    `
    UPDATE crusher_daily_reports
    SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE ${whereClause}
    RETURNING ctid
    `,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  const updated = await pool.query(
    `
    SELECT ${getCrusherSelectClause(schema)}
    FROM crusher_daily_reports cdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = cdr.plant_id" : ""}
    WHERE cdr.ctid = $1
    LIMIT 1
    `,
    [result.rows[0].ctid]
  );

  return normalizeCrusherRow(updated.rows[0] || null);
};

const deleteCrusherReportById = async ({ id, companyId = null }) => {
  const schema = await getCrusherSchemaSupport();
  const values = [id];
  let whereClause = "cdr.id = $1";

  if (schema.reportsHasCompany && companyId !== null) {
    values.push(companyId);
    whereClause += " AND cdr.company_id = $2";
  }

  const result = await pool.query(
    `
    WITH deleted_row AS (
      DELETE FROM crusher_daily_reports cdr
      WHERE ${whereClause}
      RETURNING *
    )
    SELECT
      deleted_row.id,
      deleted_row.report_date AS "reportDate",
      deleted_row.shift,
      deleted_row.crusher_unit_name AS "crusherUnitName",
      deleted_row.material_type AS "materialType",
      deleted_row.production_tons AS "productionTons",
      deleted_row.dispatch_tons AS "dispatchTons",
      deleted_row.machine_hours AS "machineHours",
      deleted_row.diesel_used AS "dieselUsed",
      deleted_row.remarks,
      ${schema.hasPlantId ? `deleted_row.plant_id AS "plantId",` : `NULL::bigint AS "plantId",`}
      ${schema.hasPlantId ? `pm.plant_name AS "plantName",` : `NULL::text AS "plantName",`}
      ${schema.hasPlantId ? `pm.plant_type AS "plantType",` : `NULL::text AS "plantType",`}
      ${
        schema.hasOperationalStatus
          ? `deleted_row.operational_status AS "operationalStatus",`
          : `NULL::text AS "operationalStatus",`
      }
      ${
        schema.hasBreakdownHours
          ? `deleted_row.breakdown_hours AS "breakdownHours",`
          : `NULL::numeric AS "breakdownHours",`
      }
      ${
        schema.hasDowntimeReason
          ? `deleted_row.downtime_reason AS "downtimeReason",`
          : `NULL::text AS "downtimeReason",`
      }
      ${
        schema.hasOpeningStockTons
          ? `deleted_row.opening_stock_tons AS "openingStockTons",`
          : `NULL::numeric AS "openingStockTons",`
      }
      ${
        schema.hasClosingStockTons
          ? `deleted_row.closing_stock_tons AS "closingStockTons",`
          : `NULL::numeric AS "closingStockTons",`
      }
      ${
        schema.hasOperatorsCount
          ? `deleted_row.operators_count AS "operatorsCount",`
          : `NULL::int AS "operatorsCount",`
      }
      ${
        schema.hasMaintenanceNotes
          ? `deleted_row.maintenance_notes AS "maintenanceNotes",`
          : `NULL::text AS "maintenanceNotes",`
      }
      ${schema.hasElectricityKwh ? `deleted_row.electricity_kwh AS "electricityKwh",` : `NULL::numeric AS "electricityKwh",`}
      ${
        schema.hasElectricityOpeningReading
          ? `deleted_row.electricity_opening_reading AS "electricityOpeningReading",`
          : `NULL::numeric AS "electricityOpeningReading",`
      }
      ${
        schema.hasElectricityClosingReading
          ? `deleted_row.electricity_closing_reading AS "electricityClosingReading",`
          : `NULL::numeric AS "electricityClosingReading",`
      }
      ${
        schema.hasDieselRatePerLitre
          ? `deleted_row.diesel_rate_per_litre AS "dieselRatePerLitre",`
          : `NULL::numeric AS "dieselRatePerLitre",`
      }
      ${schema.hasDieselCost ? `deleted_row.diesel_cost AS "dieselCost",` : `NULL::numeric AS "dieselCost",`}
      ${
        schema.hasElectricityRatePerKwh
          ? `deleted_row.electricity_rate_per_kwh AS "electricityRatePerKwh",`
          : `NULL::numeric AS "electricityRatePerKwh",`
      }
      ${
        schema.hasElectricityCost
          ? `deleted_row.electricity_cost AS "electricityCost",`
          : `NULL::numeric AS "electricityCost",`
      }
      ${
        schema.hasLabourExpense
          ? `deleted_row.labour_expense AS "labourExpense",`
          : `NULL::numeric AS "labourExpense",`
      }
      ${
        schema.hasMaintenanceExpense
          ? `deleted_row.maintenance_expense AS "maintenanceExpense",`
          : `NULL::numeric AS "maintenanceExpense",`
      }
      ${
        schema.hasOtherExpense
          ? `deleted_row.other_expense AS "otherExpense",`
          : `NULL::numeric AS "otherExpense",`
      }
      ${schema.hasTotalExpense ? `deleted_row.total_expense AS "totalExpense",` : `NULL::numeric AS "totalExpense",`}
      ${
        schema.hasExpenseRemarks
          ? `deleted_row.expense_remarks AS "expenseRemarks",`
          : `NULL::text AS "expenseRemarks",`
      }
      deleted_row.created_by AS "createdBy",
      deleted_row.created_at AS "createdAt",
      deleted_row.updated_at AS "updatedAt"
    FROM deleted_row
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = deleted_row.plant_id" : ""}
    `,
    values
  );

  return normalizeCrusherRow(result.rows[0] || null);
};

module.exports = {
  buildCrusherFilters,
  findAllCrusherReports,
  findCrusherReportSummary,
  findCrusherReportLookups,
  insertCrusherReport,
  updateCrusherReportById,
  deleteCrusherReportById,
};
