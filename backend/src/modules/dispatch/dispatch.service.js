const {
  findAllDispatchReports,
  findDispatchReportSummary,
  findDispatchById,
  insertDispatchReport,
  updateDispatchReportById,
  updateDispatchStatusById,
  generateDispatchInvoiceNumber,
  setVehicleOperationalStatus,
  plantExists,
  materialExists,
  vehicleExists,
  findActivePartyMaterialRate,
  findActiveTransportRate,
} = require("./dispatch.model");
const { withTransaction } = require("../../config/db");
const { getCompanyProfile } = require("../company_profile/company_profile.service");
const { getPartyById } = require("../parties/parties.model");
const {
  getAllPartyOrders,
  getPartyOrderById,
} = require("../party_orders/party_orders.model");
const {
  convertToTon,
  convertFromTon,
  getUnitById,
} = require("../material_unit_conversions/material_unit_conversions.service");

const allowedSourceTypes = ["Crusher", "Project", "Plant", "Store"];
const allowedStatuses = ["pending", "completed", "cancelled"];
const allowedQuantitySources = [
  "weighbridge",
  "manual_weight",
  "manual_volume",
  "vehicle_capacity",
  "trip_estimate",
];

const buildDispatchSummary = (summaryRow = {}) => ({
  totalDispatches: Number(summaryRow.totalDispatches || 0),
  totalQuantity: Number(summaryRow.totalQuantity || 0),
  totalInvoiceValue: Number(summaryRow.totalInvoiceValue || 0),
  pending: Number(summaryRow.pending || 0),
  completed: Number(summaryRow.completed || 0),
  cancelled: Number(summaryRow.cancelled || 0),
  linkedOrders: Number(summaryRow.linkedOrders || 0),
  unlinkedOrders: Number(summaryRow.unlinkedOrders || 0),
  uniquePlants: Number(summaryRow.uniquePlants || 0),
  uniqueParties: Number(summaryRow.uniqueParties || 0),
  uniqueMaterials: Number(summaryRow.uniqueMaterials || 0),
  latestDispatchDate: summaryRow.latestDispatchDate || null,
});

const getDispatchReports = async ({
  companyId = null,
  search = "",
  plantId = null,
  partyId = null,
  materialId = null,
  linkedOrderFilter = "",
  sourceType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
  page = 1,
  limit = 25,
} = {}) => {
  const filters = {
    companyId,
    search,
    plantId,
    partyId,
    materialId,
    linkedOrderFilter,
    sourceType,
    status,
    dateFrom,
    dateTo,
    page,
    limit,
  };

  const [dispatchPage, summaryRow] = await Promise.all([
    findAllDispatchReports(filters),
    findDispatchReportSummary(filters),
  ]);

  return {
    items: dispatchPage.items,
    summary: buildDispatchSummary(summaryRow),
    pagination: {
      total: dispatchPage.total,
      page: dispatchPage.page,
      limit: dispatchPage.limit,
      totalPages: dispatchPage.total ? Math.ceil(dispatchPage.total / dispatchPage.limit) : 0,
      hasPreviousPage: dispatchPage.page > 1,
      hasNextPage:
        dispatchPage.total
          ? dispatchPage.page < Math.ceil(dispatchPage.total / dispatchPage.limit)
          : false,
    },
  };
};

const getDispatchReportById = async (reportId, companyId = null) => {
  const report = await findDispatchById(Number(reportId), undefined, companyId);

  if (!report) {
    const error = new Error("Dispatch report not found");
    error.statusCode = 404;
    throw error;
  }

  return report;
};

const buildValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeStateCode = (value) => String(value || "").trim();
const toNumber = (value, fallback = 0) =>
  value === undefined || value === null || value === ""
    ? fallback
    : Number(value);
const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const roundMetric = (value, fractionDigits = 4) =>
  Number(Number(value || 0).toFixed(fractionDigits));
const isProvided = (value) => value !== undefined && value !== null && value !== "";
const hasExplicitInvoiceOverride = (invoiceValue, computedSubtotal) => {
  if (invoiceValue === undefined || invoiceValue === null || invoiceValue === "") {
    return false;
  }

  return Math.abs(roundMoney(invoiceValue) - roundMoney(computedSubtotal)) >= 0.01;
};

const calculateGST = ({ amount, gstRate, companyState, partyState }) => {
  const numericAmount = roundMoney(amount || 0);
  const numericRate = Number(gstRate || 0);
  const gstAmount = roundMoney((numericAmount * numericRate) / 100);

  if (String(companyState || "") === String(partyState || "")) {
    const cgst = roundMoney(gstAmount / 2);
    const sgst = roundMoney(gstAmount - cgst);

    return {
      cgst,
      sgst,
      igst: 0,
      totalWithGst: roundMoney(numericAmount + gstAmount),
    };
  }

  return {
    cgst: 0,
    sgst: 0,
    igst: gstAmount,
    totalWithGst: roundMoney(numericAmount + gstAmount),
  };
};

const calculateDispatchTax = ({ amount, material, company, party }) => {
  if (material.gstRate === null || material.gstRate === undefined) {
    throw buildValidationError(
      "Selected material is missing GST rate configuration"
    );
  }

  const companyState = normalizeStateCode(company?.stateCode);
  const partyState = normalizeStateCode(party?.stateCode);

  if (!companyState) {
    throw buildValidationError(
      "Company profile state code is required to calculate GST"
    );
  }

  if (!partyState) {
    throw buildValidationError(
      "Selected party state code is required to calculate GST"
    );
  }

  const gstRate = Number(material.gstRate);

  return {
    gstRate,
    ...calculateGST({
      amount,
      gstRate,
      companyState,
      partyState,
    }),
  };
};

