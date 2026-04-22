const { pool } = require("../../config/db");
const {
  formatRowsDateField,
  formatRowDateField,
} = require("../../utils/date.util");
const { hasColumn } = require("../../utils/companyScope.util");

const getProjectReportSchemaSupport = async () => {
  const [
    reportsHasCompany,
    hasPlantId,
    hasShift,
    hasWeather,
    hasProgressPercent,
    hasBlockers,
    hasNextPlan,
    hasReportStatus,
  ] = await Promise.all([
    hasColumn("project_daily_reports", "company_id"),
    hasColumn("project_daily_reports", "plant_id"),
    hasColumn("project_daily_reports", "shift"),
    hasColumn("project_daily_reports", "weather"),
    hasColumn("project_daily_reports", "progress_percent"),
    hasColumn("project_daily_reports", "blockers"),
    hasColumn("project_daily_reports", "next_plan"),
    hasColumn("project_daily_reports", "report_status"),
  ]);

  return {
    reportsHasCompany,
    hasPlantId,
    hasShift,
    hasWeather,
    hasProgressPercent,
    hasBlockers,
    hasNextPlan,
    hasReportStatus,
  };
};

const getProjectReportSelectClause = (schema) => `
  pdr.id,
  pdr.report_date AS "reportDate",
  pdr.project_name AS "projectName",
  pdr.site_name AS "siteName",
  pdr.work_done AS "workDone",
  pdr.labour_count AS "labourCount",
  pdr.machine_count AS "machineCount",
  pdr.material_used AS "materialUsed",
  pdr.remarks,
  ${schema.hasPlantId ? `pdr.plant_id AS "plantId",` : `NULL::bigint AS "plantId",`}
  ${schema.hasPlantId ? `pm.plant_name AS "plantName",` : `NULL::text AS "plantName",`}
  ${schema.hasPlantId ? `pm.plant_type AS "plantType",` : `NULL::text AS "plantType",`}
  ${schema.hasShift ? `pdr.shift AS "shift",` : `NULL::text AS "shift",`}
  ${schema.hasWeather ? `pdr.weather AS "weather",` : `NULL::text AS "weather",`}
  ${
    schema.hasProgressPercent
      ? `pdr.progress_percent AS "progressPercent",`
      : `NULL::numeric AS "progressPercent",`
  }
  ${schema.hasBlockers ? `pdr.blockers AS "blockers",` : `NULL::text AS "blockers",`}
  ${schema.hasNextPlan ? `pdr.next_plan AS "nextPlan",` : `NULL::text AS "nextPlan",`}
  ${schema.hasReportStatus ? `pdr.report_status AS "reportStatus",` : `NULL::text AS "reportStatus",`}
  pdr.created_by AS "createdBy",
  pdr.created_at AS "createdAt",
  pdr.updated_at AS "updatedAt"
`;

const normalizeProjectReportRow = (row) =>
  formatRowDateField(
    row
      ? {
          ...row,
          plantId: row.plantId === null || row.plantId === undefined ? null : Number(row.plantId),
          progressPercent:
            row.progressPercent === null || row.progressPercent === undefined
              ? null
              : Number(row.progressPercent),
        }
      : null,
    "reportDate"
  );

