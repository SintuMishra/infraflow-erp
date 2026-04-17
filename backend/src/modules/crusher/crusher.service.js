const {
  findAllCrusherReports,
  findCrusherReportSummary,
  findCrusherReportLookups,
  insertCrusherReport,
  updateCrusherReportById,
  deleteCrusherReportById,
} = require("./crusher.model");
const { plantExists } = require("../dispatch/dispatch.model");

const ALLOWED_OPERATIONAL_STATUSES = ["running", "watch", "breakdown", "maintenance", "closed"];

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeText = (value, fieldLabel, { required = false, maxLength = 255 } = {}) => {
  const normalized = String(value ?? "").trim();

  if (required && !normalized) {
    throw createValidationError(`${fieldLabel} is required`);
  }

  if (normalized.length > maxLength) {
    throw createValidationError(`${fieldLabel} must be ${maxLength} characters or fewer`);
  }

  return normalized || null;
};

const normalizeNumber = (value, fieldLabel, { min = 0, required = true } = {}) => {
  if ((value === undefined || value === null || value === "") && required) {
    throw createValidationError(`${fieldLabel} is required`);
  }

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw createValidationError(`${fieldLabel} must be a valid number`);
  }

  if (numericValue < min) {
    throw createValidationError(`${fieldLabel} must be at least ${min}`);
  }

  return numericValue;
};

const normalizeReportDate = (value) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw createValidationError("Report date is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createValidationError("Report date must use YYYY-MM-DD format");
  }

  return normalized;
};

const normalizeCrusherReportInput = (reportData = {}) => {
  const operationalStatus = normalizeText(reportData.operationalStatus, "Operational status", {
    required: false,
    maxLength: 50,
  });

  if (
    operationalStatus &&
    !ALLOWED_OPERATIONAL_STATUSES.includes(operationalStatus.toLowerCase())
  ) {
    throw createValidationError(
      `Operational status must be one of: ${ALLOWED_OPERATIONAL_STATUSES.join(", ")}`
    );
  }

  return {
    ...reportData,
    plantId: normalizeNumber(reportData.plantId, "Plant", { min: 1 }),
    reportDate: normalizeReportDate(reportData.reportDate),
    shift: normalizeText(reportData.shift, "Shift", { required: false, maxLength: 100 }),
    crusherUnitName: normalizeText(reportData.crusherUnitName, "Crusher unit", {
      required: false,
      maxLength: 150,
    }),
    materialType: normalizeText(reportData.materialType, "Material type", {
      required: false,
      maxLength: 150,
    }),
    productionTons: normalizeNumber(reportData.productionTons, "Production tons", {
      min: 0,
      required: false,
    }),
    dispatchTons: normalizeNumber(reportData.dispatchTons, "Dispatch tons", {
      min: 0,
      required: false,
    }),
    machineHours: normalizeNumber(reportData.machineHours, "Machine hours", {
      min: 0,
      required: false,
    }),
    dieselUsed: normalizeNumber(reportData.dieselUsed, "Diesel used", { min: 0, required: false }),
    electricityKwh: normalizeNumber(reportData.electricityKwh, "Electricity kWh", {
      min: 0,
      required: false,
    }),
    electricityOpeningReading: normalizeNumber(
      reportData.electricityOpeningReading,
      "Electricity opening reading",
      { min: 0, required: false }
    ),
    electricityClosingReading: normalizeNumber(
      reportData.electricityClosingReading,
      "Electricity closing reading",
      { min: 0, required: false }
    ),
    dieselRatePerLitre: normalizeNumber(reportData.dieselRatePerLitre, "Diesel rate per litre", {
      min: 0,
      required: false,
    }),
    electricityRatePerKwh: normalizeNumber(
      reportData.electricityRatePerKwh,
      "Electricity rate per kWh",
      { min: 0, required: false }
    ),
    dieselCost: normalizeNumber(reportData.dieselCost, "Diesel cost", {
      min: 0,
      required: false,
    }),
    electricityCost: normalizeNumber(reportData.electricityCost, "Electricity cost", {
      min: 0,
      required: false,
    }),
    labourExpense: normalizeNumber(reportData.labourExpense, "Labour expense", {
      min: 0,
      required: false,
    }),
    maintenanceExpense: normalizeNumber(
      reportData.maintenanceExpense,
      "Maintenance expense",
      {
        min: 0,
        required: false,
      }
    ),
    otherExpense: normalizeNumber(reportData.otherExpense, "Other expense", {
      min: 0,
      required: false,
    }),
    totalExpense: normalizeNumber(reportData.totalExpense, "Total expense", {
      min: 0,
      required: false,
    }),
    remarks: normalizeText(reportData.remarks, "Remarks", {
      required: false,
      maxLength: 500,
    }),
    operationalStatus,
    breakdownHours: normalizeNumber(reportData.breakdownHours, "Breakdown hours", {
      min: 0,
      required: false,
    }),
    downtimeReason: normalizeText(reportData.downtimeReason, "Downtime reason", {
      required: false,
      maxLength: 400,
    }),
    openingStockTons: normalizeNumber(reportData.openingStockTons, "Opening stock tons", {
      min: 0,
      required: false,
    }),
    closingStockTons: normalizeNumber(reportData.closingStockTons, "Closing stock tons", {
      min: 0,
      required: false,
    }),
    operatorsCount: normalizeNumber(reportData.operatorsCount, "Operators count", {
      min: 0,
      required: false,
    }),
    maintenanceNotes: normalizeText(reportData.maintenanceNotes, "Maintenance notes", {
      required: false,
      maxLength: 500,
    }),
    expenseRemarks: normalizeText(reportData.expenseRemarks, "Expense remarks", {
      required: false,
      maxLength: 500,
    }),
  };
};