const calculateTransportCost = async ({
  transportRate,
  quantityTons,
  distanceKm,
  materialId,
  companyId,
  dispatchDate,
}) => {
  if (!transportRate) {
    return {
      transportRateType: null,
      transportRateValue: null,
      transportCost: 0,
      transportBasisSnapshot: null,
      transportUnitIdSnapshot: null,
      transportQuantitySnapshot: null,
    };
  }

  const quantity = Number(quantityTons || 0);
  const rateValue = Number(transportRate.rateValue || 0);
  const minimumCharge = Number(transportRate.minimumCharge || 0);
  const appliedDistance =
    Number(distanceKm || 0) > 0
      ? Number(distanceKm)
      : Number(transportRate.distanceKm || 0);
  const hasUnitAwareBilling = Boolean(String(transportRate.billingBasis || "").trim());

  let transportCost = 0;
  let transportBasisSnapshot = transportRate.billingBasis || transportRate.rateType;
  let transportUnitIdSnapshot = transportRate.rateUnitId || null;
  let transportQuantitySnapshot = null;

  if (hasUnitAwareBilling) {
    const billingBasis = String(transportRate.billingBasis || "").trim();

    if (billingBasis === "per_unit") {
      if (!Number.isInteger(Number(transportRate.rateUnitId)) || Number(transportRate.rateUnitId) <= 0) {
        throw buildValidationError("Selected transport rate is missing billing unit");
      }

      const conversion = await convertFromTon(
        Number(materialId),
        quantity,
        Number(transportRate.rateUnitId),
        companyId || null,
        dispatchDate || null
      );
      transportCost = Number(conversion.calculatedQuantity) * rateValue;
      transportBasisSnapshot = "per_unit";
      transportUnitIdSnapshot = Number(transportRate.rateUnitId);
      transportQuantitySnapshot = roundMetric(Number(conversion.calculatedQuantity), 4);
    } else if (billingBasis === "per_ton") {
      transportCost = quantity * rateValue;
      transportBasisSnapshot = "per_ton";
      transportUnitIdSnapshot = null;
      transportQuantitySnapshot = roundMetric(quantity, 3);
    } else if (billingBasis === "per_trip" || billingBasis === "per_day") {
      transportCost = rateValue;
      transportBasisSnapshot = billingBasis;
      transportQuantitySnapshot = 1;
    } else if (billingBasis === "per_km") {
      transportCost = appliedDistance * rateValue;
      transportBasisSnapshot = "per_km";
      transportUnitIdSnapshot = null;
      transportQuantitySnapshot = roundMetric(appliedDistance, 3);
    }

    if (minimumCharge > 0) {
      transportCost = Math.max(transportCost, minimumCharge);
    }

    return {
      transportRateType: transportRate.rateType,
      transportRateValue: roundMoney(rateValue),
      transportCost: roundMoney(transportCost),
      transportBasisSnapshot,
      transportUnitIdSnapshot,
      transportQuantitySnapshot,
    };
  }

  if (
    transportRate.rateType === "per_trip" ||
    transportRate.rateType === "per_day"
  ) {
    transportCost = rateValue;
  } else if (transportRate.rateType === "per_ton") {
    transportCost = quantity * rateValue;
  } else if (transportRate.rateType === "per_km") {
    transportCost = appliedDistance * rateValue;
  }

  return {
    transportRateType: transportRate.rateType,
    transportRateValue: roundMoney(rateValue),
    transportCost: roundMoney(transportCost),
    transportBasisSnapshot,
    transportUnitIdSnapshot,
    transportQuantitySnapshot:
      transportRate.rateType === "per_trip" || transportRate.rateType === "per_day"
        ? 1
        : transportRate.rateType === "per_ton"
          ? roundMetric(quantity, 3)
          : transportRate.rateType === "per_km"
            ? roundMetric(appliedDistance, 3)
            : null,
  };
};

const getDefaultRateUnitLabel = (rateUnit) => {
  if (rateUnit === "per_cft") return "CFT";
  if (rateUnit === "per_metric_ton") return "metric ton";
  if (rateUnit === "per_brass") return "brass";
  if (rateUnit === "per_cubic_meter") return "cubic meter";
  if (rateUnit === "per_trip") return "trip";
  return "ton";
};

const calculateBillableRateUnits = ({ quantityTons, materialRateUnit, materialRateUnitsPerTon }) => {
  const quantity = Number(quantityTons || 0);
  const unitsPerTon = Number(materialRateUnitsPerTon || 1);
  const rawBillableUnits = quantity * unitsPerTon;

  if (materialRateUnit === "per_trip") {
    return Math.max(0, Math.ceil(rawBillableUnits - 1e-9));
  }

  return rawBillableUnits;
};

const calculateLoadingCharge = ({
  quantityTons,
  loadingCharge,
  loadingChargeBasis,
  tonsPerBrass,
}) => {
  const quantity = Number(quantityTons || 0);
  const loadingRate = roundMoney(loadingCharge || 0);
  const basis = String(loadingChargeBasis || "fixed").trim() || "fixed";

  if (basis === "none" || loadingRate <= 0) {
    return {
      loadingChargeBasis: "none",
      loadingChargeRate: loadingRate,
      loadingCharge: 0,
    };
  }

  if (basis === "per_ton") {
    return {
      loadingChargeBasis: basis,
      loadingChargeRate: loadingRate,
      loadingCharge: roundMoney(quantity * loadingRate),
    };
  }

  if (basis === "per_brass") {
    if (!Number.isFinite(Number(tonsPerBrass)) || Number(tonsPerBrass) <= 0) {
      throw buildValidationError(
        "Selected party material rate has invalid tons-per-brass for per_brass loading basis"
      );
    }

    return {
      loadingChargeBasis: basis,
      loadingChargeRate: loadingRate,
      loadingCharge: roundMoney((quantity / Number(tonsPerBrass)) * loadingRate),
    };
  }

  return {
    loadingChargeBasis: basis,
    loadingChargeRate: loadingRate,
    loadingCharge: roundMoney(loadingRate),
  };
};

