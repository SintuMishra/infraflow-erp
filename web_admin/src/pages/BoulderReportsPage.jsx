import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import { getTodayDateValue, formatDisplayDate, formatDateTimeLabel } from "../utils/date";
import { useAuth } from "../hooks/useAuth";
import { useMasters } from "../hooks/useMasters";

const INITIAL_REPORT_FORM = {
  reportDate: getTodayDateValue(),
  plantId: "",
  shiftId: "",
  crusherUnitId: "",
  crusherUnitNameSnapshot: "",
  sourceMineName: "",
  vehicleId: "",
  vehicleNumberSnapshot: "",
  contractorNameSnapshot: "",
  routeType: "to_stock_yard",
  openingStockTons: "",
  inwardWeightTons: "",
  directToCrusherTons: "",
  crusherConsumptionTons: "",
  closingStockTons: "",
  finishedOutputTons: "",
  remarks: "",
  vehicleRuns: [],
};

const INITIAL_TRIP_ROW = {
  vehicleId: "",
  vehicleNumberSnapshot: "",
  contractorNameSnapshot: "",
  routeType: "to_stock_yard",
  weighedTons: "",
  remarks: "",
};

const INITIAL_QUICK_TRIP_FORM = {
  vehicleId: "",
  vehicleNumberSnapshot: "",
  contractorNameSnapshot: "",
  routeType: "to_stock_yard",
  weighedTons: "",
  remarks: "",
};

const INITIAL_VEHICLE_FORM = {
  vehicleNumber: "",
  contractorName: "",
  vehicleType: "Hyva",
  notes: "",
};

const SHIFT_CONTEXT_STORAGE_KEY_PREFIX = "boulder.shiftContext";

const formatMetric = (value, digits = 2) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const formatRouteTypeLabel = (value) => {
  if (value === "to_stock_yard") {
    return "To Stock Yard";
  }
  if (value === "direct_to_crushing_hub") {
    return "Direct to Crushing Hub";
  }
  if (value === "mixed") {
    return "Mixed";
  }
  return value || "-";
};

const parsePositiveNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const buildMetricsPreview = (form) => {
  const openingStockTons = parsePositiveNumber(form.openingStockTons) ?? 0;
  const inwardWeightTons = parsePositiveNumber(form.inwardWeightTons) ?? 0;
  const directToCrusherTons = parsePositiveNumber(form.directToCrusherTons) ?? 0;
  const crusherConsumptionTons = parsePositiveNumber(form.crusherConsumptionTons) ?? 0;
  const finishedOutputTons = parsePositiveNumber(form.finishedOutputTons);

  const inwardToStockYard = Math.max(inwardWeightTons - directToCrusherTons, 0);
  const stockConsumption = Math.max(crusherConsumptionTons - directToCrusherTons, 0);
  const computedClosingStock = Number(
    Math.max(openingStockTons + inwardToStockYard - stockConsumption, 0).toFixed(2)
  );

  const processLossTons =
    finishedOutputTons === null
      ? null
      : Number(Math.max(crusherConsumptionTons - finishedOutputTons, 0).toFixed(2));

  const yieldPercent =
    finishedOutputTons === null
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
    computedClosingStock,
    processLossTons,
    yieldPercent,
    processLossPercent,
  };
};

const buildTripAggregates = (runs = []) => {
  const rows = Array.isArray(runs) ? runs : [];
  if (!rows.length) {
    return {
      totalInwardWeight: null,
      totalDirectToCrusher: null,
      resolvedRouteType: null,
      leadVehicleNumber: "",
      leadContractorName: "",
      count: 0,
    };
  }

  let inward = 0;
  let direct = 0;
  const routeTypes = new Set();

  rows.forEach((row) => {
    const tons = parsePositiveNumber(row.weighedTons) || 0;
    const routeType = String(row.routeType || "to_stock_yard");
    inward += tons;
    if (routeType === "direct_to_crushing_hub") {
      direct += tons;
    }
    routeTypes.add(routeType);
  });

  return {
    totalInwardWeight: Number(inward.toFixed(2)),
    totalDirectToCrusher: Number(direct.toFixed(2)),
    resolvedRouteType:
      routeTypes.size <= 1 ? rows[0]?.routeType || "to_stock_yard" : "mixed",
    leadVehicleNumber: rows[0]?.vehicleNumberSnapshot || "",
    leadContractorName: rows[0]?.contractorNameSnapshot || "",
    count: rows.length,
  };
};

const extractShiftContextFromForm = (form = {}, { openingStockOverride = null } = {}) => ({
  reportDate: form.reportDate || getTodayDateValue(),
  plantId: form.plantId || "",
  shiftId: form.shiftId || "",
  crusherUnitId: form.crusherUnitId || "",
  crusherUnitNameSnapshot: form.crusherUnitNameSnapshot || "",
  sourceMineName: form.sourceMineName || "",
  openingStockTons:
    openingStockOverride !== null && openingStockOverride !== undefined
      ? String(openingStockOverride)
      : form.openingStockTons !== undefined && form.openingStockTons !== null
        ? String(form.openingStockTons)
        : "",
});