const buildProjectReportFilters = async ({
  companyId = null,
  search = "",
  plantId = null,
  projectName = "",
  siteName = "",
  reportStatus = "",
  startDate = "",
  endDate = "",
} = {}) => {
  const schema = await getProjectReportSchemaSupport();
  const values = [];
  const conditions = [];
  let parameterIndex = 1;

  if (schema.reportsHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`pdr.company_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (schema.hasPlantId && plantId !== null && plantId !== undefined && plantId !== "") {
    values.push(Number(plantId));
    conditions.push(`pdr.plant_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (projectName) {
    values.push(projectName);
    conditions.push(`pdr.project_name = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (siteName) {
    values.push(siteName);
    conditions.push(`pdr.site_name = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (reportStatus && schema.hasReportStatus) {
    values.push(reportStatus);
    conditions.push(`pdr.report_status = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (startDate) {
    values.push(startDate);
    conditions.push(`pdr.report_date >= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (endDate) {
    values.push(endDate);
    conditions.push(`pdr.report_date <= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const searchParam = `$${parameterIndex}`;
    const searchColumns = [
      "LOWER(COALESCE(pdr.project_name, ''))",
      "LOWER(COALESCE(pdr.site_name, ''))",
      "LOWER(COALESCE(pdr.work_done, ''))",
      "LOWER(COALESCE(pdr.material_used, ''))",
      "LOWER(COALESCE(pdr.remarks, ''))",
    ];

    if (schema.hasPlantId) {
      searchColumns.push("LOWER(COALESCE(pm.plant_name, ''))");
      searchColumns.push("LOWER(COALESCE(pm.plant_type, ''))");
    }

    if (schema.hasShift) {
      searchColumns.push("LOWER(COALESCE(pdr.shift, ''))");
    }

    if (schema.hasWeather) {
      searchColumns.push("LOWER(COALESCE(pdr.weather, ''))");
    }

    if (schema.hasBlockers) {
      searchColumns.push("LOWER(COALESCE(pdr.blockers, ''))");
    }

    if (schema.hasNextPlan) {
      searchColumns.push("LOWER(COALESCE(pdr.next_plan, ''))");
    }

    if (schema.hasReportStatus) {
      searchColumns.push("LOWER(COALESCE(pdr.report_status, ''))");
    }

    conditions.push(`(${searchColumns.map((column) => `${column} LIKE ${searchParam}`).join(" OR ")})`);
    parameterIndex += 1;
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    joinClause: schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = pdr.plant_id" : "",
    schema,
  };
};

const findAllProjectReports = async (filters = {}) => {
  const normalizedLimit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
  const normalizedPage = Math.max(Number(filters.page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;
  const { whereClause, values, joinClause, schema } = await buildProjectReportFilters(filters);
  const queryValues = [...values, normalizedLimit, offset];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;
  const query = `
    SELECT
      ${getProjectReportSelectClause(schema)},
      COUNT(*) OVER()::int AS "totalCount"
    FROM project_daily_reports pdr
    ${joinClause}
    ${whereClause}
    ORDER BY pdr.report_date DESC, pdr.id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const result = await pool.query(query, queryValues);

  return {
    items: formatRowsDateField(
      result.rows.map(({ totalCount, ...row }) => normalizeProjectReportRow(row)),
      "reportDate"
    ),
    total: result.rows[0]?.totalCount || 0,
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const findProjectReportSummary = async (filters = {}) => {
  const { whereClause, values, joinClause, schema } = await buildProjectReportFilters(filters);
  const result = await pool.query(
    `
    WITH filtered_reports AS (
      SELECT
        pdr.*,
        ${schema.hasPlantId ? `pm.plant_name AS plant_name` : `NULL::text AS plant_name`}
      FROM project_daily_reports pdr
      ${joinClause}
      ${whereClause}
    )
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(labour_count), 0)::int AS "totalLabour",
      COALESCE(SUM(machine_count), 0)::int AS "totalMachines",
      COUNT(DISTINCT project_name)::int AS "uniqueProjects",
      COUNT(DISTINCT site_name)::int AS "uniqueSites",
      COUNT(DISTINCT plant_id)::int AS "uniquePlants",
      MAX(report_date)::date AS "latestDate",
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(material_used, '')), '') IS NOT NULL)::int AS "materialEntries",
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(remarks, '')), '') IS NOT NULL)::int AS "remarkEntries",
      (
        SELECT project_name
        FROM filtered_reports
        GROUP BY project_name
        ORDER BY COALESCE(SUM(labour_count), 0) DESC, project_name ASC
        LIMIT 1
      ) AS "topProjectName"
    FROM filtered_reports
    `,
    values
  );

  return result.rows[0] || {
    total: 0,
    totalLabour: 0,
    totalMachines: 0,
    uniqueProjects: 0,
    uniqueSites: 0,
    uniquePlants: 0,
    latestDate: null,
    materialEntries: 0,
    remarkEntries: 0,
    topProjectName: null,
  };
};

const findProjectReportLookups = async (companyId = null) => {
  const schema = await getProjectReportSchemaSupport();
  const whereClause = schema.reportsHasCompany && companyId !== null ? "WHERE pdr.company_id = $1" : "";
  const values = schema.reportsHasCompany && companyId !== null ? [companyId] : [];
  const result = await pool.query(
    `
    SELECT
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT pdr.project_name ORDER BY pdr.project_name), NULL) AS "projectNames",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT pdr.site_name ORDER BY pdr.site_name), NULL) AS "siteNames"
      ${
        schema.hasPlantId
          ? `,
      COALESCE(
        JSONB_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id',
            pdr.plant_id,
            'plantName',
            pm.plant_name,
            'plantType',
            pm.plant_type
          )
        ) FILTER (WHERE pdr.plant_id IS NOT NULL),
        '[]'::jsonb
      ) AS "plants"`
          : `, '[]'::jsonb AS "plants"`
      }
      ${
        schema.hasReportStatus
          ? `, ARRAY_REMOVE(ARRAY_AGG(DISTINCT pdr.report_status ORDER BY pdr.report_status), NULL) AS "reportStatuses"`
          : `, ARRAY[]::text[] AS "reportStatuses"`
      }
      ${
        schema.hasShift
          ? `, ARRAY_REMOVE(ARRAY_AGG(DISTINCT pdr.shift ORDER BY pdr.shift), NULL) AS "shifts"`
          : `, ARRAY[]::text[] AS "shifts"`
      }
    FROM project_daily_reports pdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = pdr.plant_id" : ""}
    ${whereClause}
    `,
    values
  );

  return {
    projectNames: result.rows[0]?.projectNames || [],
    siteNames: result.rows[0]?.siteNames || [],
    plants: result.rows[0]?.plants || [],
    reportStatuses: result.rows[0]?.reportStatuses || [],
    shifts: result.rows[0]?.shifts || [],
  };
};

const insertProjectReport = async ({
  reportDate,
  plantId,
  projectName,
  siteName,
  workDone,
  labourCount,
  machineCount,
  materialUsed,
  remarks,
  shift,
  weather,
  progressPercent,
  blockers,
  nextPlan,
  reportStatus,
  createdBy,
  companyId,
}) => {
  const schema = await getProjectReportSchemaSupport();
  const columns = [
    "report_date",
    "project_name",
    "site_name",
    "work_done",
    "labour_count",
    "machine_count",
    "material_used",
    "remarks",
    "created_by",
  ];
  const values = [
    reportDate,
    projectName,
    siteName,
    workDone,
    labourCount,
    machineCount,
    materialUsed || null,
    remarks || null,
    createdBy || null,
  ];

  if (schema.hasPlantId) {
    columns.push("plant_id");
    values.push(plantId ?? null);
  }
  if (schema.hasShift) {
    columns.push("shift");
    values.push(shift || null);
  }
  if (schema.hasWeather) {
    columns.push("weather");
    values.push(weather || null);
  }
  if (schema.hasProgressPercent) {
    columns.push("progress_percent");
    values.push(progressPercent ?? null);
  }
  if (schema.hasBlockers) {
    columns.push("blockers");
    values.push(blockers || null);
  }
  if (schema.hasNextPlan) {
    columns.push("next_plan");
    values.push(nextPlan || null);
  }
  if (schema.hasReportStatus) {
    columns.push("report_status");
    values.push(reportStatus || null);
  }
  if (schema.reportsHasCompany) {
    columns.push("company_id");
    values.push(companyId || null);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const inserted = await pool.query(
    `
    INSERT INTO project_daily_reports (${columns.join(", ")})
    VALUES (${placeholders})
    RETURNING ctid
    `,
    values
  );

  const result = await pool.query(
    `
    SELECT ${getProjectReportSelectClause(schema)}
    FROM project_daily_reports pdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = pdr.plant_id" : ""}
    WHERE pdr.ctid = $1
    LIMIT 1
    `,
    [inserted.rows[0].ctid]
  );

  return normalizeProjectReportRow(result.rows[0]);
};

const updateProjectReportById = async ({
  id,
  companyId = null,
  reportDate,
  plantId,
  projectName,
  siteName,
  workDone,
  labourCount,
  machineCount,
  materialUsed,
  remarks,
  shift,
  weather,
  progressPercent,
  blockers,
  nextPlan,
  reportStatus,
}) => {
  const schema = await getProjectReportSchemaSupport();
  const values = [
    reportDate,
    projectName,
    siteName,
    workDone,
    labourCount,
    machineCount,
    materialUsed || null,
    remarks || null,
  ];
  const assignments = [
    "report_date = $1",
    "project_name = $2",
    "site_name = $3",
    "work_done = $4",
    "labour_count = $5",
    "machine_count = $6",
    "material_used = $7",
    "remarks = $8",
  ];

  if (schema.hasPlantId) {
    values.push(plantId ?? null);
    assignments.push(`plant_id = $${values.length}`);
  }
  if (schema.hasShift) {
    values.push(shift || null);
    assignments.push(`shift = $${values.length}`);
  }
  if (schema.hasWeather) {
    values.push(weather || null);
    assignments.push(`weather = $${values.length}`);
  }
  if (schema.hasProgressPercent) {
    values.push(progressPercent ?? null);
    assignments.push(`progress_percent = $${values.length}`);
  }
  if (schema.hasBlockers) {
    values.push(blockers || null);
    assignments.push(`blockers = $${values.length}`);
  }
  if (schema.hasNextPlan) {
    values.push(nextPlan || null);
    assignments.push(`next_plan = $${values.length}`);
  }
  if (schema.hasReportStatus) {
    values.push(reportStatus || null);
    assignments.push(`report_status = $${values.length}`);
  }

  values.push(id);
  let whereClause = `id = $${values.length}`;

  if (schema.reportsHasCompany && companyId !== null) {
    values.push(companyId);
    whereClause += ` AND company_id = $${values.length}`;
  }

  const updated = await pool.query(
    `
    UPDATE project_daily_reports
    SET
      ${assignments.join(", ")},
      updated_at = CURRENT_TIMESTAMP
    WHERE ${whereClause}
    RETURNING ctid
    `,
    values
  );

  if (!updated.rows[0]) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT ${getProjectReportSelectClause(schema)}
    FROM project_daily_reports pdr
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = pdr.plant_id" : ""}
    WHERE pdr.ctid = $1
    LIMIT 1
    `,
    [updated.rows[0].ctid]
  );

  return normalizeProjectReportRow(result.rows[0] || null);
};

const deleteProjectReportById = async ({ id, companyId = null }) => {
  const schema = await getProjectReportSchemaSupport();
  const values = [id];
  let whereClause = "pdr.id = $1";

  if (schema.reportsHasCompany && companyId !== null) {
    values.push(companyId);
    whereClause += ` AND pdr.company_id = $2`;
  }

  const result = await pool.query(
    `
    WITH deleted_row AS (
      DELETE FROM project_daily_reports pdr
      WHERE ${whereClause}
      RETURNING *
    )
    SELECT
      deleted_row.id,
      deleted_row.report_date AS "reportDate",
      deleted_row.project_name AS "projectName",
      deleted_row.site_name AS "siteName",
      deleted_row.work_done AS "workDone",
      deleted_row.labour_count AS "labourCount",
      deleted_row.machine_count AS "machineCount",
      deleted_row.material_used AS "materialUsed",
      deleted_row.remarks,
      ${schema.hasPlantId ? `deleted_row.plant_id AS "plantId",` : `NULL::bigint AS "plantId",`}
      ${schema.hasPlantId ? `pm.plant_name AS "plantName",` : `NULL::text AS "plantName",`}
      ${schema.hasPlantId ? `pm.plant_type AS "plantType",` : `NULL::text AS "plantType",`}
      ${schema.hasShift ? `deleted_row.shift AS "shift",` : `NULL::text AS "shift",`}
      ${schema.hasWeather ? `deleted_row.weather AS "weather",` : `NULL::text AS "weather",`}
      ${
        schema.hasProgressPercent
          ? `deleted_row.progress_percent AS "progressPercent",`
          : `NULL::numeric AS "progressPercent",`
      }
      ${schema.hasBlockers ? `deleted_row.blockers AS "blockers",` : `NULL::text AS "blockers",`}
      ${schema.hasNextPlan ? `deleted_row.next_plan AS "nextPlan",` : `NULL::text AS "nextPlan",`}
      ${schema.hasReportStatus ? `deleted_row.report_status AS "reportStatus",` : `NULL::text AS "reportStatus",`}
      deleted_row.created_by AS "createdBy",
      deleted_row.created_at AS "createdAt",
      deleted_row.updated_at AS "updatedAt"
    FROM deleted_row
    ${schema.hasPlantId ? "LEFT JOIN plant_master pm ON pm.id = deleted_row.plant_id" : ""}
    `,
    values
  );

  return normalizeProjectReportRow(result.rows[0] || null);
};

module.exports = {
  buildProjectReportFilters,
  findAllProjectReports,
  findProjectReportLookups,
  findProjectReportSummary,
  insertProjectReport,
  updateProjectReportById,
  deleteProjectReportById,
};