const calculateMaterialAmount = async ({
  quantityTons,
  partyMaterialRate,
  materialId,
  companyId,
  dispatchDate,
}) => {
  const quantity = Number(quantityTons || 0);
  const hasUnitAwareBilling =
    Boolean(String(partyMaterialRate.billingBasis || "").trim()) &&
    (
      partyMaterialRate.pricePerUnit !== null &&
      partyMaterialRate.pricePerUnit !== undefined &&
      partyMaterialRate.pricePerUnit !== ""
    );

  if (hasUnitAwareBilling) {
    const billingBasis = String(partyMaterialRate.billingBasis || "").trim();
    const effectiveTonRate = roundMoney(
      partyMaterialRate.pricePerUnit || partyMaterialRate.ratePerTon || 0
    );

    if (billingBasis === "per_unit") {
      if (!Number.isInteger(Number(partyMaterialRate.rateUnitId)) || Number(partyMaterialRate.rateUnitId) <= 0) {
        throw buildValidationError("Selected party material rate is missing billing unit");
      }

      const conversion = await convertFromTon(
        Number(materialId),
        quantity,
        Number(partyMaterialRate.rateUnitId),
        companyId || null,
        dispatchDate || null
      );
      const billingUnit = await getUnitById(
        Number(partyMaterialRate.rateUnitId),
        companyId || null
      );
      const billedQuantity = Number(conversion.calculatedQuantity);
      const billedRate = roundMoney(partyMaterialRate.pricePerUnit);

      return {
        materialRatePerTon: billedRate,
        materialRateUnit: partyMaterialRate.rateUnit || "other",
        materialRateUnitLabel:
          billingUnit.unitCode || partyMaterialRate.rateUnitLabel || "unit",
        materialRateUnitsPerTon: roundMetric(billedQuantity / Math.max(quantity, 1e-9)),
        billingBasisSnapshot: "per_unit",
        billingUnitIdSnapshot: Number(partyMaterialRate.rateUnitId),
        billedQuantitySnapshot: roundMetric(billedQuantity, 4),
        billedRateSnapshot: billedRate,
        materialAmount: roundMoney(billedQuantity * billedRate),
        conversionNotesSnapshot: `Unit-aware billing converted ${roundMetric(quantity, 3)} ton to ${roundMetric(
          billedQuantity,
          4
        )} ${billingUnit.unitCode || "unit"} using factor ${Number(
          conversion.effectiveConversionFactor || conversion.conversionFactor
        )}.`,
      };
    }

    if (billingBasis === "per_ton") {
      return {
        materialRatePerTon: effectiveTonRate,
        materialRateUnit: partyMaterialRate.rateUnit || "per_ton",
        materialRateUnitLabel: partyMaterialRate.rateUnitLabel || "ton",
        materialRateUnitsPerTon: 1,
        billingBasisSnapshot: "per_ton",
        billingUnitIdSnapshot: null,
        billedQuantitySnapshot: roundMetric(quantity, 4),
        billedRateSnapshot: effectiveTonRate,
        materialAmount: roundMoney(quantity * effectiveTonRate),
        conversionNotesSnapshot: "Unit-aware ton billing used normalized dispatch tons directly.",
      };
    }

    if (billingBasis === "per_trip") {
      const materialRateUnit = partyMaterialRate.rateUnit || "per_trip";
      const materialRateUnitsPerTon = Number(partyMaterialRate.rateUnitsPerTon || 1);

      if (!Number.isFinite(materialRateUnitsPerTon) || materialRateUnitsPerTon <= 0) {
        throw buildValidationError(
          "Selected party material rate has invalid billable units per ton"
        );
      }

      const billedQuantity = calculateBillableRateUnits({
        quantityTons: quantity,
        materialRateUnit,
        materialRateUnitsPerTon,
      });
      const billedRate = roundMoney(partyMaterialRate.pricePerUnit || partyMaterialRate.ratePerTon || 0);

      return {
        materialRatePerTon: billedRate,
        materialRateUnit,
        materialRateUnitLabel:
          partyMaterialRate.rateUnitLabel || getDefaultRateUnitLabel(materialRateUnit),
        materialRateUnitsPerTon,
        billingBasisSnapshot: "per_trip",
        billingUnitIdSnapshot: Number(partyMaterialRate.rateUnitId || 0) || null,
        billedQuantitySnapshot: roundMetric(billedQuantity, 4),
        billedRateSnapshot: billedRate,
        materialAmount: roundMoney(billedQuantity * billedRate),
        conversionNotesSnapshot: "Unit-aware trip billing used the current legacy trip rounding logic.",
      };
    }

    if (billingBasis === "fixed") {
      const billedRate = roundMoney(partyMaterialRate.pricePerUnit || partyMaterialRate.ratePerTon || 0);

      return {
        materialRatePerTon: billedRate,
        materialRateUnit: partyMaterialRate.rateUnit || "fixed",
        materialRateUnitLabel: partyMaterialRate.rateUnitLabel || "dispatch",
        materialRateUnitsPerTon: 1,
        billingBasisSnapshot: "fixed",
        billingUnitIdSnapshot: null,
        billedQuantitySnapshot: 1,
        billedRateSnapshot: billedRate,
        materialAmount: billedRate,
        conversionNotesSnapshot: "Fixed billing applied once per dispatch.",
      };
    }
  }

  const materialRatePerTon = Number(partyMaterialRate.ratePerTon || 0);
  const materialRateUnit = partyMaterialRate.rateUnit || "per_ton";
  const materialRateUnitsPerTon = Number(partyMaterialRate.rateUnitsPerTon || 1);

  if (!Number.isFinite(materialRateUnitsPerTon) || materialRateUnitsPerTon <= 0) {
    throw buildValidationError(
      "Selected party material rate has invalid billable units per ton"
    );
  }

  return {
    materialRatePerTon,
    materialRateUnit,
    materialRateUnitLabel:
      partyMaterialRate.rateUnitLabel || getDefaultRateUnitLabel(materialRateUnit),
    materialRateUnitsPerTon,
    billingBasisSnapshot:
      partyMaterialRate.billingBasis ||
      (materialRateUnit === "per_ton" || materialRateUnit === "per_metric_ton"
        ? "per_ton"
        : materialRateUnit === "per_trip"
          ? "per_trip"
          : "per_unit"),
    billingUnitIdSnapshot: partyMaterialRate.rateUnitId || null,
    billedQuantitySnapshot: roundMetric(
      calculateBillableRateUnits({
        quantityTons: quantity,
        materialRateUnit,
        materialRateUnitsPerTon,
      }),
      4
    ),
    billedRateSnapshot: roundMoney(materialRatePerTon),
    materialAmount: roundMoney(
      calculateBillableRateUnits({
        quantityTons: quantity,
        materialRateUnit,
        materialRateUnitsPerTon,
      }) * materialRatePerTon
    ),
    conversionNotesSnapshot: `Legacy billing uses ${materialRateUnit} with ${roundMetric(materialRateUnitsPerTon)} billable units per ton.`,
  };
};

