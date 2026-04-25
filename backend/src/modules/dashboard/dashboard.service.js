const { pool } = require("../../config/db");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");
const { formatDateOnly } = require("../../utils/date.util");
const logger = require("../../utils/logger");
const { getAllPartyOrders } = require("../party_orders/party_orders.model");
const { findAllDispatchReports } = require("../dispatch/dispatch.model");
const { getAllRates } = require("../party_material_rates/party_material_rates.model");
const { getAllParties } = require("../parties/parties.model");

const getDashboardSummary = async (companyId = null) => {
  const [
    employeesHasCompany,
    plantsHasCompany,
    crusherHasCompany,
    dispatchHasCompany,
    vehiclesHasCompany,
    projectsHasCompany,
    equipmentLogsHasCompany,
  ] = await Promise.all([
    hasColumn("employees", "company_id"),
    hasColumn("plant_master", "company_id"),
    hasColumn("crusher_daily_reports", "company_id"),
    hasColumn("dispatch_reports", "company_id"),
    hasColumn("vehicles", "company_id"),
    hasColumn("project_daily_reports", "company_id"),
    hasColumn("equipment_logs", "company_id"),
  ]);

  const useCompanyScope = companyId !== null;
  const filters = {
    employees: employeesHasCompany && useCompanyScope ? `WHERE company_id = $1` : "",
    plants:
      plantsHasCompany && useCompanyScope
        ? `WHERE is_active = true AND company_id = $1`
        : `WHERE is_active = true`,
    crusherToday:
      crusherHasCompany && useCompanyScope
        ? `WHERE report_date = CURRENT_DATE AND company_id = $1`
        : `WHERE report_date = CURRENT_DATE`,
    crusherYesterday:
      crusherHasCompany && useCompanyScope
        ? `WHERE report_date = CURRENT_DATE - INTERVAL '1 day' AND company_id = $1`
        : `WHERE report_date = CURRENT_DATE - INTERVAL '1 day'`,
    crusherWeekly:
      crusherHasCompany && useCompanyScope
        ? `WHERE report_date >= CURRENT_DATE - INTERVAL '6 days' AND report_date <= CURRENT_DATE AND company_id = $1`
        : `WHERE report_date >= CURRENT_DATE - INTERVAL '6 days' AND report_date <= CURRENT_DATE`,
    dispatchToday:
      dispatchHasCompany && useCompanyScope
        ? `WHERE dispatch_date = CURRENT_DATE AND company_id = $1`
        : `WHERE dispatch_date = CURRENT_DATE`,
    vehiclesUsedToday:
      dispatchHasCompany && useCompanyScope
        ? `WHERE dispatch_date = CURRENT_DATE AND company_id = $1`
        : `WHERE dispatch_date = CURRENT_DATE`,
    dispatchPending:
      dispatchHasCompany && useCompanyScope
        ? `WHERE status = 'pending' AND company_id = $1`
        : `WHERE status = 'pending'`,
    dispatchCompleted:
      dispatchHasCompany && useCompanyScope
        ? `WHERE status = 'completed' AND company_id = $1`
        : `WHERE status = 'completed'`,
    vehiclesInUse:
      vehiclesHasCompany && useCompanyScope
        ? `WHERE status = 'in_use' AND company_id = $1`
        : `WHERE status = 'in_use'`,
    projectToday:
      projectsHasCompany && useCompanyScope
        ? `WHERE report_date = CURRENT_DATE AND company_id = $1`
        : `WHERE report_date = CURRENT_DATE`,
    totalVehicles:
      vehiclesHasCompany && useCompanyScope
        ? `WHERE status = 'active' AND company_id = $1`
        : `WHERE status = 'active'`,
    equipmentToday:
      equipmentLogsHasCompany && useCompanyScope
        ? `WHERE usage_date = CURRENT_DATE AND company_id = $1`
        : `WHERE usage_date = CURRENT_DATE`,
    plantDispatchJoin:
      dispatchHasCompany && useCompanyScope
        ? `AND dr.company_id = $1`
        : "",
    plantVehiclesJoin:
      vehiclesHasCompany && useCompanyScope
        ? `AND v.company_id = $1`
        : "",
    plantsScoped:
      plantsHasCompany && useCompanyScope
        ? `WHERE pm.is_active = true AND pm.company_id = $1`
        : `WHERE pm.is_active = true`,
    recentDispatch:
      dispatchHasCompany && useCompanyScope
        ? `WHERE dr.company_id = $1`
        : "",
    recentPlantJoin:
      plantsHasCompany && useCompanyScope
        ? `AND pm.company_id = $1`
        : "",
  };
  const params = useCompanyScope ? [companyId] : [];

  const totalEmployeesQuery = `
    SELECT COUNT(*)::int AS count
    FROM employees
    ${filters.employees}
  `;

  const totalPlantsQuery = `
    SELECT COUNT(*)::int AS count
    FROM plant_master
    ${filters.plants}
  `;

  const todayCrusherProductionQuery = `
    SELECT COALESCE(SUM(production_tons), 0)::numeric AS total
    FROM crusher_daily_reports
    ${filters.crusherToday}
  `;

  const yesterdayCrusherProductionQuery = `
    SELECT COALESCE(SUM(production_tons), 0)::numeric AS total
    FROM crusher_daily_reports
    ${filters.crusherYesterday}
  `;

  const weeklyCrusherProductionQuery = `
    SELECT COALESCE(SUM(production_tons), 0)::numeric AS total
    FROM crusher_daily_reports
    ${filters.crusherWeekly}
  `;

  const todayDispatchQuantityQuery = `
    SELECT COALESCE(SUM(quantity_tons), 0)::numeric AS total
    FROM dispatch_reports
    ${filters.dispatchToday}
  `;

  const todayVehiclesUsedQuery = `
    SELECT COUNT(DISTINCT vehicle_number)::int AS count
    FROM dispatch_reports
    ${filters.vehiclesUsedToday}
  `;

  const pendingDispatchQuery = `
    SELECT COUNT(*)::int AS count
    FROM dispatch_reports
    ${filters.dispatchPending}
  `;

  const completedDispatchQuery = `
    SELECT COUNT(*)::int AS count
    FROM dispatch_reports
    ${filters.dispatchCompleted}
  `;

  const vehiclesInUseQuery = `
    SELECT COUNT(*)::int AS count
    FROM vehicles
    ${filters.vehiclesInUse}
  `;

  const todayProjectReportsQuery = `
    SELECT COUNT(*)::int AS count
    FROM project_daily_reports
    ${filters.projectToday}
  `;

  const totalVehiclesQuery = `
    SELECT COUNT(*)::int AS count
    FROM vehicles
    ${filters.totalVehicles}
  `;

  const todayEquipmentHoursQuery = `
    SELECT COALESCE(SUM(usage_hours), 0)::numeric AS total
    FROM equipment_logs
    ${filters.equipmentToday}
  `;

  const plantWiseDispatchQuery = `
    SELECT
      pm.id,
      pm.plant_name AS "plantName",
      COALESCE(SUM(dr.quantity_tons), 0)::numeric AS "todayDispatchTons",
      COUNT(dr.id)::int AS "dispatchCount"
    FROM plant_master pm
    LEFT JOIN dispatch_reports dr
      ON dr.plant_id = pm.id
      AND dr.dispatch_date = CURRENT_DATE
      ${filters.plantDispatchJoin}
    ${filters.plantsScoped}
    GROUP BY pm.id, pm.plant_name
    ORDER BY "todayDispatchTons" DESC
    LIMIT 8
  `;

  const plantWiseActiveVehiclesQuery = `
    SELECT
      pm.id,
      pm.plant_name AS "plantName",
      COUNT(v.id)::int AS "activeVehicles"
    FROM plant_master pm
    LEFT JOIN vehicles v
      ON v.plant_id = pm.id
      AND v.status = 'active'
      ${filters.plantVehiclesJoin}
    ${filters.plantsScoped}
    GROUP BY pm.id, pm.plant_name
    ORDER BY "activeVehicles" DESC
    LIMIT 8
  `;

  const recentDispatchActivityQuery = `
    SELECT
      dr.id,
      dr.dispatch_date AS "dispatchDate",
      pm.plant_name AS "plantName",
      dr.material_type AS "materialType",
      dr.vehicle_number AS "vehicleNumber",
      dr.destination_name AS "destinationName",
      dr.quantity_tons AS "quantityTons"
    FROM dispatch_reports dr
    LEFT JOIN plant_master pm ON pm.id = dr.plant_id ${filters.recentPlantJoin}
    ${filters.recentDispatch}
    ORDER BY dr.dispatch_date DESC, dr.id DESC
    LIMIT 6
  `;

  const [
    totalEmployeesResult,
    totalPlantsResult,
    todayCrusherProductionResult,
    yesterdayCrusherProductionResult,
    weeklyCrusherProductionResult,
    todayDispatchQuantityResult,
    todayVehiclesUsedResult,
    pendingDispatchResult,
    completedDispatchResult,
    vehiclesInUseResult,
    todayProjectReportsResult,
    totalVehiclesResult,
    todayEquipmentHoursResult,
    plantWiseDispatchResult,
    plantWiseActiveVehiclesResult,
    recentDispatchActivityResult,
  ] = await Promise.all([
    pool.query(totalEmployeesQuery, params),
    pool.query(totalPlantsQuery, params),
    pool.query(todayCrusherProductionQuery, params),
    pool.query(yesterdayCrusherProductionQuery, params),
    pool.query(weeklyCrusherProductionQuery, params),
    pool.query(todayDispatchQuantityQuery, params),
    pool.query(todayVehiclesUsedQuery, params),
    pool.query(pendingDispatchQuery, params),
    pool.query(completedDispatchQuery, params),
    pool.query(vehiclesInUseQuery, params),
    pool.query(todayProjectReportsQuery, params),
    pool.query(totalVehiclesQuery, params),
    pool.query(todayEquipmentHoursQuery, params),
    pool.query(plantWiseDispatchQuery, params),
    pool.query(plantWiseActiveVehiclesQuery, params),
    pool.query(recentDispatchActivityQuery, params),
  ]);

  return {
    employees: {
      total: totalEmployeesResult.rows[0].count,
    },
    plants: {
      active: totalPlantsResult.rows[0].count,
      dispatchSummary: plantWiseDispatchResult.rows.map((row) => ({
        ...row,
        todayDispatchTons: Number(row.todayDispatchTons),
      })),
      activeVehicleSummary: plantWiseActiveVehiclesResult.rows,
    },
    crusher: {
      todayProduction: Number(todayCrusherProductionResult.rows[0].total),
      yesterdayProduction: Number(
        yesterdayCrusherProductionResult.rows[0].total
      ),
      weeklyProduction: Number(weeklyCrusherProductionResult.rows[0].total),
    },
    dispatch: {
      todayQuantity: Number(todayDispatchQuantityResult.rows[0].total),
      vehiclesUsedToday: todayVehiclesUsedResult.rows[0].count,
      pendingCount: pendingDispatchResult.rows[0].count,
      completedCount: completedDispatchResult.rows[0].count,
      recentActivity: recentDispatchActivityResult.rows.map((row) => ({
        ...row,
        quantityTons: Number(row.quantityTons),
      })),
    },
    projects: {
      todayReports: todayProjectReportsResult.rows[0].count,
    },
    fleet: {
      totalActiveVehicles: totalVehiclesResult.rows[0].count,
      vehiclesInUse: vehiclesInUseResult.rows[0].count,
      equipmentHoursToday: Number(todayEquipmentHoursResult.rows[0].total),
    },
  };
};

