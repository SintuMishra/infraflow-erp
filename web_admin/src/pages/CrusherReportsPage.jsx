import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getCachedResource } from "../services/clientCache";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useMasters } from "../hooks/useMasters";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  formatDisplayDate,
  getTodayDateValue,
  getTimestampFileLabel,
  toDateOnlyValue,
} from "../utils/date";

const todayDate = getTodayDateValue();
const OPERATIONAL_STATUS_OPTIONS = [
  { value: "running", label: "Running" },
  { value: "watch", label: "Watch" },
  { value: "breakdown", label: "Breakdown" },
  { value: "maintenance", label: "Maintenance" },
  { value: "closed", label: "Closed" },
];
const DATE_RANGES = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 6 },
  { label: "Last 30 Days", days: 29 },
  { label: "All Time", days: null },
];

const INITIAL_FORM = {
  reportDate: todayDate,
  plantId: "",
  shift: "",
  crusherUnitName: "",
  materialType: "",
  operationalStatus: "running",
  productionTons: "",
  dispatchTons: "",
  machineHours: "",
  dieselUsed: "",
  electricityKwh: "",
  electricityOpeningReading: "",
  electricityClosingReading: "",
  dieselRatePerLitre: "",
  electricityRatePerKwh: "",
  dieselCost: "",
  electricityCost: "",
  labourExpense: "",
  maintenanceExpense: "",
  otherExpense: "",
  totalExpense: "",
  breakdownHours: "",
  openingStockTons: "",
  closingStockTons: "",
  operatorsCount: "",
  downtimeReason: "",
  maintenanceNotes: "",
  expenseRemarks: "",
  remarks: "",
};

const INITIAL_SECTION_VISIBILITY = {
  snapshot: true,
  controls: true,
  analytics: true,
  attention: true,
  form: true,
  reports: true,
};

function CrusherReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { masters, loadingMasters, mastersError } = useMasters();
  const canManageCrusherReports = ["super_admin", "manager", "crusher_supervisor"].includes(
    String(currentUser?.role || "")
  );
  const initialFilters = useMemo(
    () => parseCrusherQuery(location.search),
    [location.search]
  );

  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(buildSummary([]));
  const [lookups, setLookups] = useState({
    shifts: [],
    crusherUnits: [],
    materialTypes: [],
    operationalStatuses: [],
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [search, setSearch] = useState(initialFilters.search);
  const [plants, setPlants] = useState([]);
  const [plantFilter, setPlantFilter] = useState(initialFilters.plantFilter);
  const [shiftFilter, setShiftFilter] = useState(initialFilters.shiftFilter);
  const [unitFilter, setUnitFilter] = useState(initialFilters.unitFilter);
  const [materialFilter, setMaterialFilter] = useState(initialFilters.materialFilter);
  const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [activeWindow, setActiveWindow] = useState(initialFilters.activeWindow);
  const [page, setPage] = useState(initialFilters.page);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [editingReportId, setEditingReportId] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [sectionVisibility, setSectionVisibility] = useState(INITIAL_SECTION_VISIBILITY);

  const debouncedSearch = useDebouncedValue(search, 300);
  const autoCalculatedElectricityKwh = useMemo(
    () =>
      calculateDerivedElectricityKwhInput(
        formData.electricityKwh,
        formData.electricityOpeningReading,
        formData.electricityClosingReading
      ),
    [formData.electricityClosingReading, formData.electricityKwh, formData.electricityOpeningReading]
  );
  const autoCalculatedDieselCost = useMemo(
    () =>
      calculateDerivedCostInput(
        formData.dieselCost,
        formData.dieselUsed,
        formData.dieselRatePerLitre
      ),
    [formData.dieselCost, formData.dieselRatePerLitre, formData.dieselUsed]
  );
  const autoCalculatedElectricityCost = useMemo(
    () =>
      calculateDerivedCostInput(
        formData.electricityCost,
        autoCalculatedElectricityKwh,
        formData.electricityRatePerKwh
      ),
    [autoCalculatedElectricityKwh, formData.electricityCost, formData.electricityRatePerKwh]
  );
  const autoCalculatedTotalExpense = useMemo(
    () =>
      calculateTotalExpenseInput([
        autoCalculatedDieselCost,
        autoCalculatedElectricityCost,
        formData.labourExpense,
        formData.maintenanceExpense,
        formData.otherExpense,
      ]),
    [
      autoCalculatedDieselCost,
      autoCalculatedElectricityCost,
      formData.labourExpense,
      formData.maintenanceExpense,
      formData.otherExpense,
    ]
  );

  useEffect(() => {
    setSearch(initialFilters.search);
    setPlantFilter(initialFilters.plantFilter);
    setShiftFilter(initialFilters.shiftFilter);
    setUnitFilter(initialFilters.unitFilter);
    setMaterialFilter(initialFilters.materialFilter);
    setStatusFilter(initialFilters.statusFilter);
    setStartDate(initialFilters.startDate);
    setEndDate(initialFilters.endDate);
    setActiveWindow(initialFilters.activeWindow);
    setPage(initialFilters.page);
  }, [initialFilters]);

  useEffect(() => {
    const nextSearch = buildCrusherQueryString({
      search,
      plantFilter,
      shiftFilter,
      unitFilter,
      materialFilter,
      statusFilter,
      startDate,
      endDate,
      activeWindow,
      page,
    });
    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;

    if (nextSearch === currentSearch) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true }
    );
  }, [
    activeWindow,
    endDate,
    location.pathname,
    location.search,
    materialFilter,
    navigate,
    page,
    plantFilter,
    search,
    shiftFilter,
    startDate,
    statusFilter,
    unitFilter,
  ]);

  async function loadReports(filters = {}) {
    setLoadingReports(true);

    try {
      const response = await api.get("/plant-unit-reports", {
        params: {
          search: filters.search || undefined,
          plantId: filters.plantId || undefined,
          shift: filters.shift || undefined,
          crusherUnitName: filters.crusherUnitName || undefined,
          materialType: filters.materialType || undefined,
          operationalStatus: filters.operationalStatus || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: filters.page || 1,
          limit: 25,
        },
      });

      setReports(response.data?.data || []);
      setSummary(response.data?.meta?.summary || buildSummary([]));
      setLookups(
        response.data?.meta?.lookups || {
          shifts: [],
          crusherUnits: [],
          materialTypes: [],
          operationalStatuses: [],
        }
      );
      setPagination(
        response.data?.meta?.pagination || {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        }
      );
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load plant reports");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadPlants() {
    try {
      const data = await getCachedResource("lookup:plants", 60_000, async () => {
        const response = await api.get("/plants/lookup");
        return response.data?.data || [];
      });
      setPlants(data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load plants");
    }
  }

  useEffect(() => {
    loadPlants();
  }, []);

  useEffect(() => {
    loadReports({
      search: debouncedSearch,
      plantId: plantFilter,
      shift: shiftFilter,
      crusherUnitName: unitFilter,
      materialType: materialFilter,
      operationalStatus: statusFilter,
      startDate,
      endDate,
      page,
    });
  }, [debouncedSearch, endDate, materialFilter, page, plantFilter, shiftFilter, startDate, statusFilter, unitFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, endDate, materialFilter, plantFilter, shiftFilter, startDate, statusFilter, unitFilter]);

  const normalizedReports = useMemo(
    () =>
      reports.map((report) => ({
        ...report,
        reportDateValue: toDateOnlyValue(report.reportDate),
        productionTons: Number(report.productionTons || 0),
        dispatchTons: Number(report.dispatchTons || 0),
        machineHours: Number(report.machineHours || 0),
        dieselUsed: Number(report.dieselUsed || 0),
        electricityKwh: Number(report.electricityKwh || 0),
        electricityOpeningReading:
          report.electricityOpeningReading === null || report.electricityOpeningReading === undefined
            ? null
            : Number(report.electricityOpeningReading),
        electricityClosingReading:
          report.electricityClosingReading === null || report.electricityClosingReading === undefined
            ? null
            : Number(report.electricityClosingReading),
        dieselRatePerLitre:
          report.dieselRatePerLitre === null || report.dieselRatePerLitre === undefined
            ? null
            : Number(report.dieselRatePerLitre),
        electricityRatePerKwh:
          report.electricityRatePerKwh === null || report.electricityRatePerKwh === undefined
            ? null
            : Number(report.electricityRatePerKwh),
        dieselCost:
          report.dieselCost === null || report.dieselCost === undefined
            ? null
            : Number(report.dieselCost),
        electricityCost:
          report.electricityCost === null || report.electricityCost === undefined
            ? null
            : Number(report.electricityCost),
        labourExpense:
          report.labourExpense === null || report.labourExpense === undefined
            ? null
            : Number(report.labourExpense),
        maintenanceExpense:
          report.maintenanceExpense === null || report.maintenanceExpense === undefined
            ? null
            : Number(report.maintenanceExpense),
        otherExpense:
          report.otherExpense === null || report.otherExpense === undefined
            ? null
            : Number(report.otherExpense),
        totalExpense:
          report.totalExpense === null || report.totalExpense === undefined
            ? null
            : Number(report.totalExpense),
        breakdownHours:
          report.breakdownHours === null || report.breakdownHours === undefined
            ? null
            : Number(report.breakdownHours),
        openingStockTons:
          report.openingStockTons === null || report.openingStockTons === undefined
            ? null
            : Number(report.openingStockTons),
        closingStockTons:
          report.closingStockTons === null || report.closingStockTons === undefined
            ? null
            : Number(report.closingStockTons),
        operatorsCount:
          report.operatorsCount === null || report.operatorsCount === undefined
            ? null
            : Number(report.operatorsCount),
      })),
    [reports]
  );

  const shiftOptions = useMemo(() => {
    const activeMasterOptions = (masters?.shifts || [])
      .filter((shift) => shift?.isActive)
      .map((shift) => shift.shiftName);
    return uniqStrings(activeMasterOptions);
  }, [masters?.shifts]);
  const activeMasterShiftKeySet = useMemo(
    () => new Set(shiftOptions.map((shift) => normalizeShiftKey(shift))),
    [shiftOptions]
  );

  const crusherUnitOptions = useMemo(() => {
    const masterOptions = (masters?.crusherUnits || []).map((unit) => unit.unitName);
    return uniqStrings([...masterOptions, ...(lookups.crusherUnits || [])]);
  }, [lookups.crusherUnits, masters?.crusherUnits]);

  const plantOptions = useMemo(
    () =>
      plants
        .filter(
          (plant) =>
            plant.isActive ||
            String(plant.id) === String(formData.plantId) ||
            String(plant.id) === String(plantFilter)
        )
        .sort((left, right) => String(left.plantName || "").localeCompare(String(right.plantName || ""))),
    [formData.plantId, plantFilter, plants]
  );

  const selectedPlant = useMemo(
    () => plantOptions.find((plant) => String(plant.id) === String(formData.plantId)) || null,
    [formData.plantId, plantOptions]
  );

  const selectedPlantType = useMemo(
    () => normalizePlantTypeLabel(selectedPlant?.plantType),
    [selectedPlant?.plantType]
  );

  const selectedPlantPreset = useMemo(
    () => getPlantReportPreset(selectedPlant?.plantType),
    [selectedPlant?.plantType]
  );

  const selectedPowerProfile = useMemo(
    () => getPowerProfile(selectedPlant?.powerSourceType),
    [selectedPlant?.powerSourceType]
  );

  const materialOptions = useMemo(() => {
    const masterOptions = (masters?.materials || []).map((material) => material.materialName);
    return uniqStrings([...masterOptions, ...(lookups.materialTypes || [])]);
  }, [lookups.materialTypes, masters?.materials]);

  const filteredCrusherUnitOptions = useMemo(() => {
    const activeMasterUnits = (masters?.crusherUnits || []).filter(
      (unit) => unit.isActive || String(unit.unitName || "") === String(formData.crusherUnitName || "")
    );
    const matchingMasterUnits = selectedPlantType
      ? activeMasterUnits.filter(
          (unit) => normalizePlantTypeLabel(unit.plantType) === selectedPlantType
        )
      : activeMasterUnits;

    return uniqStrings([
      ...matchingMasterUnits.map((unit) => unit.unitName),
      ...((lookups.crusherUnits || []).filter(Boolean)),
    ]);
  }, [formData.crusherUnitName, lookups.crusherUnits, masters?.crusherUnits, selectedPlantType]);

  useEffect(() => {
    if (
      formData.crusherUnitName &&
      selectedPlant &&
      !filteredCrusherUnitOptions.includes(formData.crusherUnitName)
    ) {
      setFormData((current) => ({
        ...current,
        crusherUnitName: "",
      }));
    }
  }, [filteredCrusherUnitOptions, formData.crusherUnitName, selectedPlant]);

  useEffect(() => {
    const normalizedFilterShift = normalizeShiftKey(shiftFilter);
    if (!normalizedFilterShift || activeMasterShiftKeySet.has(normalizedFilterShift)) {
      return;
    }

    setShiftFilter("");
  }, [activeMasterShiftKeySet, shiftFilter]);

  useEffect(() => {
    const normalizedFormShift = normalizeShiftKey(formData.shift);
    if (!normalizedFormShift || activeMasterShiftKeySet.has(normalizedFormShift)) {
      return;
    }

    setFormData((current) => ({
      ...current,
      shift: "",
    }));
  }, [activeMasterShiftKeySet, formData.shift]);

  const operationalStatusOptions = useMemo(() => {
    const merged = [
      ...OPERATIONAL_STATUS_OPTIONS,
      ...(lookups.operationalStatuses || []).map((status) => ({
        value: status,
        label: formatStatusLabel(status),
      })),
    ];

    return merged.reduce((accumulator, option) => {
      if (!accumulator.find((entry) => entry.value === option.value)) {
        accumulator.push(option);
      }
      return accumulator;
    }, []);
  }, [lookups.operationalStatuses]);

  const unitLeaderboard = useMemo(() => {
    const grouped = new Map();

    normalizedReports.forEach((report) => {
      const reportLabel = getReportDisplayName(report);
      const current = grouped.get(reportLabel) || {
        crusherUnitName: reportLabel,
        reports: 0,
        productionTons: 0,
        dispatchTons: 0,
        machineHours: 0,
        dieselUsed: 0,
      };

      current.reports += 1;
      current.productionTons += report.productionTons;
      current.dispatchTons += report.dispatchTons;
      current.machineHours += report.machineHours;
      current.dieselUsed += report.dieselUsed;
      grouped.set(reportLabel, current);
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.productionTons - left.productionTons)
      .slice(0, 5);
  }, [normalizedReports]);

  const trendRows = useMemo(() => {
    const grouped = new Map();

    normalizedReports.forEach((report) => {
      const current = grouped.get(report.reportDateValue) || {
        reportDate: report.reportDateValue,
        productionTons: 0,
        dispatchTons: 0,
        dieselUsed: 0,
      };

      current.productionTons += report.productionTons;
      current.dispatchTons += report.dispatchTons;
      current.dieselUsed += report.dieselUsed;
      grouped.set(report.reportDateValue, current);
    });

    const rows = Array.from(grouped.values()).sort((left, right) =>
      right.reportDate.localeCompare(left.reportDate)
    );
    const maxProduction = Math.max(...rows.map((row) => row.productionTons), 1);

    return rows.slice(0, 8).map((row) => ({
      ...row,
      productionWidth: `${Math.max((row.productionTons / maxProduction) * 100, row.productionTons ? 10 : 0)}%`,
    }));
  }, [normalizedReports]);

  const attentionItems = useMemo(
    () =>
      normalizedReports
        .map((report) => {
          const flags = [];

          if (report.operationalStatus === "breakdown") {
            flags.push("Breakdown reported");
          }

          if (report.breakdownHours && report.breakdownHours > 2) {
            flags.push("High breakdown hours");
          }

          if (report.productionTons > 0 && report.dispatchTons > report.productionTons) {
            flags.push("Dispatch above production");
          }

          if (!report.maintenanceNotes && report.operationalStatus === "maintenance") {
            flags.push("Maintenance notes missing");
          }

          if (!report.downtimeReason && report.breakdownHours) {
            flags.push("Downtime reason missing");
          }

          return {
            id: report.id,
            crusherUnitName: getReportDisplayName(report),
            materialType: report.materialType,
            reportDateValue: report.reportDateValue,
            flags,
          };
        })
        .filter((item) => item.flags.length > 0)
        .slice(0, 6),
    [normalizedReports]
  );

  const toggleSection = (sectionKey) => {
    setSectionVisibility((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingReportId(null);
  };

  const handleEditReport = (report) => {
    const normalizedReportShift = normalizeShiftKey(report.shift || "");

    setFormData({
      reportDate: report.reportDateValue || todayDate,
      plantId: report.plantId ? String(report.plantId) : "",
      shift: activeMasterShiftKeySet.has(normalizedReportShift) ? String(report.shift || "").trim() : "",
      crusherUnitName: report.crusherUnitName || "",
      materialType: report.materialType || "",
      operationalStatus: report.operationalStatus || "running",
      productionTons: String(report.productionTons ?? ""),
      dispatchTons: String(report.dispatchTons ?? ""),
      machineHours: String(report.machineHours ?? ""),
      dieselUsed: String(report.dieselUsed ?? ""),
      electricityKwh:
        report.electricityKwh === null || report.electricityKwh === undefined
          ? ""
          : String(report.electricityKwh),
      electricityOpeningReading:
        report.electricityOpeningReading === null || report.electricityOpeningReading === undefined
          ? ""
          : String(report.electricityOpeningReading),
      electricityClosingReading:
        report.electricityClosingReading === null || report.electricityClosingReading === undefined
          ? ""
          : String(report.electricityClosingReading),
      dieselRatePerLitre:
        report.dieselRatePerLitre === null || report.dieselRatePerLitre === undefined
          ? ""
          : String(report.dieselRatePerLitre),
      electricityRatePerKwh:
        report.electricityRatePerKwh === null || report.electricityRatePerKwh === undefined
          ? ""
          : String(report.electricityRatePerKwh),
      dieselCost:
        report.dieselCost === null || report.dieselCost === undefined
          ? ""
          : String(report.dieselCost),
      electricityCost:
        report.electricityCost === null || report.electricityCost === undefined
          ? ""
          : String(report.electricityCost),
      labourExpense:
        report.labourExpense === null || report.labourExpense === undefined
          ? ""
          : String(report.labourExpense),
      maintenanceExpense:
        report.maintenanceExpense === null || report.maintenanceExpense === undefined
          ? ""
          : String(report.maintenanceExpense),
      otherExpense:
        report.otherExpense === null || report.otherExpense === undefined
          ? ""
          : String(report.otherExpense),
      totalExpense:
        report.totalExpense === null || report.totalExpense === undefined
          ? ""
          : String(report.totalExpense),
      breakdownHours:
        report.breakdownHours === null || report.breakdownHours === undefined
          ? ""
          : String(report.breakdownHours),
      openingStockTons:
        report.openingStockTons === null || report.openingStockTons === undefined
          ? ""
          : String(report.openingStockTons),
      closingStockTons:
        report.closingStockTons === null || report.closingStockTons === undefined
          ? ""
          : String(report.closingStockTons),
      operatorsCount:
        report.operatorsCount === null || report.operatorsCount === undefined
          ? ""
          : String(report.operatorsCount),
      downtimeReason: report.downtimeReason || "",
      maintenanceNotes: report.maintenanceNotes || "",
      expenseRemarks: report.expenseRemarks || "",
      remarks: report.remarks || "",
    });
    setEditingReportId(report.id);
    setExpandedReportId(report.id);
    setSectionVisibility((current) => ({
      ...current,
      form: true,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteReport = async (report) => {
    const confirmed = window.confirm(
      `Delete the plant report for ${getReportDisplayName(report)} on ${formatDisplayDate(
        report.reportDateValue
      )}?`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/plant-unit-reports/${report.id}`);
      setSuccess("Plant report deleted successfully");

      if (editingReportId === report.id) {
        resetForm();
      }

      await loadReports({
        search: debouncedSearch,
        plantId: plantFilter,
        shift: shiftFilter,
        crusherUnitName: unitFilter,
        materialType: materialFilter,
        operationalStatus: statusFilter,
        startDate,
        endDate,
        page,
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete plant report");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      reportDate: formData.reportDate,
      plantId: Number(formData.plantId),
      shift: String(formData.shift || "").trim(),
      crusherUnitName: String(formData.crusherUnitName || "").trim(),
      materialType: String(formData.materialType || "").trim(),
      operationalStatus: String(formData.operationalStatus || "").trim(),
      productionTons: Number(formData.productionTons),
      dispatchTons: Number(formData.dispatchTons),
      machineHours: Number(formData.machineHours),
      dieselUsed: formData.dieselUsed === "" ? "" : Number(formData.dieselUsed),
      electricityKwh: formData.electricityKwh === "" ? "" : Number(formData.electricityKwh),
      electricityOpeningReading:
        formData.electricityOpeningReading === ""
          ? ""
          : Number(formData.electricityOpeningReading),
      electricityClosingReading:
        formData.electricityClosingReading === ""
          ? ""
          : Number(formData.electricityClosingReading),
      dieselRatePerLitre:
        formData.dieselRatePerLitre === "" ? "" : Number(formData.dieselRatePerLitre),
      electricityRatePerKwh:
        formData.electricityRatePerKwh === "" ? "" : Number(formData.electricityRatePerKwh),
      dieselCost: formData.dieselCost === "" ? "" : Number(formData.dieselCost),
      electricityCost:
        formData.electricityCost === "" ? "" : Number(formData.electricityCost),
      labourExpense: formData.labourExpense === "" ? "" : Number(formData.labourExpense),
      maintenanceExpense:
        formData.maintenanceExpense === "" ? "" : Number(formData.maintenanceExpense),
      otherExpense: formData.otherExpense === "" ? "" : Number(formData.otherExpense),
      totalExpense:
        autoCalculatedTotalExpense === "" ? "" : Number(autoCalculatedTotalExpense),
      breakdownHours: formData.breakdownHours === "" ? "" : Number(formData.breakdownHours),
      openingStockTons:
        formData.openingStockTons === "" ? "" : Number(formData.openingStockTons),
      closingStockTons:
        formData.closingStockTons === "" ? "" : Number(formData.closingStockTons),
      operatorsCount: formData.operatorsCount === "" ? "" : Number(formData.operatorsCount),
      downtimeReason: String(formData.downtimeReason || "").trim(),
      maintenanceNotes: String(formData.maintenanceNotes || "").trim(),
      expenseRemarks: String(formData.expenseRemarks || "").trim(),
      remarks: String(formData.remarks || "").trim(),
    };

    if (
      !payload.reportDate ||
      !formData.plantId
    ) {
      setError("Report date and plant are required");
      return;
    }

    if (payload.shift && !activeMasterShiftKeySet.has(normalizeShiftKey(payload.shift))) {
      setError("Selected shift is not active in masters. Please select a valid master shift.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.reportDate)) {
      setError("Report date must use YYYY-MM-DD format");
      return;
    }

    const numericValues = [
      payload.productionTons,
      payload.dispatchTons,
      payload.machineHours,
      payload.dieselUsed === "" ? 0 : payload.dieselUsed,
      payload.electricityKwh === "" ? 0 : payload.electricityKwh,
      payload.electricityOpeningReading === "" ? 0 : payload.electricityOpeningReading,
      payload.electricityClosingReading === "" ? 0 : payload.electricityClosingReading,
      payload.dieselRatePerLitre === "" ? 0 : payload.dieselRatePerLitre,
      payload.electricityRatePerKwh === "" ? 0 : payload.electricityRatePerKwh,
      payload.dieselCost === "" ? 0 : payload.dieselCost,
      payload.electricityCost === "" ? 0 : payload.electricityCost,
      payload.labourExpense === "" ? 0 : payload.labourExpense,
      payload.maintenanceExpense === "" ? 0 : payload.maintenanceExpense,
      payload.otherExpense === "" ? 0 : payload.otherExpense,
      payload.totalExpense === "" ? 0 : payload.totalExpense,
      payload.breakdownHours === "" ? 0 : payload.breakdownHours,
      payload.openingStockTons === "" ? 0 : payload.openingStockTons,
      payload.closingStockTons === "" ? 0 : payload.closingStockTons,
      payload.operatorsCount === "" ? 0 : payload.operatorsCount,
    ];

    if (numericValues.some((value) => Number(value) < 0)) {
      setError("Numeric fields cannot be negative");
      return;
    }

    if (
      payload.electricityOpeningReading !== "" &&
      payload.electricityClosingReading !== "" &&
      payload.electricityClosingReading < payload.electricityOpeningReading
    ) {
      setError("Electricity closing reading cannot be lower than opening reading");
      return;
    }

    if (
      payload.breakdownHours !== "" &&
      payload.machineHours !== "" &&
      Number(payload.breakdownHours) > Number(payload.machineHours)
    ) {
      setError("Downtime hours cannot be higher than machine hours");
      return;
    }

    if (payload.operatorsCount !== "" && !Number.isInteger(Number(payload.operatorsCount))) {
      setError("Operators count must be a whole number");
      return;
    }

    if (
      payload.openingStockTons !== "" &&
      payload.dispatchTons > Number(payload.openingStockTons) + Number(payload.productionTons || 0)
    ) {
      setError("Dispatch tons cannot exceed opening stock + production tons");
      return;
    }

    setLoading(true);

    try {
      if (editingReportId) {
        await api.put(`/plant-unit-reports/${editingReportId}`, payload);
        setSuccess("Plant report updated successfully");
      } else {
        await api.post("/plant-unit-reports", payload);
        setSuccess("Plant report added successfully");
      }

      resetForm();
      await loadReports({
        search: debouncedSearch,
        plantId: plantFilter,
        shift: shiftFilter,
        crusherUnitName: unitFilter,
        materialType: materialFilter,
        operationalStatus: statusFilter,
        startDate,
        endDate,
        page,
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          (editingReportId ? "Failed to update plant report" : "Failed to add plant report")
      );
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setPlantFilter("");
    setShiftFilter("");
    setUnitFilter("");
    setMaterialFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setActiveWindow("All Time");
    setPage(1);
  };

  const applyDateWindow = (range) => {
    setActiveWindow(range.label);
    setPage(1);

    if (range.days === null) {
      setStartDate("");
      setEndDate("");
      return;
    }

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - range.days);
    setStartDate(toDateOnlyValue(start));
    setEndDate(toDateOnlyValue(end));
  };

  const handleExportCsv = () => {
    const rows = normalizedReports.map((report) => ({
      report_date: report.reportDateValue,
      plant_name: report.plantName || "",
      shift: report.shift || "",
      crusher_unit: report.crusherUnitName || "",
      material_type: report.materialType || "",
      operational_status: formatStatusLabel(report.operationalStatus),
      production_tons: report.productionTons,
      dispatch_tons: report.dispatchTons,
      machine_hours: report.machineHours,
      diesel_used: report.dieselUsed,
      electricity_kwh: report.electricityKwh,
      electricity_opening_reading: report.electricityOpeningReading ?? "",
      electricity_closing_reading: report.electricityClosingReading ?? "",
      diesel_rate_per_litre: report.dieselRatePerLitre ?? "",
      electricity_rate_per_kwh: report.electricityRatePerKwh ?? "",
      diesel_cost: report.dieselCost ?? "",
      electricity_cost: report.electricityCost ?? "",
      labour_expense: report.labourExpense ?? "",
      maintenance_expense: report.maintenanceExpense ?? "",
      other_expense: report.otherExpense ?? "",
      total_expense: report.totalExpense ?? "",
      breakdown_hours: report.breakdownHours ?? "",
      opening_stock_tons: report.openingStockTons ?? "",
      closing_stock_tons: report.closingStockTons ?? "",
      operators_count: report.operatorsCount ?? "",
      downtime_reason: report.downtimeReason || "",
      maintenance_notes: report.maintenanceNotes || "",
      expense_remarks: report.expenseRemarks || "",
      remarks: report.remarks || "",
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `plant-unit-reports-${getTimestampFileLabel()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!normalizedReports.length) {
      setError("No plant reports match the current filters for PDF export");
      setSuccess("");
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1280,height=900");
    if (!reportWindow) {
      setError("Popup blocked. Please allow popups and try PDF export again.");
      setSuccess("");
      return;
    }

    const selectedPlantName =
      plantFilter &&
      plantOptions.find((plant) => String(plant.id) === String(plantFilter))?.plantName;

    const activeFilters = [
      search ? `Search: ${search}` : null,
      selectedPlantName ? `Plant: ${selectedPlantName}` : null,
      shiftFilter ? `Shift: ${shiftFilter}` : null,
      unitFilter ? `Unit: ${unitFilter}` : null,
      materialFilter ? `Material: ${materialFilter}` : null,
      statusFilter ? `Status: ${formatStatusLabel(statusFilter)}` : null,
      startDate ? `From: ${formatDisplayDate(startDate)}` : null,
      endDate ? `To: ${formatDisplayDate(endDate)}` : null,
    ].filter(Boolean);

    const rowsHtml = normalizedReports
      .map(
        (report) => `
          <tr>
            <td>${escapeHtml(formatDisplayDate(report.reportDateValue))}</td>
            <td>${escapeHtml(getReportDisplayName(report))}</td>
            <td>${escapeHtml(report.shift || "-")}</td>
            <td>${escapeHtml(report.materialType || "-")}</td>
            <td>${escapeHtml(formatStatusLabel(report.operationalStatus))}</td>
            <td>${escapeHtml(formatCompactNumber(report.productionTons))}</td>
            <td>${escapeHtml(formatCompactNumber(report.dispatchTons))}</td>
            <td>${escapeHtml(formatCompactNumber(report.machineHours))}</td>
            <td>${escapeHtml(formatCompactNumber(report.totalExpense))}</td>
          </tr>
        `
      )
      .join("");

    const generatedAt = new Date().toLocaleString("en-IN");
    const documentTitle = `Plant Unit Reports ${getTimestampFileLabel()}`;

    try {
      const htmlDocument = `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${escapeHtml(documentTitle)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
              h1 { margin: 0 0 8px; font-size: 22px; }
              .meta { color: #475569; font-size: 12px; margin-bottom: 6px; }
              .toolbar { margin: 10px 0 14px; }
              .print-btn { border: 1px solid #94a3b8; background: #0f172a; color: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 700; }
              .filterbox { margin: 12px 0 16px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
              th { background: #f1f5f9; font-weight: 700; }
              @media print { .toolbar { display: none; } body { margin: 10mm; } }
            </style>
          </head>
          <body>
            <h1>Plants & Units Daily Reports</h1>
            <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
            <div class="meta">Total Reports: ${normalizedReports.length}</div>
            <div class="toolbar">
              <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
            </div>
            ${
              activeFilters.length
                ? `<div class="filterbox"><strong>Applied Filters:</strong><br/>${activeFilters
                    .map((item) => escapeHtml(item))
                    .join(" | ")}</div>`
                : ""
            }
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plant / Unit</th>
                  <th>Shift</th>
                  <th>Material</th>
                  <th>Status</th>
                  <th>Production</th>
                  <th>Dispatch</th>
                  <th>Machine Hours</th>
                  <th>Total Expense</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </body>
        </html>
      `;

      reportWindow.document.open();
      reportWindow.document.write(htmlDocument);
      reportWindow.document.close();

      // Avoid blank-export race by printing only after the new document has rendered.
      const triggerPrint = () => {
        setTimeout(() => {
          try {
            reportWindow.focus();
            reportWindow.print();
          } catch {
            setError("PDF preview opened, but print dialog could not be triggered automatically.");
          }
        }, 500);
      };

      reportWindow.onload = triggerPrint;
      setTimeout(triggerPrint, 900);
    } catch {
      try {
        reportWindow.document.open();
        reportWindow.document.write(`
          <html><body style="font-family: Arial, sans-serif; padding: 20px;">
            <h3>PDF preview could not auto-render.</h3>
            <p>Please close this tab and retry Export PDF. If popup blocking is enabled, allow popups for this site.</p>
          </body></html>
        `);
        reportWindow.document.close();
      } catch {
        // ignore nested fallback failure
      }
      setError("Failed to render PDF export. Please try again.");
      setSuccess("");
    }
  };

  return (
    <AppShell
      title="Plants & Units Reports"
      subtitle="Production-grade plant reporting with shift analytics, correction controls, and cleaner multi-unit operations oversight"
    >
      <div style={styles.stack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div style={styles.heroCopy}>
              <p style={styles.heroEyebrow}>Plant Operations Layer</p>
              <h1 style={styles.heroTitle}>Plant Reporting Built for Real Operations Review</h1>
              <p style={styles.heroText}>
                Track shift-wise production, dispatch, stock, downtime, and maintenance context in
                one controlled workspace. This is designed for supervisors and managers who need
                plant truth, not just a record book.
              </p>
            </div>

            <div style={styles.heroSignalGrid}>
              <SignalPill
                label="Latest Reporting Date"
                value={summary.latestDate ? formatDisplayDate(summary.latestDate) : "-"}
              />
              <SignalPill label="Top Unit by Production" value={summary.topUnitName || "No data yet"} />
              <SignalPill
                label="Tons / Machine Hour"
                value={formatCompactNumber(summary.tonsPerMachineHour)}
              />
            </div>
          </div>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {mastersError ? <div style={styles.error}>{mastersError}</div> : null}

        <SectionCard title="Plant Snapshot">
          <SectionToolbar
            visible={sectionVisibility.snapshot}
            onToggle={() => toggleSection("snapshot")}
          />
          {sectionVisibility.snapshot ? (
            <>
              <div style={styles.summaryGrid}>
                <MetricCard tone="slate" tag="Reports" label="Entries in Scope" value={summary.total} />
                <MetricCard
                  tone="sand"
                  tag="Production"
                  label="Total Tons"
                  value={formatCompactNumber(summary.totalProduction)}
                />
                <MetricCard
                  tone="stone"
                  tag="Dispatch"
                  label="Total Tons"
                  value={formatCompactNumber(summary.totalDispatch)}
                />
                <MetricCard
                  tone="pearl"
                  tag="Diesel"
                  label="Total Used"
                  value={formatCompactNumber(summary.totalDiesel)}
                />
                <MetricCard
                  tone="slate"
                  tag="Electricity"
                  label="Total kWh"
                  value={formatCompactNumber(summary.totalElectricityKwh)}
                />
                <MetricCard
                  tone="sand"
                  tag="Expenses"
                  label="Total Spend"
                  value={formatCompactNumber(summary.totalExpense)}
                />
              </div>

              <div style={styles.insightRibbon}>
                <InsightStat
                  label="Machine Hours"
                  value={formatCompactNumber(summary.totalMachineHours)}
                  note="combined operating hours in this filtered lens"
                />
                <InsightStat
                  label="Diesel / Ton"
                  value={formatCompactNumber(summary.dieselPerTon)}
                  note="fuel efficiency across filtered production"
                />
                <InsightStat
                  label="Electricity / Ton"
                  value={formatCompactNumber(summary.electricityPerTon)}
                  note="power intensity across the current operational lens"
                />
                <InsightStat
                  label="Dispatch Conversion"
                  value={`${formatCompactNumber(summary.dispatchVsProduction)}%`}
                  note="dispatch as a share of produced tons"
                />
                <InsightStat
                  label="Expense / Ton"
                  value={formatCompactNumber(summary.expensePerTon)}
                  note="blended operating expense per ton of production"
                />
              </div>
            </>
          ) : (
            <CollapsedNote text="Snapshot cards are hidden to keep the workspace compact." />
          )}
        </SectionCard>

        <SectionCard title="Analysis Controls">
          <SectionToolbar
            visible={sectionVisibility.controls}
            onToggle={() => toggleSection("controls")}
          />
          {sectionVisibility.controls ? (
            <>
              <p style={styles.sectionSubtitle}>
                Filter by plant, shift, unit, material, plant status, and date range to
                compare plant behavior more realistically. The current analysis state stays in the
                URL so it can be refreshed or shared without losing context.
              </p>

              <div style={styles.chipRow}>
                {DATE_RANGES.map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => applyDateWindow(range)}
                    style={{
                      ...styles.filterChip,
                      ...(activeWindow === range.label ? styles.filterChipActive : {}),
                    }}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              <div style={styles.filterGrid}>
                <input
                  placeholder="Search shift, unit, material, downtime reason, maintenance, or remarks"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={styles.input}
                />

                <select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} style={styles.input}>
                  <option value="">All Plants / Units</option>
                  {plantOptions.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>

                <select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)} style={styles.input}>
                  <option value="">All Shifts</option>
                  {shiftOptions.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>

                <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} style={styles.input}>
                  <option value="">All Unit Lines</option>
                  {crusherUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>

                <select
                  value={materialFilter}
                  onChange={(event) => setMaterialFilter(event.target.value)}
                  style={styles.input}
                >
                  <option value="">All Materials</option>
                  {materialOptions.map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.input}>
                  <option value="">All Plant Statuses</option>
                  {operationalStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setActiveWindow("Custom");
                  }}
                  style={styles.input}
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setActiveWindow("Custom");
                  }}
                  style={styles.input}
                />

                <div style={styles.buttonRow}>
                  <button type="button" style={styles.secondaryButton} onClick={clearFilters}>
                    Reset View
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleExportCsv}
                    disabled={!normalizedReports.length || loadingReports}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleExportPdf}
                    disabled={!normalizedReports.length || loadingReports}
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </>
          ) : (
            <CollapsedNote text="Filters are hidden. Show them when you need to refine the plant view." />
          )}
        </SectionCard>

        <SectionCard title="Plant Insights">
          <SectionToolbar
            visible={sectionVisibility.analytics}
            onToggle={() => toggleSection("analytics")}
          />
          {sectionVisibility.analytics ? (
            <div style={styles.analyticsGrid}>
              <div style={styles.analyticsColumn}>
                <h4 style={styles.subsectionTitle}>Unit Performance Board</h4>
                {unitLeaderboard.length === 0 ? (
                  <EmptyState
                    title="No plant activity in this view"
                    text="Widen the date range or clear the filters to compare plant performance."
                  />
                ) : (
                  <div style={styles.focusStack}>
                    {unitLeaderboard.map((item, index) => (
                      <div key={item.crusherUnitName} style={styles.focusCard}>
                        <div style={styles.focusHeader}>
                          <span style={styles.focusRank}>#{index + 1}</span>
                          <div>
                            <h3 style={styles.focusTitle}>{item.crusherUnitName}</h3>
                            <p style={styles.focusSubtext}>{item.reports} reports in scope</p>
                          </div>
                        </div>
                        <div style={styles.focusMetrics}>
                          <span style={styles.focusMetric}>
                            {formatCompactNumber(item.productionTons)} production
                          </span>
                          <span style={styles.focusMetric}>
                            {formatCompactNumber(item.dispatchTons)} dispatch
                          </span>
                          <span style={styles.focusMetric}>
                            {formatCompactNumber(item.machineHours)} machine hours
                          </span>
                          <span style={styles.focusMetric}>
                            {formatCompactNumber(getRatio(item.productionTons, item.machineHours))} t/hr
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.analyticsColumn}>
                <h4 style={styles.subsectionTitle}>Daily Trend</h4>
                {trendRows.length === 0 ? (
                  <EmptyState
                    title="No daily trend data yet"
                    text="Once reports exist in the current range, this view will summarize plant load."
                  />
                ) : (
                  <div style={styles.trendStack}>
                    {trendRows.map((row) => (
                      <div key={row.reportDate} style={styles.trendRow}>
                        <div style={styles.trendMeta}>
                          <strong style={styles.trendDate}>{formatDisplayDate(row.reportDate)}</strong>
                          <span style={styles.trendSubtext}>
                            {formatCompactNumber(row.dispatchTons)} dispatch, {formatCompactNumber(row.dieselUsed)} diesel
                          </span>
                        </div>
                        <div style={styles.trendBarShell}>
                          <div style={{ ...styles.trendBarFill, width: row.productionWidth }} />
                        </div>
                        <strong style={styles.trendValue}>
                          {formatCompactNumber(row.productionTons)} production
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <CollapsedNote text="Insights are hidden to keep the page focused on review or entry." />
          )}
        </SectionCard>

        <SectionCard title="Attention Queue">
          <SectionToolbar
            visible={sectionVisibility.attention}
            onToggle={() => toggleSection("attention")}
          />
          {sectionVisibility.attention ? (
            attentionItems.length === 0 ? (
              <EmptyState
                title="Plant reporting looks stable"
                text="No strong plant warnings are present in the current filtered view."
              />
            ) : (
              <div style={styles.attentionGrid}>
                {attentionItems.map((item) => (
                  <div key={item.id} style={styles.attentionCard}>
                    <div style={styles.attentionHeader}>
                      <span style={styles.attentionDate}>{formatDisplayDate(item.reportDateValue)}</span>
                      <strong style={styles.attentionProject}>{item.crusherUnitName}</strong>
                    </div>
                    <p style={styles.attentionSite}>{item.materialType}</p>
                    <div style={styles.flagRow}>
                      {item.flags.map((flag) => (
                        <span key={flag} style={styles.flag}>
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <CollapsedNote text="Attention cards are hidden. Show them when you want quick plant warnings." />
          )}
        </SectionCard>

        <SectionCard title={editingReportId ? "Edit Plant Report" : "Add Plant Report"}>
          <SectionToolbar visible={sectionVisibility.form} onToggle={() => toggleSection("form")} />
          {sectionVisibility.form ? (
            <>
              <div style={styles.noteBox}>
                Use this form for disciplined daily plant reporting. Capture operating status,
                downtime, stocks, and maintenance context so the operational picture is complete.
              </div>

              <div style={styles.advisoryGrid}>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Required</span>
                  <strong style={styles.advisoryTitle}>Only the essentials block save</strong>
                  <p style={styles.advisoryText}>
                    Report date and plant are required. Shift, material, utilities, and expense
                    values can be added later without failing report generation.
                  </p>
                </div>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Synchronized</span>
                  <strong style={styles.advisoryTitle}>Master-driven dropdowns stay aligned</strong>
                  <p style={styles.advisoryText}>
                    Plants, shifts, materials, and operational lines pull from masters so the team
                    works with one naming standard.
                  </p>
                </div>
              </div>

              {selectedPlant ? (
                <div style={styles.noteBox}>
                  Reporting against <strong>{selectedPlant.plantName}</strong>.
                  {" "}Type: {selectedPlant.plantType || "Not set"}.
                  {" "}Power source: {selectedPlant.powerSourceType || "Not set"}.
                  {!selectedPlant.isActive ? " Status: inactive in masters." : ""}
                </div>
              ) : null}

              {selectedPlant ? (
                <div style={styles.noteBox}>
                  {selectedPlantPreset.description}
                </div>
              ) : null}

              {selectedPlant && !filteredCrusherUnitOptions.length ? (
                <div style={styles.readOnlyNotice}>
                  No operational line/unit is configured for the selected plant type in masters
                  yet. You can still save a plant-level report, or first add typed units in
                  `Masters`.
                </div>
              ) : null}

              {!plantOptions.length ? (
                <div style={styles.readOnlyNotice}>
                  No active plants are available from masters yet. Add a plant in the master section
                  before generating plant-unit reports.
                </div>
              ) : null}

              {!canManageCrusherReports ? (
                <div style={styles.readOnlyNotice}>
                  This role has read-only plant-report access. You can review reports here, but only
                  authorized plant roles can create or correct entries.
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={styles.formGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Report Date</span>
                    <input
                      type="date"
                      name="reportDate"
                      value={formData.reportDate}
                      onChange={handleFieldChange}
                      placeholder="Ex: 2026-04-17"
                      style={styles.input}
                    />
                    <span style={styles.inputHint}>
                      Display format: {formatDisplayDate(formData.reportDate || todayDate)} (saved as
                      YYYY-MM-DD).
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Plant / Unit</span>
                    <select
                      name="plantId"
                      value={formData.plantId}
                      onChange={handleFieldChange}
                      style={styles.input}
                    >
                      <option value="">Select plant / unit from masters</option>
                      {plantOptions.map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {plant.plantName}
                          {plant.plantType ? ` • ${plant.plantType}` : ""}
                          {!plant.isActive ? " • Inactive" : ""}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Ex: `RMC Plant 2` or `Dolamite Unit A` from the master plant list.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Shift</span>
                    <select
                      name="shift"
                      value={formData.shift}
                      onChange={handleFieldChange}
                      style={styles.input}
                      disabled={loadingMasters}
                    >
                      <option value="">Select shift from masters</option>
                      {shiftOptions.map((shift) => (
                        <option key={shift} value={shift}>
                          {shift}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Shift values are sourced only from active Masters shifts.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>{selectedPlantPreset.lineLabel}</span>
                    <select
                      name="crusherUnitName"
                      value={formData.crusherUnitName}
                      onChange={handleFieldChange}
                      style={styles.input}
                      disabled={loadingMasters}
                    >
                      <option value="">
                        {selectedPlant
                          ? `Optional ${selectedPlantPreset.linePlaceholder} from masters`
                          : "Select plant first to narrow unit options"}
                      </option>
                      {filteredCrusherUnitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      {selectedPlantPreset.lineHint}
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>{selectedPlantPreset.materialLabel}</span>
                    <select
                      name="materialType"
                      value={formData.materialType}
                      onChange={handleFieldChange}
                      style={styles.input}
                      disabled={loadingMasters}
                    >
                      <option value="">Select material from masters</option>
                      {materialOptions.map((material) => (
                        <option key={material} value={material}>
                          {material}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Ex: `20mm`, `M-Sand`, `Dolamite`, or `RMC M25` from the master materials list.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Plant Status</span>
                    <select
                      name="operationalStatus"
                      value={formData.operationalStatus}
                      onChange={handleFieldChange}
                      style={styles.input}
                    >
                      {operationalStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Use `Watch` for restricted output and `Maintenance` when stoppage is planned.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>{selectedPlantPreset.productionLabel}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="productionTons"
                      value={formData.productionTons}
                      onChange={handleFieldChange}
                      placeholder="Ex: 240"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>{selectedPlantPreset.dispatchLabel}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="dispatchTons"
                      value={formData.dispatchTons}
                      onChange={handleFieldChange}
                      placeholder="Ex: 210"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Machine Hours</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="machineHours"
                      value={formData.machineHours}
                      onChange={handleFieldChange}
                      placeholder="Ex: 8.5"
                      style={styles.input}
                    />
                  </label>

                  {selectedPowerProfile.showDiesel ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Diesel Used</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="dieselUsed"
                        value={formData.dieselUsed}
                        onChange={handleFieldChange}
                        placeholder="Ex: 115"
                        style={styles.input}
                      />
                    </label>
                  ) : null}

                  <div style={{ ...styles.noteBox, gridColumn: "1 / -1" }}>
                    Energy & utility section:
                    {" "}{selectedPowerProfile.helperText}
                  </div>

                  {selectedPowerProfile.showElectricity ? (
                    <>
                      <label style={styles.field}>
                        <span style={styles.label}>Electricity kWh</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="electricityKwh"
                          value={formData.electricityKwh}
                          onChange={handleFieldChange}
                        placeholder="Ex: 480"
                        style={styles.input}
                      />
                      <span style={styles.inputHint}>
                        If left blank, units are auto-derived from Opening Meter and Closing Meter.
                      </span>
                      {formData.electricityKwh === "" && autoCalculatedElectricityKwh !== "" ? (
                        <span style={styles.calculatedValueHint}>
                          Derived value: {autoCalculatedElectricityKwh} kWh
                        </span>
                      ) : null}
                    </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Opening Meter</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="electricityOpeningReading"
                          value={formData.electricityOpeningReading}
                          onChange={handleFieldChange}
                          placeholder="Ex: 12450"
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Closing Meter</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="electricityClosingReading"
                          value={formData.electricityClosingReading}
                          onChange={handleFieldChange}
                          placeholder="Ex: 12930"
                          style={styles.input}
                        />
                      </label>
                    </>
                  ) : null}

                  {selectedPowerProfile.showDiesel ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Diesel Rate / Litre</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="dieselRatePerLitre"
                        value={formData.dieselRatePerLitre}
                        onChange={handleFieldChange}
                        placeholder="Ex: 92.4"
                        style={styles.input}
                      />
                    </label>
                  ) : null}

                  {selectedPowerProfile.showElectricity ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Electricity Rate / kWh</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="electricityRatePerKwh"
                        value={formData.electricityRatePerKwh}
                        onChange={handleFieldChange}
                        placeholder="Ex: 8.2"
                        style={styles.input}
                      />
                    </label>
                  ) : null}

                  {selectedPlantPreset.showDowntimeFields ? (
                    <label style={styles.field}>
                      <span style={styles.label}>{selectedPlantPreset.downtimeHoursLabel}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="breakdownHours"
                        value={formData.breakdownHours}
                        onChange={handleFieldChange}
                        placeholder="Ex: 1.5"
                        style={styles.input}
                      />
                    </label>
                  ) : null}

                  {selectedPlantPreset.showStockFields ? (
                    <>
                      <label style={styles.field}>
                        <span style={styles.label}>Opening Stock Tons</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="openingStockTons"
                          value={formData.openingStockTons}
                          onChange={handleFieldChange}
                          placeholder="Ex: 75"
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Closing Stock Tons</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="closingStockTons"
                          value={formData.closingStockTons}
                          onChange={handleFieldChange}
                          placeholder="Ex: 52"
                          style={styles.input}
                        />
                      </label>
                    </>
                  ) : null}

                  <label style={styles.field}>
                    <span style={styles.label}>Operators Count</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      name="operatorsCount"
                      value={formData.operatorsCount}
                      onChange={handleFieldChange}
                      placeholder="Ex: 6"
                      style={styles.input}
                    />
                  </label>

                  {selectedPlantPreset.showDowntimeFields ? (
                    <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                      <span style={styles.label}>{selectedPlantPreset.downtimeReasonLabel}</span>
                      <textarea
                        name="downtimeReason"
                        value={formData.downtimeReason}
                        onChange={handleFieldChange}
                        placeholder="Ex: Jaw plate change, feeder jam, power trip"
                        style={{ ...styles.input, ...styles.textareaCompact }}
                      />
                    </label>
                  ) : null}

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Maintenance Notes</span>
                    <textarea
                      name="maintenanceNotes"
                      value={formData.maintenanceNotes}
                      onChange={handleFieldChange}
                      placeholder="Ex: Preventive greasing completed, belt aligned"
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Expense Remarks</span>
                    <textarea
                      name="expenseRemarks"
                      value={formData.expenseRemarks}
                      onChange={handleFieldChange}
                      placeholder="Ex: Extra mechanic visit and emergency welding"
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <div style={{ ...styles.noteBox, gridColumn: "1 / -1" }}>
                    Expense section:
                    {" "}capture direct operating spend so the report can double as a daily operating-cost sheet without leaving this workspace.
                    {" "}Total Expense is auto-calculated from Diesel Cost + Electricity Cost + Labour Expense + Maintenance Expense + Other Expense.
                  </div>

                  <div style={styles.expensePreviewRow}>
                    <span style={styles.expensePreviewChip}>
                      <span style={styles.expensePreviewLabel}>Diesel (effective)</span>
                      <strong style={styles.expensePreviewValue}>
                        {formatCurrencyValue(autoCalculatedDieselCost)}
                      </strong>
                    </span>
                    <span style={styles.expensePreviewChip}>
                      <span style={styles.expensePreviewLabel}>Electricity (effective)</span>
                      <strong style={styles.expensePreviewValue}>
                        {formatCurrencyValue(autoCalculatedElectricityCost)}
                      </strong>
                    </span>
                    <span style={styles.expensePreviewChip}>
                      <span style={styles.expensePreviewLabel}>Total Expense</span>
                      <strong style={styles.expensePreviewTotalValue}>
                        {formatCurrencyValue(autoCalculatedTotalExpense)}
                      </strong>
                    </span>
                  </div>

                  {selectedPowerProfile.showDiesel ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Diesel Cost</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="dieselCost"
                        value={formData.dieselCost}
                        onChange={handleFieldChange}
                        placeholder="Ex: 10626"
                        style={styles.input}
                      />
                      <span style={styles.inputHint}>
                        Auto-derived from Diesel Used × Diesel Rate when left blank.
                      </span>
                      {formData.dieselCost === "" && autoCalculatedDieselCost !== "" ? (
                        <span style={styles.calculatedValueHint}>
                          Derived value: {formatCurrencyValue(autoCalculatedDieselCost)}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {selectedPowerProfile.showElectricity ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Electricity Cost</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="electricityCost"
                        value={formData.electricityCost}
                        onChange={handleFieldChange}
                        placeholder="Ex: 3936"
                        style={styles.input}
                      />
                      <span style={styles.inputHint}>
                        Auto-derived from Electricity kWh × Electricity Rate when left blank.
                      </span>
                      {formData.electricityCost === "" && autoCalculatedElectricityCost !== "" ? (
                        <span style={styles.calculatedValueHint}>
                          Derived value: {formatCurrencyValue(autoCalculatedElectricityCost)}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  <label style={styles.field}>
                    <span style={styles.label}>Labour Expense</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="labourExpense"
                      value={formData.labourExpense}
                      onChange={handleFieldChange}
                      placeholder="Ex: 8500"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Maintenance Expense</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="maintenanceExpense"
                      value={formData.maintenanceExpense}
                      onChange={handleFieldChange}
                      placeholder="Ex: 4200"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Other Expense</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="otherExpense"
                      value={formData.otherExpense}
                      onChange={handleFieldChange}
                      placeholder="Ex: 1800"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Total Expense</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="totalExpense"
                      value={autoCalculatedTotalExpense}
                      readOnly
                      placeholder="Ex: 29062"
                      style={{ ...styles.input, ...styles.readOnlyInput, ...styles.readOnlyTotalInput }}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Remarks</span>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleFieldChange}
                      placeholder="Ex: Output steady after lunch shift, no safety incidents reported"
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <div style={styles.buttonRow}>
                    <button
                      type="submit"
                      style={styles.button}
                      disabled={loading || !plantOptions.length}
                    >
                      {loading
                        ? editingReportId
                          ? "Updating..."
                          : "Saving..."
                        : editingReportId
                          ? "Update Plant Report"
                          : "Add Plant Report"}
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={resetForm}
                      disabled={loading}
                    >
                      {editingReportId ? "Cancel Edit" : "Reset Form"}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <CollapsedNote text="The form is hidden. Show it when you need to add or correct a plant report." />
          )}
        </SectionCard>

        <SectionCard title="Plants & Units Daily Reports">
          <SectionToolbar
            visible={sectionVisibility.reports}
            onToggle={() => toggleSection("reports")}
          />
          {sectionVisibility.reports ? (
            loadingReports ? (
              <EmptyState
                title="Refreshing plant reports"
                text="The workspace is loading the latest filtered plant activity."
              />
            ) : normalizedReports.length === 0 ? (
              <EmptyState
                title="No plant reports match the current view"
                text="Clear filters, widen the date range, or add a new shift report so plant performance can be tracked reliably."
              />
            ) : (
              <div style={styles.reportSection}>
                <div style={styles.paginationRow}>
                  <span style={styles.paginationText}>
                    Page {pagination.page} of {Math.max(pagination.totalPages || 1, 1)} •{" "}
                    {pagination.total} matching reports
                  </span>
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      disabled={!pagination.hasPreviousPage || loadingReports}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() =>
                        setPage((current) =>
                          Math.min(current + 1, Math.max(pagination.totalPages || 1, 1))
                        )
                      }
                      disabled={!pagination.hasNextPage || loadingReports}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Shift / Unit</th>
                        <th style={styles.th}>Material</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Production</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedReports.map((report) => (
                        <CrusherReportRow
                          key={report.id}
                          report={report}
                          isExpanded={expandedReportId === report.id}
                          canManage={canManageCrusherReports}
                          onToggleExpand={() =>
                            setExpandedReportId((current) =>
                              current === report.id ? null : report.id
                            )
                          }
                          onEdit={() => handleEditReport(report)}
                          onDelete={() => handleDeleteReport(report)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <CollapsedNote text="The plant report table is hidden. Show it when you want to review entries." />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function CrusherReportRow({
  report,
  isExpanded,
  canManage,
  onToggleExpand,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <tr>
        <td style={styles.td}>{formatDisplayDate(report.reportDateValue)}</td>
        <td style={styles.td}>
          <div style={styles.tableStack}>
            <strong>{getReportDisplayName(report)}</strong>
            <span style={styles.mutedText}>
              {report.plantName && report.crusherUnitName && report.crusherUnitName !== report.plantName
                ? `${report.crusherUnitName} • `
                : ""}
              {report.shift || "-"}
            </span>
          </div>
        </td>
        <td style={styles.td}>{report.materialType}</td>
        <td style={styles.td}>
          <span
            style={{
              ...styles.statusBadge,
              ...(styles[`status${normalizeStatusStyleKey(report.operationalStatus)}`] || {}),
            }}
          >
            {formatStatusLabel(report.operationalStatus)}
          </span>
        </td>
        <td style={styles.td}>
          <div style={styles.tableStack}>
            <strong>{formatCompactNumber(report.productionTons)} tons</strong>
            <span style={styles.mutedText}>
              {formatCompactNumber(getRatio(report.productionTons, report.machineHours))} t/hr
            </span>
          </div>
        </td>
        <td style={styles.td}>
          <div style={styles.rowActionGroup}>
            <button type="button" style={styles.smallButton} onClick={onToggleExpand}>
              {isExpanded ? "Less" : "More"}
            </button>
            {canManage ? (
              <>
                <button type="button" style={styles.smallButton} onClick={onEdit}>
                  Edit
                </button>
                <button type="button" style={styles.smallButtonDanger} onClick={onDelete}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </td>
      </tr>
      {isExpanded ? (
        <tr>
          <td colSpan={6} style={styles.expandedCell}>
            <div style={styles.expandedGrid}>
              <DetailCard label="Plant / Unit" value={getReportDisplayName(report)} />
              <DetailCard
                label="Operational Line"
                value={
                  report.crusherUnitName && report.crusherUnitName !== report.plantName
                    ? report.crusherUnitName
                    : "-"
                }
              />
              <DetailCard label="Dispatch Tons" value={formatCompactNumber(report.dispatchTons)} />
              <DetailCard label="Machine Hours" value={formatCompactNumber(report.machineHours)} />
              <DetailCard label="Diesel Used" value={formatCompactNumber(report.dieselUsed)} />
              <DetailCard
                label="Electricity kWh"
                value={report.electricityKwh ? formatCompactNumber(report.electricityKwh) : "-"}
              />
              <DetailCard
                label="Meter Reading"
                value={
                  report.electricityOpeningReading !== null || report.electricityClosingReading !== null
                    ? `${report.electricityOpeningReading ?? "-"} / ${report.electricityClosingReading ?? "-"}`
                    : "-"
                }
              />
              <DetailCard
                label="Energy Cost"
                value={`${report.dieselCost ?? "-"} diesel / ${report.electricityCost ?? "-"} power`}
              />
              <DetailCard
                label="Breakdown Hours"
                value={report.breakdownHours === null ? "-" : formatCompactNumber(report.breakdownHours)}
              />
              <DetailCard
                label="Opening / Closing Stock"
                value={`${report.openingStockTons ?? "-"} / ${report.closingStockTons ?? "-"}`}
              />
              <DetailCard
                label="Operators Count"
                value={report.operatorsCount === null ? "-" : String(report.operatorsCount)}
              />
              <DetailCard
                label="Expense Stack"
                value={`${report.labourExpense ?? "-"} labour / ${report.maintenanceExpense ?? "-"} maintenance / ${report.otherExpense ?? "-"} other`}
              />
              <DetailCard
                label="Total Expense"
                value={report.totalExpense === null ? "-" : formatCompactNumber(report.totalExpense)}
              />
              <DetailCard label="Downtime Reason" value={report.downtimeReason || "-"} />
              <DetailCard label="Maintenance Notes" value={report.maintenanceNotes || "-"} />
              <DetailCard label="Expense Remarks" value={report.expenseRemarks || "-"} />
              <DetailCard label="Remarks" value={report.remarks || "-"} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailCard({ label, value }) {
  return (
    <div style={styles.detailCard}>
      <span style={styles.detailLabel}>{label}</span>
      <p style={styles.detailValue}>{value}</p>
    </div>
  );
}

function SectionToolbar({ visible, onToggle }) {
  return (
    <div style={styles.sectionToolbar}>
      <button type="button" style={styles.toggleButton} onClick={onToggle}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function SignalPill({ label, value }) {
  return (
    <div style={styles.heroPill}>
      <span style={styles.heroPillLabel}>{label}</span>
      <strong style={styles.heroPillValue}>{value}</strong>
    </div>
  );
}

function MetricCard({ tone, tag, label, value }) {
  return (
    <div style={{ ...styles.summaryCard, ...(styles[`summary${tone}`] || {}) }}>
      <span style={styles.summaryTag}>{tag}</span>
      <p style={styles.summaryLabel}>{label}</p>
      <h3 style={styles.summaryValue}>{value}</h3>
    </div>
  );
}

function InsightStat({ label, value, note }) {
  return (
    <div style={styles.insightCard}>
      <span style={styles.insightLabel}>{label}</span>
      <strong style={styles.insightValue}>{value}</strong>
      <p style={styles.insightNote}>{note}</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div style={styles.emptyState}>
      <strong style={styles.emptyStateTitle}>{title}</strong>
      <p style={styles.emptyStateText}>{text}</p>
    </div>
  );
}

function CollapsedNote({ text }) {
  return <div style={styles.collapsedNote}>{text}</div>;
}

const uniqStrings = (values) =>
  Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()))).sort();

const normalizeShiftKey = (value) => String(value || "").trim().toLowerCase();

const normalizePlantTypeLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const getPlantReportPreset = (plantType) => {
  const normalized = normalizePlantTypeLabel(plantType);

  if (!normalized) {
    return {
      lineLabel: "Operational Line / Unit",
      linePlaceholder: "unit line",
      lineHint:
        "Ex: `Primary Line 1` or `Batching Line B`. Leave blank when one report covers the full plant.",
      materialLabel: "Material / Output Type",
      productionLabel: "Production Tons",
      dispatchLabel: "Dispatch Tons",
      showStockFields: true,
      showDowntimeFields: true,
      downtimeHoursLabel: "Downtime Hours",
      downtimeReasonLabel: "Downtime Reason",
      description:
        "Select a plant to narrow operational lines and adjust the reporting layout for the chosen plant type.",
    };
  }

  if (
    normalized.includes("rmc") ||
    normalized.includes("ready mix") ||
    normalized.includes("easy mix") ||
    normalized.includes("eazy mix") ||
    normalized.includes("batch")
  ) {
    return {
      lineLabel: "Batching Line / Unit",
      linePlaceholder: "batching line",
      lineHint:
        "Ex: `Batching Line A` or `Transit Mixer Bay 2`. Leave blank when the report is for the whole plant.",
      materialLabel: "Concrete / Mix Grade",
      productionLabel: "Production Output",
      dispatchLabel: "Dispatch / Delivery Output",
      showStockFields: false,
      showDowntimeFields: true,
      downtimeHoursLabel: "Stoppage Hours",
      downtimeReasonLabel: "Stoppage / Breakdown Reason",
      description:
        "This layout is tuned for mix or batching operations, so the form emphasizes plant output, stoppages, crew, energy, and operating cost.",
    };
  }

  if (
    normalized.includes("crusher") ||
    normalized.includes("dolamite") ||
    normalized.includes("dolomite") ||
    normalized.includes("stone") ||
    normalized.includes("aggregate")
  ) {
    return {
      lineLabel: "Crusher Line / Unit",
      linePlaceholder: "crusher line",
      lineHint:
        "Ex: `Primary Crusher 1` or `Secondary Line B`. Leave blank when the full crusher plant is being reported.",
      materialLabel: "Material Type",
      productionLabel: "Production Tons",
      dispatchLabel: "Dispatch Tons",
      showStockFields: true,
      showDowntimeFields: true,
      downtimeHoursLabel: "Breakdown Hours",
      downtimeReasonLabel: "Downtime Reason",
      description:
        "This layout is tuned for crushing and mineral processing plants, so stock, breakdown, and line-level operating detail stay visible.",
    };
  }

  return {
    lineLabel: "Operational Line / Unit",
    linePlaceholder: "unit line",
    lineHint:
      "Choose the line or internal unit only when the selected plant has multiple reportable operating lines.",
    materialLabel: "Material / Output Type",
    productionLabel: "Production Output",
    dispatchLabel: "Dispatch Output",
    showStockFields: false,
    showDowntimeFields: true,
    downtimeHoursLabel: "Downtime Hours",
    downtimeReasonLabel: "Downtime Reason",
    description:
      "This layout stays general-purpose so future plant types can still report daily output, downtime, energy, and expense cleanly.",
  };
};

const getPowerProfile = (powerSourceType) => {
  const normalized = normalizePlantTypeLabel(powerSourceType);

  if (!normalized) {
    return {
      showDiesel: true,
      showElectricity: true,
      helperText:
        "Use diesel for generator-operated units, electricity readings for grid-powered plants, or both when the plant runs hybrid operations.",
    };
  }

  const showDiesel =
    normalized.includes("diesel") ||
    normalized.includes("generator") ||
    normalized.includes("dg") ||
    normalized.includes("hybrid");
  const showElectricity =
    normalized.includes("electric") ||
    normalized.includes("grid") ||
    normalized.includes("mains") ||
    normalized.includes("hybrid");

  return {
    showDiesel: showDiesel || (!showDiesel && !showElectricity),
    showElectricity: showElectricity || (!showDiesel && !showElectricity),
    helperText: showDiesel && showElectricity
      ? "This plant is configured as hybrid, so both diesel and electricity sections are available."
      : showElectricity
        ? "This plant is configured as electric or grid-powered, so the electricity section stays visible."
        : showDiesel
          ? "This plant is configured as diesel-powered, so the diesel section stays visible."
          : "The configured power source is custom, so diesel and electricity can both be entered if needed.",
  };
};

const getReportDisplayName = (report) =>
  report?.plantName || report?.crusherUnitName || "Unknown Unit";

const toNonNegativeNumericOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
};

const calculateDerivedElectricityKwhInput = (
  electricityKwhValue,
  openingReadingValue,
  closingReadingValue
) => {
  const explicitKwh = toNonNegativeNumericOrNull(electricityKwhValue);
  if (explicitKwh !== null) {
    return String(Number(explicitKwh.toFixed(2)));
  }

  const opening = toNonNegativeNumericOrNull(openingReadingValue);
  const closing = toNonNegativeNumericOrNull(closingReadingValue);

  if (opening === null || closing === null || closing < opening) {
    return "";
  }

  return String(Number((closing - opening).toFixed(2)));
};

const calculateDerivedCostInput = (explicitCostValue, quantityValue, rateValue) => {
  const explicitCost = toNonNegativeNumericOrNull(explicitCostValue);
  if (explicitCost !== null) {
    return String(Number(explicitCost.toFixed(2)));
  }

  const quantity = toNonNegativeNumericOrNull(quantityValue);
  const rate = toNonNegativeNumericOrNull(rateValue);

  if (quantity === null || rate === null) {
    return "";
  }

  return String(Number((quantity * rate).toFixed(2)));
};

const calculateTotalExpenseInput = (values = []) => {
  const numericValues = values
    .map((value) => toNonNegativeNumericOrNull(value))
    .filter((value) => value !== null);

  if (!numericValues.length) {
    return "";
  }

  return String(Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(2)));
};

const buildSummary = (reports) => ({
  total: reports.length,
  totalProduction: reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0),
  totalDispatch: reports.reduce((sum, report) => sum + Number(report.dispatchTons || 0), 0),
  totalDiesel: reports.reduce((sum, report) => sum + Number(report.dieselUsed || 0), 0),
  totalElectricityKwh: reports.reduce(
    (sum, report) => sum + Number(report.electricityKwh || 0),
    0
  ),
  totalElectricityCost: reports.reduce(
    (sum, report) => sum + Number(report.electricityCost || 0),
    0
  ),
  totalExpense: reports.reduce((sum, report) => sum + Number(report.totalExpense || 0), 0),
  totalMachineHours: reports.reduce((sum, report) => sum + Number(report.machineHours || 0), 0),
  totalBreakdownHours: reports.reduce(
    (sum, report) => sum + Number(report.breakdownHours || 0),
    0
  ),
  uniqueUnits: new Set(reports.map((report) => getReportDisplayName(report)).filter(Boolean)).size,
  uniqueMaterials: new Set(reports.map((report) => report.materialType).filter(Boolean)).size,
  latestDate: reports.reduce(
    (current, report) => (report.reportDateValue > current ? report.reportDateValue : current),
    ""
  ),
  averageProductionPerReport: reports.length
    ? reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0) / reports.length
    : 0,
  tonsPerMachineHour: getRatio(
    reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0),
    reports.reduce((sum, report) => sum + Number(report.machineHours || 0), 0)
  ),
  dieselPerTon: getRatio(
    reports.reduce((sum, report) => sum + Number(report.dieselUsed || 0), 0),
    reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0)
  ),
  electricityPerTon: getRatio(
    reports.reduce((sum, report) => sum + Number(report.electricityKwh || 0), 0),
    reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0)
  ),
  expensePerTon: getRatio(
    reports.reduce((sum, report) => sum + Number(report.totalExpense || 0), 0),
    reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0)
  ),
  dispatchVsProduction:
    reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0) > 0
      ? (reports.reduce((sum, report) => sum + Number(report.dispatchTons || 0), 0) /
          reports.reduce((sum, report) => sum + Number(report.productionTons || 0), 0)) *
        100
      : 0,
  topUnitName:
    Array.from(
      reports.reduce((map, report) => {
        const key = getReportDisplayName(report);
        map.set(key, (map.get(key) || 0) + Number(report.productionTons || 0));
        return map;
      }, new Map()).entries()
    ).sort((left, right) => right[1] - left[1])[0]?.[0] || "",
});

const formatCompactNumber = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
};

const formatCurrencyValue = (value) => {
  const numeric = toNonNegativeNumericOrNull(value);
  if (numeric === null) {
    return "INR 0.00";
  }

  return `INR ${numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getRatio = (numerator, denominator) => {
  const normalizedDenominator = Number(denominator || 0);
  if (!normalizedDenominator) return 0;
  return Number((Number(numerator || 0) / normalizedDenominator).toFixed(2));
};

const formatStatusLabel = (value) => {
  if (!value) return "Not Set";
  return String(value)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeStatusStyleKey = (value) =>
  String(value || "neutral").replace(/[^a-zA-Z0-9]/g, "");

const escapeCsvValue = (value) => {
  const normalizedValue = String(value ?? "");
  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }
  return normalizedValue;
};

const buildCsv = (rows) => {
  if (!rows.length) {
    return "report_date,shift,crusher_unit,material_type,operational_status,production_tons,dispatch_tons,machine_hours,diesel_used,breakdown_hours,opening_stock_tons,closing_stock_tons,operators_count,downtime_reason,maintenance_notes,remarks\n";
  }

  const headers = Object.keys(rows[0]);
  return `${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n")}\n`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseCrusherQuery = (searchValue) => {
  const params = new URLSearchParams(searchValue);
  const startDate = params.get("startDate") || "";
  const endDate = params.get("endDate") || "";

  return {
    search: params.get("search") || "",
    plantFilter: params.get("plantId") || "",
    shiftFilter: params.get("shift") || "",
    unitFilter: params.get("crusherUnitName") || "",
    materialFilter: params.get("materialType") || "",
    statusFilter: params.get("operationalStatus") || "",
    startDate,
    endDate,
    activeWindow: params.get("window") || (startDate || endDate ? "Custom" : "All Time"),
    page: Math.max(Number(params.get("page")) || 1, 1),
  };
};

const buildCrusherQueryString = ({
  search = "",
  plantFilter = "",
  shiftFilter = "",
  unitFilter = "",
  materialFilter = "",
  statusFilter = "",
  startDate = "",
  endDate = "",
  activeWindow = "All Time",
  page = 1,
}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (plantFilter) params.set("plantId", plantFilter);
  if (shiftFilter) params.set("shift", shiftFilter);
  if (unitFilter) params.set("crusherUnitName", unitFilter);
  if (materialFilter) params.set("materialType", materialFilter);
  if (statusFilter) params.set("operationalStatus", statusFilter);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (activeWindow && activeWindow !== "All Time") params.set("window", activeWindow);
  if (page > 1) params.set("page", String(page));
  return params.toString();
};

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "30px",
    padding: "30px",
    background:
      "radial-gradient(circle at top left, rgba(214,180,121,0.16), transparent 24%), radial-gradient(circle at bottom right, rgba(148,163,184,0.14), transparent 30%), linear-gradient(135deg, #111827 0%, #172033 46%, #1f2937 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 28px 72px rgba(15,23,42,0.18)",
  },
  heroGlowOne: {
    position: "absolute",
    top: "-90px",
    right: "-60px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(214,180,121,0.16)",
    filter: "blur(42px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-120px",
    left: "-40px",
    width: "260px",
    height: "260px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    filter: "blur(46px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)",
    gap: "22px",
    alignItems: "center",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  heroEyebrow: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    letterSpacing: "0.14em",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.02,
    fontWeight: "800",
    letterSpacing: "-0.05em",
    maxWidth: "760px",
  },
  heroText: {
    margin: 0,
    maxWidth: "720px",
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.85,
    fontSize: "15px",
  },
  heroSignalGrid: {
    display: "grid",
    gap: "12px",
  },
  heroPill: {
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "16px",
    backdropFilter: "blur(10px)",
  },
  heroPillLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "11px",
    fontWeight: "800",
    color: "rgba(255,255,255,0.68)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroPillValue: {
    fontSize: "16px",
    color: "#ffffff",
    lineHeight: 1.35,
  },
  error: {
    color: "#b91c1c",
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    border: "1px solid #fecaca",
    borderRadius: "16px",
    padding: "13px 16px",
  },
  success: {
    color: "#0f5132",
    background: "linear-gradient(135deg, #f3faf7 0%, #edf7f2 100%)",
    border: "1px solid #c7e6d6",
    borderRadius: "16px",
    padding: "13px 16px",
  },
  sectionToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "10px",
  },
  toggleButton: {
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    color: "#111827",
    fontWeight: "700",
    fontSize: "12px",
    padding: "8px 13px",
    cursor: "pointer",
  },
  collapsedNote: {
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "14px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    borderRadius: "24px",
    padding: "22px",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow: "0 16px 36px rgba(15,23,42,0.05)",
  },
  summaryslate: {
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
  },
  summarysand: {
    background: "linear-gradient(135deg, #faf7f2 0%, #f6f1e8 100%)",
  },
  summarystone: {
    background: "linear-gradient(135deg, #f7f7f2 0%, #f3f4ee 100%)",
  },
  summarypearl: {
    background: "linear-gradient(135deg, #f7f4f3 0%, #f1eeec 100%)",
  },
  summaryTag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.82)",
    color: "#1f2937",
    fontSize: "11px",
    fontWeight: "800",
    marginBottom: "12px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  summaryLabel: {
    margin: 0,
    marginBottom: "8px",
    color: "#475569",
    fontSize: "14px",
    fontWeight: "700",
  },
  summaryValue: {
    margin: 0,
    color: "#0f172a",
    fontSize: "34px",
    lineHeight: 1.05,
    fontWeight: "800",
  },
  insightRibbon: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  insightCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(180deg, #fcfcfb 0%, #ffffff 100%)",
    border: "1px solid #e7e5e4",
  },
  insightLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  insightValue: {
    display: "block",
    color: "#111827",
    fontSize: "24px",
    lineHeight: 1.15,
    fontWeight: "800",
  },
  insightNote: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  sectionSubtitle: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.8,
    maxWidth: "860px",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  filterChip: {
    padding: "10px 14px",
    border: "1px solid #d6d3d1",
    borderRadius: "999px",
    background: "#fff",
    color: "#111827",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  filterChipActive: {
    background: "#1f2937",
    color: "#fff",
    border: "1px solid #1f2937",
    boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
    alignItems: "start",
  },
  input: {
    padding: "13px 15px",
    border: "1px solid #d6d3d1",
    borderRadius: "16px",
    fontSize: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.96)",
    width: "100%",
    boxSizing: "border-box",
    color: "#111827",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  },
  readOnlyInput: {
    background: "#f5f5f4",
    color: "#1f2937",
    fontWeight: "700",
    border: "1px solid #cbd5e1",
  },
  readOnlyTotalInput: {
    fontSize: "16px",
    color: "#0f5132",
    border: "1px solid #9fd8bb",
    background: "linear-gradient(180deg, #effcf5 0%, #f7fdf9 100%)",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  analyticsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  subsectionTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "16px",
    fontWeight: "800",
  },
  focusStack: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  focusCard: {
    borderRadius: "20px",
    padding: "20px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafb 100%)",
    border: "1px solid #e7e5e4",
  },
  focusHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  focusRank: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1f2937",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "800",
    flexShrink: 0,
  },
  focusTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#111827",
    lineHeight: 1.3,
  },
  focusSubtext: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  focusMetrics: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  focusMetric: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#1f2937",
    fontSize: "12px",
    fontWeight: "700",
  },
  trendStack: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  trendRow: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) minmax(120px, 2fr) auto",
    gap: "14px",
    alignItems: "center",
  },
  trendMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  trendDate: {
    color: "#111827",
    fontSize: "14px",
  },
  trendSubtext: {
    color: "#64748b",
    fontSize: "12px",
  },
  trendBarShell: {
    width: "100%",
    height: "14px",
    borderRadius: "999px",
    background: "#e5e7eb",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #334155 0%, #a16207 100%)",
  },
  trendValue: {
    color: "#111827",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  attentionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
  },
  attentionCard: {
    borderRadius: "20px",
    padding: "20px",
    background: "linear-gradient(180deg, #fbfaf8 0%, #ffffff 100%)",
    border: "1px solid #e7ded1",
  },
  attentionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  attentionDate: {
    color: "#8a6a3d",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  attentionProject: {
    color: "#111827",
    fontSize: "16px",
  },
  attentionSite: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  flagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  flag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fffdfa",
    border: "1px solid #e7ded1",
    color: "#7c5e36",
    fontSize: "12px",
    fontWeight: "700",
  },
  noteBox: {
    background: "linear-gradient(135deg, #f7f8fa 0%, #fbfbfc 100%)",
    color: "#334155",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #dbe2ea",
    fontSize: "14px",
    marginBottom: "14px",
    lineHeight: 1.7,
  },
  expensePreviewRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },
  expensePreviewChip: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    borderRadius: "14px",
    border: "1px solid #dbe2ea",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    padding: "10px 12px",
  },
  expensePreviewLabel: {
    color: "#64748b",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: "700",
  },
  expensePreviewValue: {
    color: "#1f2937",
    fontSize: "14px",
  },
  expensePreviewTotalValue: {
    color: "#0f5132",
    fontSize: "15px",
  },
  readOnlyNotice: {
    background: "linear-gradient(135deg, #faf7f2 0%, #fcfbf8 100%)",
    color: "#7c5e36",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #e7ded1",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  advisoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  advisoryCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
  },
  advisoryEyebrow: {
    display: "block",
    marginBottom: "8px",
    color: "#8a6a2f",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  advisoryTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: "15px",
    lineHeight: 1.4,
    marginBottom: "6px",
  },
  advisoryText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  inputHint: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  calculatedValueHint: {
    color: "#0f5132",
    fontSize: "12px",
    fontWeight: "700",
  },
  textareaCompact: {
    minHeight: "84px",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  button: {
    padding: "13px 20px",
    border: "none",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #111827 0%, #273449 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "800",
    letterSpacing: "0.01em",
    boxShadow: "0 14px 28px rgba(15,23,42,0.12)",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.96)",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
  },
  smallButton: {
    padding: "8px 11px",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.96)",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
  },
  smallButtonDanger: {
    padding: "8px 11px",
    border: "1px solid #fecaca",
    borderRadius: "999px",
    background: "#fcf2f1",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
  },
  emptyState: {
    padding: "20px",
    borderRadius: "18px",
    border: "1px dashed #cbd5e1",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
  },
  emptyStateTitle: {
    display: "block",
    marginBottom: "8px",
    color: "#0f172a",
    fontSize: "15px",
  },
  emptyStateText: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  reportSection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  paginationText: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 14px 32px rgba(15,23,42,0.04)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px 14px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  tableStack: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  mutedText: {
    color: "#64748b",
    fontSize: "12px",
  },
  statusBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  statusrunning: {
    background: "#edf7f2",
    color: "#2f5d47",
  },
  statuswatch: {
    background: "#faf3e6",
    color: "#8a6a3d",
  },
  statusbreakdown: {
    background: "#f8ecea",
    color: "#8c3c36",
  },
  statusmaintenance: {
    background: "#eef2f7",
    color: "#3f5268",
  },
  statusclosed: {
    background: "#f1f5f9",
    color: "#475569",
  },
  statusneutral: {
    background: "#eef1f4",
    color: "#475569",
  },
  rowActionGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  expandedCell: {
    padding: "0 14px 16px",
    background: "#fcfcfb",
    borderBottom: "1px solid #f1f5f9",
  },
  expandedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  detailCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfbfa 100%)",
    border: "1px solid #e7e5e4",
  },
  detailLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  detailValue: {
    margin: 0,
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
  },
};

export default CrusherReportsPage;
