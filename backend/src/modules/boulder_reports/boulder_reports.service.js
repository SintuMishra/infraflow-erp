const {
  listBoulderVehicles,
  insertBoulderVehicle,
  updateBoulderVehicle,
  updateBoulderVehicleStatus,
  listBoulderReports,
  insertBoulderReport,
  updateBoulderReport,
  deleteBoulderReport,
  getBoulderReportById,
} = require("./boulder_reports.model");
const { plantExists } = require("../dispatch/dispatch.model");
const { findCrusherUnits, findShifts } = require("../masters/masters.model");

const ALLOWED_ROUTE_TYPES = ["to_stock_yard", "direct_to_crushing_hub", "mixed"];

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const mapBoulderDbError = (error) => {
  if (!error?.code) {
    return error;
  }

  if (
    error.code === "23505" &&
    String(error.constraint || "").includes("uq_boulder_logistics_vehicles_company_vehicle")
  ) {
    return buildValidationError(
      "Vehicle number already exists in mine logistics registry for this company",
      409
    );
  }

  return error;
};

const normalizeText = (value, label, { required = false, maxLength = 255 } = {}) => {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) {
    throw buildValidationError(`${label} is required`);
  }
  if (normalized.length > maxLength) {
    throw buildValidationError(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized || null;
};

const canonicalizePlantType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  if (
    normalized.includes("crusher") ||
    normalized.includes("crushing") ||
    normalized.includes("stone")
  ) {
    return "crusher";
  }

  if (normalized.includes("project") || normalized.includes("site")) {
    return "project";
  }

  return normalized;
};

const arePlantTypesCompatible = (plantType, unitPlantType) => {
  const left = canonicalizePlantType(plantType);
  const right = canonicalizePlantType(unitPlantType);

  if (!left || !right) {
    return true;
  }

  return left === right || left.includes(right) || right.includes(left);
};

const normalizeNumber = (value, label, { min = 0, required = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw buildValidationError(`${label} is required`);
    }
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw buildValidationError(`${label} must be a valid number`);
  }
  if (numericValue < min) {
    throw buildValidationError(`${label} must be at least ${min}`);
  }

  return Number(numericValue.toFixed(2));
};

const normalizeDate = (value, label = "Report date") => {
  const normalized = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw buildValidationError(`${label} must use YYYY-MM-DD format`);
  }
  return normalized;
};

const normalizeVehicleRuns = (vehicleRuns, { availableVehicles = [] } = {}) => {
  const rows = Array.isArray(vehicleRuns) ? vehicleRuns : [];
  if (!rows.length) {
    return {
      vehicleRuns: [],
      totals: null,
    };
  }

  const vehiclesById = new Map(
    (availableVehicles || [])
      .filter((item) => Number.isInteger(Number(item?.id)) && Number(item.id) > 0)
      .map((item) => [Number(item.id), item])
  );

  let inwardWeightTons = 0;
  let directToCrusherTons = 0;
  const routeTypes = new Set();

  const normalizedRuns = rows.map((row, index) => {
    const vehicleIdRaw =
      row?.vehicleId === undefined || row?.vehicleId === null || row?.vehicleId === ""
        ? null
        : Number(row.vehicleId);
    const vehicleId =
      Number.isInteger(vehicleIdRaw) && vehicleIdRaw > 0 ? vehicleIdRaw : null;

    const linkedVehicle = vehicleId ? vehiclesById.get(vehicleId) : null;
    const routeType = normalizeText(row?.routeType || "to_stock_yard", `Trip #${index + 1} route type`, {
      required: true,
      maxLength: 32,
    });
    if (!["to_stock_yard", "direct_to_crushing_hub"].includes(routeType)) {
      throw buildValidationError(
        `Trip #${index + 1} route type must be to_stock_yard or direct_to_crushing_hub`
      );
    }

    const weighedTons = normalizeNumber(row?.weighedTons, `Trip #${index + 1} weighed tons`, {
      min: 0.01,
      required: true,
    });

    const vehicleNumberSnapshot = normalizeText(
      linkedVehicle?.vehicleNumber || row?.vehicleNumberSnapshot,
      `Trip #${index + 1} vehicle number`,
      {
        required: true,
        maxLength: 40,
      }
    );
    const contractorNameSnapshot = normalizeText(
      linkedVehicle?.contractorName || row?.contractorNameSnapshot,
      `Trip #${index + 1} contractor name`,
      {
        required: true,
        maxLength: 160,
      }
    );

    routeTypes.add(routeType);
    inwardWeightTons += weighedTons;
    if (routeType === "direct_to_crushing_hub") {
      directToCrusherTons += weighedTons;
    }

    return {
      tripNo: index + 1,
      vehicleId,
      vehicleNumberSnapshot,
      contractorNameSnapshot,
      routeType,
      weighedTons,
      remarks: normalizeText(row?.remarks, `Trip #${index + 1} remarks`, { maxLength: 300 }),
    };
  });

  const resolvedRouteType =
    routeTypes.size <= 1 ? normalizedRuns[0]?.routeType || "to_stock_yard" : "mixed";

  return {
    vehicleRuns: normalizedRuns,
    totals: {
      inwardWeightTons: Number(inwardWeightTons.toFixed(2)),
      directToCrusherTons: Number(directToCrusherTons.toFixed(2)),
      routeType: resolvedRouteType,
    },
  };
};