const calculateDispatchCommercials = async ({
  dispatchDate,
  plantId,
  materialId,
  partyId,
  vehicle,
  transportVendorId,
  quantityTons,
  distanceKm,
  otherCharge,
  loadingCharge,
  loadingChargeManual,
  invoiceValue,
  billingNotes,
  companyId,
}) => {
  const partyMaterialRate = await findActivePartyMaterialRate({
    plantId: Number(plantId),
    partyId: Number(partyId),
    materialId: Number(materialId),
    companyId: companyId || null,
    effectiveDate: dispatchDate || null,
  });

  if (!partyMaterialRate) {
    throw buildValidationError(
      "No active party material rate found for the selected plant, material, and party"
    );
  }

  const effectiveTransportVendorId =
    transportVendorId || vehicle.vendorId || null;

  const transportRate = effectiveTransportVendorId
      ? await findActiveTransportRate({
        plantId: Number(plantId),
        vendorId: Number(effectiveTransportVendorId),
        materialId: Number(materialId),
        companyId: companyId || null,
      })
    : null;

  const quantity = Number(quantityTons || 0);
  const {
    materialRatePerTon,
    materialRateUnit,
    materialRateUnitLabel,
    materialRateUnitsPerTon,
    billingBasisSnapshot,
    billingUnitIdSnapshot,
    billedQuantitySnapshot,
    billedRateSnapshot,
    materialAmount,
    conversionNotesSnapshot,
  } = await calculateMaterialAmount({
    quantityTons: quantity,
    partyMaterialRate,
    materialId,
    companyId,
    dispatchDate,
  });
  const royaltyMode = partyMaterialRate.royaltyMode || "none";
  const royaltyValue = Number(partyMaterialRate.royaltyValue || 0);
  const tonsPerBrass =
    partyMaterialRate.tonsPerBrass === null || partyMaterialRate.tonsPerBrass === undefined
      ? null
      : Number(partyMaterialRate.tonsPerBrass);
  const loadingDefaults = calculateLoadingCharge({
    quantityTons: quantity,
    loadingCharge: partyMaterialRate.loadingCharge || 0,
    loadingChargeBasis: partyMaterialRate.loadingChargeBasis || "fixed",
    tonsPerBrass,
  });
  const normalizedLoadingChargeManual = Boolean(loadingChargeManual);
  const normalizedLoadingCharge = normalizedLoadingChargeManual
    ? roundMoney(toNumber(loadingCharge, 0))
    : loadingDefaults.loadingCharge;
  const normalizedOtherCharge = roundMoney(toNumber(otherCharge, 0));

  let royaltyAmount = 0;

  if (royaltyMode === "per_ton") {
    royaltyAmount = roundMoney(quantity * royaltyValue);
  } else if (royaltyMode === "per_brass") {
    if (!Number.isFinite(tonsPerBrass) || tonsPerBrass <= 0) {
      throw buildValidationError(
        "Selected party material rate has invalid tons-per-brass for per_brass royalty mode"
      );
    }
    royaltyAmount = roundMoney((quantity / tonsPerBrass) * royaltyValue);
  } else if (royaltyMode === "fixed") {
    royaltyAmount = roundMoney(royaltyValue);
  }

  const {
    transportRateType,
    transportRateValue,
    transportBasisSnapshot,
    transportUnitIdSnapshot,
    transportQuantitySnapshot,
    transportCost,
  } = await calculateTransportCost({
    transportRate,
    quantityTons: quantity,
    distanceKm,
    materialId,
    companyId,
    dispatchDate,
  });

  const computedSubtotal = roundMoney(
    materialAmount +
    royaltyAmount +
    normalizedLoadingCharge +
    transportCost +
    normalizedOtherCharge
  );

  const finalInvoiceValue =
    invoiceValue === undefined || invoiceValue === null || invoiceValue === ""
      ? computedSubtotal
      : roundMoney(invoiceValue);

  if (
    hasExplicitInvoiceOverride(invoiceValue, computedSubtotal) &&
    !String(billingNotes || "").trim()
  ) {
    throw buildValidationError(
      "Billing notes are required when manually overriding the taxable invoice value"
    );
  }

  return {
    transportVendorId: effectiveTransportVendorId
      ? Number(effectiveTransportVendorId)
      : null,
    partyMaterialRateId: Number(partyMaterialRate.id),
    transportRateId: transportRate ? Number(transportRate.id) : null,
    materialRatePerTon: roundMoney(materialRatePerTon),
    materialRateUnit,
    materialRateUnitLabel,
    materialRateUnitsPerTon: roundMetric(materialRateUnitsPerTon),
    billingBasisSnapshot,
    billingUnitIdSnapshot,
    billedQuantitySnapshot,
    billedRateSnapshot,
    materialAmount,
    transportRateType,
    transportRateValue,
    transportBasisSnapshot,
    transportUnitIdSnapshot,
    transportQuantitySnapshot,
    transportCost,
    royaltyMode,
    royaltyValue: roundMoney(royaltyValue),
    royaltyTonsPerBrass:
      royaltyMode === "per_brass" && Number.isFinite(tonsPerBrass) && tonsPerBrass > 0
        ? roundMetric(tonsPerBrass)
        : null,
    royaltyAmount,
    loadingCharge: normalizedLoadingCharge,
    loadingChargeBasis: loadingDefaults.loadingChargeBasis,
    loadingChargeRate: loadingDefaults.loadingChargeRate,
    loadingChargeIsManual: normalizedLoadingChargeManual,
    otherCharge: normalizedOtherCharge,
    totalInvoiceValue: finalInvoiceValue,
    invoiceValue: finalInvoiceValue,
    conversionNotesSnapshot,
  };
};

const validateDispatchMasterLinks = async ({
  plantId,
  materialId,
  vehicleId,
  partyId,
  companyId,
}) => {
  const plant = await plantExists(Number(plantId), companyId);
  if (!plant) {
    const error = new Error("Selected plant does not exist");
    error.statusCode = 400;
    throw error;
  }

  const material = await materialExists(Number(materialId), companyId);
  if (!material) {
    const error = new Error("Selected material does not exist");
    error.statusCode = 400;
    throw error;
  }

  const vehicle = await vehicleExists(Number(vehicleId), companyId);
  if (!vehicle) {
    const error = new Error("Selected vehicle does not exist");
    error.statusCode = 400;
    throw error;
  }

  if (Number(vehicle.plantId) !== Number(plantId)) {
    const error = new Error("Selected vehicle does not belong to the selected plant");
    error.statusCode = 400;
    throw error;
  }

  const party = await getPartyById(Number(partyId), companyId);
  if (!party) {
    const error = new Error("Selected party does not exist");
    error.statusCode = 400;
    throw error;
  }

  return { plant, material, vehicle, party };
};

const assertVehicleAvailable = (vehicle) => {
  if (vehicle.status !== "active") {
    const error = new Error("Selected vehicle is not available for dispatch");
    error.statusCode = 400;
    throw error;
  }
};