const toDateOnlyValue = (value) => formatDateOnly(value) || "";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_COMMERCIAL_EXCEPTION_LIMIT = 250;
const ALLOWED_COMMERCIAL_EXCEPTION_TYPES = [
  "overdue_order",
  "active_order_missing_rate",
  "unlinked_dispatch",
  "incomplete_dispatch_closure",
];
const COMMERCIAL_EXCEPTION_SLA_DAYS = {
  overdue_order: 1,
  active_order_missing_rate: 2,
  unlinked_dispatch: 1,
  incomplete_dispatch_closure: 1,
};

const buildCommercialExceptionFilterError = (details) => {
  const error = new Error("INVALID_COMMERCIAL_EXCEPTION_FILTERS");
  error.details = details;
  return error;
};

const parsePositiveInteger = (value, fieldName) => {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw buildCommercialExceptionFilterError(`${fieldName} must be a positive integer`);
  }

  return numericValue;
};

const parsePositiveIntegerOrEmpty = (value, fieldName) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  return String(parsePositiveInteger(normalizedValue, fieldName));
};

const parseBooleanFilter = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (value === true || value === false) {
    return value;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw buildCommercialExceptionFilterError(`${fieldName} must be true or false`);
};

const normalizeCommercialExceptionFilters = ({
  partyId = "",
  exceptionType = "",
  assignedEmployeeId = "",
  dateFrom = "",
  dateTo = "",
  includeReviewed = false,
  reviewedOnly = false,
  page = 1,
  limit = 250,
} = {}) => {
  const normalizedExceptionType = String(exceptionType || "").trim();
  const normalizedDateFrom = String(dateFrom || "").trim();
  const normalizedDateTo = String(dateTo || "").trim();
  const normalizedIncludeReviewed = parseBooleanFilter(includeReviewed, "includeReviewed");
  const normalizedReviewedOnly = parseBooleanFilter(reviewedOnly, "reviewedOnly");
  const normalizedPage = parsePositiveInteger(page || 1, "page");
  const normalizedLimit = parsePositiveInteger(limit || 250, "limit");

  if (
    normalizedExceptionType &&
    !ALLOWED_COMMERCIAL_EXCEPTION_TYPES.includes(normalizedExceptionType)
  ) {
    throw buildCommercialExceptionFilterError("exceptionType is invalid");
  }

  if (normalizedDateFrom && !DATE_ONLY_PATTERN.test(normalizedDateFrom)) {
    throw buildCommercialExceptionFilterError("dateFrom must use YYYY-MM-DD format");
  }

  if (normalizedDateTo && !DATE_ONLY_PATTERN.test(normalizedDateTo)) {
    throw buildCommercialExceptionFilterError("dateTo must use YYYY-MM-DD format");
  }

  if (normalizedDateFrom && normalizedDateTo && normalizedDateFrom > normalizedDateTo) {
    throw buildCommercialExceptionFilterError("dateFrom cannot be later than dateTo");
  }

  if (normalizedLimit > MAX_COMMERCIAL_EXCEPTION_LIMIT) {
    throw buildCommercialExceptionFilterError(
      `limit cannot exceed ${MAX_COMMERCIAL_EXCEPTION_LIMIT}`
    );
  }

  return {
    partyId: parsePositiveIntegerOrEmpty(partyId, "partyId"),
    exceptionType: normalizedExceptionType,
    assignedEmployeeId: parsePositiveIntegerOrEmpty(
      assignedEmployeeId,
      "assignedEmployeeId"
    ),
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
    includeReviewed: normalizedIncludeReviewed || normalizedReviewedOnly,
    reviewedOnly: normalizedReviewedOnly,
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const buildExceptionKey = ({ exceptionType, entityId, dateValue, reference }) =>
  [exceptionType, entityId, dateValue, String(reference || "").trim()].join(":");

const getCommercialExceptionSlaDays = (exceptionType) =>
  COMMERCIAL_EXCEPTION_SLA_DAYS[exceptionType] ?? 1;

const parseAuditDetails = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return value;
};

const getCommercialExceptionAuditQueryState = async (companyId = null) => {
  const auditTableExists = await tableExists("audit_logs");

  if (!auditTableExists) {
    return null;
  }

  const [
    auditHasCompany,
    auditHasAction,
    auditHasTargetType,
    auditHasCreatedAt,
    auditHasDetails,
  ] = await Promise.all([
    hasColumn("audit_logs", "company_id"),
    hasColumn("audit_logs", "action"),
    hasColumn("audit_logs", "target_type"),
    hasColumn("audit_logs", "created_at"),
    hasColumn("audit_logs", "details"),
  ]);

  if (!auditHasAction || !auditHasTargetType || !auditHasCreatedAt || !auditHasDetails) {
    return null;
  }

  const values = [];
  const conditions = [];

  values.push("commercial_exception");
  conditions.push(`a.target_type = $${values.length}`);

  if (auditHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`a.company_id = $${values.length}`);
  }

  return {
    values,
    conditions,
  };
};

