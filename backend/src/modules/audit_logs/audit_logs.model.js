const { pool } = require("../../config/db");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");

const appendAuditFilters = ({
  conditions,
  values,
  parameterIndex,
  auditHasCompany,
  auditHasDetails,
  companyId = null,
  action = "",
  targetType = "",
  search = "",
  startDate = "",
  endDate = "",
  includeAction = true,
  includeTargetType = true,
} = {}) => {
  let nextParameterIndex = parameterIndex;

  if (auditHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`a.company_id = $${nextParameterIndex}`);
    nextParameterIndex += 1;
  }

  if (includeAction && action) {
    values.push(action);
    conditions.push(`a.action = $${nextParameterIndex}`);
    nextParameterIndex += 1;
  }

  if (includeTargetType && targetType) {
    values.push(targetType);
    conditions.push(`a.target_type = $${nextParameterIndex}`);
    nextParameterIndex += 1;
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const searchParam = `$${nextParameterIndex}`;
    nextParameterIndex += 1;

    const searchableColumns = [
      "LOWER(COALESCE(a.action, ''))",
      "LOWER(COALESCE(a.target_type, ''))",
      "LOWER(COALESCE(e.full_name, ''))",
      "LOWER(COALESCE(e.employee_code, ''))",
      "LOWER(COALESCE(u.username, ''))",
    ];

    if (auditHasDetails) {
      searchableColumns.push("LOWER(COALESCE(a.details::text, ''))");
    }

    conditions.push(
      `(${searchableColumns
        .map((column) => `${column} LIKE ${searchParam}`)
        .join(" OR ")})`
    );
  }

  if (startDate) {
    values.push(startDate);
    conditions.push(`a.created_at >= $${nextParameterIndex}::date`);
    nextParameterIndex += 1;
  }

  if (endDate) {
    values.push(endDate);
    conditions.push(`a.created_at < ($${nextParameterIndex}::date + INTERVAL '1 day')`);
    nextParameterIndex += 1;
  }

  return {
    conditions,
    values,
    parameterIndex: nextParameterIndex,
  };
};