const assertVehicleCapacity = (vehicle, quantityTons, quantitySource = null) => {
  if (String(quantitySource || "").trim() === "trip_estimate") {
    return;
  }

  if (
    vehicle.vehicleCapacityTons !== null &&
    vehicle.vehicleCapacityTons !== undefined &&
    Number(quantityTons) > Number(vehicle.vehicleCapacityTons)
  ) {
    const error = new Error(
      `Dispatch quantity exceeds vehicle capacity of ${vehicle.vehicleCapacityTons} tons`
    );
    error.statusCode = 400;
    throw error;
  }
};

const normalizeDispatchQuantity = async ({
  materialId,
  vehicle,
  quantityTons,
  enteredQuantity,
  enteredUnitId,
  quantitySource,
  companyId,
  dispatchDate,
}) => {
  const hasNewQuantityFields =
    isProvided(quantitySource) || isProvided(enteredQuantity) || isProvided(enteredUnitId);

  if (!hasNewQuantityFields) {
    const normalizedQuantityTons = Number(quantityTons);

    if (!Number.isFinite(normalizedQuantityTons) || normalizedQuantityTons <= 0) {
      throw buildValidationError("quantityTons must be a valid number greater than 0");
    }

    return {
      quantityTons: normalizedQuantityTons,
      enteredQuantity: null,
      enteredUnitId: null,
      quantitySource: null,
      conversionFactorToTon: null,
      conversionId: null,
      conversionMethodSnapshot: null,
      sourceVehicleCapacityTons: null,
      sourceVehicleCapacityUnitId: null,
    };
  }

  const normalizedSource = String(quantitySource || "").trim();

  if (!allowedQuantitySources.includes(normalizedSource)) {
    throw buildValidationError(
      "quantitySource must be one of weighbridge, manual_weight, manual_volume, vehicle_capacity, trip_estimate"
    );
  }

  if (normalizedSource === "weighbridge" || normalizedSource === "manual_weight") {
    const normalizedQuantityTons = Number(quantityTons);

    if (!Number.isFinite(normalizedQuantityTons) || normalizedQuantityTons <= 0) {
      throw buildValidationError("quantityTons must be a valid number greater than 0");
    }

    return {
      quantityTons: normalizedQuantityTons,
      enteredQuantity:
        isProvided(enteredQuantity) && Number.isFinite(Number(enteredQuantity))
          ? Number(enteredQuantity)
          : null,
      enteredUnitId:
        isProvided(enteredUnitId) && Number.isFinite(Number(enteredUnitId))
          ? Number(enteredUnitId)
          : null,
      quantitySource: normalizedSource,
      conversionFactorToTon: 1,
      conversionId: null,
      conversionMethodSnapshot: normalizedSource,
      sourceVehicleCapacityTons: null,
      sourceVehicleCapacityUnitId: null,
    };
  }

  if (normalizedSource === "manual_volume") {
    const normalizedEnteredQuantity = Number(enteredQuantity);
    const normalizedEnteredUnitId = Number(enteredUnitId);

    if (!Number.isFinite(normalizedEnteredQuantity) || normalizedEnteredQuantity <= 0) {
      throw buildValidationError("enteredQuantity must be a valid number greater than 0");
    }

    if (!Number.isInteger(normalizedEnteredUnitId) || normalizedEnteredUnitId <= 0) {
      throw buildValidationError("enteredUnitId must be a valid positive number");
    }

    const conversion = await convertToTon(
      Number(materialId),
      normalizedEnteredQuantity,
      normalizedEnteredUnitId,
      companyId || null,
      dispatchDate || null
    );

    return {
      quantityTons: Number(conversion.calculatedQuantity),
      enteredQuantity: normalizedEnteredQuantity,
      enteredUnitId: normalizedEnteredUnitId,
      quantitySource: normalizedSource,
      conversionFactorToTon: Number(
        conversion.effectiveConversionFactor || conversion.conversionFactor
      ),
      conversionId: conversion.originalConversionId || conversion.conversionId || null,
      conversionMethodSnapshot: conversion.conversionMethod || null,
      sourceVehicleCapacityTons: null,
      sourceVehicleCapacityUnitId: null,
    };
  }

  if (normalizedSource === "vehicle_capacity" || normalizedSource === "trip_estimate") {
    const vehicleCapacityTons = Number(vehicle?.vehicleCapacityTons);

    if (!Number.isFinite(vehicleCapacityTons) || vehicleCapacityTons <= 0) {
      throw buildValidationError(
        "Selected vehicle is missing capacity in tons for quantity estimation"
      );
    }

    const trips =
      normalizedSource === "trip_estimate" && isProvided(enteredQuantity)
        ? Number(enteredQuantity)
        : 1;

    if (!Number.isFinite(trips) || trips <= 0) {
      throw buildValidationError(
        "enteredQuantity must be a valid number greater than 0 for trip_estimate"
      );
    }

    return {
      quantityTons: roundMetric(vehicleCapacityTons * trips, 3),
      enteredQuantity: isProvided(enteredQuantity) ? Number(enteredQuantity) : 1,
      enteredUnitId:
        isProvided(enteredUnitId) && Number.isFinite(Number(enteredUnitId))
          ? Number(enteredUnitId)
          : null,
      quantitySource: normalizedSource,
      conversionFactorToTon: vehicleCapacityTons,
      conversionId: null,
      conversionMethodSnapshot: "vehicle_capacity",
      sourceVehicleCapacityTons: vehicleCapacityTons,
      sourceVehicleCapacityUnitId: null,
    };
  }

  throw buildValidationError("Unsupported quantity source");
};

const assertDispatchCompletionReadiness = ({
  status,
  invoiceNumber,
  invoiceDate,
  totalInvoiceValue,
}) => {
  if (status !== "completed") {
    return;
  }

  if (!String(invoiceNumber || "").trim()) {
    throw buildValidationError(
      "Invoice Number is required before marking a dispatch as completed"
    );
  }

  if (!String(invoiceDate || "").trim()) {
    throw buildValidationError(
      "Invoice Date is required before marking a dispatch as completed"
    );
  }

  if (!(Number(totalInvoiceValue || 0) > 0)) {
    throw buildValidationError(
      "A positive taxable invoice value is required before marking a dispatch as completed"
    );
  }
};