const getReviewedExceptionMap = async (companyId = null) => {
  const auditState = await getCommercialExceptionAuditQueryState(companyId);
  if (!auditState) {
    return new Map();
  }
  const values = ["commercial_exception.reviewed", ...auditState.values];
  const conditions = [`a.action = $1`, ...auditState.conditions];
  let result;

  try {
    result = await pool.query(
      `
      SELECT
        a.id,
        a.created_at AS "createdAt",
        a.details AS "details"
      FROM audit_logs a
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.created_at DESC, a.id DESC
      `,
      values
    );
  } catch (error) {
    logger.warn("Commercial exception review audit query failed", {
      companyId,
      message: error.message,
    });
    return new Map();
  }

  const reviewMap = new Map();

  result.rows.forEach((row) => {
    const details = parseAuditDetails(row.details);
    const exceptionKey = String(details.exceptionKey || "").trim();

    if (!exceptionKey || reviewMap.has(exceptionKey)) {
      return;
    }

    reviewMap.set(exceptionKey, {
      reviewedAt: row.createdAt || null,
      reviewedByName: details.actorName || details.actorUsername || "",
      notes: details.notes || "",
    });
  });

  return reviewMap;
};

const getAssignedExceptionMap = async (companyId = null) => {
  const auditState = await getCommercialExceptionAuditQueryState(companyId);
  if (!auditState) {
    return new Map();
  }
  const values = ["commercial_exception.assigned", ...auditState.values];
  const conditions = [`a.action = $1`, ...auditState.conditions];
  let result;

  try {
    result = await pool.query(
      `
      SELECT
        a.id,
        a.created_at AS "createdAt",
        a.details AS "details"
      FROM audit_logs a
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.created_at DESC, a.id DESC
      `,
      values
    );
  } catch (error) {
    logger.warn("Commercial exception assignment audit query failed", {
      companyId,
      message: error.message,
    });
    return new Map();
  }

  const assignmentMap = new Map();

  result.rows.forEach((row) => {
    const details = parseAuditDetails(row.details);
    const exceptionKey = String(details.exceptionKey || "").trim();

    if (!exceptionKey || assignmentMap.has(exceptionKey)) {
      return;
    }

    assignmentMap.set(exceptionKey, {
      assignedAt: row.createdAt || null,
      assigneeEmployeeId:
        details.assigneeEmployeeId === null || details.assigneeEmployeeId === undefined
          ? null
          : Number(details.assigneeEmployeeId),
      assigneeName: details.assigneeName || "",
      assigneeEmployeeCode: details.assigneeEmployeeCode || "",
    });
  });

  return assignmentMap;
};