const buildCrusherSummary = (summaryRow = {}, reports = []) => {
  const totalProduction = Number(summaryRow.totalProduction || 0);
  const totalDispatch = Number(summaryRow.totalDispatch || 0);
  const totalDiesel = Number(summaryRow.totalDiesel || 0);
  const totalElectricityKwh = Number(summaryRow.totalElectricityKwh || 0);
  const totalElectricityCost = Number(summaryRow.totalElectricityCost || 0);
  const totalExpense = Number(summaryRow.totalExpense || 0);
  const totalMachineHours = Number(summaryRow.totalMachineHours || 0);
  const totalBreakdownHours = Number(summaryRow.totalBreakdownHours || 0);
  const total = Number(summaryRow.total || 0);

  return {
    total,
    totalProduction,
    totalDispatch,
    totalDiesel,
    totalElectricityKwh,
    totalElectricityCost,
    totalExpense,
    totalMachineHours,
    totalBreakdownHours,
    uniqueUnits: Number(summaryRow.uniqueUnits || 0),
    uniqueMaterials: Number(summaryRow.uniqueMaterials || 0),
    latestDate: summaryRow.latestDate || null,
    averageProductionPerReport: total ? Number((totalProduction / total).toFixed(2)) : 0,
    averageDispatchPerReport: total ? Number((totalDispatch / total).toFixed(2)) : 0,
    tonsPerMachineHour: totalMachineHours
      ? Number((totalProduction / totalMachineHours).toFixed(2))
      : 0,
    dieselPerTon: totalProduction ? Number((totalDiesel / totalProduction).toFixed(2)) : 0,
    electricityPerTon: totalProduction
      ? Number((totalElectricityKwh / totalProduction).toFixed(2))
      : 0,
    expensePerTon: totalProduction ? Number((totalExpense / totalProduction).toFixed(2)) : 0,
    dispatchVsProduction: totalProduction
      ? Number(((totalDispatch / totalProduction) * 100).toFixed(1))
      : 0,
    topUnitName: summaryRow.topUnitName || reports[0]?.crusherUnitName || "",
  };
};

const buildDerivedExpenseFields = (normalized) => {
  const derivedElectricityKwh =
    normalized.electricityKwh !== null
      ? normalized.electricityKwh
      : normalized.electricityOpeningReading !== null &&
          normalized.electricityClosingReading !== null
        ? Number(
            (normalized.electricityClosingReading - normalized.electricityOpeningReading).toFixed(2)
          )
        : null;

  const derivedDieselCost =
    normalized.dieselCost !== null
      ? normalized.dieselCost
      : normalized.dieselUsed !== null && normalized.dieselRatePerLitre !== null
        ? Number((normalized.dieselUsed * normalized.dieselRatePerLitre).toFixed(2))
        : null;

  const derivedElectricityCost =
    normalized.electricityCost !== null
      ? normalized.electricityCost
      : derivedElectricityKwh !== null && normalized.electricityRatePerKwh !== null
        ? Number((derivedElectricityKwh * normalized.electricityRatePerKwh).toFixed(2))
        : null;

  // Keep total expense canonical across all clients: always sum component costs/expenses.
  const derivedTotalExpense = Number(
    (
      Number(derivedDieselCost || 0) +
      Number(derivedElectricityCost || 0) +
      Number(normalized.labourExpense || 0) +
      Number(normalized.maintenanceExpense || 0) +
      Number(normalized.otherExpense || 0)
    ).toFixed(2)
  );

  return {
    derivedElectricityKwh,
    derivedDieselCost,
    derivedElectricityCost,
    derivedTotalExpense,
  };
};