const resolveCompletionInvoiceFields = async ({
  status,
  dispatchDate,
  invoiceNumber,
  invoiceDate,
  companyId,
  db,
}) => {
  const normalizedInvoiceNumber = String(invoiceNumber || "").trim();
  const normalizedInvoiceDate = String(invoiceDate || "").trim();

  if (status !== "completed") {
    return {
      invoiceNumber: normalizedInvoiceNumber || null,
      invoiceDate: normalizedInvoiceDate || null,
    };
  }

  const effectiveInvoiceDate = normalizedInvoiceDate || dispatchDate || null;

  const effectiveInvoiceNumber =
    normalizedInvoiceNumber ||
    (effectiveInvoiceDate
      ? await generateDispatchInvoiceNumber(
          {
            dispatchDate: effectiveInvoiceDate,
            companyId: companyId || null,
          },
          db
        )
      : null);

  return {
    invoiceNumber: effectiveInvoiceNumber,
    invoiceDate: effectiveInvoiceDate,
  };
};

const validatePartyOrderLink = async ({
  partyOrderId,
  companyId,
  plantId,
  materialId,
  partyId,
  quantityTons,
  existingReportId = null,
}) => {
  if (!partyOrderId) {
    return null;
  }

  const order = await getPartyOrderById(Number(partyOrderId), companyId || null, {
    excludeDispatchReportId: existingReportId ? Number(existingReportId) : null,
  });

  if (!order) {
    throw buildValidationError("Selected party order does not exist");
  }

  if (order.status === "cancelled") {
    throw buildValidationError("Selected party order is cancelled");
  }

  if (String(order.partyId) !== String(partyId)) {
    throw buildValidationError("Selected party order does not belong to the selected party");
  }

  if (String(order.plantId) !== String(plantId)) {
    throw buildValidationError("Selected party order does not belong to the selected plant");
  }

  if (String(order.materialId) !== String(materialId)) {
    throw buildValidationError("Selected party order does not match the selected material");
  }

  if (Number(quantityTons) > Number(order.pendingQuantityTons || 0)) {
    throw buildValidationError(
      `Dispatch quantity exceeds pending order quantity of ${order.pendingQuantityTons} tons`
    );
  }

  return order;
};

const getMatchingFulfillableOrders = async ({
  companyId,
  plantId,
  materialId,
  partyId,
}) => {
  const orders = await getAllPartyOrders(companyId || null);

  return orders.filter(
    (order) =>
      order.status !== "cancelled" &&
      Number(order.pendingQuantityTons || 0) > 0 &&
      String(order.partyId) === String(partyId) &&
      String(order.plantId) === String(plantId) &&
      String(order.materialId) === String(materialId)
  );
};

const ensureDispatchHasRequiredOrderLink = async ({
  partyOrderId,
  companyId,
  plantId,
  materialId,
  partyId,
}) => {
  if (partyOrderId) {
    return;
  }

  const matchingOrders = await getMatchingFulfillableOrders({
    companyId,
    plantId,
    materialId,
    partyId,
  });

  if (matchingOrders.length > 0) {
    throw buildValidationError(
      "Select a party order before dispatching this load so pending quantity can be tracked correctly"
    );
  }
};

const validatePartyOrderStatusTransition = async ({
  existingReport,
  nextStatus,
  companyId,
}) => {
  if (!existingReport?.partyOrderId) {
    return null;
  }

  if (!["pending", "completed"].includes(nextStatus)) {
    return null;
  }

  return await validatePartyOrderLink({
    partyOrderId: existingReport.partyOrderId,
    companyId: companyId || null,
    plantId: existingReport.plantId,
    materialId: existingReport.materialId,
    partyId: existingReport.partyId,
    quantityTons: existingReport.quantityTons,
    existingReportId: existingReport.id,
  });
};