const normalizeVehiclePayload = (payload = {}) => ({
  vehicleNumber: normalizeText(payload.vehicleNumber, "Vehicle number", {
    required: true,
    maxLength: 40,
  }),
  contractorName: normalizeText(payload.contractorName, "Contractor name", {
    required: true,
    maxLength: 160,
  }),
  vehicleType: normalizeText(payload.vehicleType, "Vehicle type", { maxLength: 60 }),
  notes: normalizeText(payload.notes, "Notes", { maxLength: 500 }),
});

const deriveCalculatedMetrics = ({
  openingStockTons,
  inwardWeightTons,
  directToCrusherTons,
  crusherConsumptionTons,
  closingStockTons,
  finishedOutputTons,
}) => {
  if (directToCrusherTons > inwardWeightTons) {
    throw buildValidationError("Direct-to-crusher tons cannot exceed inward weighed tons");
  }

  const inwardToStockYard = Number((inwardWeightTons - directToCrusherTons).toFixed(2));
  const stockConsumption = Number(Math.max(crusherConsumptionTons - directToCrusherTons, 0).toFixed(2));
  const computedClosing = Number((openingStockTons + inwardToStockYard - stockConsumption).toFixed(2));

  if (computedClosing < 0) {
    throw buildValidationError(
      "Computed closing stock is negative. Check opening, inward, direct-to-crusher, and consumption values"
    );
  }

  let resolvedClosing = closingStockTons;
  if (resolvedClosing === null || resolvedClosing === undefined) {
    resolvedClosing = computedClosing;
  }

  if (Math.abs(Number(resolvedClosing) - computedClosing) >= 0.01) {
    throw buildValidationError(
      `Closing stock mismatch. Expected ${computedClosing.toFixed(2)} tons from daily flow`
    );
  }

  const processLossTons =
    finishedOutputTons === null || finishedOutputTons === undefined
      ? null
      : Number(Math.max(crusherConsumptionTons - finishedOutputTons, 0).toFixed(2));

  const yieldPercent =
    finishedOutputTons === null || finishedOutputTons === undefined
      ? null
      : crusherConsumptionTons > 0
        ? Number(((finishedOutputTons / crusherConsumptionTons) * 100).toFixed(2))
        : 0;

  const processLossPercent =
    processLossTons === null
      ? null
      : crusherConsumptionTons > 0
        ? Number(((processLossTons / crusherConsumptionTons) * 100).toFixed(2))
        : 0;

  return {
    inwardToStockYard,
    stockConsumption,
    closingStockTons: Number(resolvedClosing.toFixed(2)),
    processLossTons,
    yieldPercent,
    processLossPercent,
  };
};