const listAuditLogs = async ({
  companyId = null,
  action = "",
  targetType = "",
  search = "",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 100,
}) => {
  const auditTableExists = await tableExists("audit_logs");

  if (!auditTableExists) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: Math.min(Math.max(Number(limit) || 100, 1), 200),
      facets: {
        actions: [],
        targetTypes: [],
      },
      summary: {
        totalMatching: 0,
        userEvents: 0,
        systemEvents: 0,
        uniqueActors: 0,
      },
    };
  }

  const auditHasCompany = await hasColumn("audit_logs", "company_id");
  const auditHasDetails = await hasColumn("audit_logs", "details");
  const usersHaveCompany = await hasColumn("users", "company_id");
  const employeesHaveCompany = await hasColumn("employees", "company_id");

  const baseFilterState = appendAuditFilters({
    conditions: [],
    values: [],
    parameterIndex: 1,
    auditHasCompany,
    auditHasDetails,
    companyId,
    action,
    targetType,
    search,
    startDate,
    endDate,
  });
  const conditions = baseFilterState.conditions;
  const values = baseFilterState.values;
  let parameterIndex = baseFilterState.parameterIndex;

  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  values.push(normalizedLimit);
  const limitParam = `$${parameterIndex}`;
  parameterIndex += 1;

  values.push(offset);
  const offsetParam = `$${parameterIndex}`;

  const listQuery = `
    SELECT
      a.id,
      a.action,
      a.actor_user_id AS "actorUserId",
      a.target_type AS "targetType",
      a.target_id AS "targetId",
      ${
        auditHasCompany ? `a.company_id AS "companyId",` : `NULL AS "companyId",`
      }
      ${auditHasDetails ? `a.details AS "details",` : `NULL AS "details",`}
      a.created_at AS "createdAt",
      COUNT(*) OVER()::int AS "totalCount",
      u.username AS "actorUsername",
      e.full_name AS "actorFullName",
      e.employee_code AS "actorEmployeeCode"
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
      ${
        auditHasCompany && usersHaveCompany
          ? `AND (u.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    LEFT JOIN employees e ON e.id = u.employee_id
      ${
        auditHasCompany && employeesHaveCompany
          ? `AND (e.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `;

  const summaryFilterState = appendAuditFilters({
    conditions: [],
    values: [],
    parameterIndex: 1,
    auditHasCompany,
    auditHasDetails,
    companyId,
    action,
    targetType,
    search,
    startDate,
    endDate,
  });

  const summaryQuery = `
    SELECT
      COUNT(*)::int AS "totalMatching",
      COUNT(*) FILTER (WHERE a.actor_user_id IS NOT NULL)::int AS "userEvents",
      COUNT(*) FILTER (WHERE a.actor_user_id IS NULL)::int AS "systemEvents",
      COUNT(DISTINCT a.actor_user_id)::int AS "uniqueActors"
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
      ${
        auditHasCompany && usersHaveCompany
          ? `AND (u.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    LEFT JOIN employees e ON e.id = u.employee_id
      ${
        auditHasCompany && employeesHaveCompany
          ? `AND (e.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    ${summaryFilterState.conditions.length ? `WHERE ${summaryFilterState.conditions.join(" AND ")}` : ""}
  `;

  const actionFacetState = appendAuditFilters({
    conditions: [],
    values: [],
    parameterIndex: 1,
    auditHasCompany,
    auditHasDetails,
    companyId,
    action,
    targetType,
    search,
    startDate,
    endDate,
    includeAction: false,
  });

  const targetFacetState = appendAuditFilters({
    conditions: [],
    values: [],
    parameterIndex: 1,
    auditHasCompany,
    auditHasDetails,
    companyId,
    action,
    targetType,
    search,
    startDate,
    endDate,
    includeTargetType: false,
  });

  const actionFacetQuery = `
    SELECT DISTINCT a.action
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
      ${
        auditHasCompany && usersHaveCompany
          ? `AND (u.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    LEFT JOIN employees e ON e.id = u.employee_id
      ${
        auditHasCompany && employeesHaveCompany
          ? `AND (e.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    ${actionFacetState.conditions.length ? `WHERE ${actionFacetState.conditions.join(" AND ")}` : ""}
    ORDER BY a.action ASC
  `;

  const targetFacetQuery = `
    SELECT DISTINCT a.target_type AS "targetType"
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
      ${
        auditHasCompany && usersHaveCompany
          ? `AND (u.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    LEFT JOIN employees e ON e.id = u.employee_id
      ${
        auditHasCompany && employeesHaveCompany
          ? `AND (e.company_id = a.company_id OR a.company_id IS NULL)`
          : ""
      }
    ${targetFacetState.conditions.length ? `WHERE ${targetFacetState.conditions.join(" AND ")}` : ""}
    ORDER BY a.target_type ASC
  `;

  const [summaryResult, actionFacetResult, targetFacetResult, result] = await Promise.all([
    pool.query(summaryQuery, summaryFilterState.values),
    pool.query(actionFacetQuery, actionFacetState.values),
    pool.query(targetFacetQuery, targetFacetState.values),
    pool.query(listQuery, values),
  ]);

  const total = result.rows[0]?.totalCount || summaryResult.rows[0]?.totalMatching || 0;

  return {
    items: result.rows.map(({ totalCount, ...row }) => row),
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    summary: {
      totalMatching: Number(summaryResult.rows[0]?.totalMatching || 0),
      userEvents: Number(summaryResult.rows[0]?.userEvents || 0),
      systemEvents: Number(summaryResult.rows[0]?.systemEvents || 0),
      uniqueActors: Number(summaryResult.rows[0]?.uniqueActors || 0),
    },
    facets: {
      actions: actionFacetResult.rows
        .map((row) => row.action)
        .filter(Boolean),
      targetTypes: targetFacetResult.rows
        .map((row) => row.targetType)
        .filter(Boolean),
    },
  };
};

module.exports = {
  listAuditLogs,
};