const createDispatchReport = async ({
  dispatchDate,
  sourceType,
  destinationName,
  quantityTons,
  enteredQuantity,
  enteredUnitId,
  quantitySource,
  remarks,
  createdBy,
  plantId,
  materialId,
  vehicleId,
  partyId,
  status,
  ewbNumber,
  ewbDate,
  ewbValidUpto,
  invoiceNumber,
  invoiceDate,
  invoiceValue,
  distanceKm,
  transportVendorId,
  partyOrderId,
  otherCharge,
  loadingCharge,
  loadingChargeManual,
  billingNotes,
  companyId,
}) => {
  if (!allowedSourceTypes.includes(sourceType)) {
    const error = new Error("Invalid source type");
    error.statusCode = 400;
    throw error;
  }

  const finalStatus = status || "pending";

  if (!allowedStatuses.includes(finalStatus)) {
    const error = new Error("Invalid dispatch status");
    error.statusCode = 400;
    throw error;
  }

  const { plant, material, vehicle, party } = await validateDispatchMasterLinks({
    plantId,
    materialId,
    vehicleId,
    partyId,
    companyId: companyId || null,
  });

  const normalizedQuantity = await normalizeDispatchQuantity({
    materialId,
    vehicle,
    quantityTons,
    enteredQuantity,
    enteredUnitId,
    quantitySource,
    companyId: companyId || null,
    dispatchDate,
  });

  assertVehicleCapacity(
    vehicle,
    normalizedQuantity.quantityTons,
    normalizedQuantity.quantitySource
  );

  if (finalStatus === "pending") {
    assertVehicleAvailable(vehicle);
  }

  await ensureDispatchHasRequiredOrderLink({
    partyOrderId,
    companyId: companyId || null,
    plantId,
    materialId,
    partyId,
  });

  await validatePartyOrderLink({
    partyOrderId,
    companyId: companyId || null,
    plantId,
    materialId,
    partyId,
    quantityTons: normalizedQuantity.quantityTons,
  });

  const company = await getCompanyProfile(companyId || null);
  const commercials = await calculateDispatchCommercials({
    dispatchDate,
    plantId,
    materialId,
    partyId,
    vehicle,
    transportVendorId,
    quantityTons: normalizedQuantity.quantityTons,
    distanceKm,
    otherCharge,
    loadingCharge,
    loadingChargeManual,
    invoiceValue,
    billingNotes,
    companyId: companyId || null,
  });

  const gstResult = calculateDispatchTax({
    amount: commercials.totalInvoiceValue,
    material,
    company,
    party,
  });

  return await withTransaction(async (db) => {
    const completionInvoiceFields = await resolveCompletionInvoiceFields({
      status: finalStatus,
      dispatchDate,
      invoiceNumber,
      invoiceDate,
      companyId,
      db,
    });

    assertDispatchCompletionReadiness({
      status: finalStatus,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      totalInvoiceValue: commercials.totalInvoiceValue,
    });

    const report = await insertDispatchReport({
      dispatchDate,
      sourceType,
      sourceName: plant.plantName,
      materialType: material.materialName,
      vehicleNumber: vehicle.vehicleNumber,
      destinationName,
      quantityTons: normalizedQuantity.quantityTons,
      enteredQuantity: normalizedQuantity.enteredQuantity,
      enteredUnitId: normalizedQuantity.enteredUnitId,
      quantitySource: normalizedQuantity.quantitySource,
      conversionFactorToTon: normalizedQuantity.conversionFactorToTon,
      conversionId: normalizedQuantity.conversionId,
      conversionMethodSnapshot: normalizedQuantity.conversionMethodSnapshot,
      sourceVehicleCapacityTons: normalizedQuantity.sourceVehicleCapacityTons,
      sourceVehicleCapacityUnitId: normalizedQuantity.sourceVehicleCapacityUnitId,
      remarks,
      createdBy,
      plantId: Number(plantId),
      materialId: Number(materialId),
      vehicleId: Number(vehicleId),
      partyId: Number(partyId),
      partyOrderId: partyOrderId ? Number(partyOrderId) : null,
      status: finalStatus,
      ewbNumber,
      ewbDate,
      ewbValidUpto,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      invoiceValue: commercials.invoiceValue,
      distanceKm: distanceKm === "" ? null : distanceKm,
      transportVendorId: commercials.transportVendorId,
      partyMaterialRateId: commercials.partyMaterialRateId,
      transportRateId: commercials.transportRateId,
      materialRatePerTon: commercials.materialRatePerTon,
      materialRateUnit: commercials.materialRateUnit,
      materialRateUnitLabel: commercials.materialRateUnitLabel,
      materialRateUnitsPerTon: commercials.materialRateUnitsPerTon,
      billingBasisSnapshot: commercials.billingBasisSnapshot,
      billingUnitIdSnapshot: commercials.billingUnitIdSnapshot,
      billedQuantitySnapshot: commercials.billedQuantitySnapshot,
      billedRateSnapshot: commercials.billedRateSnapshot,
      materialAmount: commercials.materialAmount,
      transportRateType: commercials.transportRateType,
      transportRateValue: commercials.transportRateValue,
      transportBasisSnapshot: commercials.transportBasisSnapshot,
      transportUnitIdSnapshot: commercials.transportUnitIdSnapshot,
      transportQuantitySnapshot: commercials.transportQuantitySnapshot,
      transportCost: commercials.transportCost,
      royaltyMode: commercials.royaltyMode,
      royaltyValue: commercials.royaltyValue,
      royaltyTonsPerBrass: commercials.royaltyTonsPerBrass,
      royaltyAmount: commercials.royaltyAmount,
      loadingCharge: commercials.loadingCharge,
      loadingChargeBasis: commercials.loadingChargeBasis,
      loadingChargeRate: commercials.loadingChargeRate,
      loadingChargeIsManual: commercials.loadingChargeIsManual,
      otherCharge: commercials.otherCharge,
      totalInvoiceValue: commercials.totalInvoiceValue,
      conversionNotesSnapshot: commercials.conversionNotesSnapshot,
      billingNotes: billingNotes || null,
      gstRate: gstResult.gstRate,
      cgst: gstResult.cgst,
      sgst: gstResult.sgst,
      igst: gstResult.igst,
      totalWithGst: gstResult.totalWithGst,
      companyId: companyId || null,
    }, db);

    if (finalStatus === "pending") {
      await setVehicleOperationalStatus({
        vehicleId: Number(vehicleId),
        status: "in_use",
        companyId: companyId || null,
      }, db);
    }

    return report;
  });
};