const markCommercialExceptionReviewed = async ({
  companyId = null,
  exceptionKey,
  actorUserId = null,
  actorName = "",
  actorUsername = "",
  exceptionType = "",
  entityId = null,
  reference = "",
  notes = "",
}) => {
  const trimmedKey = String(exceptionKey || "").trim();

  if (!trimmedKey) {
    const error = new Error("Exception key is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    exceptionKey: trimmedKey,
    actorUserId,
    actorName: String(actorName || "").trim(),
    actorUsername: String(actorUsername || "").trim(),
    exceptionType: String(exceptionType || "").trim(),
    entityId: entityId === null || entityId === undefined ? null : Number(entityId),
    reference: String(reference || "").trim(),
    notes: String(notes || "").trim(),
    companyId,
  };
};

const assignCommercialException = async ({
  companyId = null,
  exceptionKey,
  actorUserId = null,
  actorName = "",
  actorUsername = "",
  exceptionType = "",
  entityId = null,
  reference = "",
  assigneeEmployeeId = null,
  assigneeName = "",
  assigneeEmployeeCode = "",
}) => {
  const trimmedKey = String(exceptionKey || "").trim();

  if (!trimmedKey) {
    const error = new Error("Exception key is required");
    error.statusCode = 400;
    throw error;
  }

  if (!assigneeEmployeeId) {
    const error = new Error("Assignee employee is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    exceptionKey: trimmedKey,
    actorUserId,
    actorName: String(actorName || "").trim(),
    actorUsername: String(actorUsername || "").trim(),
    exceptionType: String(exceptionType || "").trim(),
    entityId: entityId === null || entityId === undefined ? null : Number(entityId),
    reference: String(reference || "").trim(),
    assigneeEmployeeId: Number(assigneeEmployeeId),
    assigneeName: String(assigneeName || "").trim(),
    assigneeEmployeeCode: String(assigneeEmployeeCode || "").trim(),
    companyId,
  };
};

const getCommercialExceptions = async (companyId = null, filters = {}) => {
  const normalizedFilters = normalizeCommercialExceptionFilters(filters);
  const [orders, dispatchReportPage, rates, parties, reviewedExceptionMap, assignedExceptionMap] =
    await Promise.all([
    getAllPartyOrders(companyId),
    findAllDispatchReports({
      companyId,
      page: 1,
      limit: 500,
    }),
    getAllRates(companyId),
    getAllParties(companyId),
    getReviewedExceptionMap(companyId),
    getAssignedExceptionMap(companyId),
  ]);

  const dispatches = Array.isArray(dispatchReportPage)
    ? dispatchReportPage
    : dispatchReportPage?.items || [];

  const today = toDateOnlyValue(new Date());
  const now = Date.now();
  const activeRates = rates.filter((rate) => rate.isActive);
  const openOrders = orders.filter((order) => order.status === "open");
  const activeRateKeySet = new Set(
    activeRates.map((rate) => `${rate.partyId}-${rate.plantId}-${rate.materialId}`)
  );
  const partiesMap = new Map(parties.map((party) => [String(party.id), party.partyName]));

  const overdueOrders = openOrders
    .filter(
      (order) =>
        Number(order.pendingQuantityTons || 0) > 0 &&
        order.targetDispatchDate &&
        toDateOnlyValue(order.targetDispatchDate) < today
    )
    .map((order) => {
      const dateValue = toDateOnlyValue(order.targetDispatchDate || order.orderDate);
      const reference = order.orderNumber;
      const exceptionKey = buildExceptionKey({
        exceptionType: "overdue_order",
        entityId: order.id,
        dateValue,
        reference,
      });
      const reviewState = reviewedExceptionMap.get(exceptionKey) || null;
      const assignmentState = assignedExceptionMap.get(exceptionKey) || null;

      return {
        id: `overdue-order-${order.id}`,
        entityId: order.id,
        exceptionType: "overdue_order",
        exceptionKey,
        dateValue,
        partyId: order.partyId,
        partyName: order.partyName || partiesMap.get(String(order.partyId)) || "",
        plantId: order.plantId,
        plantName: order.plantName || "",
        materialId: order.materialId,
        materialName: order.materialName || "",
        reference,
        detail: `Pending ${Number(order.pendingQuantityTons || 0)} tons past target date`,
        actionPath: `/party-orders?focusOrderId=${order.id}&partyId=${order.partyId}&plantId=${order.plantId}&materialId=${order.materialId}&status=open&pendingOnly=true`,
        actionLabel: "Open Orders",
        isReviewed: Boolean(reviewState),
        reviewedAt: reviewState?.reviewedAt || null,
        reviewedByName: reviewState?.reviewedByName || "",
        reviewNotes: reviewState?.notes || "",
        assigneeEmployeeId: assignmentState?.assigneeEmployeeId || null,
        assigneeName: assignmentState?.assigneeName || "",
        assigneeEmployeeCode: assignmentState?.assigneeEmployeeCode || "",
        assignedAt: assignmentState?.assignedAt || null,
      };
    });

  const ordersMissingRates = openOrders
    .filter((order) => {
      const key = `${order.partyId}-${order.plantId}-${order.materialId}`;
      return !activeRateKeySet.has(key);
    })
    .map((order) => {
      const dateValue = toDateOnlyValue(order.orderDate);
      const reference = order.orderNumber;
      const exceptionKey = buildExceptionKey({
        exceptionType: "active_order_missing_rate",
        entityId: order.id,
        dateValue,
        reference,
      });
      const reviewState = reviewedExceptionMap.get(exceptionKey) || null;
      const assignmentState = assignedExceptionMap.get(exceptionKey) || null;

      return {
        id: `missing-rate-${order.id}`,
        entityId: order.id,
        exceptionType: "active_order_missing_rate",
        exceptionKey,
        dateValue,
        partyId: order.partyId,
        partyName: order.partyName || partiesMap.get(String(order.partyId)) || "",
        plantId: order.plantId,
        plantName: order.plantName || "",
        materialId: order.materialId,
        materialName: order.materialName || "",
        reference: order.orderNumber,
        detail: "Active order exists without an active commercial rate",
        actionPath: `/party-orders?focusOrderId=${order.id}&partyId=${order.partyId}&plantId=${order.plantId}&materialId=${order.materialId}&status=open`,
        actionLabel: "Open Order",
        isReviewed: Boolean(reviewState),
        reviewedAt: reviewState?.reviewedAt || null,
        reviewedByName: reviewState?.reviewedByName || "",
        reviewNotes: reviewState?.notes || "",
        assigneeEmployeeId: assignmentState?.assigneeEmployeeId || null,
        assigneeName: assignmentState?.assigneeName || "",
        assigneeEmployeeCode: assignmentState?.assigneeEmployeeCode || "",
        assignedAt: assignmentState?.assignedAt || null,
      };
    });

  const unlinkedDispatches = dispatches
    .filter((dispatch) => !dispatch.partyOrderId)
    .filter((dispatch) =>
      openOrders.some(
        (order) =>
          String(order.partyId) === String(dispatch.partyId) &&
          String(order.plantId) === String(dispatch.plantId) &&
          String(order.materialId) === String(dispatch.materialId) &&
          Number(order.pendingQuantityTons || 0) > 0
      )
    )
    .map((dispatch) => {
      const dateValue = toDateOnlyValue(dispatch.dispatchDate);
      const reference = `Dispatch #${dispatch.id}`;
      const exceptionKey = buildExceptionKey({
        exceptionType: "unlinked_dispatch",
        entityId: dispatch.id,
        dateValue,
        reference,
      });
      const reviewState = reviewedExceptionMap.get(exceptionKey) || null;
      const assignmentState = assignedExceptionMap.get(exceptionKey) || null;

      return {
        id: `unlinked-dispatch-${dispatch.id}`,
        entityId: dispatch.id,
        exceptionType: "unlinked_dispatch",
        exceptionKey,
        dateValue,
        partyId: dispatch.partyId,
        partyName: dispatch.partyName || partiesMap.get(String(dispatch.partyId)) || "",
        plantId: dispatch.plantId,
        plantName: dispatch.plantName || dispatch.sourceName || "",
        materialId: dispatch.materialId,
        materialName: dispatch.materialName || dispatch.materialType || "",
        reference,
        detail:
          "Dispatch saved without order linkage even though a matching open order exists",
        actionPath: `/dispatch-reports?focusDispatchId=${dispatch.id}&partyId=${dispatch.partyId}&plantId=${dispatch.plantId}&materialId=${dispatch.materialId}&linkedOrderFilter=unlinked`,
        actionLabel: "Open Dispatch",
        isReviewed: Boolean(reviewState),
        reviewedAt: reviewState?.reviewedAt || null,
        reviewedByName: reviewState?.reviewedByName || "",
        reviewNotes: reviewState?.notes || "",
        assigneeEmployeeId: assignmentState?.assigneeEmployeeId || null,
        assigneeName: assignmentState?.assigneeName || "",
        assigneeEmployeeCode: assignmentState?.assigneeEmployeeCode || "",
        assignedAt: assignmentState?.assignedAt || null,
      };
    });

  const incompleteClosures = dispatches
    .filter((dispatch) => dispatch.status === "completed")
    .filter(
      (dispatch) =>
        !String(dispatch.invoiceNumber || "").trim() ||
        !dispatch.invoiceDate ||
        !String(dispatch.ewbNumber || "").trim() ||
        !dispatch.ewbDate ||
        !dispatch.ewbValidUpto
    )
    .map((dispatch) => {
      const dateValue = toDateOnlyValue(dispatch.dispatchDate);
      const reference = `Dispatch #${dispatch.id}`;
      const exceptionKey = buildExceptionKey({
        exceptionType: "incomplete_dispatch_closure",
        entityId: dispatch.id,
        dateValue,
        reference,
      });
      const reviewState = reviewedExceptionMap.get(exceptionKey) || null;
      const assignmentState = assignedExceptionMap.get(exceptionKey) || null;

      return {
        id: `incomplete-closure-${dispatch.id}`,
        entityId: dispatch.id,
        exceptionType: "incomplete_dispatch_closure",
        exceptionKey,
        dateValue,
        partyId: dispatch.partyId,
        partyName: dispatch.partyName || partiesMap.get(String(dispatch.partyId)) || "",
        plantId: dispatch.plantId,
        plantName: dispatch.plantName || dispatch.sourceName || "",
        materialId: dispatch.materialId,
        materialName: dispatch.materialName || dispatch.materialType || "",
        reference,
        detail: "Completed dispatch is missing invoice number/date or E-Way details",
        actionPath: `/dispatch-reports?focusDispatchId=${dispatch.id}&partyId=${dispatch.partyId}&plantId=${dispatch.plantId}&materialId=${dispatch.materialId}&status=completed`,
        actionLabel: "Open Dispatch",
        isReviewed: Boolean(reviewState),
        reviewedAt: reviewState?.reviewedAt || null,
        reviewedByName: reviewState?.reviewedByName || "",
        reviewNotes: reviewState?.notes || "",
        assigneeEmployeeId: assignmentState?.assigneeEmployeeId || null,
        assigneeName: assignmentState?.assigneeName || "",
        assigneeEmployeeCode: assignmentState?.assigneeEmployeeCode || "",
        assignedAt: assignmentState?.assignedAt || null,
      };
    });

  const allItems = [
    ...overdueOrders,
    ...ordersMissingRates,
    ...unlinkedDispatches,
    ...incompleteClosures,
  ]
    .map((item) => {
      const exceptionTimestamp = item.dateValue
        ? new Date(`${item.dateValue}T00:00:00.000Z`).getTime()
        : null;
      const exceptionAgeDays =
        exceptionTimestamp && Number.isFinite(exceptionTimestamp)
          ? Math.max(0, Math.floor((now - exceptionTimestamp) / DAY_IN_MS))
          : null;
      const reviewedTimestamp = item.reviewedAt
        ? new Date(item.reviewedAt).getTime()
        : null;
      const reviewAgeDays =
        reviewedTimestamp && Number.isFinite(reviewedTimestamp)
          ? Math.floor((now - reviewedTimestamp) / DAY_IN_MS)
          : null;
      const slaDays = getCommercialExceptionSlaDays(item.exceptionType);
      const isSlaBreached =
        exceptionAgeDays !== null && Number.isFinite(slaDays) && exceptionAgeDays >= slaDays;
      const isEscalated =
        item.isReviewed && reviewAgeDays !== null && reviewAgeDays > 2;

      return {
        ...item,
        exceptionAgeDays,
        reviewAgeDays,
        slaDays,
        isSlaBreached,
        isEscalated,
      };
    })
    .sort((left, right) => right.dateValue.localeCompare(left.dateValue));

  const filteredItems = allItems
    .filter((item) => {
      const matchesParty =
        normalizedFilters.partyId === ""
          ? true
          : String(item.partyId) === normalizedFilters.partyId;
      const matchesExceptionType =
        normalizedFilters.exceptionType === ""
          ? true
          : item.exceptionType === normalizedFilters.exceptionType;
      const matchesAssignee =
        normalizedFilters.assignedEmployeeId === ""
          ? true
          : String(item.assigneeEmployeeId || "") ===
            normalizedFilters.assignedEmployeeId;
      const matchesDateFrom =
        normalizedFilters.dateFrom === ""
          ? true
          : item.dateValue >= normalizedFilters.dateFrom;
      const matchesDateTo =
        normalizedFilters.dateTo === ""
          ? true
          : item.dateValue <= normalizedFilters.dateTo;
      const includeReviewedFlag = normalizedFilters.includeReviewed;
      const reviewedOnlyFlag = normalizedFilters.reviewedOnly;

      const isReviewed = Boolean(item.isReviewed ?? item.reviewed ?? false);

      let matchesReviewed = true;

      if (reviewedOnlyFlag) {
        matchesReviewed = isReviewed === true;
      } else if (!includeReviewedFlag) {
        matchesReviewed = isReviewed === false;
      }

      return (
        matchesParty &&
        matchesExceptionType &&
        matchesAssignee &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesReviewed
      );
    });
  const filteredTotalCount = filteredItems.length;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTotalCount / normalizedFilters.limit)
  );
  const currentPage = Math.min(normalizedFilters.page, totalPages);
  const pageOffset = (currentPage - 1) * normalizedFilters.limit;
  const paginatedItems = filteredItems.slice(
    pageOffset,
    pageOffset + normalizedFilters.limit
  );

  const pendingQuantity = openOrders.reduce(
    (sum, order) => sum + Number(order.pendingQuantityTons || 0),
    0
  );
  const inTransitQuantity = orders.reduce(
    (sum, order) => sum + Number(order.inProgressQuantityTons || 0),
    0
  );
  const dispatchAgainstOrdersToday = dispatches
    .filter(
      (dispatch) => toDateOnlyValue(dispatch.dispatchDate) === today && dispatch.partyOrderId
    )
    .reduce((sum, dispatch) => sum + Number(dispatch.quantityTons || 0), 0);
  const partiesWithNoActiveRatesCount = new Set(
    ordersMissingRates.map((item) => String(item.partyId))
  ).size;
  const escalatedReviewedCount = allItems.filter((item) => item.isEscalated).length;
  const slaBreachedCount = allItems.filter((item) => item.isSlaBreached).length;
  const assignedCount = allItems.filter((item) => item.assigneeEmployeeId).length;
  const unassignedCount = allItems.length - assignedCount;
  const escalatedUnassignedCount = allItems.filter(
    (item) => item.isEscalated && !item.assigneeEmployeeId
  ).length;
  const slaBreachedUnassignedCount = allItems.filter(
    (item) => item.isSlaBreached && !item.assigneeEmployeeId
  ).length;
  const ownerSummary = Array.from(
    allItems.reduce((summaryMap, item) => {
      if (!item.assigneeEmployeeId) {
        return summaryMap;
      }

      const key = String(item.assigneeEmployeeId);
      const current = summaryMap.get(key) || {
        assigneeEmployeeId: item.assigneeEmployeeId,
        assigneeName: item.assigneeName || "",
        assigneeEmployeeCode: item.assigneeEmployeeCode || "",
        assignedCount: 0,
        escalatedCount: 0,
        slaBreachedCount: 0,
        reviewedCount: 0,
        unreviewedCount: 0,
      };

      current.assignedCount += 1;
      if (item.isEscalated) {
        current.escalatedCount += 1;
      }
      if (item.isSlaBreached) {
        current.slaBreachedCount += 1;
      }
      if (item.isReviewed) {
        current.reviewedCount += 1;
      } else {
        current.unreviewedCount += 1;
      }

      summaryMap.set(key, current);
      return summaryMap;
    }, new Map()).values()
  ).sort((left, right) => {
    if (right.escalatedCount !== left.escalatedCount) {
      return right.escalatedCount - left.escalatedCount;
    }

    if (right.assignedCount !== left.assignedCount) {
      return right.assignedCount - left.assignedCount;
    }

    return String(left.assigneeName || "").localeCompare(String(right.assigneeName || ""));
  });

  const priorityAlerts = [];
  if (overdueOrders.length > 0) {
    priorityAlerts.push(`${overdueOrders.length} overdue order(s) still carry pending balance`);
  }
  if (slaBreachedCount > 0) {
    priorityAlerts.push(
      `${slaBreachedCount} commercial exception(s) have crossed SLA and need immediate follow-up`
    );
  }
  if (ordersMissingRates.length > 0) {
    priorityAlerts.push(
      `${partiesWithNoActiveRatesCount} party account(s) have active orders but no active commercial rate`
    );
  }
  if (unlinkedDispatches.length > 0) {
    priorityAlerts.push(
      `${unlinkedDispatches.length} dispatch record(s) were saved without order linkage even though matching open orders exist`
    );
  }
  if (incompleteClosures.length > 0) {
    priorityAlerts.push(
      `${incompleteClosures.length} completed dispatch record(s) are missing invoice or E-Way details`
    );
  }
  if (priorityAlerts.length === 0) {
    priorityAlerts.push(
      "Commercial control layer looks stable across orders, rates, linked dispatch, and closure data."
    );
  }

  return {
    summary: {
      total: allItems.length,
      openOrdersCount: openOrders.length,
      pendingQuantity,
      inTransitQuantity,
      dispatchAgainstOrdersToday,
      overdueOrdersCount: overdueOrders.length,
      partiesWithNoActiveRatesCount,
      unlinkedDispatchesCount: unlinkedDispatches.length,
      incompleteClosuresCount: incompleteClosures.length,
      reviewedCount: allItems.filter((item) => item.isReviewed).length,
      escalatedReviewedCount,
      slaBreachedCount,
      assignedCount,
      unassignedCount,
      escalatedUnassignedCount,
      slaBreachedUnassignedCount,
      ownerSummary,
      priorityAlerts,
    },
    items: paginatedItems,
    meta: {
      filteredCount: paginatedItems.length,
      filteredTotalCount,
      totalCount: allItems.length,
      currentPage,
      totalPages,
      limit: normalizedFilters.limit,
      includeReviewed: normalizedFilters.includeReviewed,
      reviewedOnly: normalizedFilters.reviewedOnly,
      assignedEmployeeId: normalizedFilters.assignedEmployeeId,
      hasPreviousPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
    },
  };
};

module.exports = {
  getDashboardSummary,
  getCommercialExceptions,
  markCommercialExceptionReviewed,
  assignCommercialException,
};