const enforceOperationalConstraints = (normalized) => {
  if (
    normalized.electricityOpeningReading !== null &&
    normalized.electricityClosingReading !== null &&
    normalized.electricityClosingReading < normalized.electricityOpeningReading
  ) {
    throw createValidationError("Electricity closing reading cannot be lower than opening reading");
  }

  if (
    normalized.machineHours !== null &&
    normalized.breakdownHours !== null &&
    normalized.breakdownHours > normalized.machineHours
  ) {
    throw createValidationError("Breakdown hours cannot exceed machine hours");
  }

  if (normalized.operatorsCount !== null && !Number.isInteger(normalized.operatorsCount)) {
    throw createValidationError("Operators count must be a whole number");
  }

  if (
    normalized.openingStockTons !== null &&
    normalized.dispatchTons !== null &&
    normalized.dispatchTons > normalized.openingStockTons + Number(normalized.productionTons || 0)
  ) {
    throw createValidationError("Dispatch tons cannot exceed opening stock + production tons");
  }
};

const getCrusherReports = async ({
  companyId = null,
  search = "",
  shift = "",
  plantId = null,
  crusherUnitName = "",
  materialType = "",
  operationalStatus = "",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 25,
} = {}) => {
  const filters = {
    companyId,
    search,
    shift,
    plantId,
    crusherUnitName,
    materialType,
    operationalStatus,
    startDate,
    endDate,
    page,
    limit,
  };

  const [reportPage, summaryRow, lookups] = await Promise.all([
    findAllCrusherReports(filters),
    findCrusherReportSummary(filters),
    findCrusherReportLookups(companyId),
  ]);

  return {
    items: reportPage.items,
    summary: buildCrusherSummary(summaryRow, reportPage.items),
    lookups,
    pagination: {
      total: reportPage.total,
      page: reportPage.page,
      limit: reportPage.limit,
      totalPages: reportPage.total ? Math.ceil(reportPage.total / reportPage.limit) : 0,
      hasPreviousPage: reportPage.page > 1,
      hasNextPage:
        reportPage.total ? reportPage.page < Math.ceil(reportPage.total / reportPage.limit) : false,
    },
  };
};

const createCrusherReport = async (reportData) => {
  const normalized = normalizeCrusherReportInput(reportData);
  const plant = await plantExists(normalized.plantId, reportData.companyId || null);

  if (!plant) {
    throw createValidationError("Selected plant does not exist");
  }

  enforceOperationalConstraints(normalized);

  const {
    derivedElectricityKwh,
    derivedDieselCost,
    derivedElectricityCost,
    derivedTotalExpense,
  } = buildDerivedExpenseFields(normalized);

  return insertCrusherReport({
    ...normalized,
    shift: normalized.shift || null,
    materialType: normalized.materialType || null,
    productionTons: normalized.productionTons ?? 0,
    dispatchTons: normalized.dispatchTons ?? 0,
    machineHours: normalized.machineHours ?? 0,
    dieselUsed: normalized.dieselUsed ?? 0,
    electricityKwh: derivedElectricityKwh,
    dieselCost: derivedDieselCost,
    electricityCost: derivedElectricityCost,
    totalExpense: derivedTotalExpense,
    crusherUnitName: normalized.crusherUnitName || plant.plantName,
  });
};

const editCrusherReport = async (reportData) => {
  const normalized = normalizeCrusherReportInput(reportData);
  const plant = await plantExists(normalized.plantId, reportData.companyId || null);

  if (!plant) {
    throw createValidationError("Selected plant does not exist");
  }

  enforceOperationalConstraints(normalized);

  const {
    derivedElectricityKwh,
    derivedDieselCost,
    derivedElectricityCost,
    derivedTotalExpense,
  } = buildDerivedExpenseFields(normalized);

  return updateCrusherReportById({
    id: reportData.id,
    companyId: reportData.companyId || null,
    ...normalized,
    shift: normalized.shift || null,
    materialType: normalized.materialType || null,
    productionTons: normalized.productionTons ?? 0,
    dispatchTons: normalized.dispatchTons ?? 0,
    machineHours: normalized.machineHours ?? 0,
    dieselUsed: normalized.dieselUsed ?? 0,
    electricityKwh: derivedElectricityKwh,
    dieselCost: derivedDieselCost,
    electricityCost: derivedElectricityCost,
    totalExpense: derivedTotalExpense,
    crusherUnitName: normalized.crusherUnitName || plant.plantName,
  });
};

const removeCrusherReport = async ({ id, companyId = null }) => {
  return deleteCrusherReportById({ id, companyId });
};

module.exports = {
  ALLOWED_OPERATIONAL_STATUSES,
  getCrusherReports,
  createCrusherReport,
  editCrusherReport,
  removeCrusherReport,
  normalizeCrusherReportInput,
  buildCrusherSummary,
  buildDerivedExpenseFields,
};
