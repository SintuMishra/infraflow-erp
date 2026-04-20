const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isProvided = (value) => value !== undefined && value !== null && value !== "";

const parseNumber = (value) => {
  if (!isProvided(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validateVehicleInput = (req, res, next) => {
  const vehicleNumber = String(req.body.vehicleNumber || "").trim();
  const contractorName = String(req.body.contractorName || "").trim();

  if (!vehicleNumber) {
    return res.status(400).json({
      success: false,
      message: "Vehicle number is required",
    });
  }

  if (!contractorName) {
    return res.status(400).json({
      success: false,
      message: "Contractor name is required",
    });
  }

  next();
};

const validateVehicleStatusInput = (req, res, next) => {
  if (typeof req.body.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be a boolean",
    });
  }

  next();
};

const validateReportInput = (req, res, next) => {
  const {
    reportDate,
    plantId,
    shiftId,
    crusherUnitId,
    routeType,
    openingStockTons,
    inwardWeightTons,
    directToCrusherTons,
    crusherConsumptionTons,
    vehicleNumberSnapshot,
    contractorNameSnapshot,
  } = req.body;

  if (!isProvided(reportDate) || !DATE_ONLY_PATTERN.test(String(reportDate).trim())) {
    return res.status(400).json({
      success: false,
      message: "reportDate is required and must use YYYY-MM-DD format",
    });
  }

  const parsedPlantId = Number(plantId);
  if (!Number.isInteger(parsedPlantId) || parsedPlantId <= 0) {
    return res.status(400).json({
      success: false,
      message: "plantId must be a positive integer",
    });
  }

  const parsedShiftId = Number(shiftId);
  if (!Number.isInteger(parsedShiftId) || parsedShiftId <= 0) {
    return res.status(400).json({
      success: false,
      message: "shiftId must be a positive integer",
    });
  }

  if (isProvided(crusherUnitId)) {
    const parsedCrusherUnitId = Number(crusherUnitId);
    if (!Number.isInteger(parsedCrusherUnitId) || parsedCrusherUnitId <= 0) {
      return res.status(400).json({
        success: false,
        message: "crusherUnitId must be a positive integer when provided",
      });
    }
  }

  if (isProvided(routeType)) {
    const normalizedRouteType = String(routeType).trim();
    if (!["to_stock_yard", "direct_to_crushing_hub", "mixed"].includes(normalizedRouteType)) {
      return res.status(400).json({
        success: false,
        message: "routeType must be to_stock_yard, direct_to_crushing_hub, or mixed",
      });
    }
  }

  const runs = Array.isArray(req.body.vehicleRuns) ? req.body.vehicleRuns : [];
  if (!runs.length && !String(vehicleNumberSnapshot || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "vehicleNumberSnapshot is required when vehicleRuns are not provided",
    });
  }

  if (!runs.length && !String(contractorNameSnapshot || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "contractorNameSnapshot is required when vehicleRuns are not provided",
    });
  }

  if (runs.length) {
    for (let index = 0; index < runs.length; index += 1) {
      const run = runs[index] || {};
      const runRouteType = String(run.routeType || "").trim();
      const runTons = parseNumber(run.weighedTons);
      const runVehicleNumber = String(run.vehicleNumberSnapshot || "").trim();
      const runContractorName = String(run.contractorNameSnapshot || "").trim();

      if (!["to_stock_yard", "direct_to_crushing_hub"].includes(runRouteType)) {
        return res.status(400).json({
          success: false,
          message: `vehicleRuns[${index}].routeType must be to_stock_yard or direct_to_crushing_hub`,
        });
      }

      if (!Number.isFinite(runTons) || runTons <= 0) {
        return res.status(400).json({
          success: false,
          message: `vehicleRuns[${index}].weighedTons must be a number greater than 0`,
        });
      }

      if (!runVehicleNumber) {
        return res.status(400).json({
          success: false,
          message: `vehicleRuns[${index}].vehicleNumberSnapshot is required`,
        });
      }

      if (!runContractorName) {
        return res.status(400).json({
          success: false,
          message: `vehicleRuns[${index}].contractorNameSnapshot is required`,
        });
      }
    }
  }

  const numericFields = [
    [openingStockTons, "openingStockTons", true],
    [inwardWeightTons, "inwardWeightTons", true],
    [directToCrusherTons, "directToCrusherTons", true],
    [crusherConsumptionTons, "crusherConsumptionTons", true],
    [req.body.closingStockTons, "closingStockTons", false],
    [req.body.finishedOutputTons, "finishedOutputTons", false],
  ];

  for (const [fieldValue, fieldName, required] of numericFields) {
    if (!required && !isProvided(fieldValue)) {
      continue;
    }

    const parsed = parseNumber(fieldValue);
    if (!Number.isFinite(parsed)) {
      return res.status(400).json({
        success: false,
        message: `${fieldName} must be a valid number`,
      });
    }

    if (parsed < 0) {
      return res.status(400).json({
        success: false,
        message: `${fieldName} cannot be negative`,
      });
    }
  }

  next();
};

module.exports = {
  validateVehicleInput,
  validateVehicleStatusInput,
  validateReportInput,
};
