const validateCrusherReportInput = (req, res, next) => {
  const {
    reportDate,
    plantId,
    shift,
    crusherUnitName,
    materialType,
    productionTons,
    dispatchTons,
    machineHours,
    dieselUsed,
    electricityKwh,
    electricityOpeningReading,
    electricityClosingReading,
    dieselRatePerLitre,
    electricityRatePerKwh,
    dieselCost,
    electricityCost,
    labourExpense,
    maintenanceExpense,
    otherExpense,
    totalExpense,
    breakdownHours,
    openingStockTons,
    closingStockTons,
    operatorsCount,
    operationalStatus,
  } = req.body;

  if (
    !String(reportDate || "").trim() ||
    plantId === undefined ||
    plantId === null ||
    plantId === ""
  ) {
    return res.status(400).json({
      success: false,
      message: "reportDate and plantId are required",
    });
  }

  if (!Number.isInteger(Number(plantId)) || Number(plantId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a positive integer",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reportDate).trim())) {
    return res.status(400).json({
      success: false,
      message: "reportDate must use YYYY-MM-DD format",
    });
  }

  const numericChecks = [
    ["productionTons", productionTons],
    ["dispatchTons", dispatchTons],
    ["machineHours", machineHours],
    ["dieselUsed", dieselUsed],
    ["electricityKwh", electricityKwh],
    ["electricityOpeningReading", electricityOpeningReading],
    ["electricityClosingReading", electricityClosingReading],
    ["dieselRatePerLitre", dieselRatePerLitre],
    ["electricityRatePerKwh", electricityRatePerKwh],
    ["dieselCost", dieselCost],
    ["electricityCost", electricityCost],
    ["labourExpense", labourExpense],
    ["maintenanceExpense", maintenanceExpense],
    ["otherExpense", otherExpense],
    ["totalExpense", totalExpense],
    ["breakdownHours", breakdownHours],
    ["openingStockTons", openingStockTons],
    ["closingStockTons", closingStockTons],
    ["operatorsCount", operatorsCount],
  ];

  for (const [label, value] of numericChecks) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      return res.status(400).json({
        success: false,
        message: `${label} must be a non-negative number`,
      });
    }
  }

  const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parsedMachineHours = toOptionalNumber(machineHours);
  const parsedBreakdownHours = toOptionalNumber(breakdownHours);
  const parsedOperatorsCount = toOptionalNumber(operatorsCount);
  const parsedOpeningStockTons = toOptionalNumber(openingStockTons);
  const parsedProductionTons = toOptionalNumber(productionTons) ?? 0;
  const parsedDispatchTons = toOptionalNumber(dispatchTons);
  const parsedOpeningMeter = toOptionalNumber(electricityOpeningReading);
  const parsedClosingMeter = toOptionalNumber(electricityClosingReading);

  if (
    parsedMachineHours !== null &&
    parsedBreakdownHours !== null &&
    parsedBreakdownHours > parsedMachineHours
  ) {
    return res.status(400).json({
      success: false,
      message: "breakdownHours cannot exceed machineHours",
    });
  }

  if (parsedOperatorsCount !== null && !Number.isInteger(parsedOperatorsCount)) {
    return res.status(400).json({
      success: false,
      message: "operatorsCount must be a whole number",
    });
  }

  if (
    parsedOpeningStockTons !== null &&
    parsedDispatchTons !== null &&
    parsedDispatchTons > parsedOpeningStockTons + parsedProductionTons
  ) {
    return res.status(400).json({
      success: false,
      message: "dispatchTons cannot exceed openingStockTons + productionTons",
    });
  }

  if (
    parsedOpeningMeter !== null &&
    parsedClosingMeter !== null &&
    parsedClosingMeter < parsedOpeningMeter
  ) {
    return res.status(400).json({
      success: false,
      message: "electricityClosingReading cannot be lower than electricityOpeningReading",
    });
  }

  if (
    operationalStatus &&
    !["running", "watch", "breakdown", "maintenance", "closed"].includes(
      String(operationalStatus).trim().toLowerCase()
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "operationalStatus must be running, watch, breakdown, maintenance, or closed",
    });
  }

  return next();
};

module.exports = {
  validateCrusherReportInput,
};