const normalizeReportPayload = async (payload = {}, { companyId, createdBy = null, updatedBy = null, isEdit = false } = {}) => {
  const plantId = Number(payload.plantId || 0);
  if (!Number.isInteger(plantId) || plantId <= 0) {
    throw buildValidationError("Plant is required");
  }

  const plant = await plantExists(plantId, companyId);
  if (!plant) {
    throw buildValidationError("Selected plant does not exist");
  }

  const shiftId = Number(payload.shiftId || 0);
  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    throw buildValidationError("Shift is required");
  }

  const shiftMasters = await findShifts(companyId);
  const selectedShift = (shiftMasters || []).find(
    (shift) => Number(shift.id) === shiftId && Boolean(shift.isActive)
  );
  if (!selectedShift) {
    throw buildValidationError("Selected shift does not exist in active masters");
  }

  const rawCrusherUnitId =
    payload.crusherUnitId === undefined || payload.crusherUnitId === null || payload.crusherUnitId === ""
      ? null
      : Number(payload.crusherUnitId);
  const crusherUnitId = Number.isInteger(rawCrusherUnitId) && rawCrusherUnitId > 0
    ? rawCrusherUnitId
    : null;

  let selectedCrusherUnit = null;
  if (crusherUnitId !== null) {
    const crusherUnits = await findCrusherUnits(companyId);
    selectedCrusherUnit = (crusherUnits || []).find(
      (unit) => Number(unit.id) === crusherUnitId && Boolean(unit.isActive)
    );
    if (!selectedCrusherUnit) {
      throw buildValidationError("Selected plant unit does not exist in active masters");
    }

    if (!arePlantTypesCompatible(plant.plantType, selectedCrusherUnit.plantType)) {
      throw buildValidationError(
        `Selected plant unit type (${selectedCrusherUnit.plantType}) does not match plant type (${plant.plantType})`
      );
    }
  }

  const reportDate = normalizeDate(payload.reportDate);
  let routeType = normalizeText(payload.routeType || "to_stock_yard", "Route type", {
    required: true,
    maxLength: 32,
  });

  if (!ALLOWED_ROUTE_TYPES.includes(routeType)) {
    throw buildValidationError(
      "Route type must be to_stock_yard, direct_to_crushing_hub, or mixed"
    );
  }

  const availableVehicles = await listBoulderVehicles(companyId);
  const normalizedRuns = normalizeVehicleRuns(payload.vehicleRuns, { availableVehicles });

  const openingStockTons = normalizeNumber(payload.openingStockTons, "Opening stock tons", {
    min: 0,
    required: true,
  });
  let inwardWeightTons = normalizeNumber(payload.inwardWeightTons, "Inward weighed tons", {
    min: 0,
    required: true,
  });
  let directToCrusherTons = normalizeNumber(payload.directToCrusherTons, "Direct-to-crusher tons", {
    min: 0,
    required: true,
  });
  const crusherConsumptionTons = normalizeNumber(payload.crusherConsumptionTons, "Crusher consumption tons", {
    min: 0,
    required: true,
  });
  const closingStockTons = normalizeNumber(payload.closingStockTons, "Closing stock tons", {
    min: 0,
    required: false,
  });
  const finishedOutputTons = normalizeNumber(payload.finishedOutputTons, "Finished output tons", {
    min: 0,
    required: false,
  });

  if (normalizedRuns.totals) {
    inwardWeightTons = normalizedRuns.totals.inwardWeightTons;
    directToCrusherTons = normalizedRuns.totals.directToCrusherTons;
    routeType = normalizedRuns.totals.routeType;
  }

  const metrics = deriveCalculatedMetrics({
    openingStockTons,
    inwardWeightTons,
    directToCrusherTons,
    crusherConsumptionTons,
    closingStockTons,
    finishedOutputTons,
  });

  const vehicleIdRaw = payload.vehicleId === "" || payload.vehicleId === null || payload.vehicleId === undefined
    ? null
    : Number(payload.vehicleId);
  let vehicleId = Number.isInteger(vehicleIdRaw) && vehicleIdRaw > 0 ? vehicleIdRaw : null;

  const leadRun = normalizedRuns.vehicleRuns[0] || null;
  if (leadRun?.vehicleId) {
    vehicleId = leadRun.vehicleId;
  }

  return {
    id: isEdit ? Number(payload.id) : undefined,
    companyId,
    reportDate,
    plantId,
    shiftId,
    shift: normalizeText(selectedShift.shiftName, "Shift", { required: true, maxLength: 100 }),
    crusherUnitId,
    crusherUnitNameSnapshot: normalizeText(
      selectedCrusherUnit?.unitName || payload.crusherUnitNameSnapshot || plant.plantName,
      "Plant unit",
      { required: true, maxLength: 150 }
    ),
    sourceMineName: normalizeText(payload.sourceMineName, "Source mine", { maxLength: 160 }),
    vehicleId,
    vehicleNumberSnapshot: normalizeText(payload.vehicleNumberSnapshot, "Vehicle number", {
      required: !leadRun,
      maxLength: 40,
    }) || leadRun?.vehicleNumberSnapshot,
    contractorNameSnapshot: normalizeText(payload.contractorNameSnapshot, "Contractor name", {
      required: !leadRun,
      maxLength: 160,
    }) || leadRun?.contractorNameSnapshot,
    routeType,
    vehicleRuns: normalizedRuns.vehicleRuns,
    openingStockTons,
    inwardWeightTons,
    directToCrusherTons,
    crusherConsumptionTons,
    closingStockTons: metrics.closingStockTons,
    finishedOutputTons,
    yieldPercent: metrics.yieldPercent,
    processLossTons: metrics.processLossTons,
    processLossPercent: metrics.processLossPercent,
    remarks: normalizeText(payload.remarks, "Remarks", { maxLength: 600 }),
    createdBy,
    updatedBy,
  };
};