function BoulderReportsPage() {
  const { currentUser } = useAuth();
  const { masters, loadingMasters, mastersError } = useMasters();
  const canManage = ["super_admin", "manager", "hr", "crusher_supervisor"].includes(
    String(currentUser?.role || "")
  );

  const [plants, setPlants] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    totalInwardWeight: 0,
    totalDirectToCrusher: 0,
    totalCrusherConsumption: 0,
    totalFinishedOutput: 0,
    averageYieldPercent: 0,
    totalProcessLoss: 0,
    latestDate: null,
  });

  const [filters, setFilters] = useState({
    search: "",
    plantId: "",
    shiftId: "",
    crusherUnitId: "",
    vehicleId: "",
    routeType: "",
    contractorName: "",
    startDate: "",
    endDate: "",
  });

  const [reportForm, setReportForm] = useState(INITIAL_REPORT_FORM);
  const [vehicleForm, setVehicleForm] = useState(INITIAL_VEHICLE_FORM);
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingVehicleId, setEditingVehicleId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submittingVehicle, setSubmittingVehicle] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [keepShiftContext, setKeepShiftContext] = useState(true);
  const [autoCarryClosingToOpening, setAutoCarryClosingToOpening] = useState(true);
  const [allowClosingOverride, setAllowClosingOverride] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(true);
  const [quickTripForm, setQuickTripForm] = useState(INITIAL_QUICK_TRIP_FORM);
  const [quickTripStickyVehicle, setQuickTripStickyVehicle] = useState(true);

  const shiftContextStorageKey = useMemo(
    () =>
      `${SHIFT_CONTEXT_STORAGE_KEY_PREFIX}.${currentUser?.companyId || "na"}.${
        currentUser?.userId || "na"
      }`,
    [currentUser?.companyId, currentUser?.userId]
  );

  const tripAggregates = useMemo(
    () => buildTripAggregates(reportForm.vehicleRuns),
    [reportForm.vehicleRuns]
  );

  const effectiveReportForm = useMemo(() => {
    if (!tripAggregates.count) {
      return reportForm;
    }

    return {
      ...reportForm,
      inwardWeightTons: tripAggregates.totalInwardWeight,
      directToCrusherTons: tripAggregates.totalDirectToCrusher,
      routeType: tripAggregates.resolvedRouteType,
      vehicleNumberSnapshot:
        reportForm.vehicleNumberSnapshot || tripAggregates.leadVehicleNumber || "",
      contractorNameSnapshot:
        reportForm.contractorNameSnapshot || tripAggregates.leadContractorName || "",
    };
  }, [reportForm, tripAggregates]);

  const metricsPreview = useMemo(() => buildMetricsPreview(effectiveReportForm), [effectiveReportForm]);

  const activeVehicles = useMemo(
    () => (vehicles || []).filter((vehicle) => vehicle.isActive),
    [vehicles]
  );

  const selectedPlant = useMemo(
    () =>
      reportForm.plantId
        ? (plants || []).find((plant) => Number(plant.id) === Number(reportForm.plantId))
        : null,
    [plants, reportForm.plantId]
  );
  const selectedFilterPlant = useMemo(
    () =>
      filters.plantId
        ? (plants || []).find((plant) => Number(plant.id) === Number(filters.plantId))
        : null,
    [filters.plantId, plants]
  );

  const activeShifts = useMemo(
    () => (masters?.shifts || []).filter((shift) => shift.isActive),
    [masters?.shifts]
  );

  const activeCrusherUnits = useMemo(
    () => (masters?.crusherUnits || []).filter((unit) => unit.isActive),
    [masters?.crusherUnits]
  );

  const reportFormCrusherUnits = useMemo(() => {
    if (!selectedPlant?.plantType) {
      return activeCrusherUnits;
    }

    const matchedUnits = activeCrusherUnits.filter((unit) => {
      return arePlantTypesCompatible(selectedPlant.plantType, unit?.plantType);
    });

    // Production safety fallback: if strict type mapping yields zero because of
    // inconsistent master naming, allow active units instead of blocking entry.
    return matchedUnits.length ? matchedUnits : activeCrusherUnits;
  }, [activeCrusherUnits, selectedPlant?.plantType]);

  const filterCrusherUnits = useMemo(() => {
    if (!selectedFilterPlant?.plantType) {
      return activeCrusherUnits;
    }

    return activeCrusherUnits.filter((unit) => {
      return arePlantTypesCompatible(selectedFilterPlant.plantType, unit?.plantType);
    });
  }, [activeCrusherUnits, selectedFilterPlant?.plantType]);

  const selectedVehicle = useMemo(
    () =>
      reportForm.vehicleId
        ? vehicles.find((vehicle) => Number(vehicle.id) === Number(reportForm.vehicleId))
        : null,
    [vehicles, reportForm.vehicleId]
  );

  useEffect(() => {
    if (!selectedVehicle) {
      return;
    }

    setReportForm((prev) => ({
      ...prev,
      vehicleNumberSnapshot: selectedVehicle.vehicleNumber || prev.vehicleNumberSnapshot,
      contractorNameSnapshot: selectedVehicle.contractorName || prev.contractorNameSnapshot,
    }));
  }, [selectedVehicle]);

  useEffect(() => {
    if (!reportForm.crusherUnitId) {
      return;
    }

    const stillValid = reportFormCrusherUnits.some(
      (unit) => Number(unit.id) === Number(reportForm.crusherUnitId)
    );

    if (!stillValid) {
      setReportForm((prev) => ({
        ...prev,
        crusherUnitId: "",
      }));
    }
  }, [reportFormCrusherUnits, reportForm.crusherUnitId]);

  useEffect(() => {
    if (reportForm.crusherUnitId) {
      const selectedUnit = reportFormCrusherUnits.find(
        (unit) => Number(unit.id) === Number(reportForm.crusherUnitId)
      );
      if (selectedUnit?.unitName) {
        setReportForm((prev) => ({
          ...prev,
          crusherUnitNameSnapshot: selectedUnit.unitName,
        }));
      }
      return;
    }

    if (!reportFormCrusherUnits.length && selectedPlant?.plantName) {
      setReportForm((prev) => ({
        ...prev,
        crusherUnitNameSnapshot: selectedPlant.plantName,
      }));
    }
  }, [
    reportForm.crusherUnitId,
    reportFormCrusherUnits,
    selectedPlant?.plantName,
  ]);

  useEffect(() => {
    if (!filters.crusherUnitId) {
      return;
    }

    const stillValid = filterCrusherUnits.some(
      (unit) => Number(unit.id) === Number(filters.crusherUnitId)
    );

    if (!stillValid) {
      setFilters((prev) => ({
        ...prev,
        crusherUnitId: "",
      }));
    }
  }, [filterCrusherUnits, filters.crusherUnitId]);

  useEffect(() => {
    if (!shiftContextStorageKey) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(shiftContextStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      setReportForm((prev) => ({
        ...prev,
        ...extractShiftContextFromForm(parsed),
      }));
    } catch {
      // Ignore corrupted context payload and keep default form values.
    }
  }, [shiftContextStorageKey]);

  useEffect(() => {
    const contextPayload = {
      reportDate: reportForm.reportDate || getTodayDateValue(),
      plantId: reportForm.plantId || "",
      shiftId: reportForm.shiftId || "",
      crusherUnitId: reportForm.crusherUnitId || "",
      crusherUnitNameSnapshot: reportForm.crusherUnitNameSnapshot || "",
      sourceMineName: reportForm.sourceMineName || "",
      openingStockTons:
        reportForm.openingStockTons !== undefined && reportForm.openingStockTons !== null
          ? String(reportForm.openingStockTons)
          : "",
    };
    try {
      window.localStorage.setItem(shiftContextStorageKey, JSON.stringify(contextPayload));
    } catch {
      // No-op: localStorage may be blocked in some browser modes.
    }
  }, [
    reportForm.reportDate,
    reportForm.plantId,
    reportForm.shiftId,
    reportForm.crusherUnitId,
    reportForm.crusherUnitNameSnapshot,
    reportForm.sourceMineName,
    reportForm.openingStockTons,
    shiftContextStorageKey,
  ]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);

    try {
      const [plantsRes, vehiclesRes] = await Promise.all([
        api.get("/plants"),
        api.get("/boulder-reports/vehicles"),
      ]);

      setPlants(plantsRes.data?.data || []);
      setVehicles(vehiclesRes.data?.data || []);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load boulder workspace masters");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);

    try {
      const res = await api.get("/boulder-reports", {
        params: {
          search: filters.search || undefined,
          plantId: filters.plantId || undefined,
          shiftId: filters.shiftId || undefined,
          crusherUnitId: filters.crusherUnitId || undefined,
          vehicleId: filters.vehicleId || undefined,
          routeType: filters.routeType || undefined,
          contractorName: filters.contractorName || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: 1,
          limit: 50,
        },
      });

      setReports(res.data?.data || []);
      setSummary(
        res.data?.meta?.summary || {
          total: 0,
          totalInwardWeight: 0,
          totalDirectToCrusher: 0,
          totalCrusherConsumption: 0,
          totalFinishedOutput: 0,
          averageYieldPercent: 0,
          totalProcessLoss: 0,
          latestDate: null,
        }
      );
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load boulder reports");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadInitialData().then(() => {
        loadReports();
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInitialData, loadReports]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadReports();
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [loadReports]);

  const resetReportForm = ({ preserveContext = keepShiftContext, openingStockOverride = null } = {}) => {
    if (!preserveContext) {
      setReportForm({
        ...INITIAL_REPORT_FORM,
        reportDate: getTodayDateValue(),
      });
      setQuickTripForm({ ...INITIAL_QUICK_TRIP_FORM });
      setEditingReportId(null);
      setAllowClosingOverride(false);
      return;
    }

    const context = extractShiftContextFromForm(reportForm, {
      openingStockOverride,
    });

    setReportForm({
      ...INITIAL_REPORT_FORM,
      ...context,
    });
    setQuickTripForm((prev) => ({
      ...INITIAL_QUICK_TRIP_FORM,
      vehicleId: quickTripStickyVehicle ? prev.vehicleId : "",
      vehicleNumberSnapshot: quickTripStickyVehicle ? prev.vehicleNumberSnapshot : "",
      contractorNameSnapshot: quickTripStickyVehicle ? prev.contractorNameSnapshot : "",
      routeType: quickTripStickyVehicle ? prev.routeType || "to_stock_yard" : "to_stock_yard",
    }));
    setEditingReportId(null);
    setAllowClosingOverride(false);
  };

  const resetVehicleForm = () => {
    setVehicleForm(INITIAL_VEHICLE_FORM);
    setEditingVehicleId(null);
  };

  const handleReportChange = (event) => {
    const { name, value } = event.target;

    setReportForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVehicleChange = (event) => {
    const { name, value } = event.target;

    setVehicleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addVehicleRunRow = () => {
    setReportForm((prev) => ({
      ...prev,
      vehicleRuns: [...(prev.vehicleRuns || []), { ...INITIAL_TRIP_ROW }],
    }));
  };

  const removeVehicleRunRow = (index) => {
    setReportForm((prev) => ({
      ...prev,
      vehicleRuns: (prev.vehicleRuns || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const handleVehicleRunChange = (index, field, value) => {
    setReportForm((prev) => {
      const nextRows = [...(prev.vehicleRuns || [])];
      const current = { ...(nextRows[index] || INITIAL_TRIP_ROW), [field]: value };

      if (field === "vehicleId") {
        const selected = activeVehicles.find((vehicle) => Number(vehicle.id) === Number(value));
        if (selected) {
          current.vehicleNumberSnapshot = selected.vehicleNumber || current.vehicleNumberSnapshot;
          current.contractorNameSnapshot = selected.contractorName || current.contractorNameSnapshot;
        }
      }

      nextRows[index] = current;
      return {
        ...prev,
        vehicleRuns: nextRows,
      };
    });
  };

  const handleQuickTripChange = (field, value) => {
    setQuickTripForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "vehicleId") {
        const selected = activeVehicles.find((vehicle) => Number(vehicle.id) === Number(value));
        if (selected) {
          next.vehicleNumberSnapshot = selected.vehicleNumber || next.vehicleNumberSnapshot;
          next.contractorNameSnapshot = selected.contractorName || next.contractorNameSnapshot;
        }
      }

      return next;
    });
  };

  const appendQuickTrip = () => {
    const weighedTons = parsePositiveNumber(quickTripForm.weighedTons);
    if (!weighedTons || weighedTons <= 0) {
      setError("Quick trip weighed tons must be greater than 0");
      return false;
    }

    if (!String(quickTripForm.vehicleNumberSnapshot || "").trim()) {
      setError("Quick trip vehicle number is required");
      return false;
    }

    if (!String(quickTripForm.contractorNameSnapshot || "").trim()) {
      setError("Quick trip contractor name is required");
      return false;
    }

    if (!["to_stock_yard", "direct_to_crushing_hub"].includes(String(quickTripForm.routeType || ""))) {
      setError("Quick trip route type is invalid");
      return false;
    }

    setReportForm((prev) => ({
      ...prev,
      vehicleRuns: [
        ...(prev.vehicleRuns || []),
        {
          vehicleId: quickTripForm.vehicleId || "",
          vehicleNumberSnapshot: String(quickTripForm.vehicleNumberSnapshot || "").trim(),
          contractorNameSnapshot: String(quickTripForm.contractorNameSnapshot || "").trim(),
          routeType: quickTripForm.routeType || "to_stock_yard",
          weighedTons: Number(weighedTons.toFixed(2)),
          remarks: String(quickTripForm.remarks || "").trim(),
        },
      ],
    }));

    setQuickTripForm((prev) => {
      if (!quickTripStickyVehicle) {
        return { ...INITIAL_QUICK_TRIP_FORM };
      }
      return {
        ...prev,
        weighedTons: "",
        remarks: "",
      };
    });
    setError("");
    setSuccess("Trip added");
    return true;
  };

  const handleQuickTripSubmit = (event) => {
    event.preventDefault();
    appendQuickTrip();
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!reportForm.plantId) {
      setError("Please select plant / unit");
      return;
    }

    if (!reportForm.reportDate) {
      setError("Report date is required");
      return;
    }

    if (!reportForm.shiftId) {
      setError("Please select shift from masters");
      return;
    }

    if (!effectiveReportForm.vehicleNumberSnapshot || !effectiveReportForm.contractorNameSnapshot) {
      setError("Vehicle number and contractor name are required");
      return;
    }

    if (
      parsePositiveNumber(effectiveReportForm.directToCrusherTons) !== null &&
      parsePositiveNumber(effectiveReportForm.inwardWeightTons) !== null &&
      Number(effectiveReportForm.directToCrusherTons) > Number(effectiveReportForm.inwardWeightTons)
    ) {
      setError("Direct-to-crusher tons cannot exceed inward weighed tons");
      return;
    }

    if (tripAggregates.count) {
      const incompleteTrip = (reportForm.vehicleRuns || []).some((row) => {
        return (
          !String(row.vehicleNumberSnapshot || "").trim() ||
          !String(row.contractorNameSnapshot || "").trim() ||
          !["to_stock_yard", "direct_to_crushing_hub"].includes(String(row.routeType || "")) ||
          (parsePositiveNumber(row.weighedTons) || 0) <= 0
        );
      });
      if (incompleteTrip) {
        setError(
          "Each vehicle trip row must include vehicle number, contractor, route type, and weighed tons"
        );
        return;
      }
    }

    const resolvedCrusherUnitName =
      reportFormCrusherUnits.find(
        (unit) => Number(unit.id) === Number(reportForm.crusherUnitId)
      )?.unitName ||
      reportForm.crusherUnitNameSnapshot ||
      selectedPlant?.plantName ||
      "";

    if (!resolvedCrusherUnitName) {
      setError("Plant unit context is required");
      return;
    }

    const payload = {
      ...effectiveReportForm,
      closingStockTons:
        effectiveReportForm.closingStockTons === ""
          ? metricsPreview.computedClosingStock
          : effectiveReportForm.closingStockTons,
      plantId: Number(effectiveReportForm.plantId),
      shiftId: Number(effectiveReportForm.shiftId),
      crusherUnitId: effectiveReportForm.crusherUnitId ? Number(effectiveReportForm.crusherUnitId) : null,
      crusherUnitNameSnapshot: resolvedCrusherUnitName,
      vehicleId: effectiveReportForm.vehicleId ? Number(effectiveReportForm.vehicleId) : null,
      vehicleRuns: (reportForm.vehicleRuns || []).map((row) => ({
        vehicleId: row.vehicleId ? Number(row.vehicleId) : null,
        vehicleNumberSnapshot: row.vehicleNumberSnapshot,
        contractorNameSnapshot: row.contractorNameSnapshot,
        routeType: row.routeType,
        weighedTons: row.weighedTons,
        remarks: row.remarks || "",
      })),
    };

    try {
      setSubmittingReport(true);

      if (editingReportId) {
        await api.patch(`/boulder-reports/${editingReportId}`, payload);
        setSuccess("Boulder report updated successfully");
      } else {
        await api.post("/boulder-reports", payload);
        setSuccess("Boulder report added successfully");
      }

      const nextOpeningStockTons = autoCarryClosingToOpening && !editingReportId
        ? payload.closingStockTons
        : reportForm.openingStockTons;
      resetReportForm({
        preserveContext: keepShiftContext,
        openingStockOverride: nextOpeningStockTons,
      });
      await loadReports();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save boulder report");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleEditReport = (report) => {
    setEditingReportId(report.id);
    setAllowClosingOverride(true);
    setQuickAddMode(false);
    setQuickTripForm({ ...INITIAL_QUICK_TRIP_FORM });
    setReportForm({
      reportDate: report.reportDate || getTodayDateValue(),
      plantId: report.plantId ? String(report.plantId) : "",
      shiftId: report.shiftId ? String(report.shiftId) : "",
      crusherUnitId: report.crusherUnitId ? String(report.crusherUnitId) : "",
      crusherUnitNameSnapshot: report.crusherUnitNameSnapshot || "",
      sourceMineName: report.sourceMineName || "",
      vehicleId: report.vehicleId ? String(report.vehicleId) : "",
      vehicleNumberSnapshot: report.vehicleNumberSnapshot || "",
      contractorNameSnapshot: report.contractorNameSnapshot || "",
      routeType: report.routeType || "to_stock_yard",
      openingStockTons: report.openingStockTons ?? "",
      inwardWeightTons: report.inwardWeightTons ?? "",
      directToCrusherTons: report.directToCrusherTons ?? "",
      crusherConsumptionTons: report.crusherConsumptionTons ?? "",
      closingStockTons: report.closingStockTons ?? "",
      finishedOutputTons: report.finishedOutputTons ?? "",
      remarks: report.remarks || "",
      vehicleRuns: Array.isArray(report.vehicleRuns)
        ? report.vehicleRuns.map((run) => ({
            vehicleId: run.vehicleId ? String(run.vehicleId) : "",
            vehicleNumberSnapshot: run.vehicleNumberSnapshot || "",
            contractorNameSnapshot: run.contractorNameSnapshot || "",
            routeType: run.routeType || "to_stock_yard",
            weighedTons: run.weighedTons ?? "",
            remarks: run.remarks || "",
          }))
        : [],
    });
  };

  const handleDeleteReport = async (reportId) => {
    const confirmed = window.confirm("Delete this boulder report?");
    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.delete(`/boulder-reports/${reportId}`);
      setSuccess("Boulder report deleted successfully");
      if (Number(editingReportId) === Number(reportId)) {
        resetReportForm();
      }
      await loadReports();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete boulder report");
    }
  };

  const handleVehicleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!vehicleForm.vehicleNumber || !vehicleForm.contractorName) {
      setError("Vehicle number and contractor name are required");
      return;
    }

    try {
      setSubmittingVehicle(true);

      if (editingVehicleId) {
        await api.patch(`/boulder-reports/vehicles/${editingVehicleId}`, vehicleForm);
        setSuccess("Mine vehicle updated successfully");
      } else {
        await api.post("/boulder-reports/vehicles", vehicleForm);
        setSuccess("Mine vehicle added successfully");
      }

      resetVehicleForm();
      const vehiclesRes = await api.get("/boulder-reports/vehicles");
      setVehicles(vehiclesRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save mine vehicle");
    } finally {
      setSubmittingVehicle(false);
    }
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      vehicleNumber: vehicle.vehicleNumber || "",
      contractorName: vehicle.contractorName || "",
      vehicleType: vehicle.vehicleType || "",
      notes: vehicle.notes || "",
    });
    setShowVehicleForm(true);
  };

  const toggleVehicleStatus = async (vehicle) => {
    setError("");
    setSuccess("");
    setStatusUpdatingId(vehicle.id);

    try {
      await api.patch(`/boulder-reports/vehicles/${vehicle.id}/status`, {
        isActive: !vehicle.isActive,
      });

      const vehiclesRes = await api.get("/boulder-reports/vehicles");
      setVehicles(vehiclesRes.data?.data || []);
      setSuccess(`Vehicle marked as ${vehicle.isActive ? "inactive" : "active"}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update vehicle status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const clearSavedShiftContext = () => {
    try {
      window.localStorage.removeItem(shiftContextStorageKey);
    } catch {
      // No-op
    }

    setReportForm({
      ...INITIAL_REPORT_FORM,
      reportDate: getTodayDateValue(),
    });
    setQuickTripForm({ ...INITIAL_QUICK_TRIP_FORM });
    setAllowClosingOverride(false);
    setEditingReportId(null);
    setSuccess("Shift context cleared. You can start a fresh shift setup.");
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      plantId: "",
      shiftId: "",
      crusherUnitId: "",
      vehicleId: "",
      routeType: "",
      contractorName: "",
      startDate: "",
      endDate: "",
    });
  };

  const escapeCsvValue = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const exportAnalysisCsv = () => {
    if (!reports.length) {
      setError("No reports available to export");
      return;
    }

    const headers = [
      "Report Date",
      "Plant",
      "Unit",
      "Shift",
      "Source Mine",
      "Route Type",
      "Vehicle Number",
      "Contractor",
      "Opening Stock Tons",
      "Inward Weighed Tons",
      "Direct To Crusher Tons",
      "Crusher Consumption Tons",
      "Closing Stock Tons",
      "Finished Output Tons",
      "Yield Percent",
      "Process Loss Tons",
      "Process Loss Percent",
      "Remarks",
      "Vehicle Trips",
    ];

    const rows = reports.map((report) => [
      formatDisplayDate(report.reportDate),
      report.plantName || "",
      report.crusherUnitNameSnapshot || "",
      report.shift || "",
      report.sourceMineName || "",
      formatRouteTypeLabel(report.routeType),
      report.vehicleNumberSnapshot || "",
      report.contractorNameSnapshot || "",
      report.openingStockTons ?? "",
      report.inwardWeightTons ?? "",
      report.directToCrusherTons ?? "",
      report.crusherConsumptionTons ?? "",
      report.closingStockTons ?? "",
      report.finishedOutputTons ?? "",
      report.yieldPercent ?? "",
      report.processLossTons ?? "",
      report.processLossPercent ?? "",
      report.remarks || "",
      report.vehicleTripCount ?? 0,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `boulder-analysis-${getTodayDateValue()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess("CSV export generated successfully");
  };

  const exportAnalysisPdf = () => {
    if (!reports.length) {
      setError("No reports available to export");
      return;
    }

    const popup = window.open("", "_blank", "width=1200,height=860");
    if (!popup) {
      setError("Popup blocked. Please allow popups and try PDF export again.");
      return;
    }

    const summaryLine = `
      Total: ${formatMetric(summary.total)} | Inward: ${formatMetric(summary.totalInwardWeight)} tons | 
      Direct: ${formatMetric(summary.totalDirectToCrusher)} tons | 
      Consumption: ${formatMetric(summary.totalCrusherConsumption)} tons | 
      Output: ${formatMetric(summary.totalFinishedOutput)} tons | 
      Avg Yield: ${formatMetric(summary.averageYieldPercent)}%
    `;

    const rowsHtml = reports
      .map(
        (report, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDisplayDate(report.reportDate)}</td>
            <td>${report.plantName || "-"}</td>
            <td>${report.crusherUnitNameSnapshot || "-"}</td>
            <td>${report.shift || "-"}</td>
            <td>${report.sourceMineName || "-"}</td>
            <td>${formatRouteTypeLabel(report.routeType)}</td>
            <td>${report.vehicleNumberSnapshot || "-"}</td>
            <td>${report.contractorNameSnapshot || "-"}</td>
            <td>${formatMetric(report.inwardWeightTons)}</td>
            <td>${formatMetric(report.directToCrusherTons)}</td>
            <td>${formatMetric(report.crusherConsumptionTons)}</td>
            <td>${formatMetric(report.closingStockTons)}</td>
            <td>${report.yieldPercent === null || report.yieldPercent === undefined ? "-" : `${formatMetric(report.yieldPercent)}%`}</td>
            <td>${report.vehicleTripCount ?? 0}</td>
          </tr>
        `
      )
      .join("");

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Boulder Analysis Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .meta { margin-bottom: 12px; font-size: 12px; color: #334155; }
            .summary { margin-bottom: 14px; font-size: 12px; color: #0f172a; background: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            th { background: #f1f5f9; }
            .actions { margin: 14px 0; }
            button { padding: 8px 12px; border: none; border-radius: 6px; background: #0f172a; color: white; font-weight: 700; cursor: pointer; }
            @media print { .actions { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Boulder Analysis Report</h1>
          <div class="meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
          <div class="summary">${summaryLine}</div>
          <div class="actions"><button onclick="window.print()">Print / Save PDF</button></div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Plant</th>
                <th>Unit</th>
                <th>Shift</th>
                <th>Source Mine</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Contractor</th>
                <th>Inward</th>
                <th>Direct</th>
                <th>Consumption</th>
                <th>Closing</th>
                <th>Yield</th>
                <th>Trips</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();

    const triggerPrint = () => {
      try {
        popup.focus();
        popup.print();
      } catch {
        setError("Unable to trigger print dialog. Use the print button in opened tab.");
      }
    };

    popup.onload = () => {
      window.setTimeout(triggerPrint, 250);
    };
    window.setTimeout(triggerPrint, 1200);
    setSuccess("PDF export window opened successfully");
  };

  return (
    <AppShell
      title="Boulder Reports"
      subtitle="Track mine-to-crusher raw boulder movement with editable vehicle and contractor control"
    >
      {error ? <div style={styles.errorBanner}>{error}</div> : null}
      {success ? <div style={styles.successBanner}>{success}</div> : null}
      {mastersError ? <div style={styles.warningBanner}>{mastersError}</div> : null}

      <SectionCard title="Boulder Snapshot">
        <div style={styles.metricsGrid}>
          <Metric label="Reports" value={summary.total} />
          <Metric label="Inward Tons" value={formatMetric(summary.totalInwardWeight)} />
          <Metric label="Direct to Crusher" value={formatMetric(summary.totalDirectToCrusher)} />
          <Metric
            label="Crusher Consumption"
            value={formatMetric(summary.totalCrusherConsumption)}
          />
          <Metric label="Finished Output" value={formatMetric(summary.totalFinishedOutput)} />
          <Metric label="Average Yield" value={`${formatMetric(summary.averageYieldPercent)}%`} />
          <Metric label="Process Loss" value={formatMetric(summary.totalProcessLoss)} />
          <Metric
            label="Latest"
            value={summary.latestDate ? formatDisplayDate(summary.latestDate) : "-"}
          />
        </div>
      </SectionCard>

      <SectionCard title="Analysis Controls">
        <div style={styles.filtersGrid}>
          <input
            style={styles.input}
            placeholder="Search mine, vehicle, contractor, remarks"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />

          <select
            style={styles.input}
            value={filters.plantId}
            onChange={(event) => setFilters((prev) => ({ ...prev, plantId: event.target.value }))}
          >
            <option value="">All Plants</option>
            {(plants || []).map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.plantName}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={filters.shiftId}
            onChange={(event) => setFilters((prev) => ({ ...prev, shiftId: event.target.value }))}
          >
            <option value="">All Shifts</option>
            {activeShifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.shiftName}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={filters.crusherUnitId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                crusherUnitId: event.target.value,
              }))
            }
          >
            <option value="">All Plant Units</option>
            {filterCrusherUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unitName}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={filters.vehicleId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                vehicleId: event.target.value,
              }))
            }
          >
            <option value="">All Mine Vehicles</option>
            {activeVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicleNumber} - {vehicle.contractorName}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={filters.routeType}
            onChange={(event) => setFilters((prev) => ({ ...prev, routeType: event.target.value }))}
          >
            <option value="">All Routes</option>
            <option value="to_stock_yard">To Stock Yard</option>
            <option value="direct_to_crushing_hub">Direct to Crushing Hub</option>
            <option value="mixed">Mixed (Stock + Direct)</option>
          </select>

          <input
            style={styles.input}
            placeholder="Contractor filter"
            value={filters.contractorName}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                contractorName: event.target.value,
              }))
            }
          />

          <input
            type="date"
            style={styles.input}
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
          />

          <input
            type="date"
            style={styles.input}
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
          />

          <button type="button" style={styles.secondaryButton} onClick={clearFilters}>
            Reset View
          </button>
          <button type="button" style={styles.secondaryButton} onClick={exportAnalysisCsv}>
            Export CSV
          </button>
          <button type="button" style={styles.primaryButton} onClick={exportAnalysisPdf}>
            Export PDF
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Add Boulder Report">
        <form style={styles.formGrid} onSubmit={handleReportSubmit}>
          {loadingMasters ? (
            <p style={styles.sectionHint}>Loading master-linked shifts and units...</p>
          ) : null}
          {!loadingMasters && !activeShifts.length ? (
            <p style={styles.warningText}>
              No active shifts found in Masters. Add a shift in Masters before saving boulder reports.
            </p>
          ) : null}
          {!loadingMasters && !reportFormCrusherUnits.length ? (
            <p style={styles.warningText}>
              No active plant units are available in masters. You can continue with plant-level reporting.
            </p>
          ) : null}

          <div style={styles.contextPanel}>
            <p style={styles.contextTitle}>Shift Context Memory</p>
            <p style={styles.contextHint}>
              Keep date, plant, shift, source mine, and opening stock ready between entries so you do not retype for every truck.
            </p>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={keepShiftContext}
                onChange={(event) => setKeepShiftContext(event.target.checked)}
              />
              Keep shift context after save
            </label>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={autoCarryClosingToOpening}
                onChange={(event) => setAutoCarryClosingToOpening(event.target.checked)}
              />
              Auto carry closing stock as next opening stock
            </label>
            <div style={styles.inlineActions}>
              <button type="button" style={styles.secondaryButton} onClick={clearSavedShiftContext}>
                Start Fresh Shift
              </button>
            </div>
          </div>

          <label style={styles.fieldLabel}>
            Report Date
            <input
              type="date"
              name="reportDate"
              value={reportForm.reportDate}
              onChange={handleReportChange}
              style={styles.input}
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Plant
            <select
              name="plantId"
              value={reportForm.plantId}
              onChange={handleReportChange}
              style={styles.input}
              required
            >
              <option value="">Select Plant</option>
              {(plants || []).map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Shift
            <select
              name="shiftId"
              value={reportForm.shiftId}
              onChange={handleReportChange}
              style={styles.input}
              required
              disabled={loadingMasters}
            >
              <option value="">Select Shift</option>
              {activeShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.shiftName}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Plant Unit (Master)
            {reportFormCrusherUnits.length ? (
              <select
                name="crusherUnitId"
                value={reportForm.crusherUnitId}
                onChange={handleReportChange}
                style={styles.input}
                required
                disabled={loadingMasters}
              >
                <option value="">Select Unit</option>
                {reportFormCrusherUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={selectedPlant?.plantName || "Select plant first"}
                style={styles.input}
                disabled
                readOnly
              />
            )}
          </label>

          <label style={styles.fieldLabel}>
            Source Mine
            <input
              name="sourceMineName"
              value={reportForm.sourceMineName}
              onChange={handleReportChange}
              style={styles.input}
              placeholder="Mine location / pit"
            />
          </label>

          <label style={styles.fieldLabel}>
            Shift Route Pattern
            <select
              name="routeType"
              value={tripAggregates.count ? tripAggregates.resolvedRouteType || "mixed" : reportForm.routeType}
              onChange={handleReportChange}
              style={styles.input}
              disabled={tripAggregates.count > 0}
              required
            >
              <option value="to_stock_yard">To Stock Yard</option>
              <option value="direct_to_crushing_hub">Direct to Crushing Hub</option>
              <option value="mixed">Mixed (Auto from vehicle trips)</option>
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Lead Vehicle (Optional)
            <select
              name="vehicleId"
              value={reportForm.vehicleId}
              onChange={handleReportChange}
              style={styles.input}
              disabled={tripAggregates.count > 0}
            >
              <option value="">Manual entry only</option>
              {activeVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicleNumber} - {vehicle.contractorName}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Lead Vehicle Number Snapshot
            <input
              name="vehicleNumberSnapshot"
              value={
                tripAggregates.count
                  ? tripAggregates.leadVehicleNumber
                  : reportForm.vehicleNumberSnapshot
              }
              onChange={handleReportChange}
              style={styles.input}
              placeholder="MH12AB9090"
              required
              readOnly={tripAggregates.count > 0}
            />
          </label>

          <label style={styles.fieldLabel}>
            Lead Contractor Snapshot
            <input
              name="contractorNameSnapshot"
              value={
                tripAggregates.count
                  ? tripAggregates.leadContractorName
                  : reportForm.contractorNameSnapshot
              }
              onChange={handleReportChange}
              style={styles.input}
              placeholder="Contractor name"
              required
              readOnly={tripAggregates.count > 0}
            />
          </label>

          <div style={styles.tripPanel}>
            <div style={styles.tripPanelHeader}>
              <p style={styles.tripPanelTitle}>Vehicle-wise Inward Trips (Recommended)</p>
              <div style={styles.inlineActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setQuickAddMode((prev) => !prev)}
                >
                  {quickAddMode ? "Show Table Entry" : "Show Quick Add"}
                </button>
                <button type="button" style={styles.secondaryButton} onClick={addVehicleRunRow}>
                  Add Trip Row
                </button>
              </div>
            </div>
            <p style={styles.tripPanelHint}>
              Enter each mine-to-crusher or mine-to-stock movement here. Shift totals are auto-calculated from these entries.
            </p>
            {quickAddMode ? (
              <form style={styles.quickTripForm} onSubmit={handleQuickTripSubmit}>
                <select
                  style={styles.input}
                  value={quickTripForm.vehicleId || ""}
                  onChange={(event) => handleQuickTripChange("vehicleId", event.target.value)}
                >
                  <option value="">Manual vehicle</option>
                  {activeVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicleNumber} - {vehicle.contractorName}
                    </option>
                  ))}
                </select>
                <input
                  style={styles.input}
                  placeholder="Vehicle Number"
                  value={quickTripForm.vehicleNumberSnapshot || ""}
                  onChange={(event) =>
                    handleQuickTripChange("vehicleNumberSnapshot", event.target.value)
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Contractor Name"
                  value={quickTripForm.contractorNameSnapshot || ""}
                  onChange={(event) =>
                    handleQuickTripChange("contractorNameSnapshot", event.target.value)
                  }
                />
                <select
                  style={styles.input}
                  value={quickTripForm.routeType || "to_stock_yard"}
                  onChange={(event) => handleQuickTripChange("routeType", event.target.value)}
                >
                  <option value="to_stock_yard">To Stock Yard</option>
                  <option value="direct_to_crushing_hub">Direct to Crushing Hub</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={styles.input}
                  placeholder="Weighed Tons"
                  value={quickTripForm.weighedTons ?? ""}
                  onChange={(event) => handleQuickTripChange("weighedTons", event.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Remarks (optional)"
                  value={quickTripForm.remarks || ""}
                  onChange={(event) => handleQuickTripChange("remarks", event.target.value)}
                />
                <button type="submit" style={styles.primaryButton}>
                  Quick Add Trip
                </button>
                <label style={styles.toggleLabelCompact}>
                  <input
                    type="checkbox"
                    checked={quickTripStickyVehicle}
                    onChange={(event) => setQuickTripStickyVehicle(event.target.checked)}
                  />
                  Keep same vehicle for next row
                </label>
              </form>
            ) : null}
            {(reportForm.vehicleRuns || []).length ? (
              <div style={styles.tripRowsWrap}>
                {(reportForm.vehicleRuns || []).map((run, index) => (
                  <div key={`trip-row-${index}`} style={styles.tripRow}>
                    <select
                      style={styles.input}
                      value={run.vehicleId || ""}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "vehicleId", event.target.value)
                      }
                    >
                      <option value="">Manual vehicle</option>
                      {activeVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicleNumber} - {vehicle.contractorName}
                        </option>
                      ))}
                    </select>
                    <input
                      style={styles.input}
                      placeholder="Vehicle Number"
                      value={run.vehicleNumberSnapshot || ""}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "vehicleNumberSnapshot", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Contractor Name"
                      value={run.contractorNameSnapshot || ""}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "contractorNameSnapshot", event.target.value)
                      }
                    />
                    <select
                      style={styles.input}
                      value={run.routeType || "to_stock_yard"}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "routeType", event.target.value)
                      }
                    >
                      <option value="to_stock_yard">To Stock Yard</option>
                      <option value="direct_to_crushing_hub">Direct to Crushing Hub</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={styles.input}
                      placeholder="Weighed Tons"
                      value={run.weighedTons ?? ""}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "weighedTons", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Trip remarks (optional)"
                      value={run.remarks || ""}
                      onChange={(event) =>
                        handleVehicleRunChange(index, "remarks", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={() => removeVehicleRunRow(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.sectionHint}>
                No trip rows yet. You can still use manual shift totals below, or add vehicle rows for automatic totals.
              </p>
            )}
          </div>

          {tripAggregates.count ? (
            <p style={styles.warningText}>
              {tripAggregates.count} vehicle trip rows are active. Inward tons, direct tons, and route type are auto-derived from trip rows.
            </p>
          ) : null}

          <p style={styles.sectionHint}>
            Shift stock formula: Closing = Opening + (Inward to Stock) - (Crusher Feed from Stock). Use manual closing override only for audited corrections.
          </p>

          <label style={styles.fieldLabel}>
            Opening Boulder Stock (Shift Start Tons)
            <input
              name="openingStockTons"
              value={reportForm.openingStockTons}
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Total Inward Weighbridge Tons
            <input
              name="inwardWeightTons"
              value={
                tripAggregates.count
                  ? tripAggregates.totalInwardWeight ?? ""
                  : reportForm.inwardWeightTons
              }
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              required
              readOnly={tripAggregates.count > 0}
            />
          </label>

          <label style={styles.fieldLabel}>
            Direct-to-Crusher Tons
            <input
              name="directToCrusherTons"
              value={
                tripAggregates.count
                  ? tripAggregates.totalDirectToCrusher ?? ""
                  : reportForm.directToCrusherTons
              }
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              required
              readOnly={tripAggregates.count > 0}
            />
          </label>

          <label style={styles.fieldLabel}>
            Crusher Feed / Consumption (Shift Tons)
            <input
              name="crusherConsumptionTons"
              value={reportForm.crusherConsumptionTons}
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Closing Boulder Stock (Auto)
            <input
              name="closingStockTons"
              value={reportForm.closingStockTons}
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              placeholder={`Auto ${metricsPreview.computedClosingStock}`}
              readOnly={!allowClosingOverride}
              disabled={!allowClosingOverride}
            />
          </label>

          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={allowClosingOverride}
              onChange={(event) => setAllowClosingOverride(event.target.checked)}
            />
            Allow manual closing override (for correction only)
          </label>

          <label style={styles.fieldLabel}>
            Finished Output (Shift Close, Optional)
            <input
              name="finishedOutputTons"
              value={reportForm.finishedOutputTons}
              onChange={handleReportChange}
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
            />
          </label>

          <label style={{ ...styles.fieldLabel, gridColumn: "1 / -1" }}>
            Remarks
            <textarea
              name="remarks"
              value={reportForm.remarks}
              onChange={handleReportChange}
              style={styles.textarea}
              placeholder="Operational notes, deviation, weather, mine delay"
            />
          </label>

          <div style={styles.previewGrid}>
            <PreviewTile
              label="Inward to Stock"
              value={`${formatMetric(metricsPreview.inwardToStockYard)} tons`}
            />
            <PreviewTile
              label="Stock Consumption"
              value={`${formatMetric(metricsPreview.stockConsumption)} tons`}
            />
            <PreviewTile
              label="Computed Closing"
              value={`${formatMetric(metricsPreview.computedClosingStock)} tons`}
            />
            <PreviewTile
              label="Yield"
              value={
                metricsPreview.yieldPercent === null
                  ? "-"
                  : `${formatMetric(metricsPreview.yieldPercent)}%`
              }
            />
            <PreviewTile
              label="Process Loss"
              value={
                metricsPreview.processLossTons === null
                  ? "-"
                  : `${formatMetric(metricsPreview.processLossTons)} tons`
              }
            />
            <PreviewTile
              label="Loss %"
              value={
                metricsPreview.processLossPercent === null
                  ? "-"
                  : `${formatMetric(metricsPreview.processLossPercent)}%`
              }
            />
          </div>

          <div style={styles.actionsRow}>
            <button type="submit" style={styles.primaryButton} disabled={!canManage || submittingReport}>
              {submittingReport
                ? "Saving..."
                : editingReportId
                  ? "Update Boulder Report"
                  : "Add Boulder Report"}
            </button>

            {editingReportId ? (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetReportForm}
                disabled={submittingReport}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Mine-to-Crusher Vehicle Registry">
        <div style={styles.registryHeader}>
          <p style={styles.sectionHint}>
            Keep this list editable. Update contractor or vehicle details any time when hired trucks change.
          </p>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => {
              setShowVehicleForm((prev) => !prev);
              if (showVehicleForm) {
                resetVehicleForm();
              }
            }}
          >
            {showVehicleForm ? "Hide Vehicle Form" : "Add / Edit Vehicle"}
          </button>
        </div>

        {showVehicleForm ? (
          <form style={styles.vehicleFormGrid} onSubmit={handleVehicleSubmit}>
            <label style={styles.fieldLabel}>
              Vehicle Number
              <input
                name="vehicleNumber"
                value={vehicleForm.vehicleNumber}
                onChange={handleVehicleChange}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.fieldLabel}>
              Contractor Name
              <input
                name="contractorName"
                value={vehicleForm.contractorName}
                onChange={handleVehicleChange}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.fieldLabel}>
              Vehicle Type
              <input
                name="vehicleType"
                value={vehicleForm.vehicleType}
                onChange={handleVehicleChange}
                style={styles.input}
                placeholder="Hyva / Tipper"
              />
            </label>

            <label style={{ ...styles.fieldLabel, gridColumn: "1 / -1" }}>
              Notes
              <textarea
                name="notes"
                value={vehicleForm.notes}
                onChange={handleVehicleChange}
                style={styles.textarea}
                placeholder="Route scope, vendor contract notes"
              />
            </label>

            <div style={styles.actionsRow}>
              <button type="submit" style={styles.primaryButton} disabled={!canManage || submittingVehicle}>
                {submittingVehicle
                  ? "Saving..."
                  : editingVehicleId
                    ? "Update Vehicle"
                    : "Add Vehicle"}
              </button>

              {editingVehicleId ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={resetVehicleForm}
                  disabled={submittingVehicle}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Vehicle No.</th>
                <th style={styles.th}>Contractor</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Updated</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length ? (
                vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td style={styles.td}>{vehicle.vehicleNumber}</td>
                    <td style={styles.td}>{vehicle.contractorName}</td>
                    <td style={styles.td}>{vehicle.vehicleType || "-"}</td>
                    <td style={styles.td}>{vehicle.isActive ? "Active" : "Inactive"}</td>
                    <td style={styles.td}>{formatDateTimeLabel(vehicle.updatedAt) || "-"}</td>
                    <td style={styles.td}>
                      <div style={styles.inlineActions}>
                        <button
                          type="button"
                          style={styles.tableActionButton}
                          onClick={() => handleEditVehicle(vehicle)}
                          disabled={!canManage}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.tableActionButton}
                          onClick={() => toggleVehicleStatus(vehicle)}
                          disabled={!canManage || statusUpdatingId === vehicle.id}
                        >
                          {statusUpdatingId === vehicle.id
                            ? "Updating..."
                            : vehicle.isActive
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.emptyCell} colSpan={6}>
                    No mine-vehicle entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Boulder Daily Reports">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Plant / Unit / Shift</th>
                <th style={styles.th}>Mine</th>
                <th style={styles.th}>Vehicle / Contractor</th>
                <th style={styles.th}>Flow (tons)</th>
                <th style={styles.th}>Yield</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length ? (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td style={styles.td}>{formatDisplayDate(report.reportDate)}</td>
                    <td style={styles.td}>
                      {report.plantName || "-"}
                      <br />
                      <span style={styles.subtleText}>
                        {report.crusherUnitNameSnapshot || "Unit -"} | {report.shift || "Shift -"}
                      </span>
                    </td>
                    <td style={styles.td}>{report.sourceMineName || "-"}</td>
                    <td style={styles.td}>
                      {report.vehicleNumberSnapshot}
                      <br />
                      <span style={styles.subtleText}>
                        {report.contractorNameSnapshot} | {formatRouteTypeLabel(report.routeType)} | Trips{" "}
                        {report.vehicleTripCount ?? 0}
                      </span>
                    </td>
                    <td style={styles.td}>
                      Inward {formatMetric(report.inwardWeightTons)} | Direct {formatMetric(report.directToCrusherTons)}
                      <br />
                      <span style={styles.subtleText}>
                        Consumed {formatMetric(report.crusherConsumptionTons)} | Closing {formatMetric(report.closingStockTons)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {report.yieldPercent === null || report.yieldPercent === undefined
                        ? "-"
                        : `${formatMetric(report.yieldPercent)}%`}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.inlineActions}>
                        <button
                          type="button"
                          style={styles.tableActionButton}
                          onClick={() => handleEditReport(report)}
                          disabled={!canManage}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.dangerButton}
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={!canManage}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.emptyCell} colSpan={7}>
                    {loading ? "Loading boulder reports..." : "No boulder reports found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
    </div>
  );
}

function PreviewTile({ label, value }) {
  return (
    <div style={styles.previewTile}>
      <p style={styles.previewLabel}>{label}</p>
      <p style={styles.previewValue}>{value}</p>
    </div>
  );
}

const styles = {
  errorBanner: {
    border: "1px solid #fecdd3",
    background:
      "linear-gradient(135deg, rgba(255,241,242,0.98) 0%, rgba(255,228,230,0.98) 100%)",
    color: "#881337",
    borderRadius: "16px",
    padding: "13px 15px",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(190, 24, 93, 0.08)",
  },
  successBanner: {
    border: "1px solid #86efac",
    background:
      "linear-gradient(135deg, rgba(240,253,244,0.98) 0%, rgba(220,252,231,0.98) 100%)",
    color: "#14532d",
    borderRadius: "16px",
    padding: "13px 15px",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(22, 163, 74, 0.08)",
  },
  warningBanner: {
    border: "1px solid #fde68a",
    background:
      "linear-gradient(135deg, rgba(255,251,235,0.98) 0%, rgba(254,243,199,0.98) 100%)",
    color: "#854d0e",
    borderRadius: "16px",
    padding: "13px 15px",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(202, 138, 4, 0.08)",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  metricCard: {
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: "16px",
    padding: "14px",
    background:
      "radial-gradient(circle at top right, rgba(15,118,110,0.12), transparent 45%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  },
  metricLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    fontWeight: 700,
  },
  metricValue: {
    margin: "8px 0 0",
    fontWeight: 800,
    fontSize: "22px",
    color: "#0f172a",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
    alignItems: "center",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  tripPanel: {
    gridColumn: "1 / -1",
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, rgba(239,246,255,0.85) 0%, rgba(248,250,252,0.95) 100%)",
    padding: "12px",
  },
  tripPanelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
  },
  tripPanelTitle: {
    margin: 0,
    fontWeight: 800,
    color: "#0f172a",
    fontSize: "14px",
  },
  tripPanelHint: {
    margin: "6px 0 10px",
    color: "#475569",
    fontSize: "13px",
  },
  tripRowsWrap: {
    display: "grid",
    gap: "8px",
  },
  quickTripForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    background: "rgba(255,255,255,0.95)",
    borderRadius: "12px",
    padding: "10px",
    marginBottom: "10px",
  },
  tripRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px",
    alignItems: "center",
    border: "1px solid #dbeafe",
    background: "rgba(255,255,255,0.92)",
    borderRadius: "12px",
    padding: "8px",
  },
  vehicleFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  fieldLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#334155",
    fontWeight: 600,
    fontSize: "13px",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    boxShadow: "inset 0 1px 1px rgba(15,23,42,0.04)",
  },
  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    minHeight: "74px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  previewGrid: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginTop: "4px",
  },
  previewTile: {
    border: "1px solid #dbe3ee",
    borderRadius: "14px",
    padding: "12px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.98) 100%)",
  },
  previewLabel: {
    margin: 0,
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.4px",
  },
  previewValue: {
    margin: "6px 0 0",
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
  },
  actionsRow: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    padding: "11px 18px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.24)",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    color: "#0f172a",
    padding: "11px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: "8px",
    background: "#fff1f2",
    color: "#9f1239",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  registryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  sectionHint: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
  },
  warningText: {
    margin: 0,
    gridColumn: "1 / -1",
    color: "#9a3412",
    background: "rgba(255, 237, 213, 0.9)",
    border: "1px solid #fed7aa",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 600,
  },
  contextPanel: {
    gridColumn: "1 / -1",
    border: "1px solid #c7d2fe",
    background:
      "linear-gradient(135deg, rgba(238,242,255,0.92) 0%, rgba(248,250,252,0.96) 100%)",
    borderRadius: "14px",
    padding: "12px",
    display: "grid",
    gap: "8px",
  },
  contextTitle: {
    margin: 0,
    color: "#1e1b4b",
    fontWeight: 800,
    fontSize: "14px",
  },
  contextHint: {
    margin: 0,
    color: "#3730a3",
    fontSize: "13px",
  },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#0f172a",
    fontWeight: 600,
    fontSize: "13px",
    gridColumn: "1 / -1",
  },
  toggleLabelCompact: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#334155",
    fontWeight: 600,
    fontSize: "12px",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: "780px",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    overflow: "hidden",
    background: "#ffffff",
  },
  th: {
    textAlign: "left",
    padding: "11px 10px",
    borderBottom: "1px solid #e2e8f0",
    background:
      "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.98) 100%)",
    color: "#334155",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  td: {
    padding: "11px 10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: "13px",
    verticalAlign: "top",
  },
  subtleText: {
    color: "#64748b",
    fontSize: "12px",
  },
  emptyCell: {
    textAlign: "center",
    color: "#64748b",
    padding: "16px",
  },
  inlineActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  tableActionButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default BoulderReportsPage;