const editDispatchReport = async ({
  reportId,
  dispatchDate,
  sourceType,
  destinationName,
  quantityTons,
  enteredQuantity,
  enteredUnitId,
  quantitySource,
  remarks,
  plantId,
  materialId,
  vehicleId,
  partyId,
  ewbNumber,
  ewbDate,
  ewbValidUpto,
  invoiceNumber,
  invoiceDate,
  invoiceValue,
  distanceKm,
  transportVendorId,
  partyOrderId,
  otherCharge,
  loadingCharge,
  loadingChargeManual,
  billingNotes,
  companyId,
}) => {
  if (!allowedSourceTypes.includes(sourceType)) {
    const error = new Error("Invalid source type");
    error.statusCode = 400;
    throw error;
  }

  const existingReport = await findDispatchById(Number(reportId), undefined, companyId || null);
  if (!existingReport) {
    const error = new Error("Dispatch report not found");
    error.statusCode = 404;
    throw error;
  }

  const { plant, material, vehicle, party } = await validateDispatchMasterLinks({
    plantId,
    materialId,
    vehicleId,
    partyId,
    companyId: companyId || null,
  });

  const normalizedQuantity = await normalizeDispatchQuantity({
    materialId,
    vehicle,
    quantityTons,
    enteredQuantity,
    enteredUnitId,
    quantitySource,
    companyId: companyId || null,
    dispatchDate,
  });

  assertVehicleCapacity(
    vehicle,
    normalizedQuantity.quantityTons,
    normalizedQuantity.quantitySource
  );

  const vehicleChanged = Number(existingReport.vehicleId) !== Number(vehicleId);

  if (existingReport.status === "pending" && vehicleChanged) {
    assertVehicleAvailable(vehicle);
  }

  await ensureDispatchHasRequiredOrderLink({
    partyOrderId,
    companyId: companyId || null,
    plantId,
    materialId,
    partyId,
  });

  await validatePartyOrderLink({
    partyOrderId,
    companyId: companyId || null,
    plantId,
    materialId,
    partyId,
    quantityTons: normalizedQuantity.quantityTons,
    existingReportId: reportId,
  });

  const company = await getCompanyProfile(companyId || null);
  const commercials = await calculateDispatchCommercials({
    dispatchDate,
    plantId,
    materialId,
    partyId,
    vehicle,
    transportVendorId,
    quantityTons: normalizedQuantity.quantityTons,
    distanceKm,
    otherCharge,
    loadingCharge,
    loadingChargeManual,
    invoiceValue,
    billingNotes,
    companyId: companyId || null,
  });
  const gstResult = calculateDispatchTax({
    amount: commercials.totalInvoiceValue,
    material,
    company,
    party,
  });

  return await withTransaction(async (db) => {
    const completionInvoiceFields = await resolveCompletionInvoiceFields({
      status: existingReport.status,
      dispatchDate,
      invoiceNumber,
      invoiceDate,
      companyId,
      db,
    });

    assertDispatchCompletionReadiness({
      status: existingReport.status,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      totalInvoiceValue: commercials.totalInvoiceValue,
    });

    const updatedReport = await updateDispatchReportById({
      reportId: Number(reportId),
      dispatchDate,
      sourceType,
      sourceName: plant.plantName,
      materialType: material.materialName,
      vehicleNumber: vehicle.vehicleNumber,
      destinationName,
      quantityTons: normalizedQuantity.quantityTons,
      enteredQuantity: normalizedQuantity.enteredQuantity,
      enteredUnitId: normalizedQuantity.enteredUnitId,
      quantitySource: normalizedQuantity.quantitySource,
      conversionFactorToTon: normalizedQuantity.conversionFactorToTon,
      conversionId: normalizedQuantity.conversionId,
      conversionMethodSnapshot: normalizedQuantity.conversionMethodSnapshot,
      sourceVehicleCapacityTons: normalizedQuantity.sourceVehicleCapacityTons,
      sourceVehicleCapacityUnitId: normalizedQuantity.sourceVehicleCapacityUnitId,
      remarks,
      plantId: Number(plantId),
      materialId: Number(materialId),
      vehicleId: Number(vehicleId),
      partyId: Number(partyId),
      partyOrderId: partyOrderId ? Number(partyOrderId) : null,
      ewbNumber,
      ewbDate,
      ewbValidUpto,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      invoiceValue: commercials.invoiceValue,
      distanceKm: distanceKm === "" ? null : distanceKm,
      transportVendorId: commercials.transportVendorId,
      partyMaterialRateId: commercials.partyMaterialRateId,
      transportRateId: commercials.transportRateId,
      materialRatePerTon: commercials.materialRatePerTon,
      materialRateUnit: commercials.materialRateUnit,
      materialRateUnitLabel: commercials.materialRateUnitLabel,
      materialRateUnitsPerTon: commercials.materialRateUnitsPerTon,
      billingBasisSnapshot: commercials.billingBasisSnapshot,
      billingUnitIdSnapshot: commercials.billingUnitIdSnapshot,
      billedQuantitySnapshot: commercials.billedQuantitySnapshot,
      billedRateSnapshot: commercials.billedRateSnapshot,
      materialAmount: commercials.materialAmount,
      transportRateType: commercials.transportRateType,
      transportRateValue: commercials.transportRateValue,
      transportBasisSnapshot: commercials.transportBasisSnapshot,
      transportUnitIdSnapshot: commercials.transportUnitIdSnapshot,
      transportQuantitySnapshot: commercials.transportQuantitySnapshot,
      transportCost: commercials.transportCost,
      royaltyMode: commercials.royaltyMode,
      royaltyValue: commercials.royaltyValue,
      royaltyTonsPerBrass: commercials.royaltyTonsPerBrass,
      royaltyAmount: commercials.royaltyAmount,
      loadingCharge: commercials.loadingCharge,
      loadingChargeBasis: commercials.loadingChargeBasis,
      loadingChargeRate: commercials.loadingChargeRate,
      loadingChargeIsManual: commercials.loadingChargeIsManual,
      otherCharge: commercials.otherCharge,
      totalInvoiceValue: commercials.totalInvoiceValue,
      conversionNotesSnapshot: commercials.conversionNotesSnapshot,
      billingNotes: billingNotes || null,
      gstRate: gstResult.gstRate,
      cgst: gstResult.cgst,
      sgst: gstResult.sgst,
      igst: gstResult.igst,
      totalWithGst: gstResult.totalWithGst,
      companyId: companyId || null,
    }, db);

    if (existingReport.status === "pending" && vehicleChanged) {
      await setVehicleOperationalStatus({
        vehicleId: Number(existingReport.vehicleId),
        status: "active",
        companyId: companyId || null,
      }, db);

      await setVehicleOperationalStatus({
        vehicleId: Number(vehicleId),
        status: "in_use",
        companyId: companyId || null,
      }, db);
    }

    return updatedReport;
  });
};

const updateDispatchStatus = async ({ reportId, status, companyId }) => {
  if (!allowedStatuses.includes(status)) {
    const error = new Error("Invalid dispatch status");
    error.statusCode = 400;
    throw error;
  }

  const existingReport = await findDispatchById(Number(reportId), undefined, companyId || null);
  if (!existingReport) {
    const error = new Error("Dispatch report not found");
    error.statusCode = 404;
    throw error;
  }

  if (existingReport.status === status) {
    return existingReport;
  }

  if (status === "pending") {
    const vehicle = await vehicleExists(Number(existingReport.vehicleId), companyId || null);
    if (!vehicle) {
      const error = new Error("Linked vehicle not found");
      error.statusCode = 400;
      throw error;
    }

    assertVehicleAvailable(vehicle);
    assertVehicleCapacity(vehicle, existingReport.quantityTons);
  }

  await validatePartyOrderStatusTransition({
    existingReport,
    nextStatus: status,
    companyId: companyId || null,
  });

  return await withTransaction(async (db) => {
    const completionInvoiceFields = await resolveCompletionInvoiceFields({
      status,
      dispatchDate: existingReport.dispatchDate,
      invoiceNumber: existingReport.invoiceNumber,
      invoiceDate: existingReport.invoiceDate,
      companyId,
      db,
    });

    assertDispatchCompletionReadiness({
      status,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      totalInvoiceValue: existingReport.totalInvoiceValue ?? existingReport.invoiceValue,
    });

    const updatedReport = await updateDispatchStatusById({
      reportId: Number(reportId),
      status,
      invoiceNumber: completionInvoiceFields.invoiceNumber,
      invoiceDate: completionInvoiceFields.invoiceDate,
      companyId: companyId || null,
    }, db);

    if (existingReport.status !== "pending" && status === "pending") {
      await setVehicleOperationalStatus({
        vehicleId: Number(existingReport.vehicleId),
        status: "in_use",
        companyId: companyId || null,
      }, db);
    }

    if (existingReport.status === "pending" && status !== "pending") {
      await setVehicleOperationalStatus({
        vehicleId: Number(existingReport.vehicleId),
        status: "active",
        companyId: companyId || null,
      }, db);
    }

    return updatedReport;
  });
};

module.exports = {
  getDispatchReports,
  getDispatchReportById,
  createDispatchReport,
  editDispatchReport,
  updateDispatchStatus,
};