const getVehicles = async (companyId) => await listBoulderVehicles(companyId);

const createVehicle = async (payload) => {
  const normalized = normalizeVehiclePayload(payload);
  try {
    return await insertBoulderVehicle({
      companyId: payload.companyId,
      ...normalized,
    });
  } catch (error) {
    throw mapBoulderDbError(error);
  }
};

const editVehicle = async (payload) => {
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw buildValidationError("Invalid vehicle id");
  }

  const normalized = normalizeVehiclePayload(payload);
  try {
    return await updateBoulderVehicle({
      id,
      companyId: payload.companyId,
      ...normalized,
    });
  } catch (error) {
    throw mapBoulderDbError(error);
  }
};

const toggleVehicleStatus = async ({ id, companyId, isActive }) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw buildValidationError("Invalid vehicle id");
  }

  if (typeof isActive !== "boolean") {
    throw buildValidationError("isActive must be a boolean");
  }

  return await updateBoulderVehicleStatus({
    id: parsedId,
    companyId,
    isActive,
  });
};

const listReports = async (filters) => {
  const reportPage = await listBoulderReports(filters);
  const summaryRow = reportPage.summary || {};

  return {
    items: reportPage.items,
    summary: {
      total: Number(summaryRow.total || 0),
      totalInwardWeight: Number(summaryRow.totalInwardWeight || 0),
      totalDirectToCrusher: Number(summaryRow.totalDirectToCrusher || 0),
      totalCrusherConsumption: Number(summaryRow.totalCrusherConsumption || 0),
      totalFinishedOutput: Number(summaryRow.totalFinishedOutput || 0),
      averageYieldPercent: Number(summaryRow.averageYieldPercent || 0),
      totalProcessLoss: Number(summaryRow.totalProcessLoss || 0),
      latestDate: summaryRow.latestDate || null,
    },
    pagination: {
      total: reportPage.total,
      page: reportPage.page,
      limit: reportPage.limit,
      totalPages: reportPage.total ? Math.ceil(reportPage.total / reportPage.limit) : 0,
      hasPreviousPage: reportPage.page > 1,
      hasNextPage: reportPage.total
        ? reportPage.page < Math.ceil(reportPage.total / reportPage.limit)
        : false,
    },
  };
};

const createReport = async (payload) => {
  const normalized = await normalizeReportPayload(payload, {
    companyId: payload.companyId,
    createdBy: payload.createdBy || null,
    updatedBy: payload.createdBy || null,
    isEdit: false,
  });

  const id = await insertBoulderReport(normalized);
  if (!id) {
    throw buildValidationError("Failed to create boulder report", 500);
  }

  return await getBoulderReportById({ id, companyId: payload.companyId });
};

const editReport = async (payload) => {
  const parsedId = Number(payload.id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw buildValidationError("Invalid boulder report id");
  }

  const normalized = await normalizeReportPayload(
    { ...payload, id: parsedId },
    {
      companyId: payload.companyId,
      updatedBy: payload.updatedBy || null,
      isEdit: true,
    }
  );

  const id = await updateBoulderReport(normalized);
  if (!id) {
    return null;
  }

  return await getBoulderReportById({ id, companyId: payload.companyId });
};

const removeReport = async ({ id, companyId }) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw buildValidationError("Invalid boulder report id");
  }

  return await deleteBoulderReport({ id: parsedId, companyId });
};

module.exports = {
  getVehicles,
  createVehicle,
  editVehicle,
  toggleVehicleStatus,
  listReports,
  createReport,
  editReport,
  removeReport,
};
