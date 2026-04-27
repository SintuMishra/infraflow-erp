import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getCachedResource } from "../services/clientCache";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useMasters } from "../hooks/useMasters";
import { useAuth } from "../hooks/useAuth";
import { isCrusherPlantType } from "../utils/plantClassification";
import { formatDisplayDate } from "../utils/date";
import {
  getTimestampFileLabel,
  getTodayDateValue,
  parseDateOnlyValue,
  toDateOnlyValue,
} from "../utils/date";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const formatCurrency = (value) =>
  `INR ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))}`;
const QUANTITY_SOURCE_OPTIONS = [
  { value: "weighbridge", label: "Weighbridge" },
  { value: "manual_weight", label: "Manual Weight" },
  { value: "manual_volume", label: "Manual Volume" },
  { value: "vehicle_capacity", label: "Vehicle Capacity" },
  { value: "trip_estimate", label: "Trip Estimate" },
];
const ALL_SOURCE_TYPES = ["Crusher", "Project", "Plant", "Store"];
const TON_UNIT_CODES = new Set(["TON", "MT"]);
const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const roundMetric = (value, digits = 3) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const buildNormalizedKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

const getLoadingBasisLabel = (basis) => {
  if (basis === "none") return "No Loading";
  if (basis === "per_ton") return "Per Ton";
  if (basis === "per_brass") return "Per Brass";
  if (basis === "per_trip") return "Per Trip / Load";
  return "Fixed Per Dispatch";
};

const formatLoadingRateLabel = (basis, rate) => {
  const amount = Number(rate || 0);

  if (basis === "none" || amount <= 0) {
    return "No loading default";
  }

  if (basis === "per_ton") {
    return `${amount.toFixed(2)} / ton`;
  }

  if (basis === "per_brass") {
    return `${amount.toFixed(2)} / brass`;
  }

  if (basis === "per_trip") {
    return `${amount.toFixed(2)} / trip`;
  }

  return `${amount.toFixed(2)} / dispatch`;
};

const calculateBillableRateUnits = ({
  quantityTons,
  materialRateUnit,
  materialRateUnitsPerTon,
}) => {
  const quantity = Number(quantityTons || 0);
  const unitsPerTon = Number(materialRateUnitsPerTon || 1);
  const rawBillableUnits = quantity * unitsPerTon;

  if (materialRateUnit === "per_trip") {
    return Math.max(0, Math.ceil(rawBillableUnits - 1e-9));
  }

  return rawBillableUnits;
};
const getRateUnitLabel = (rate) => {
  const safeRate = rate || {};
  if (safeRate.rateUnit === "per_cft") return safeRate.rateUnitLabel || "CFT";
  if (safeRate.rateUnit === "per_metric_ton") return safeRate.rateUnitLabel || "metric ton";
  if (safeRate.rateUnit === "per_brass") return safeRate.rateUnitLabel || "brass";
  if (safeRate.rateUnit === "per_cubic_meter") return safeRate.rateUnitLabel || "cubic meter";
  if (safeRate.rateUnit === "per_trip") return safeRate.rateUnitLabel || "trip";
  if (safeRate.rateUnit === "other") return safeRate.rateUnitLabel || "custom unit";
  return safeRate.rateUnitLabel || "ton";
};
const getFriendlyBasisLabel = (basis) => {
  if (basis === "per_ton" || basis === "per_metric_ton") return "Per Ton";
  if (basis === "per_brass") return "Per Brass";
  if (basis === "per_cft") return "Per CFT";
  if (basis === "per_cubic_meter") return "Per Cubic Meter";
  if (basis === "per_trip") return "Per Trip";
  if (basis === "per_day") return "Per Day";
  if (basis === "per_km") return "Per KM";
  if (basis === "fixed") return "Fixed";
  if (basis === "other") return "Custom";
  if (basis === "none") return "Not Applicable";
  return basis ? String(basis).replace(/_/g, " ") : "Pending";
};
const isDifferentNumber = (left, right, tolerance = 0.01) =>
  Math.abs(Number(left || 0) - Number(right || 0)) >= tolerance;
const toComparableDateOnly = (value) => {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};
const compareEffectiveRatePriority = (left, right) => {
  const leftDate = toComparableDateOnly(left?.effectiveFrom) || "";
  const rightDate = toComparableDateOnly(right?.effectiveFrom) || "";

  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
};
const getCommercialRefreshMessage = (report, billingPreview) => {
  if (!report || !billingPreview?.hasPartyRate) {
    return "";
  }

  const differences = [];

  if (
    String(report.materialRateUnit || "per_ton") !==
      String(billingPreview.materialRateUnit || "per_ton") ||
    String(report.materialRateUnitLabel || "ton") !==
      String(billingPreview.materialRateUnitLabel || "ton") ||
    isDifferentNumber(report.materialRatePerTon, billingPreview.materialRatePerTon) ||
    isDifferentNumber(
      report.materialRateUnitsPerTon ?? 1,
      billingPreview.materialRateUnitsPerTon ?? 1,
      0.0001
    )
  ) {
    differences.push(
      `material ${Number(report.materialRatePerTon || 0).toFixed(2)} / ${
        report.materialRateUnitLabel || "ton"
      } -> ${Number(billingPreview.materialRatePerTon || 0).toFixed(2)} / ${
        billingPreview.materialRateUnitLabel || "ton"
      }`
    );
  }

  if (
    String(report.royaltyMode || "none") !== String(billingPreview.royaltyMode || "none") ||
    isDifferentNumber(report.royaltyValue, billingPreview.royaltyValue) ||
    isDifferentNumber(report.royaltyAmount, billingPreview.royaltyAmount) ||
    isDifferentNumber(report.royaltyTonsPerBrass, billingPreview.tonsPerBrass, 0.0001)
  ) {
    differences.push(
      `royalty ${String(report.royaltyMode || "none").replace(/_/g, " ")} ${
        Number(report.royaltyValue || 0).toFixed(2)
      } -> ${String(billingPreview.royaltyMode || "none").replace(/_/g, " ")} ${
        Number(billingPreview.royaltyValue || 0).toFixed(2)
      }`
    );
  }

  if (
    String(report.loadingChargeBasis || "fixed") !==
      String(billingPreview.loadingChargeBasis || "fixed") ||
    isDifferentNumber(report.loadingChargeRate, billingPreview.loadingChargeRate) ||
    isDifferentNumber(report.loadingCharge, billingPreview.loadingCharge)
  ) {
    differences.push(
      `loading ${Number(report.loadingCharge || 0).toFixed(2)} (${String(
        report.loadingChargeBasis || "fixed"
      ).replace(/_/g, " ")}) -> ${Number(billingPreview.loadingCharge || 0).toFixed(2)} (${String(
        billingPreview.loadingChargeBasis || "fixed"
      ).replace(/_/g, " ")})`
    );
  }

  if (!differences.length) {
    return "";
  }

  return `Saved dispatch billing is using an older commercial snapshot. Saving now will refresh ${differences.join(" | ")}.`;
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? "");

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const buildCsv = (rows) => {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");
};

const getRecommendedSourceType = (plantType) =>
  isCrusherPlantType(plantType) ? "Crusher" : "Plant";

const getSourceTypeOptions = (plantType) => {
  const recommended = getRecommendedSourceType(plantType);
  const options = [recommended, "Project", "Store"];

  if (recommended !== "Plant") {
    options.push("Plant");
  }

  if (recommended !== "Crusher") {
    options.push("Crusher");
  }

  return Array.from(new Set(options));
};

const getDispatchCompletionMissingItems = (report) => {
  const missingItems = [];

  if (!String(report?.invoiceDate || "").trim()) {
    missingItems.push("invoice date");
  }

  if (!(Number(report?.totalInvoiceValue ?? report?.invoiceValue ?? 0) > 0)) {
    missingItems.push("positive taxable invoice value");
  }

  return missingItems;
};

const getDispatchCompletionBlockMessage = (report) => {
  const missingItems = getDispatchCompletionMissingItems(report);

  if (!missingItems.length) {
    return "";
  }

  return `Complete the ${missingItems.join(", ")} before marking this dispatch as completed.`;
};

const getDispatchCompletionReadyMessage = (report) => {
  if (!String(report?.invoiceNumber || "").trim()) {
    return "Ready to complete. Invoice number will be auto-generated on completion.";
  }

  return "Ready to complete";
};

const getCompletionReadinessMeta = (report) => {
  const missingItems = getDispatchCompletionMissingItems(report);

  if (!missingItems.length) {
    return {
      isReady: true,
      pillLabel: "Ready",
      detail: getDispatchCompletionReadyMessage(report),
    };
  }

  return {
    isReady: false,
    pillLabel: `Blocked (${missingItems.length})`,
    detail: `Missing: ${missingItems.join(", ")}`,
  };
};

const getQuantitySourceLabel = (value) =>
  QUANTITY_SOURCE_OPTIONS.find((option) => option.value === value)?.label || "Legacy Tons";

const WarningList = ({ warnings, tone = "warn" }) => {
  if (!warnings.length) {
    return null;
  }

  return (
    <div
      style={{
        ...styles.warningPanel,
        ...(tone === "danger" ? styles.warningPanelDanger : styles.warningPanelWarn),
      }}
    >
      {warnings.map((warning) => (
        <div key={warning} style={styles.warningItem}>
          <span style={styles.warningDot} />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
};

const createDispatchFormState = () => ({
  dispatchDate: getTodayDateValue(),
  sourceType: "",
  plantId: "",
  materialId: "",
  partyId: "",
  partyOrderId: "",
  vehicleId: "",
  transportVendorId: "",
  destinationName: "",
  quantityTons: "",
  enteredQuantity: "",
  enteredUnitId: "",
  quantitySource: "",
  remarks: "",
  ewbNumber: "",
  ewbDate: "",
  ewbValidUpto: "",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceValue: "",
  distanceKm: "",
  otherCharge: "",
  loadingCharge: "",
  loadingChargeManual: false,
  billingNotes: "",
});

function DispatchReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const hasAppliedPrefillRef = useRef(false);
  const focusedDispatchIdRef = useRef("");
  const {
    masters,
    loadingMasters,
    refreshingMasters,
    mastersError,
    mastersLoadedAt,
  } = useMasters();

  const [reports, setReports] = useState([]);
  const [plants, setPlants] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [partyRates, setPartyRates] = useState([]);
  const [transportRates, setTransportRates] = useState([]);
  const [partyOrders, setPartyOrders] = useState([]);
  const [units, setUnits] = useState([]);
  const [materialUnitConversions, setMaterialUnitConversions] = useState([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unitsWarning, setUnitsWarning] = useState("");
  const [materialConversionsWarning, setMaterialConversionsWarning] = useState("");
  const [savedCreatePreview, setSavedCreatePreview] = useState(null);
  const [savedEditPreview, setSavedEditPreview] = useState(null);

  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [linkedOrderFilter, setLinkedOrderFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dispatchSummary, setDispatchSummary] = useState({
    totalDispatches: 0,
    totalQuantity: 0,
    totalInvoiceValue: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    linkedOrders: 0,
    unlinkedOrders: 0,
    uniquePlants: 0,
    uniqueParties: 0,
    uniqueMaterials: 0,
    latestDispatchDate: null,
  });
  const [dispatchPagination, setDispatchPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  const [showList, setShowList] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [parties, setParties] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [editVehicleSearch, setEditVehicleSearch] = useState("");

  const [formData, setFormData] = useState(createDispatchFormState);

  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState(createDispatchFormState);
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const focusDispatchId = queryParams.get("focusDispatchId") || "";

  const statusOptions = ["pending", "completed", "cancelled"];
  const canManageDispatchRecords = ["super_admin", "manager", "crusher_supervisor"].includes(
    String(currentUser?.role || "")
  );


  useEffect(() => {
    setSearch(queryParams.get("search") || "");
    setPlantFilter(queryParams.get("plantId") || "");
    setPartyFilter(queryParams.get("partyId") || "");
    setMaterialFilter(queryParams.get("materialId") || "");
    setLinkedOrderFilter(queryParams.get("linkedOrderFilter") || "");
    setSourceTypeFilter(queryParams.get("sourceType") || "");
    setStatusFilter(queryParams.get("status") || "");
    setDateFromFilter(queryParams.get("dateFrom") || "");
    setDateToFilter(queryParams.get("dateTo") || "");
    setPage(Math.max(Number(queryParams.get("page")) || 1, 1));
  }, [queryParams]);

  useEffect(() => {
    if (search || plantFilter || sourceTypeFilter || statusFilter) {
      const timeoutId = window.setTimeout(() => {
        setShowList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [search, plantFilter, sourceTypeFilter, statusFilter]);

  const loadReferenceData = useCallback(async () => {
    setIsLoadingData(true);

    try {
      const [
        plantsRes,
        vehiclesRes,
        vendorsRes,
        partiesRes,
        partyRatesRes,
        transportRatesRes,
        partyOrdersRes,
        unitsRes,
        materialConversionsRes,
      ] = await Promise.allSettled([
        getCachedResource("lookup:plants", 60_000, async () => (await api.get("/plants/lookup")).data?.data || []),
        getCachedResource("lookup:vehicles", 60_000, async () => (await api.get("/vehicles/lookup")).data?.data || []),
        getCachedResource("lookup:vendors", 60_000, async () => (await api.get("/vendors")).data?.data || []),
        getCachedResource("lookup:parties", 60_000, async () => (await api.get("/parties/lookup")).data?.data || []),
        getCachedResource("reference:party-rates", 60_000, async () => (await api.get("/party-material-rates")).data?.data || []),
        getCachedResource("reference:transport-rates", 60_000, async () => (await api.get("/transport-rates")).data?.data || []),
        getCachedResource("reference:party-orders", 60_000, async () => (await api.get("/party-orders")).data?.data || []),
        getCachedResource("reference:units", 60_000, async () => (await api.get("/masters/units")).data?.data || []),
        getCachedResource("reference:material-conversions", 60_000, async () => (await api.get("/masters/material-unit-conversions")).data?.data || []),
      ]);

      const requiredResponses = [
        plantsRes,
        vehiclesRes,
        vendorsRes,
        partiesRes,
        partyRatesRes,
        transportRatesRes,
        partyOrdersRes,
      ];
      const failedRequiredResponse = requiredResponses.find(
        (response) => response.status !== "fulfilled"
      );

      if (failedRequiredResponse) {
        throw failedRequiredResponse.reason;
      }

      setPlants(plantsRes.value);
      setVehicles(vehiclesRes.value);
      setVendors(vendorsRes.value);
      setPartyRates(partyRatesRes.value);
      setTransportRates(transportRatesRes.value);
      setPartyOrders(partyOrdersRes.value);
      setParties(partiesRes.value);

      if (unitsRes.status === "fulfilled") {
        setUnits(unitsRes.value);
        setUnitsWarning("");
      } else {
        setUnits([]);
        setUnitsWarning(
          "Unit master data could not be loaded. Legacy dispatch records still load, but unit-aware labels may be incomplete."
        );
      }

      if (materialConversionsRes.status === "fulfilled") {
        setMaterialUnitConversions(materialConversionsRes.value);
        setMaterialConversionsWarning("");
      } else {
        setMaterialUnitConversions([]);
        setMaterialConversionsWarning(
          "Material conversions could not be loaded. Manual volume preview may be limited, but legacy dispatch entry still works."
        );
      }

      setError("");
    } catch {
      setUnitsWarning("");
      setMaterialConversionsWarning("");
      setError("Failed to load dispatch data");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadReferenceData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReferenceData]);

  const loadDispatchReports = useCallback(async (currentPage = page) => {
    setIsLoadingData(true);

    try {
      const params = {
        page: currentPage,
        limit: 25,
      };

      if (search) params.search = search;
      if (plantFilter) params.plantId = plantFilter;
      if (partyFilter) params.partyId = partyFilter;
      if (materialFilter) params.materialId = materialFilter;
      if (linkedOrderFilter) params.linkedOrderFilter = linkedOrderFilter;
      if (sourceTypeFilter) params.sourceType = sourceTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFromFilter) params.dateFrom = dateFromFilter;
      if (dateToFilter) params.dateTo = dateToFilter;

      const reportsRes = await api.get("/dispatch-reports", { params });

      setReports(reportsRes.data?.data || []);
      setDispatchSummary(
        reportsRes.data?.meta?.summary || {
          totalDispatches: 0,
          totalQuantity: 0,
          totalInvoiceValue: 0,
          pending: 0,
          completed: 0,
          cancelled: 0,
        }
      );
      setDispatchPagination(
        reportsRes.data?.meta?.pagination || {
          total: 0,
          page: currentPage,
          limit: 25,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        }
      );
      setError("");
    } catch (err) {
      setReports([]);
      setDispatchSummary({
        totalDispatches: 0,
        totalQuantity: 0,
        totalInvoiceValue: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        linkedOrders: 0,
        unlinkedOrders: 0,
        uniquePlants: 0,
        uniqueParties: 0,
        uniqueMaterials: 0,
        latestDispatchDate: null,
      });
      setDispatchPagination({
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      });
      setError(err?.response?.data?.message || "Failed to load dispatch data");
    } finally {
      setIsLoadingData(false);
    }
  }, [
    dateFromFilter,
    dateToFilter,
    linkedOrderFilter,
    materialFilter,
    page,
    partyFilter,
    plantFilter,
    search,
    sourceTypeFilter,
    statusFilter,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDispatchReports(page);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [loadDispatchReports, page]);

  const availableMaterials = masters?.materials || [];
  const activePlants = useMemo(
    () => plants.filter((plant) => plant.isActive),
    [plants]
  );

  const plantOptions = useMemo(
    () =>
      plants
        .filter(
          (plant) =>
            plant.isActive ||
            String(plant.id) === String(formData.plantId) ||
            String(plant.id) === String(editForm.plantId) ||
            String(plant.id) === String(plantFilter)
        )
        .sort((left, right) =>
          String(left.plantName || "").localeCompare(String(right.plantName || ""))
        ),
    [editForm.plantId, formData.plantId, plantFilter, plants]
  );

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "active"),
    [vehicles]
  );

  const activePartyRates = useMemo(
    () => partyRates.filter((rate) => rate.isActive),
    [partyRates]
  );

  const activeTransportRates = useMemo(
    () => transportRates.filter((rate) => rate.isActive),
    [transportRates]
  );

  const activeMaterialUnitConversions = useMemo(
    () => materialUnitConversions.filter((conversion) => conversion.isActive),
    [materialUnitConversions]
  );

  const availableUnits = useMemo(
    () => units.filter((unit) => unit.isActive),
    [units]
  );

  const unitsById = useMemo(
    () => new Map(units.map((unit) => [String(unit.id), unit])),
    [units]
  );

  const handleChange = (setter) => (e) => {
    const { name, value } = e.target;

    if (setter === setFormData) {
      setSavedCreatePreview(null);
    }
    if (setter === setEditForm) {
      setSavedEditPreview(null);
    }

    setter((prev) => {
      const next = {
        ...prev,
        [name]:
          name === "ewbNumber"
            ? String(value || "")
                .replace(/\D/g, "")
                .slice(0, 12)
            : value,
      };

      if (
        name === "invoiceNumber" &&
        String(value || "").trim() &&
        !prev.invoiceDate &&
        prev.dispatchDate
      ) {
        next.invoiceDate = prev.dispatchDate;
      }

      if (
        name === "dispatchDate" &&
        String(prev.invoiceNumber || "").trim() &&
        !prev.invoiceDate &&
        String(value || "").trim()
      ) {
        next.invoiceDate = String(value || "").trim();
      }

      if (
        name === "invoiceDate" &&
        String(value || "").trim() &&
        String(prev.ewbNumber || "").trim() &&
        !prev.ewbDate
      ) {
        next.ewbDate = String(value || "").trim();
      }

      if (
        name === "ewbNumber" &&
        String(next.ewbNumber || "").trim() &&
        !prev.ewbDate
      ) {
        next.ewbDate = prev.invoiceDate || prev.dispatchDate || "";
      }

      if (
        name === "ewbDate" &&
        String(value || "").trim() &&
        !prev.ewbValidUpto
      ) {
        next.ewbValidUpto = String(value || "").trim();
      }

      if (name === "plantId") {
        next.vehicleId = "";
        next.materialId = "";
        next.partyId = "";
        next.partyOrderId = "";
        next.transportVendorId = "";
        if (setter === setFormData) {
          setVehicleSearch("");
        }
        if (setter === setEditForm) {
          setEditVehicleSearch("");
        }
      }

      if (name === "materialId") {
        next.partyId = "";
        next.partyOrderId = "";
        next.enteredUnitId = "";
      }

      if (name === "partyId") {
        next.partyOrderId = "";
      }

      if (name === "quantitySource") {
        if (value !== "manual_volume") {
          next.enteredUnitId = "";
        }

        if (value !== "trip_estimate") {
          next.enteredQuantity =
            prev.quantitySource === "trip_estimate" ? "" : prev.enteredQuantity;
        }
      }

      if (name === "vehicleId") {
        const selectedVehicle = vehicles.find(
          (vehicle) => String(vehicle.id) === String(value)
        );

        if (selectedVehicle?.vendorId) {
          next.transportVendorId = String(selectedVehicle.vendorId);
        } else if (value === "") {
          next.transportVendorId = "";
        }
      }

      return next;
    });
  };

  const handleLoadingChargeChange = (setter) => (e) => {
    const { value } = e.target;

    setter((prev) => ({
      ...prev,
      loadingCharge: value,
      loadingChargeManual: true,
    }));
  };

  const resetLoadingChargeToAuto = (setter) => {
    setter((prev) => ({
      ...prev,
      loadingCharge: "",
      loadingChargeManual: false,
    }));
  };

  const vehiclesForPlant = (plantId, searchValue = "") => {
    if (!plantId) return [];

    const query = String(searchValue || "").trim().toLowerCase();

    return activeVehicles
      .filter((vehicle) => String(vehicle.plantId) === String(plantId))
      .filter((vehicle) => {
        if (!query) return true;

        return [
          vehicle.vehicleNumber,
          vehicle.vehicleType,
          vehicle.assignedDriver,
          vehicle.vendorName,
          vehicle.ownershipType,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftVendorLinked = left.vendorId ? 1 : 0;
        const rightVendorLinked = right.vendorId ? 1 : 0;

        if (leftVendorLinked !== rightVendorLinked) {
          return rightVendorLinked - leftVendorLinked;
        }

        return String(left.vehicleNumber || "").localeCompare(
          String(right.vehicleNumber || "")
        );
      });
  };

  const transportVendorOptionsForForm = useMemo(() => {
    if (!formData.plantId || !formData.materialId) return [];

    const vendorIds = new Set(
      activeTransportRates
        .filter(
          (rate) =>
            String(rate.plantId) === String(formData.plantId) &&
            String(rate.materialId) === String(formData.materialId)
        )
        .map((rate) => String(rate.vendorId))
    );

    return vendors.filter((vendor) => vendorIds.has(String(vendor.id)));
  }, [activeTransportRates, vendors, formData.plantId, formData.materialId]);

  const transportVendorOptionsForEdit = useMemo(() => {
    if (!editForm.plantId || !editForm.materialId) return [];

    const vendorIds = new Set(
      activeTransportRates
        .filter(
          (rate) =>
            String(rate.plantId) === String(editForm.plantId) &&
            String(rate.materialId) === String(editForm.materialId)
        )
        .map((rate) => String(rate.vendorId))
    );

    return vendors.filter((vendor) => vendorIds.has(String(vendor.id)));
  }, [activeTransportRates, vendors, editForm.plantId, editForm.materialId]);

  const activePartyOrders = useMemo(
    () => partyOrders.filter((order) => order.status !== "cancelled"),
    [partyOrders]
  );

  const formMatchingOrders = useMemo(() => {
    if (!formData.plantId || !formData.materialId || !formData.partyId) {
      return [];
    }

    return activePartyOrders.filter((order) => {
      const matchesLink =
        String(order.plantId) === String(formData.plantId) &&
        String(order.materialId) === String(formData.materialId) &&
        String(order.partyId) === String(formData.partyId);
      const canStillLink =
        Number(order.pendingQuantityTons || 0) > 0 ||
        String(order.id) === String(formData.partyOrderId);

      return matchesLink && canStillLink;
    });
  }, [
    activePartyOrders,
    formData.materialId,
    formData.partyId,
    formData.partyOrderId,
    formData.plantId,
  ]);

  const editMatchingOrders = useMemo(() => {
    if (!editForm.plantId || !editForm.materialId || !editForm.partyId) {
      return [];
    }

    return activePartyOrders.filter((order) => {
      const matchesLink =
        String(order.plantId) === String(editForm.plantId) &&
        String(order.materialId) === String(editForm.materialId) &&
        String(order.partyId) === String(editForm.partyId);
      const canStillLink =
        Number(order.pendingQuantityTons || 0) > 0 ||
        String(order.id) === String(editForm.partyOrderId);

      return matchesLink && canStillLink;
    });
  }, [
    activePartyOrders,
    editForm.materialId,
    editForm.partyId,
    editForm.partyOrderId,
    editForm.plantId,
  ]);

  const getAvailablePartyOrders = (payload, currentOrderId = "") => {
    if (!payload.plantId || !payload.materialId || !payload.partyId) {
      return [];
    }

    return activePartyOrders.filter((order) => {
      const matchesLink =
        String(order.plantId) === String(payload.plantId) &&
        String(order.materialId) === String(payload.materialId) &&
        String(order.partyId) === String(payload.partyId);
      const canStillLink =
        Number(order.pendingQuantityTons || 0) > 0 ||
        String(order.id) === String(currentOrderId);

      return matchesLink && canStillLink;
    });
  };

  const getSelectedPartyOrder = (payload, currentOrderId = "") => {
    if (!payload.partyOrderId) {
      return null;
    }

    return (
      getAvailablePartyOrders(payload, currentOrderId).find(
        (order) => String(order.id) === String(payload.partyOrderId)
      ) || null
    );
  };

  const hasMatchingPartyOrders = (payload, currentOrderId = "") =>
    getAvailablePartyOrders(payload, currentOrderId).length > 0;

  const getSelectedPartyRate = (payload) => {
    if (!payload.plantId || !payload.materialId || !payload.partyId) return null;
    const effectiveDispatchDate =
      toComparableDateOnly(payload.dispatchDate) || getTodayDateValue();

    return (
      activePartyRates
        .filter(
          (rate) =>
            String(rate.plantId) === String(payload.plantId) &&
            String(rate.materialId) === String(payload.materialId) &&
            String(rate.partyId) === String(payload.partyId) &&
            (!toComparableDateOnly(rate.effectiveFrom) ||
              toComparableDateOnly(rate.effectiveFrom) <= effectiveDispatchDate)
        )
        .sort(compareEffectiveRatePriority)[0] || null
    );
  };

  const getSelectedTransportRate = (payload) => {
    const effectiveTransportVendorId =
      payload.transportVendorId ||
      vehicles.find((v) => String(v.id) === String(payload.vehicleId))?.vendorId;

    if (!payload.plantId || !payload.materialId || !effectiveTransportVendorId) {
      return null;
    }

    return activeTransportRates.find(
      (rate) =>
        String(rate.plantId) === String(payload.plantId) &&
        String(rate.materialId) === String(payload.materialId) &&
        String(rate.vendorId) === String(effectiveTransportVendorId)
    );
  };

  const getUnitOptionLabel = useCallback((unitId) => {
    const unit = unitsById.get(String(unitId));
    if (!unit) return "Unknown unit";
    return unit.unitCode || unit.unitName || `Unit ${unit.id}`;
  }, [unitsById]);

  const getMaterialConversionToTon = useCallback(
    (payload) => {
      const materialId = Number(payload.materialId || 0);
      const enteredUnitId = Number(payload.enteredUnitId || 0);

      if (!materialId || !enteredUnitId) {
        return null;
      }

      const enteredUnit = unitsById.get(String(enteredUnitId));
      if (!enteredUnit) {
        return null;
      }

      const enteredUnitCode = buildNormalizedKey(enteredUnit.unitCode || enteredUnit.unitName);
      if (TON_UNIT_CODES.has(enteredUnitCode)) {
        return {
          conversionId: null,
          conversionFactor: 1,
          conversionMethod: "identity",
          isReciprocal: false,
        };
      }

      const effectiveDispatchDate =
        toComparableDateOnly(payload.dispatchDate) || getTodayDateValue();

      const matchingConversions = activeMaterialUnitConversions
        .filter(
          (conversion) =>
            String(conversion.materialId) === String(materialId) &&
            (!toComparableDateOnly(conversion.effectiveFrom) ||
              toComparableDateOnly(conversion.effectiveFrom) <= effectiveDispatchDate)
        )
        .sort(compareEffectiveRatePriority);

      for (const conversion of matchingConversions) {
        const fromUnit = unitsById.get(String(conversion.fromUnitId || ""));
        const toUnit = unitsById.get(String(conversion.toUnitId || ""));
        const fromCode = buildNormalizedKey(fromUnit?.unitCode || fromUnit?.unitName);
        const toCode = buildNormalizedKey(toUnit?.unitCode || toUnit?.unitName);
        const rawFactor = Number(conversion.conversionFactor || 0);

        if (!Number.isFinite(rawFactor) || rawFactor <= 0) {
          continue;
        }

        if (
          String(conversion.fromUnitId) === String(enteredUnitId) &&
          TON_UNIT_CODES.has(toCode)
        ) {
          return {
            conversionId: conversion.id || null,
            conversionFactor: rawFactor,
            conversionMethod: conversion.conversionMethod || null,
            isReciprocal: false,
          };
        }

        if (
          String(conversion.toUnitId) === String(enteredUnitId) &&
          TON_UNIT_CODES.has(fromCode)
        ) {
          return {
            conversionId: conversion.id || null,
            conversionFactor: 1 / rawFactor,
            conversionMethod: conversion.conversionMethod || null,
            isReciprocal: true,
          };
        }
      }

      return null;
    },
    [activeMaterialUnitConversions, unitsById]
  );

  const getNormalizedQuantityPreview = useCallback((payload) => {
    const quantitySource = String(payload.quantitySource || "").trim();
    const quantityTons = Number(payload.quantityTons || 0);
    const enteredQuantity = Number(payload.enteredQuantity || 0);
    const selectedVehicle = vehicles.find(
      (vehicle) => String(vehicle.id) === String(payload.vehicleId)
    );
    const vehicleCapacityTons = Number(selectedVehicle?.vehicleCapacityTons || 0);

    if (!quantitySource) {
      return {
        value: Number.isFinite(quantityTons) && quantityTons > 0 ? quantityTons : null,
        sourceLabel: "Legacy Tons",
        note: "Using direct quantity tons entry.",
        canCalculateLocally: Number.isFinite(quantityTons) && quantityTons > 0,
      };
    }

    if (quantitySource === "weighbridge" || quantitySource === "manual_weight") {
      return {
        value: Number.isFinite(quantityTons) && quantityTons > 0 ? quantityTons : null,
        sourceLabel: getQuantitySourceLabel(quantitySource),
        note: "Weight-based entry uses quantity tons directly.",
        canCalculateLocally: Number.isFinite(quantityTons) && quantityTons > 0,
      };
    }

    if (quantitySource === "manual_volume") {
      const conversion = getMaterialConversionToTon(payload);
      const canConvert =
        Number.isFinite(enteredQuantity) &&
        enteredQuantity > 0 &&
        Number.isFinite(conversion?.conversionFactor) &&
        conversion.conversionFactor > 0;

      return {
        value: canConvert
          ? roundMetric(enteredQuantity * Number(conversion.conversionFactor), 3)
          : null,
        sourceLabel: getQuantitySourceLabel(quantitySource),
        note:
          !payload.enteredQuantity || !payload.enteredUnitId
            ? "Enter quantity and unit to estimate converted quantity."
            : canConvert
              ? `Converted from ${payload.enteredQuantity} ${getUnitOptionLabel(
                  payload.enteredUnitId
                )} using masters configuration.`
              : materialConversionsWarning
                ? "Conversion preview is unavailable because material conversions could not be loaded."
                : "Conversion not configured for this material. Please configure in Masters.",
        canCalculateLocally: canConvert,
        missingConversion:
          Boolean(payload.enteredQuantity) &&
          Boolean(payload.enteredUnitId) &&
          !conversion &&
          !materialConversionsWarning,
        conversionUnavailable: Boolean(materialConversionsWarning),
      };
    }

    if (quantitySource === "vehicle_capacity") {
      return {
        value:
          Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0
            ? roundMetric(vehicleCapacityTons, 3)
            : null,
        sourceLabel: getQuantitySourceLabel(quantitySource),
        note:
          Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0
            ? `Using linked vehicle capacity of ${roundMetric(vehicleCapacityTons, 3)} tons for one trip.`
            : "Selected vehicle needs capacity in tons before using this source.",
        canCalculateLocally: Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0,
      };
    }

    if (quantitySource === "trip_estimate") {
      const trips = Number.isFinite(enteredQuantity) && enteredQuantity > 0 ? enteredQuantity : 1;
      return {
        value:
          Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0
            ? roundMetric(vehicleCapacityTons * trips, 3)
            : null,
        sourceLabel: getQuantitySourceLabel(quantitySource),
        note:
          Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0
            ? `${roundMetric(trips, 3)} trip(s) x ${roundMetric(vehicleCapacityTons, 3)} tons vehicle capacity.`
            : "Selected vehicle needs capacity in tons before using trip estimate.",
        canCalculateLocally: Number.isFinite(vehicleCapacityTons) && vehicleCapacityTons > 0,
      };
    }

    return {
      value: null,
      sourceLabel: "Quantity Source",
      note: "Quantity will be normalized by the backend.",
      canCalculateLocally: false,
    };
  }, [getMaterialConversionToTon, getUnitOptionLabel, materialConversionsWarning, vehicles]);

  const buildBillingPreview = (payload) => {
    const quantityPreview = getNormalizedQuantityPreview(payload);
    const quantity = Number(quantityPreview.value || 0);
    const distance = Number(payload.distanceKm || 0);
    const otherCharge = roundMoney(payload.otherCharge || 0);
    const selectedMaterial =
      availableMaterials.find((material) => String(material.id) === String(payload.materialId)) ||
      null;

    const partyRate = getSelectedPartyRate(payload);
    const transportRate = getSelectedTransportRate(payload);
    const requiresPartyRate =
      Boolean(payload.plantId) && Boolean(payload.materialId) && Boolean(payload.partyId);
    const hasPartyRate = Boolean(partyRate);

    const materialRatePerTon = Number(partyRate?.ratePerTon || 0);
    const materialRateUnit = partyRate?.rateUnit || "per_ton";
    const materialRateUnitLabel = getRateUnitLabel(partyRate);
    const materialRateUnitsPerTon = Number(partyRate?.rateUnitsPerTon || 1);
    const materialAmount = quantityPreview.canCalculateLocally
      ? roundMoney(
          calculateBillableRateUnits({
            quantityTons: quantity,
            materialRateUnit,
            materialRateUnitsPerTon,
          }) * materialRatePerTon
        )
      : 0;

    const royaltyMode = partyRate?.royaltyMode || "none";
    const royaltyValue = Number(partyRate?.royaltyValue || 0);
    const tonsPerBrass =
      partyRate?.tonsPerBrass === null || partyRate?.tonsPerBrass === undefined
        ? null
        : Number(partyRate?.tonsPerBrass);
    let royaltyAmount = 0;

    if (quantityPreview.canCalculateLocally && royaltyMode === "per_ton") {
      royaltyAmount = roundMoney(quantity * royaltyValue);
    } else if (
      quantityPreview.canCalculateLocally &&
      royaltyMode === "per_brass" &&
      Number.isFinite(tonsPerBrass) &&
      tonsPerBrass > 0
    ) {
      royaltyAmount = roundMoney((quantity / tonsPerBrass) * royaltyValue);
    } else if (royaltyMode === "fixed") {
      royaltyAmount = roundMoney(royaltyValue);
    }

    const loadingChargeBasis = partyRate?.loadingChargeBasis || "fixed";
    const loadingChargeRate = roundMoney(partyRate?.loadingCharge || 0);
    let autoLoadingCharge = 0;

    if (quantityPreview.canCalculateLocally && loadingChargeBasis === "per_ton") {
      autoLoadingCharge = quantity * loadingChargeRate;
    } else if (
      quantityPreview.canCalculateLocally &&
      loadingChargeBasis === "per_brass" &&
      Number.isFinite(tonsPerBrass) &&
      tonsPerBrass > 0
    ) {
      autoLoadingCharge = (quantity / tonsPerBrass) * loadingChargeRate;
    } else if (loadingChargeBasis === "none") {
      autoLoadingCharge = 0;
    } else {
      autoLoadingCharge = loadingChargeRate;
    }

    autoLoadingCharge = roundMoney(autoLoadingCharge);
    const loadingCharge = payload.loadingChargeManual
      ? roundMoney(payload.loadingCharge || 0)
      : autoLoadingCharge;

    let transportCost = 0;
    let transportRateType = transportRate?.rateType || null;
    let transportRateValue = Number(transportRate?.rateValue || 0);

    if (transportRate) {
      if (transportRate.rateType === "per_trip" || transportRate.rateType === "per_day") {
        transportCost = transportRate.rateValue;
      } else if (transportRate.rateType === "per_ton" && quantityPreview.canCalculateLocally) {
        transportCost = quantity * transportRate.rateValue;
      } else if (transportRate.rateType === "per_km") {
        const appliedDistance =
          distance > 0 ? distance : Number(transportRate.distanceKm || 0);
        transportCost = appliedDistance * transportRate.rateValue;
      }
    }

    if (!hasPartyRate) {
      transportCost = 0;
    }

    transportCost = roundMoney(transportCost);

    const computedTotal = hasPartyRate
      ? roundMoney(
          materialAmount +
            royaltyAmount +
            loadingCharge +
            transportCost +
            otherCharge
        )
      : 0;

    const finalInvoiceValue =
      hasPartyRate && payload.invoiceValue !== "" && payload.invoiceValue !== null
        ? roundMoney(payload.invoiceValue)
        : computedTotal;
    const hasManualOverride =
      payload.invoiceValue !== "" &&
      payload.invoiceValue !== null &&
      Math.abs(finalInvoiceValue - computedTotal) >= 0.01;
    const overrideAmount = hasManualOverride
      ? roundMoney(finalInvoiceValue - computedTotal)
      : 0;

    const estimatedBillingQuantity = quantityPreview.canCalculateLocally
      ? roundMetric(
          calculateBillableRateUnits({
            quantityTons: quantity,
            materialRateUnit,
            materialRateUnitsPerTon,
          }),
          3
        )
      : null;

    let estimatedTransportQuantity = null;
    if (transportRate) {
      if (transportRate.rateType === "per_trip" || transportRate.rateType === "per_day") {
        estimatedTransportQuantity = 1;
      } else if (transportRate.rateType === "per_ton" && quantityPreview.canCalculateLocally) {
        estimatedTransportQuantity = roundMetric(quantity, 3);
      } else if (transportRate.rateType === "per_km") {
        estimatedTransportQuantity = distance > 0 ? roundMetric(distance, 2) : null;
      }
    }

    return {
      partyRate,
      hasPartyRate,
      requiresPartyRate,
      transportRate,
      materialRatePerTon,
      materialRateUnit,
      materialRateUnitLabel,
      materialRateUnitsPerTon,
      materialAmount,
      royaltyMode,
      royaltyValue,
      tonsPerBrass,
      royaltyAmount,
      loadingChargeBasis,
      loadingChargeRate,
      autoLoadingCharge,
      loadingCharge,
      loadingChargeIsManual: Boolean(payload.loadingChargeManual),
      transportRateType,
      transportRateValue,
      transportCost,
      otherCharge,
      quantityPreview,
      computedTotal,
      finalInvoiceValue,
      hasManualOverride,
      overrideAmount,
      estimatedBillingQuantity,
      estimatedTransportQuantity,
      selectedMaterial,
    };
  };

  const formBillingPreview = buildBillingPreview(formData);

  const editBillingPreview = buildBillingPreview(editForm);
  const editCommercialRefreshMessage = useMemo(
    () => getCommercialRefreshMessage(editRecord, editBillingPreview),
    [editBillingPreview, editRecord]
  );
  const formPartyOrder = getSelectedPartyOrder(formData, formData.partyOrderId);
  const editPartyOrder = getSelectedPartyOrder(editForm, editForm.partyOrderId);

  useEffect(() => {
    const prefill = location.state?.prefillDispatch;

    if (!prefill || hasAppliedPrefillRef.current) {
      return;
    }

    hasAppliedPrefillRef.current = true;
    setFormData({
      ...createDispatchFormState(),
      sourceType: prefill.sourceType || "",
      plantId: prefill.plantId || "",
      materialId: prefill.materialId || "",
      partyId: prefill.partyId || "",
      partyOrderId: prefill.partyOrderId || "",
      remarks: prefill.remarks || "",
    });
    setShowForm(true);
    setShowList(false);
    setEditRecord(null);
    setSuccess("Dispatch form prefilled from the selected party order. Complete vehicle, destination, and quantity to save.");
    setError("");
  }, [location.state]);

  useEffect(() => {
    if (formMatchingOrders.length === 1 && !formData.partyOrderId) {
      setFormData((prev) => ({
        ...prev,
        partyOrderId: String(formMatchingOrders[0].id),
      }));
    }

    if (
      formData.partyOrderId &&
      formMatchingOrders.length > 0 &&
      !formMatchingOrders.some(
        (order) => String(order.id) === String(formData.partyOrderId)
      )
    ) {
      setFormData((prev) => ({
        ...prev,
        partyOrderId: formMatchingOrders.length === 1 ? String(formMatchingOrders[0].id) : "",
      }));
    }
  }, [
    formData.partyOrderId,
    formMatchingOrders,
  ]);

  useEffect(() => {
    if (!editRecord) {
      return;
    }

    if (editMatchingOrders.length === 1 && !editForm.partyOrderId) {
      setEditForm((prev) => ({
        ...prev,
        partyOrderId: String(editMatchingOrders[0].id),
      }));
    }

    if (
      editForm.partyOrderId &&
      editMatchingOrders.length > 0 &&
      !editMatchingOrders.some(
        (order) => String(order.id) === String(editForm.partyOrderId)
      )
    ) {
      setEditForm((prev) => ({
        ...prev,
        partyOrderId: editMatchingOrders.length === 1 ? String(editMatchingOrders[0].id) : "",
      }));
    }
  }, [
    editRecord,
    editForm.partyOrderId,
    editMatchingOrders,
  ]);

  useEffect(() => {
    const selectedPlant =
      plantOptions.find((plant) => String(plant.id) === String(formData.plantId)) || null;
    const recommendedSourceType = getRecommendedSourceType(selectedPlant?.plantType);

    if (
      recommendedSourceType &&
      (!formData.sourceType || formData.sourceType === "Plant" || formData.sourceType === "Crusher")
    ) {
      setFormData((prev) =>
        prev.sourceType === recommendedSourceType
          ? prev
          : {
              ...prev,
              sourceType: recommendedSourceType,
            }
      );
    }
  }, [formData.plantId, formData.sourceType, plantOptions]);

  useEffect(() => {
    if (!editRecord) {
      return;
    }

    const selectedPlant =
      plantOptions.find((plant) => String(plant.id) === String(editForm.plantId)) || null;
    const recommendedSourceType = getRecommendedSourceType(selectedPlant?.plantType);

    if (
      recommendedSourceType &&
      (!editForm.sourceType || editForm.sourceType === "Plant" || editForm.sourceType === "Crusher")
    ) {
      setEditForm((prev) =>
        prev.sourceType === recommendedSourceType
          ? prev
          : {
              ...prev,
              sourceType: recommendedSourceType,
            }
      );
    }
  }, [editForm.plantId, editForm.sourceType, editRecord, plantOptions]);

  const validateDispatchPayload = (payload) => {
    const quantitySource = String(payload.quantitySource || "").trim();

    if (
      !payload.dispatchDate ||
      !payload.sourceType ||
      !payload.plantId ||
      !payload.materialId ||
      !payload.partyId ||
      !payload.vehicleId ||
      !payload.destinationName
    ) {
      return "Dispatch date, source type, plant, material, party, vehicle, and destination are required";
    }

    if (!quantitySource || quantitySource === "weighbridge" || quantitySource === "manual_weight") {
      const quantityTons = Number(payload.quantityTons);
      if (!Number.isFinite(quantityTons) || quantityTons <= 0) {
        return "Quantity tons must be a valid number greater than 0";
      }
    }

    if (quantitySource === "manual_volume") {
      const enteredQuantity = Number(payload.enteredQuantity);
      const enteredUnitId = Number(payload.enteredUnitId);

      if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
        return "Entered quantity must be a valid number greater than 0 for manual volume";
      }

      if (!Number.isInteger(enteredUnitId) || enteredUnitId <= 0) {
        return "Select a valid unit for manual volume quantity";
      }

      if (
        !materialConversionsWarning &&
        payload.materialId &&
        !getMaterialConversionToTon(payload)
      ) {
        return "Conversion not configured for this material. Please configure in Masters.";
      }
    }

    if (quantitySource === "trip_estimate") {
      const enteredQuantity = payload.enteredQuantity === "" ? 1 : Number(payload.enteredQuantity);

      if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
        return "Trip estimate must be a valid number greater than 0";
      }
    }

    if (quantitySource === "vehicle_capacity" || quantitySource === "trip_estimate") {
      const selectedVehicle = vehicles.find(
        (vehicle) => String(vehicle.id) === String(payload.vehicleId)
      );
      const vehicleCapacityTons = Number(selectedVehicle?.vehicleCapacityTons || 0);

      if (!Number.isFinite(vehicleCapacityTons) || vehicleCapacityTons <= 0) {
        return "Selected vehicle is missing capacity in tons for quantity estimation";
      }
    }

    const invoiceValue = payload.invoiceValue === "" ? null : Number(payload.invoiceValue);
    if (invoiceValue !== null && (!Number.isFinite(invoiceValue) || invoiceValue < 0)) {
      return "Invoice value must be a valid number of 0 or more";
    }

    const distanceKm = payload.distanceKm === "" ? null : Number(payload.distanceKm);
    if (distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm < 0)) {
      return "Distance must be a valid number of 0 or more";
    }

    const otherCharge = payload.otherCharge === "" ? null : Number(payload.otherCharge);
    if (otherCharge !== null && (!Number.isFinite(otherCharge) || otherCharge < 0)) {
      return "Other charge must be a valid number of 0 or more";
    }

    const loadingCharge = payload.loadingCharge === "" ? null : Number(payload.loadingCharge);
    if (loadingCharge !== null && (!Number.isFinite(loadingCharge) || loadingCharge < 0)) {
      return "Loading charge must be a valid number of 0 or more";
    }

    if (!String(payload.destinationName || "").trim()) {
      return "Destination name is required";
    }

    const billingPreview = buildBillingPreview(payload);
    if (billingPreview.hasManualOverride && !String(payload.billingNotes || "").trim()) {
      return "Billing notes are required when manually overriding the taxable invoice value";
    }

    if (
      hasMatchingPartyOrders(payload, payload.partyOrderId) &&
      !payload.partyOrderId
    ) {
      return "Select a party order before dispatching this load so pending quantity is updated correctly";
    }

    const selectedPartyOrder = getSelectedPartyOrder(payload, payload.partyOrderId);
    const normalizedQuantityPreview = getNormalizedQuantityPreview(payload);
    if (
      selectedPartyOrder &&
      normalizedQuantityPreview.value !== null &&
      Number(normalizedQuantityPreview.value || 0) >
        Number(selectedPartyOrder.pendingQuantityTons || 0)
    ) {
      return `Dispatch quantity exceeds pending order quantity of ${selectedPartyOrder.pendingQuantityTons} tons`;
    }

    const ewbNumber = String(payload.ewbNumber || "").trim();
    if (ewbNumber && !/^\d{12}$/.test(ewbNumber)) {
      return "E-Way Bill Number must be a 12-digit numeric value";
    }

    if ((payload.ewbDate || payload.ewbValidUpto) && !ewbNumber) {
      return "E-Way Bill Number is required when EWB dates are provided";
    }

    if (ewbNumber && !payload.ewbDate) {
      return "E-Way Bill Date is required when EWB Number is provided";
    }

    if (ewbNumber && !payload.ewbValidUpto) {
      return "E-Way Bill Valid Upto is required when EWB Number is provided";
    }

    if (payload.ewbDate && payload.ewbValidUpto) {
      const issueDate = parseDateOnlyValue(payload.ewbDate);
      const validDate = parseDateOnlyValue(payload.ewbValidUpto);

      if (!issueDate || !validDate) {
        return "E-Way Bill dates are invalid";
      }

      if (validDate < issueDate) {
        return "E-Way Bill validity cannot be before EWB date";
      }
    }

    const dispatchDate = parseDateOnlyValue(payload.dispatchDate);
    const invoiceDate = parseDateOnlyValue(payload.invoiceDate);
    const ewbDate = parseDateOnlyValue(payload.ewbDate);

    if (invoiceDate && dispatchDate && invoiceDate > dispatchDate) {
      return "Invoice Date cannot be after dispatch date";
    }

    if (ewbDate && dispatchDate && ewbDate > dispatchDate) {
      return "E-Way Bill Date cannot be after dispatch date";
    }

    if (ewbDate && invoiceDate && ewbDate < invoiceDate) {
      return "E-Way Bill Date cannot be before invoice date";
    }

    return "";
  };

  const normalizeDispatchPayload = (payload) => ({
    ...payload,
    plantId: Number(payload.plantId),
    materialId: Number(payload.materialId),
    partyId: Number(payload.partyId),
    partyOrderId: payload.partyOrderId ? Number(payload.partyOrderId) : null,
    vehicleId: Number(payload.vehicleId),
    transportVendorId: payload.transportVendorId
      ? Number(payload.transportVendorId)
      : null,
    quantityTons: Number(payload.quantityTons),
    enteredQuantity:
      payload.enteredQuantity === "" ? null : Number(payload.enteredQuantity),
    enteredUnitId: payload.enteredUnitId ? Number(payload.enteredUnitId) : null,
    quantitySource: payload.quantitySource || null,
    invoiceValue:
      payload.invoiceValue === "" ? null : Number(payload.invoiceValue),
    distanceKm: payload.distanceKm === "" ? null : Number(payload.distanceKm),
    otherCharge: payload.otherCharge === "" ? 0 : Number(payload.otherCharge),
    loadingCharge:
      payload.loadingCharge === "" ? null : Number(payload.loadingCharge),
    loadingChargeManual: Boolean(payload.loadingChargeManual),
    billingNotes: payload.billingNotes || "",
  });

  const buildDispatchReadiness = (payload, billingPreview) => {
    const quantitySource = String(payload.quantitySource || "").trim();
    const quantityPreview = getNormalizedQuantityPreview(payload);
    const checks = [
      {
        label: "Dispatch date selected",
        ready: Boolean(payload.dispatchDate),
      },
      {
        label: "Source type selected",
        ready: Boolean(payload.sourceType),
      },
      {
        label: "Plant, material, party and vehicle linked",
        ready: Boolean(
          payload.plantId &&
            payload.materialId &&
            payload.partyId &&
            payload.vehicleId
        ),
      },
      {
        label: "Matching party order linked for fulfillment tracking",
        ready:
          !hasMatchingPartyOrders(payload, payload.partyOrderId) ||
          Boolean(payload.partyOrderId),
      },
      {
        label: "Linked order still has pending quantity",
        ready:
          !payload.partyOrderId ||
          Number(
            getSelectedPartyOrder(payload, payload.partyOrderId)?.pendingQuantityTons || 0
          ) > 0,
      },
      {
        label: "Destination and quantity inputs filled",
        ready: Boolean(payload.destinationName) && (
          (!quantitySource && Number(payload.quantityTons || 0) > 0) ||
          ((quantitySource === "weighbridge" || quantitySource === "manual_weight") &&
            Number(payload.quantityTons || 0) > 0) ||
          (quantitySource === "manual_volume" &&
            Number(payload.enteredQuantity || 0) > 0 &&
            Boolean(payload.enteredUnitId)) ||
          (quantitySource === "vehicle_capacity" && quantityPreview.value !== null) ||
          (quantitySource === "trip_estimate" &&
            Number(payload.enteredQuantity || 1) > 0 &&
            quantityPreview.value !== null)
        ),
      },
      {
        label: "Active party billing rate found",
        ready: Boolean(billingPreview.partyRate),
      },
      {
        label: "Billing can be computed now or after backend normalization",
        ready:
          Boolean(billingPreview.partyRate) &&
          (quantityPreview.canCalculateLocally ||
            (quantitySource === "manual_volume" &&
              !quantityPreview.missingConversion)),
      },
    ];

    const missingItems = checks
      .filter((check) => !check.ready)
      .map((check) => check.label);

    return {
      isReady: missingItems.length === 0,
      missingItems,
    };
  };

  const buildDispatchWarnings = (payload, billingPreview, selectedPartyOrder) => {
    const warnings = [];
    const matchingOrders = getAvailablePartyOrders(payload, payload.partyOrderId);
    const selectedVehicle = vehicles.find(
      (vehicle) => String(vehicle.id) === String(payload.vehicleId)
    );

    if (
      payload.plantId &&
      payload.materialId &&
      payload.partyId &&
      !billingPreview.partyRate
    ) {
      warnings.push(
        "Party rate is missing for this party, plant, and material. Save will be blocked until a rate is configured."
      );
    }

    if (
      String(payload.quantitySource || "").trim() === "manual_volume" &&
      billingPreview.quantityPreview.missingConversion
    ) {
      warnings.push(
        "Conversion not configured for this material. Please configure in Masters."
      );
    }

    if (
      payload.plantId &&
      payload.materialId &&
      payload.partyId &&
      matchingOrders.length === 0
    ) {
      warnings.push(
        "No open matching order exists for this dispatch combination, so fulfillment will not be tracked against an order."
      );
    }

    if (
      payload.plantId &&
      payload.materialId &&
      (payload.transportVendorId || selectedVehicle?.vendorId) &&
      !billingPreview.transportRate
    ) {
      warnings.push(
        "Transport rate is not configured for this plant, material, and vendor. Dispatch can still continue if transport is optional."
      );
    }

    if (matchingOrders.length > 1 && !payload.partyOrderId) {
      warnings.push(
        "More than one matching open order exists. Select the correct order before saving."
      );
    }

    if (
      selectedVehicle &&
      selectedVehicle.ownershipType === "transporter" &&
      !selectedVehicle.vendorId &&
      !payload.transportVendorId
    ) {
      warnings.push(
        "Selected vehicle looks transporter-owned but has no transporter linked yet."
      );
    }

    if (
      selectedPartyOrder &&
      Number(selectedPartyOrder.pendingQuantityTons || 0) > 0 &&
      selectedPartyOrder.targetDispatchDate &&
      toDateOnlyValue(selectedPartyOrder.targetDispatchDate) < getTodayDateValue()
    ) {
      warnings.push(
        "The linked order is already past its target dispatch date and still has pending balance."
      );
    }

    if (
      payload.invoiceNumber &&
      (!payload.invoiceDate || !payload.ewbNumber || !payload.ewbDate || !payload.ewbValidUpto)
    ) {
      warnings.push(
        "Invoice has started but invoice/E-Way details are still incomplete for a closure-ready dispatch."
      );
    }

    return warnings;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateDispatchPayload(formData);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (!formBillingPreview.partyRate) {
      setError("No active party material rate found for the selected plant, material, and party");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.post(
        "/dispatch-reports",
        normalizeDispatchPayload(formData)
      );
      setSavedCreatePreview(response.data?.data || null);

      setSuccess("Dispatch report added successfully");
      setFormData(createDispatchFormState());
      setShowForm(false);
      setShowList(true);
      setPage(1);
      await loadDispatchReports(1);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to add dispatch report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPanel = (report) => {
    const componentSubtotal = roundMoney(
      Number(report.materialAmount || 0) +
        Number(report.transportCost || 0) +
        Number(report.royaltyAmount || 0) +
        Number(report.loadingCharge || 0) +
        Number(report.otherCharge || 0)
    );
    const storedTaxableValue =
      report.totalInvoiceValue !== null && report.totalInvoiceValue !== undefined
        ? Number(report.totalInvoiceValue)
        : report.invoiceValue !== null && report.invoiceValue !== undefined
          ? Number(report.invoiceValue)
          : null;
    const manualOverrideValue =
      storedTaxableValue !== null &&
      Math.abs(roundMoney(storedTaxableValue) - componentSubtotal) >= 0.01
        ? String(storedTaxableValue)
        : "";

    setEditRecord(report);
    setEditForm({
      dispatchDate: report.dispatchDate || "",
      sourceType: report.sourceType || "",
      plantId: report.plantId ? String(report.plantId) : "",
      materialId: report.materialId ? String(report.materialId) : "",
      partyId: report.partyId ? String(report.partyId) : "",
      partyOrderId: report.partyOrderId ? String(report.partyOrderId) : "",
      vehicleId: report.vehicleId ? String(report.vehicleId) : "",
      transportVendorId: report.transportVendorId
        ? String(report.transportVendorId)
        : "",
      destinationName: report.destinationName || "",
      quantityTons:
        report.quantityTons !== null && report.quantityTons !== undefined
          ? String(report.quantityTons)
          : "",
      enteredQuantity:
        report.enteredQuantity !== null && report.enteredQuantity !== undefined
          ? String(report.enteredQuantity)
          : "",
      enteredUnitId: report.enteredUnitId ? String(report.enteredUnitId) : "",
      quantitySource: report.quantitySource || "",
      remarks: report.remarks || "",
      ewbNumber: report.ewbNumber || "",
      ewbDate: report.ewbDate || "",
      ewbValidUpto: report.ewbValidUpto || "",
      invoiceNumber: report.invoiceNumber || "",
      invoiceDate: report.invoiceDate || "",
      invoiceValue: manualOverrideValue,
      distanceKm:
        report.distanceKm !== null && report.distanceKm !== undefined
          ? String(report.distanceKm)
          : "",
      otherCharge:
        report.otherCharge !== null && report.otherCharge !== undefined
          ? String(report.otherCharge)
          : "",
      loadingCharge:
        report.loadingChargeIsManual &&
        report.loadingCharge !== null &&
        report.loadingCharge !== undefined
          ? String(report.loadingCharge)
          : "",
      loadingChargeManual: Boolean(report.loadingChargeIsManual),
      billingNotes: report.billingNotes || "",
    });
    setError("");
    setSuccess("");
  };

  const closeEditPanel = () => {
    setEditRecord(null);
    setEditForm(createDispatchFormState());
  };

  useEffect(() => {
    if (!focusDispatchId) {
      focusedDispatchIdRef.current = "";
      return;
    }

    if (focusedDispatchIdRef.current === String(focusDispatchId)) {
      return;
    }

    const targetDispatch = reports.find(
      (item) => String(item.id) === String(focusDispatchId)
    );

    if (!targetDispatch) {
      return;
    }

    openEditPanel(targetDispatch);
    setShowList(true);
    setShowForm(true);
    setSuccess("Focused dispatch opened from the commercial exceptions queue.");
    setError("");
    focusedDispatchIdRef.current = String(focusDispatchId);
  }, [focusDispatchId, reports]);

  const handleResetEditBillingToAuto = () => {
    setEditForm((prev) => ({
      ...prev,
      invoiceValue: "",
    }));
    setSuccess(
      "Manual taxable value override cleared. Save the dispatch to restore computed billing."
    );
    setError("");
  };

  const handleResetFormLoadingToAuto = () => {
    resetLoadingChargeToAuto(setFormData);
    setSuccess("Loading charge reset to the party rate default for this dispatch.");
    setError("");
  };

  const handleResetEditLoadingToAuto = () => {
    resetLoadingChargeToAuto(setEditForm);
    setSuccess("Loading charge reset to the party rate default for this dispatch.");
    setError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!editRecord) return;

    const validationMessage = validateDispatchPayload(editForm);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (!editBillingPreview.partyRate) {
      setError("No active party material rate found for the selected plant, material, and party");
      return;
    }

    try {
      setIsUpdating(true);
      const response = await api.patch(
        `/dispatch-reports/${editRecord.id}`,
        normalizeDispatchPayload(editForm)
      );
      setSavedEditPreview(response.data?.data || null);

      setSuccess("Dispatch report updated successfully");
      closeEditPanel();
      await loadDispatchReports(page);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update dispatch report"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (report, status) => {
    setError("");
    setSuccess("");

    if (status === "completed") {
      const completionBlockMessage = getDispatchCompletionBlockMessage(report);

      if (completionBlockMessage) {
        setError(completionBlockMessage);
        return;
      }
    }

    try {
      setStatusUpdatingId(report.id);
      await api.patch(`/dispatch-reports/${report.id}/status`, { status });
      setSuccess(`Dispatch status changed to ${status}`);
      await loadDispatchReports(page);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update dispatch status"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredReports = reports;

  const summary = useMemo(() => {
    return {
      totalDispatches: dispatchSummary.totalDispatches || 0,
      totalQuantity: Number(dispatchSummary.totalQuantity || 0).toFixed(2),
      totalInvoiceValue: Number(dispatchSummary.totalInvoiceValue || 0).toFixed(2),
      pending: dispatchSummary.pending || 0,
      completed: dispatchSummary.completed || 0,
      cancelled: dispatchSummary.cancelled || 0,
    };
  }, [dispatchSummary]);

  const filteredSummary = useMemo(() => {
    return {
      count: dispatchSummary.totalDispatches || 0,
      quantity: Number(dispatchSummary.totalQuantity || 0),
      invoiceValue: Number(dispatchSummary.totalInvoiceValue || 0),
    };
  }, [dispatchSummary]);

  const dispatchWorkspaceHealth = useMemo(() => {
    const activePlants = plants.filter((plant) => plant.isActive).length;
    const activeParties = parties.filter((party) => party.isActive).length;

    return [
      {
        label: "Active plants",
        value: activePlants,
        note: "Dispatch source points available in the current company scope",
      },
      {
        label: "Ready vehicles",
        value: activeVehicles.length,
        note: "Vehicles currently available for assignment",
      },
      {
        label: "Live party rates",
        value: activePartyRates.length,
        note: "Material billing rates available for pricing logic",
      },
      {
        label: "Live transport rates",
        value: activeTransportRates.length,
        note: "Transport slabs available for logistics costing",
      },
      {
        label: "Active parties",
        value: activeParties,
        note: "Customers available to be linked in dispatch",
      },
    ];
  }, [plants, parties, activeVehicles.length, activePartyRates.length, activeTransportRates.length]);

  const hasActiveFilters = Boolean(
    search ||
      plantFilter ||
      partyFilter ||
      materialFilter ||
      linkedOrderFilter ||
      sourceTypeFilter ||
      statusFilter ||
      dateFromFilter ||
      dateToFilter
  );

  const mastersSyncLabel = mastersLoadedAt
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(mastersLoadedAt))
    : "Waiting for first sync";

  const selectedVehicleForForm = useMemo(
    () =>
      vehicles.find((vehicle) => String(vehicle.id) === String(formData.vehicleId)) || null,
    [vehicles, formData.vehicleId]
  );

  const selectedPlantForForm = useMemo(
    () => plantOptions.find((plant) => String(plant.id) === String(formData.plantId)) || null,
    [formData.plantId, plantOptions]
  );

  const selectedVehicleForEdit = useMemo(
    () =>
      vehicles.find((vehicle) => String(vehicle.id) === String(editForm.vehicleId)) || null,
    [vehicles, editForm.vehicleId]
  );

  const selectedPlantForEdit = useMemo(
    () => plantOptions.find((plant) => String(plant.id) === String(editForm.plantId)) || null,
    [editForm.plantId, plantOptions]
  );

  const sourceTypeOptionsForForm = useMemo(
    () => getSourceTypeOptions(selectedPlantForForm?.plantType),
    [selectedPlantForForm?.plantType]
  );

  const sourceTypeOptionsForEdit = useMemo(
    () => getSourceTypeOptions(selectedPlantForEdit?.plantType),
    [selectedPlantForEdit?.plantType]
  );

  const selectedTransportVendorForForm = useMemo(() => {
    const effectiveVendorId =
      formData.transportVendorId || selectedVehicleForForm?.vendorId || "";

    return (
      vendors.find((vendor) => String(vendor.id) === String(effectiveVendorId)) || null
    );
  }, [vendors, formData.transportVendorId, selectedVehicleForForm]);

  const selectedTransportVendorForEdit = useMemo(() => {
    const effectiveVendorId =
      editForm.transportVendorId || selectedVehicleForEdit?.vendorId || "";

    return (
      vendors.find((vendor) => String(vendor.id) === String(effectiveVendorId)) || null
    );
  }, [vendors, editForm.transportVendorId, selectedVehicleForEdit]);

  const dispatchControlBrief = useMemo(() => {
    const unlinkedCount = reports.filter((report) => !report.partyOrderId).length;

    let title = "Dispatch control layer is stable";
    let text =
      "Billing, compliance fields, and order linkage can be handled from one operational workspace.";
    let tone = "calm";

    if (unlinkedCount > 0) {
      title = "Some dispatch records still lack order linkage";
      text = `${formatMetric(
        unlinkedCount
      )} dispatch record(s) are not linked to party orders, which increases commercial follow-up effort.`;
      tone = "attention";
    } else if (summary.pending > 0) {
      title = "Pending dispatch records still need closure";
      text = `${formatMetric(
        summary.pending
      )} dispatch record(s) are still pending and should be reviewed for billing and compliance completion.`;
      tone = "strong";
    }

    return { title, text, tone, unlinkedCount };
  }, [reports, summary.pending]);

  const dispatchFocusTiles = useMemo(
    () => [
      {
        label: "Pending Dispatches",
        value: formatMetric(summary.pending),
        note: "Operational records awaiting closure",
        tone: summary.pending > 0 ? "attention" : "calm",
      },
      {
        label: "Unlinked To Order",
        value: formatMetric(dispatchControlBrief.unlinkedCount),
        note: "Commercial linkage still missing",
        tone: dispatchControlBrief.unlinkedCount > 0 ? "attention" : "calm",
      },
      {
        label: "Filtered Tons",
        value: formatMetric(filteredSummary.quantity),
        note: "Quantity inside the current view",
        tone: filteredSummary.quantity > 0 ? "strong" : "calm",
      },
      {
        label: "Invoice Value In View",
        value: formatMetric(filteredSummary.invoiceValue),
        note: "Commercial value matching current filters",
        tone: filteredSummary.invoiceValue > 0 ? "strong" : "calm",
      },
    ],
    [
      dispatchControlBrief.unlinkedCount,
      filteredSummary.invoiceValue,
      filteredSummary.quantity,
      summary.pending,
    ]
  );

  const getStatusBadgeStyle = (status) => {
    if (status === "completed") {
      return { ...styles.statusBadge, ...styles.completedBadge };
    }

    if (status === "pending") {
      return { ...styles.statusBadge, ...styles.pendingBadge };
    }

    return { ...styles.statusBadge, ...styles.cancelledBadge };
  };

  const renderVehicleOptionLabel = (vehicle) => {
    const parts = [
      vehicle.vehicleNumber,
      vehicle.vehicleType,
      vehicle.assignedDriver,
      vehicle.vehicleCapacityTons ? `${vehicle.vehicleCapacityTons} tons` : "",
      vehicle.vendorName ? `Vendor ${vehicle.vendorName}` : "",
      vehicle.ownershipType ? vehicle.ownershipType.replace(/_/g, " ") : "",
    ].filter(Boolean);

    return parts.join(" • ");
  };

  const renderDispatchLogisticsAssistant = ({
    payload,
    selectedVehicle,
    selectedTransportVendor,
    billingPreview,
    vehicleSearchValue,
    onVehicleSearchChange,
    isEdit = false,
  }) => {
    const matchingVehicles = vehiclesForPlant(payload.plantId, vehicleSearchValue);

    return (
      <div style={styles.dispatchAssistantCard}>
        <div style={styles.dispatchAssistantHeader}>
          <div>
            <p style={styles.dispatchAssistantEyebrow}>
              {isEdit ? "Edit Logistics Assistant" : "Dispatch Logistics Assistant"}
            </p>
            <strong style={styles.dispatchAssistantTitle}>
              Keep vehicle choice tied to transporter and cost readiness
            </strong>
          </div>
          <span style={styles.dispatchAssistantBadge}>
            {payload.plantId
              ? `${formatMetric(matchingVehicles.length)} ready vehicles`
              : "Select plant first"}
          </span>
        </div>

        <div style={styles.dispatchAssistantGrid}>
          <div style={styles.dispatchAssistantBlock}>
            <label style={styles.dispatchAssistantLabel}>Search vehicles</label>
            <input
              value={vehicleSearchValue}
              onChange={(event) => onVehicleSearchChange(event.target.value)}
              placeholder={
                payload.plantId
                  ? "Search by vehicle no., type, driver, vendor"
                  : "Select plant first to search vehicles"
              }
              style={styles.input}
              disabled={!payload.plantId}
            />
            <span style={styles.dispatchAssistantHint}>
              Search narrows the vehicle dropdown without leaving dispatch entry.
            </span>
          </div>

          <div style={styles.dispatchAssistantBlock}>
            <label style={styles.dispatchAssistantLabel}>Selected vehicle</label>
            <div style={styles.dispatchAssistantSummary}>
              <strong>{selectedVehicle?.vehicleNumber || "No vehicle selected"}</strong>
              <span>
                {selectedVehicle
                  ? [
                      selectedVehicle.vehicleType,
                      selectedVehicle.assignedDriver || "No driver",
                      selectedVehicle.vehicleCapacityTons
                        ? `${selectedVehicle.vehicleCapacityTons} tons`
                        : "Capacity not set",
                    ].join(" • ")
                  : "Choose the dispatch vehicle after selecting plant."}
              </span>
            </div>
          </div>

          <div style={styles.dispatchAssistantBlock}>
            <label style={styles.dispatchAssistantLabel}>Transport linkage</label>
            <div style={styles.dispatchAssistantSummary}>
              <strong>{selectedTransportVendor?.vendorName || "No transport vendor linked"}</strong>
              <span>
                {selectedTransportVendor
                  ? billingPreview.transportRate
                    ? `Active ${billingPreview.transportRateType} rate found for this plant/material combination`
                    : "Vendor linked, but no active transport rate found for this plant/material combination"
                  : "Link a transporter through the vehicle or select one manually below."}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.dispatchAssistantActions}>
          <Link to="/vehicles" style={styles.helperLinkButton}>
            Open Vehicles
          </Link>
          <Link to="/vendors" style={styles.helperLinkButton}>
            Open Vendors
          </Link>
          <Link to="/transport-rates" style={styles.helperLinkButton}>
            Open Transport Rates
          </Link>
        </div>
      </div>
    );
  };

  const renderQuantityInputSection = ({
    payload,
    setter,
    billingPreview,
    selectedVehicle,
  }) => {
    const quantitySource = String(payload.quantitySource || "").trim();
    const normalizedPreview = billingPreview.quantityPreview;
    const usesDirectTons =
      !quantitySource || quantitySource === "weighbridge" || quantitySource === "manual_weight";
    const isManualVolume = quantitySource === "manual_volume";
    const isVehicleCapacity = quantitySource === "vehicle_capacity";
    const isTripEstimate = quantitySource === "trip_estimate";
    return (
      <>
        <div style={styles.fullWidthField}>
          <div style={styles.fieldGroupCard}>
            <div style={styles.fieldGroupHeader}>
              <div>
                <p style={styles.fieldGroupEyebrow}>Quantity</p>
                <strong style={styles.fieldGroupTitle}>Choose how quantity is captured</strong>
              </div>
            </div>

            <div style={styles.form}>
              <div style={styles.fieldStack}>
                <label style={styles.fieldLabel}>Quantity Source</label>
                <select
                  name="quantitySource"
                  value={payload.quantitySource}
                  onChange={handleChange(setter)}
                  style={styles.input}
                >
                  <option value="">Legacy Quantity Tons</option>
                  {QUANTITY_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {usesDirectTons && (
                <div style={styles.fieldStack}>
                  <label style={styles.fieldLabel}>Quantity Tons / MT</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="quantityTons"
                    placeholder="Enter quantity in tons"
                    value={payload.quantityTons}
                    onChange={handleChange(setter)}
                    style={styles.input}
                  />
                </div>
              )}

              {isManualVolume && (
                <>
                  <div style={styles.fieldStack}>
                    <label style={styles.fieldLabel}>Entered Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="enteredQuantity"
                      placeholder="Enter measured quantity"
                      value={payload.enteredQuantity}
                      onChange={handleChange(setter)}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldStack}>
                    <label style={styles.fieldLabel}>Unit</label>
                    <select
                      name="enteredUnitId"
                      value={payload.enteredUnitId}
                      onChange={handleChange(setter)}
                      style={styles.input}
                    >
                      <option value="">Select unit from masters</option>
                      {availableUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unitCode || unit.unitName}
                          {unit.dimensionType ? ` • ${unit.dimensionType}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {isTripEstimate && (
                <div style={styles.fieldStack}>
                  <label style={styles.fieldLabel}>Trip Count</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="enteredQuantity"
                    placeholder="Enter trip count"
                    value={payload.enteredQuantity}
                    onChange={handleChange(setter)}
                    style={styles.input}
                  />
                </div>
              )}

              {(isVehicleCapacity || isTripEstimate) && (
                <div style={styles.fieldStack}>
                  <label style={styles.fieldLabel}>Selected Vehicle Capacity</label>
                  <input
                    value={
                      selectedVehicle?.vehicleCapacityTons
                        ? `${roundMetric(selectedVehicle.vehicleCapacityTons, 3)} tons`
                        : "Capacity not configured on selected vehicle"
                    }
                    style={styles.input}
                    disabled
                  />
                </div>
              )}

              <div style={styles.fullWidthField}>
                <div style={styles.quantityModeCard}>
                  <span style={styles.previewLabel}>Converted Quantity</span>
                  <strong style={styles.previewValue}>
                    {normalizedPreview.value !== null
                      ? `${formatMetric(normalizedPreview.value)} tons`
                      : "Awaiting system normalization"}
                  </strong>
                  <span style={styles.previewHint}>{normalizedPreview.note}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(isVehicleCapacity || isTripEstimate) && (
          <div style={styles.fullWidthField}>
            <div style={styles.inlineInfoBanner}>
              Vehicle capacity hint:{" "}
              <strong>
                {selectedVehicle?.vehicleCapacityTons
                  ? `${roundMetric(selectedVehicle.vehicleCapacityTons, 3)} tons`
                  : "capacity missing on selected vehicle"}
              </strong>
              {isTripEstimate
                ? ` • Current estimate: ${payload.enteredQuantity || 1} trip(s)`
                : " • One trip will use the linked vehicle capacity."}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderBillingPreview = (billingPreview) => (
    <>
      <div style={styles.billingFlowNote}>
        Estimated Preview only. Final amount after save will be calculated by system using backend billing, transport, and tax rules.
      </div>

      {billingPreview.requiresPartyRate && !billingPreview.hasPartyRate ? (
        <div style={styles.overrideWarningCard}>
          <strong>Billing preview is blocked until party material rate is configured</strong>
          <span>
            Create an active rate for this party + plant + material combination first. Dispatch save is intentionally blocked without it.
          </span>
        </div>
      ) : null}

      {billingPreview.hasManualOverride ? (
        <div style={styles.overrideWarningCard}>
          <strong>Manual taxable value override is active</strong>
          <span>
            Auto value: {billingPreview.computedTotal.toFixed(2)} | Override:{" "}
            {billingPreview.finalInvoiceValue.toFixed(2)} | Difference:{" "}
            {billingPreview.overrideAmount.toFixed(2)}
          </span>
        </div>
      ) : null}

      {!billingPreview.quantityPreview.canCalculateLocally ? (
        <div style={styles.overrideWarningCard}>
          <strong>Frontend preview is partial for this quantity mode</strong>
          <span>{billingPreview.quantityPreview.note}</span>
        </div>
      ) : null}

      <div style={styles.previewGrid}>
        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Normalized Quantity</span>
          <strong style={styles.previewValue}>
            {billingPreview.quantityPreview.value !== null
              ? `${formatMetric(billingPreview.quantityPreview.value)} tons`
              : "Backend after save"}
          </strong>
          <span style={styles.previewHint}>{billingPreview.quantityPreview.sourceLabel}</span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Billing Basis</span>
          <strong style={styles.previewValue}>
            {getFriendlyBasisLabel(billingPreview.materialRateUnit)}
          </strong>
          <span style={styles.previewHint}>
            {billingPreview.materialRateUnitLabel || "ton"}
          </span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Billing Quantity</span>
          <strong style={styles.previewValue}>
            {billingPreview.estimatedBillingQuantity !== null
              ? formatMetric(billingPreview.estimatedBillingQuantity)
              : "After save"}
          </strong>
          <span style={styles.previewHint}>Indicative billing quantity</span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Rate</span>
          <strong style={styles.previewValue}>
            {billingPreview.materialRatePerTon || 0}
          </strong>
          <span style={styles.previewHint}>
            per {billingPreview.materialRateUnitLabel || "ton"}
          </span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Material Amount</span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.materialAmount)}
          </strong>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Royalty</span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.royaltyAmount)}
          </strong>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Loading Charge</span>
          <strong style={styles.previewValue}>
            {formatCurrency(Number(billingPreview.loadingCharge || 0))}
          </strong>
          <span style={styles.previewHint}>
            {billingPreview.loadingChargeIsManual
              ? `Manual override • Auto ${formatCurrency(
                  Number(billingPreview.autoLoadingCharge || 0)
                )}`
              : `${getLoadingBasisLabel(
                  billingPreview.loadingChargeBasis
                )} • ${formatLoadingRateLabel(
                  billingPreview.loadingChargeBasis,
                  billingPreview.loadingChargeRate
                )}`}
          </span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Transport Basis</span>
          <strong style={styles.previewValue}>
            {getFriendlyBasisLabel(billingPreview.transportRateType)}
          </strong>
          <span style={styles.previewHint}>
            {billingPreview.estimatedTransportQuantity !== null
              ? `Qty ${formatMetric(billingPreview.estimatedTransportQuantity)}`
              : "Vendor/rate optional"}
          </span>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Transport Amount</span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.transportCost)}
          </strong>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Other Charge</span>
          <strong style={styles.previewValue}>
            {formatCurrency(Number(billingPreview.otherCharge || 0))}
          </strong>
        </div>

        <div style={{ ...styles.previewCard, ...styles.previewCardStrong }}>
          <span style={styles.previewLabel}>GST</span>
          <strong style={styles.previewValue}>
            {billingPreview.selectedMaterial?.gstRate !== null &&
            billingPreview.selectedMaterial?.gstRate !== undefined
              ? `${formatMetric(billingPreview.selectedMaterial.gstRate)}%`
              : "After save"}
          </strong>
          <span style={styles.previewHint}>
            Final tax amount is backend-confirmed after save
          </span>
        </div>

        <div style={{ ...styles.previewCard, ...styles.previewCardStrong }}>
          <span style={styles.previewLabel}>Grand Total</span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.finalInvoiceValue)}
          </strong>
        </div>

        <div
          style={{
            ...styles.previewCard,
            ...(billingPreview.hasManualOverride
              ? styles.previewCardWarn
              : styles.previewCardStrong),
          }}
        >
          <span style={styles.previewLabel}>
            {billingPreview.hasManualOverride
              ? "Manual Override"
              : "System Note"}
          </span>
          <strong style={styles.previewValue}>
            {billingPreview.hasManualOverride
              ? formatCurrency(billingPreview.finalInvoiceValue)
              : "Auto"}
          </strong>
          <span style={styles.previewHint}>
            Final amount after save will be calculated by system
          </span>
        </div>
      </div>
    </>
  );

  const renderBackendResponsePreview = (report, title) => {
    if (!report) {
      return null;
    }

    return (
      <div style={styles.backendPreviewWrap}>
        <div style={styles.backendPreviewHeader}>
          <div>
            <p style={styles.dispatchAssistantEyebrow}>Backend Response Preview</p>
            <strong style={styles.dispatchAssistantTitle}>{title}</strong>
          </div>
          <span style={styles.dispatchAssistantBadge}>
            Dispatch #{report.id || "Saved"}
          </span>
        </div>

        <div style={styles.previewGrid}>
          <div style={{ ...styles.previewCard, ...styles.previewCardStrong }}>
            <span style={styles.previewLabel}>quantityTons</span>
            <strong style={styles.previewValue}>
              {formatMetric(report.quantityTons || 0)}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>billingBasisSnapshot</span>
            <strong style={styles.previewValue}>
              {report.billingBasisSnapshot || "-"}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>billedQuantitySnapshot</span>
            <strong style={styles.previewValue}>
              {report.billedQuantitySnapshot ?? "-"}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>billedRateSnapshot</span>
            <strong style={styles.previewValue}>
              {report.billedRateSnapshot ?? "-"}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>transportBasisSnapshot</span>
            <strong style={styles.previewValue}>
              {report.transportBasisSnapshot || "-"}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>transportQuantitySnapshot</span>
            <strong style={styles.previewValue}>
              {report.transportQuantitySnapshot ?? "-"}
            </strong>
          </div>
          <div style={styles.previewCard}>
            <span style={styles.previewLabel}>transportRateValue</span>
            <strong style={styles.previewValue}>
              {report.transportRateValue ?? "-"}
            </strong>
          </div>
          <div style={{ ...styles.previewCard, ...styles.previewCardStrong }}>
            <span style={styles.previewLabel}>totalInvoiceValue</span>
            <strong style={styles.previewValue}>
              {formatCurrency(report.totalInvoiceValue || 0)}
            </strong>
          </div>
        </div>
      </div>
    );
  };

  const renderPartyOrderPreview = (order) => {
    if (!order) {
      return null;
    }

    return (
      <div style={styles.orderPreviewCard}>
        <div style={styles.orderPreviewHeader}>
          <strong>{order.orderNumber}</strong>
          <span style={styles.orderPreviewMeta}>
            {order.orderDate} • {order.partyName}
          </span>
        </div>

        <div style={styles.orderPreviewGrid}>
          <div style={styles.orderPreviewMetric}>
            <span style={styles.previewLabel}>Ordered</span>
            <strong style={styles.previewValue}>
              {formatMetric(order.orderedQuantityTons)} tons
            </strong>
          </div>
          <div style={styles.orderPreviewMetric}>
            <span style={styles.previewLabel}>Planned</span>
            <strong style={styles.previewValue}>
              {formatMetric(order.plannedQuantityTons)} tons
            </strong>
          </div>
          <div style={styles.orderPreviewMetric}>
            <span style={styles.previewLabel}>Completed</span>
            <strong style={styles.previewValue}>
              {formatMetric(order.completedQuantityTons)} tons
            </strong>
          </div>
          <div style={styles.orderPreviewMetric}>
            <span style={styles.previewLabel}>Pending</span>
            <strong style={styles.previewValue}>
              {formatMetric(order.pendingQuantityTons)} tons
            </strong>
          </div>
        </div>
      </div>
    );
  };

  const getPartyOptionsForPayload = (payload) =>
    parties
      .filter(
        (party) =>
          party.isActive || String(party.id) === String(payload.partyId || "")
      )
      .sort((left, right) =>
        String(left.partyName || "").localeCompare(String(right.partyName || ""))
      );

  const renderDispatchFormGroups = ({
    payload,
    setter,
    billingPreview,
    readiness,
    warnings,
    selectedPlant,
    selectedVehicle,
    selectedTransportVendor,
    selectedPartyOrder,
    sourceTypeOptions,
    transportVendorOptions,
    vehicleSearchValue,
    onVehicleSearchChange,
    savedPreview,
    savedPreviewTitle,
    loadingResetHandler,
    commercialRefreshMessage = "",
    isEdit = false,
  }) => (
    <>
      {selectedPlant ? (
        <div style={styles.inlineInfoBanner}>
          Dispatching from <strong>{selectedPlant.plantName}</strong>. Type:{" "}
          {selectedPlant.plantType || "Not set"}. Recommended source:{" "}
          {getRecommendedSourceType(selectedPlant.plantType)}.
          {!selectedPlant.isActive ? " Status: inactive in masters." : ""}
        </div>
      ) : null}

      {!activePlants.length ? (
        <div
          style={{
            ...styles.warningPanel,
            ...styles.warningPanelDanger,
          }}
        >
          No active plants/units are available from masters right now. Add or reactivate a
          plant before creating dispatch records.
        </div>
      ) : null}

      <div style={styles.fieldGroupCard}>
        <div style={styles.fieldGroupHeader}>
          <div>
            <p style={styles.fieldGroupEyebrow}>Dispatch Basics</p>
            <strong style={styles.fieldGroupTitle}>Core dispatch details</strong>
          </div>
        </div>

        <div style={styles.form}>
          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Dispatch Date</label>
            <input
              type="date"
              name="dispatchDate"
              value={payload.dispatchDate}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Plant / Source</label>
            <select
              name="plantId"
              value={payload.plantId}
              onChange={handleChange(setter)}
              style={styles.input}
            >
              <option value="">Select Plant / Unit</option>
              {plantOptions.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                  {plant.plantType ? ` • ${plant.plantType}` : ""}
                  {!plant.isActive ? " • Inactive" : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Source Type</label>
            <select
              name="sourceType"
              value={payload.sourceType}
              onChange={handleChange(setter)}
              style={styles.input}
            >
              <option value="">Select Source Type</option>
              {sourceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Party</label>
            <select
              name="partyId"
              value={payload.partyId}
              onChange={handleChange(setter)}
              style={styles.input}
              disabled={!payload.plantId || !payload.materialId}
            >
              <option value="">
                {payload.materialId ? "Select Party / Customer" : "Select Material First"}
              </option>
              {getPartyOptionsForPayload(payload).map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyName}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Material</label>
            <select
              name="materialId"
              value={payload.materialId}
              onChange={handleChange(setter)}
              style={styles.input}
              disabled={loadingMasters || !payload.plantId}
            >
              <option value="">
                {payload.plantId ? "Select Material" : "Select Plant First"}
              </option>
              {availableMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.materialName}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Destination</label>
            <input
              name="destinationName"
              placeholder="Enter destination"
              value={payload.destinationName}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Party Order</label>
            <select
              name="partyOrderId"
              value={payload.partyOrderId}
              onChange={handleChange(setter)}
              style={styles.input}
              disabled={!payload.partyId || !payload.materialId}
            >
              <option value="">
                {payload.partyId
                  ? hasMatchingPartyOrders(payload, payload.partyOrderId)
                    ? "Select Party Order for fulfillment"
                    : "Link Party Order (optional)"
                  : "Select Party First"}
              </option>
              {getAvailablePartyOrders(payload, payload.partyOrderId).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} • Pending {formatMetric(order.pendingQuantityTons)} tons
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.fieldStack, ...styles.fullWidthField }}>
            <label style={styles.fieldLabel}>Remarks</label>
            <input
              name="remarks"
              placeholder="Optional dispatch remarks"
              value={payload.remarks}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>
        </div>

        {renderPartyOrderPreview(selectedPartyOrder)}
        {!selectedPartyOrder && hasMatchingPartyOrders(payload, payload.partyOrderId) && (
          <div style={styles.orderPreviewCard}>
            <div style={styles.orderPreviewHeader}>
              <strong>Select a party order</strong>
              <span style={styles.orderPreviewMeta}>
                Matching pending orders exist for this party, plant, and material. Link one
                before saving so the remaining balance updates correctly.
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={styles.fieldGroupCard}>
        <div style={styles.fieldGroupHeader}>
          <div>
            <p style={styles.fieldGroupEyebrow}>Vehicle & Transport</p>
            <strong style={styles.fieldGroupTitle}>Logistics and compliance</strong>
          </div>
        </div>

        <div style={styles.fullWidthField}>
          {renderDispatchLogisticsAssistant({
            payload,
            selectedVehicle,
            selectedTransportVendor,
            billingPreview,
            vehicleSearchValue,
            onVehicleSearchChange,
            isEdit,
          })}
        </div>

        <div style={styles.form}>
          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Vehicle</label>
            <select
              name="vehicleId"
              value={payload.vehicleId}
              onChange={handleChange(setter)}
              style={styles.input}
              disabled={!payload.plantId}
            >
              <option value="">
                {payload.plantId ? "Select Vehicle" : "Select Plant First"}
              </option>
              {vehiclesForPlant(payload.plantId, vehicleSearchValue).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {renderVehicleOptionLabel(vehicle)}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Driver</label>
            <input
              value={selectedVehicle?.assignedDriver || "No driver assigned"}
              style={styles.input}
              disabled
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Transport Vendor</label>
            <select
              name="transportVendorId"
              value={payload.transportVendorId}
              onChange={handleChange(setter)}
              style={styles.input}
              disabled={!payload.materialId}
            >
              <option value="">Auto from vehicle or select manually</option>
              {transportVendorOptions.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Distance KM</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="distanceKm"
              placeholder="Enter distance"
              value={payload.distanceKm}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>E-Way Bill Number</label>
            <input
              name="ewbNumber"
              placeholder="12 digit EWB number"
              value={payload.ewbNumber}
              onChange={handleChange(setter)}
              style={styles.input}
              inputMode="numeric"
              maxLength={12}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>E-Way Bill Date</label>
            <input
              type="date"
              name="ewbDate"
              value={payload.ewbDate}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>E-Way Bill Valid Upto</label>
            <input
              type="date"
              name="ewbValidUpto"
              value={payload.ewbValidUpto}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {renderQuantityInputSection({
        payload,
        setter,
        billingPreview,
        selectedVehicle,
      })}

      <div style={styles.fieldGroupCard}>
        <div style={styles.fieldGroupHeader}>
          <div>
            <p style={styles.fieldGroupEyebrow}>Commercial Preview</p>
            <strong style={styles.fieldGroupTitle}>Estimated preview before save</strong>
          </div>
        </div>

        <div
          style={{
            ...styles.readinessStrip,
            ...(readiness.isReady ? styles.readinessOk : styles.readinessWarn),
          }}
        >
          <strong>{isEdit ? "Ready to update" : "Ready to save"}</strong>
          <span>
            {readiness.isReady
              ? "Estimated preview is available. Final amount after save will be calculated by system."
              : readiness.missingItems.join(" • ")}
          </span>
        </div>

        <WarningList warnings={warnings} tone={isEdit ? "danger" : "warn"} />
        {commercialRefreshMessage ? (
          <div style={styles.overrideWarningCard}>
            <strong>Commercial refresh available</strong>
            <span>{commercialRefreshMessage}</span>
          </div>
        ) : null}
        {renderBillingPreview(billingPreview)}
        {renderBackendResponsePreview(savedPreview, savedPreviewTitle)}
      </div>

      <div style={styles.fieldGroupCard}>
        <div style={styles.fieldGroupHeader}>
          <div>
            <p style={styles.fieldGroupEyebrow}>Optional Commercial Controls</p>
            <strong style={styles.fieldGroupTitle}>Legacy-compatible billing and invoice fields</strong>
          </div>
        </div>

        <div style={styles.inlineInfoBanner}>
          Legacy quantity tons, invoice override, loading override, and invoice fields remain
          available for compatibility. Hidden technical snapshot and conversion fields are preserved
          by the system and are not shown here.
        </div>

        <div style={styles.form}>
          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Invoice Number</label>
            <input
              name="invoiceNumber"
              placeholder="Blank = auto on completion"
              value={payload.invoiceNumber}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Invoice Date</label>
            <input
              type="date"
              name="invoiceDate"
              value={payload.invoiceDate}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Manual Taxable Value Override</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="invoiceValue"
              placeholder="Leave blank for auto"
              value={payload.invoiceValue}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldStack}>
            <label style={styles.fieldLabel}>Other Charge</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="otherCharge"
              placeholder="Optional extra charge"
              value={payload.otherCharge}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>

          <div style={{ ...styles.fieldStack, ...styles.fullWidthField }}>
            <label style={styles.fieldLabel}>Loading</label>
            <div style={styles.inlineFieldWithAction}>
              <input
                type="number"
                step="0.01"
                min="0"
                name="loadingCharge"
                placeholder={
                  billingPreview.loadingChargeIsManual
                    ? "Manual Loading Charge"
                    : `Auto Loading • ${getLoadingBasisLabel(
                        billingPreview.loadingChargeBasis
                      )}`
                }
                value={
                  payload.loadingChargeManual
                    ? payload.loadingCharge
                    : String(billingPreview.loadingCharge || "")
                }
                onChange={handleLoadingChargeChange(setter)}
                style={{ ...styles.input, marginBottom: 0 }}
                disabled={!billingPreview.hasPartyRate}
              />
              {payload.loadingChargeManual ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={loadingResetHandler}
                >
                  Reset Loading
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ ...styles.fieldStack, ...styles.fullWidthField }}>
            <label style={styles.fieldLabel}>Billing Notes</label>
            <input
              name="billingNotes"
              placeholder="Required if taxable value is manually overridden"
              value={payload.billingNotes}
              onChange={handleChange(setter)}
              style={styles.input}
            />
          </div>
        </div>
      </div>
    </>
  );

  const formReadiness = buildDispatchReadiness(formData, formBillingPreview);
  const editReadiness = buildDispatchReadiness(editForm, editBillingPreview);
  const formWarnings = buildDispatchWarnings(
    formData,
    formBillingPreview,
    formPartyOrder
  );
  const editWarnings = buildDispatchWarnings(
    editForm,
    editBillingPreview,
    editPartyOrder
  );

  const handleExportCsv = () => {
    if (filteredReports.length === 0) {
      setError("No dispatch reports match the current filters for export");
      setSuccess("");
      return;
    }

    const rows = filteredReports.map((report) => ({
      dispatch_date: toDateOnlyValue(report.dispatchDate),
      plant: report.plantName || report.sourceName || "",
      source_type: report.sourceType || "",
      party: report.partyName || "",
      material: report.materialName || report.materialType || "",
      order_number: report.partyOrderNumber || "",
      linked_order: report.partyOrderId ? "Yes" : "No",
      vehicle: report.linkedVehicleNumber || report.vehicleNumber || "",
      destination: report.destinationName || "",
      quantity_tons: Number(report.quantityTons || 0),
      total_invoice_value: Number(report.totalInvoiceValue ?? report.invoiceValue ?? 0),
      invoice_number: report.invoiceNumber || "",
      ewb_number: report.ewbNumber || "",
      status: report.status || "",
      remarks: report.remarks || "",
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = getTimestampFileLabel();

    anchor.href = url;
    anchor.download = `dispatch-reports-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    setSuccess("Dispatch reports export downloaded");
    setError("");
  };

  return (
    <AppShell
      title="Dispatch Reports"
      subtitle="Premium dispatch operations with billing intelligence, linked masters, and practical daily controls"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>Dispatch Operations Layer</p>
              <h1 style={styles.heroTitle}>Dispatch Billing Control Center</h1>
              <p style={styles.heroText}>
                Record plant-wise material movement with party billing, transport
                cost, royalty logic, and invoice-ready dispatch details.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Billing Logic</span>
                <strong style={styles.heroPillValue}>Auto-filled, override-ready</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Compliance</span>
                <strong style={styles.heroPillValue}>Invoice + EWB ready</strong>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.controlBrief,
            ...(dispatchControlBrief.tone === "attention"
              ? styles.controlBriefAttention
              : dispatchControlBrief.tone === "strong"
                ? styles.controlBriefStrong
                : styles.controlBriefCalm),
          }}
        >
          <div style={styles.controlBriefCopy}>
            <p style={styles.controlBriefEyebrow}>Dispatch Guidance</p>
            <h2 style={styles.controlBriefTitle}>{dispatchControlBrief.title}</h2>
            <p style={styles.controlBriefText}>{dispatchControlBrief.text}</p>
          </div>

          <div style={styles.controlBriefActions}>
            <button type="button" style={styles.button} onClick={() => setShowForm(true)}>
              Add Dispatch
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setLinkedOrderFilter("unlinked")}
            >
              Focus Unlinked
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setStatusFilter("pending")}
            >
              Focus Pending
            </button>
          </div>
        </div>

        <div style={styles.focusTileGrid}>
          {dispatchFocusTiles.map((tile) => (
            <div
              key={tile.label}
              style={{
                ...styles.focusTile,
                ...(tile.tone === "attention"
                  ? styles.focusTileAttention
                  : tile.tone === "strong"
                    ? styles.focusTileStrong
                    : styles.focusTileCalm),
              }}
            >
              <span style={styles.focusTileLabel}>{tile.label}</span>
              <strong style={styles.focusTileValue}>{tile.value}</strong>
              <p style={styles.focusTileText}>{tile.note}</p>
            </div>
          ))}
        </div>

        {(mastersError || error) && (
          <div style={styles.messageError}>{mastersError || error}</div>
        )}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {unitsWarning && <WarningList warnings={[unitsWarning]} />}
        {materialConversionsWarning && (
          <WarningList warnings={[materialConversionsWarning]} />
        )}
        {isLoadingData && (
          <div style={styles.loadingBanner}>
            Refreshing dispatch masters, vehicles, and billing references...
          </div>
        )}
        {!canManageDispatchRecords && (
          <div style={styles.loadingBanner}>
            This role has read-only dispatch access. You can review records and print documents, but create, edit, and status-change actions are restricted.
          </div>
        )}

        <SectionCard title="Dispatch Workspace Health">
          <div style={styles.syncBanner}>
            <div>
              <p style={styles.syncLabel}>Commercial Source Of Truth</p>
              <strong style={styles.syncValue}>
                {refreshingMasters
                  ? "Refreshing master references..."
                  : `Last master sync: ${mastersSyncLabel}`}
              </strong>
            </div>
            <span style={styles.syncNote}>
              Dispatch billing now depends on scoped plants, materials, parties, vehicles, and rate tables instead of UI-only assumptions.
            </span>
          </div>

          <div style={styles.healthGrid}>
            {dispatchWorkspaceHealth.map((item) => (
              <div key={item.label} style={styles.healthCard}>
                <span style={styles.healthLabel}>{item.label}</span>
                <strong style={styles.healthValue}>{formatMetric(item.value)}</strong>
                <p style={styles.healthNote}>{item.note}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Dispatch Overview">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Records</span>
              <p style={styles.summaryLabel}>Total Dispatches</p>
              <h3 style={styles.summaryValue}>{summary.totalDispatches}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Quantity</span>
              <p style={styles.summaryLabel}>Total Tons</p>
              <h3 style={styles.summaryValue}>{summary.totalQuantity}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Billing</span>
              <p style={styles.summaryLabel}>Total Invoice Value</p>
              <h3 style={styles.summaryValue}>{summary.totalInvoiceValue}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
              <span style={styles.summaryTag}>Pending</span>
              <p style={styles.summaryLabel}>Pending Records</p>
              <h3 style={styles.summaryValue}>{summary.pending}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Completed</span>
              <p style={styles.summaryLabel}>Completed Records</p>
              <h3 style={styles.summaryValue}>{summary.completed}</h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Dispatch Workspace">
          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Dispatch Entry</h3>
              </div>
              <p style={styles.blockSubtitle}>
                Keep the form open only when needed and list open when reviewing records.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowList((prev) => !prev)}
              >
                {showList ? "Hide List" : "Show List"}
              </button>

              <button
                type="button"
                style={showForm ? styles.secondaryButton : styles.button}
                onClick={() => setShowForm((prev) => !prev)}
                disabled={!canManageDispatchRecords}
              >
                {showForm ? "Hide Form" : "Add Dispatch"}
              </button>
            </div>
          </div>

          {showForm && canManageDispatchRecords && (
            <form onSubmit={handleSubmit} style={styles.formSectionStack}>
              <div style={styles.advisoryGrid}>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Compliance</span>
                  <strong style={styles.advisoryTitle}>Invoice and E-Way details are closure controls</strong>
                  <p style={styles.advisoryText}>
                    A pending dispatch can be recorded before billing is finalized. Once invoice work
                    starts, invoice date and E-Way details should be completed before operational closure.
                  </p>
                </div>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Plant Context</span>
                  <strong style={styles.advisoryTitle}>Source type now follows plant intent</strong>
                  <p style={styles.advisoryText}>
                    Crusher plants default to `Crusher`, while other plants default to `Plant`, so
                    dispatch classification stays more consistent with the master setup.
                  </p>
                </div>
              </div>
              {renderDispatchFormGroups({
                payload: formData,
                setter: setFormData,
                billingPreview: formBillingPreview,
                readiness: formReadiness,
                warnings: formWarnings,
                selectedPlant: selectedPlantForForm,
                selectedVehicle: selectedVehicleForForm,
                selectedTransportVendor: selectedTransportVendorForForm,
                selectedPartyOrder: formPartyOrder,
                sourceTypeOptions: sourceTypeOptionsForForm,
                transportVendorOptions: transportVendorOptionsForForm,
                vehicleSearchValue: vehicleSearch,
                onVehicleSearchChange: setVehicleSearch,
                savedPreview: savedCreatePreview,
                savedPreviewTitle: "Backend-confirmed values after save",
                loadingResetHandler: handleResetFormLoadingToAuto,
              })}

              <button
                type="submit"
                style={styles.button}
                disabled={
                  isSubmitting || !activePlants.length || !formReadiness.isReady
                }
                title={
                  formReadiness.isReady
                    ? "Save dispatch report"
                    : `Blocked: ${formReadiness.missingItems.join(" | ")}`
                }
              >
                {isSubmitting ? "Saving Dispatch..." : "Add Dispatch Report"}
              </button>
            </form>
          )}
        </SectionCard>

        {editRecord && canManageDispatchRecords && (
          <SectionCard title={`Edit Dispatch — ${editRecord.destinationName}`}>
            <p style={styles.sectionSubtitle}>
              Update dispatch details, billing values, and invoice-linked data without creating duplicate records.
            </p>

            <form onSubmit={handleEditSubmit} style={styles.formSectionStack}>
              {renderDispatchFormGroups({
                payload: editForm,
                setter: setEditForm,
                billingPreview: editBillingPreview,
                readiness: editReadiness,
                warnings: editWarnings,
                selectedPlant: selectedPlantForEdit,
                selectedVehicle: selectedVehicleForEdit,
                selectedTransportVendor: selectedTransportVendorForEdit,
                selectedPartyOrder: editPartyOrder,
                sourceTypeOptions: sourceTypeOptionsForEdit,
                transportVendorOptions: transportVendorOptionsForEdit,
                vehicleSearchValue: editVehicleSearch,
                onVehicleSearchChange: setEditVehicleSearch,
                savedPreview: savedEditPreview,
                savedPreviewTitle: "Backend-confirmed values after update",
                loadingResetHandler: handleResetEditLoadingToAuto,
                commercialRefreshMessage: editCommercialRefreshMessage,
                isEdit: true,
              })}

              <div style={styles.actionRow}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={handleResetEditBillingToAuto}
                  disabled={isUpdating}
                >
                  Reset To Auto Billing
                </button>
                <button
                  type="submit"
                  style={styles.button}
                  disabled={isUpdating || !editReadiness.isReady}
                  title={
                    editReadiness.isReady
                      ? "Save dispatch changes"
                      : `Blocked: ${editReadiness.missingItems.join(" | ")}`
                  }
                >
                  {isUpdating ? "Saving Changes..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeEditPanel}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard title="Search & Filters">
          <p style={styles.sectionSubtitle}>
            Search dispatch records by plant, material, vehicle, party, destination, EWB number, or invoice number.
          </p>

          <div style={styles.quickFilterRow}>
            <button
              type="button"
              style={{
                ...styles.quickFilterButton,
                ...(statusFilter === "pending" && linkedOrderFilter === ""
                  ? styles.quickFilterButtonActive
                  : {}),
              }}
              onClick={() => {
                setStatusFilter("pending");
                setLinkedOrderFilter("");
                setPage(1);
              }}
            >
              Pending Dispatches ({formatMetric(dispatchSummary.pending || 0)})
            </button>
            <button
              type="button"
              style={{
                ...styles.quickFilterButton,
                ...(linkedOrderFilter === "unlinked" && statusFilter === ""
                  ? styles.quickFilterButtonActive
                  : {}),
              }}
              onClick={() => {
                setLinkedOrderFilter("unlinked");
                setStatusFilter("");
                setPage(1);
              }}
            >
              Unlinked To Order ({formatMetric(dispatchSummary.unlinkedOrders || 0)})
            </button>
            <button
              type="button"
              style={{
                ...styles.quickFilterButton,
                ...(statusFilter === "completed" && linkedOrderFilter === "linked"
                  ? styles.quickFilterButtonActive
                  : {}),
              }}
              onClick={() => {
                setStatusFilter("completed");
                setLinkedOrderFilter("linked");
                setPage(1);
              }}
            >
              Completed And Linked ({formatMetric(dispatchSummary.completed || 0)})
            </button>
          </div>

          <div style={styles.form}>
            <input
              placeholder="Search dispatch reports"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            />

            <select
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Plants / Units</option>
              {plantOptions.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                  {plant.plantType ? ` • ${plant.plantType}` : ""}
                  {!plant.isActive ? " • Inactive" : ""}
                </option>
              ))}
            </select>

            <select
              value={partyFilter}
              onChange={(e) => {
                setPartyFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Parties</option>
              {parties
                .filter((party) => party.isActive)
                .map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.partyName}
                  </option>
                ))}
            </select>

            <select
              value={materialFilter}
              onChange={(e) => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Materials</option>
              {availableMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.materialName}
                </option>
              ))}
            </select>

            <select
              value={sourceTypeFilter}
              onChange={(e) => {
                setSourceTypeFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Source Types</option>
              {ALL_SOURCE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={linkedOrderFilter}
              onChange={(e) => {
                setLinkedOrderFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            >
              <option value="">All Order Link States</option>
              <option value="linked">Linked To Order</option>
              <option value="unlinked">Not Linked To Order</option>
            </select>

            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => {
                setDateFromFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            />

            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => {
                setDateToFilter(e.target.value);
                setPage(1);
              }}
              style={styles.input}
            />
          </div>

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.count)} records • {formatMetric(filteredSummary.quantity)} tons • {formatMetric(filteredSummary.invoiceValue)} invoice value
            </span>

            <div style={styles.inlineActions}>
              {hasActiveFilters && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setSearch("");
                    setPlantFilter("");
                    setPartyFilter("");
                    setMaterialFilter("");
                    setLinkedOrderFilter("");
                    setSourceTypeFilter("");
                    setStatusFilter("");
                    setDateFromFilter("");
                    setDateToFilter("");
                    setPage(1);
                  }}
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                style={styles.button}
                onClick={handleExportCsv}
              >
                Export CSV
              </button>
            </div>
              </div>

              {dispatchPagination.totalPages > 1 && (
                <div style={styles.paginationRow}>
                  <span style={styles.filterMetaText}>
                    Page {dispatchPagination.page} of {dispatchPagination.totalPages}
                  </span>
                  <div style={styles.inlineActions}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={!dispatchPagination.hasPreviousPage}
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={!dispatchPagination.hasNextPage}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>

        {showList && (
          <SectionCard title="Dispatch Report List">
            <p style={styles.sectionSubtitle}>
              View and manage dispatch movement records with party billing, transport cost, status, EWB, and invoice details.
            </p>

            {filteredReports.length === 0 ? (
              <div style={styles.emptyStateCard}>
                <strong style={styles.emptyStateTitle}>
                  {hasActiveFilters
                    ? "No dispatch records match the current filters"
                    : "No dispatch reports found yet"}
                </strong>
                <p style={styles.emptyStateText}>
                  {hasActiveFilters
                    ? "Try broadening plant, source type, status, or search terms to surface the operational record you need."
                    : "Once dispatch entries are created, they will appear here with billing, E-Way, print, and status controls."}
                </p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
	                    <tr>
	                      <th style={styles.th}>Date</th>
	                      <th style={styles.th}>Plant</th>
	                      <th style={styles.th}>Party</th>
	                      <th style={styles.th}>Material</th>
	                      <th style={styles.th}>Order</th>
	                      <th style={styles.th}>Vehicle</th>
	                      <th style={styles.th}>Destination</th>
	                      <th style={styles.th}>Quantity</th>
	                      <th style={styles.th}>Total Invoice</th>
	                      <th style={styles.th}>Invoice Header</th>
	                      <th style={styles.th}>EWB</th>
	                      <th style={styles.th}>Status</th>
	                      <th style={styles.th}>Completion Readiness</th>
	                      <th style={styles.th}>Actions</th>
	                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      const completionBlockMessage = getDispatchCompletionBlockMessage(report);
                      const canCompleteDispatch = !completionBlockMessage;
                      const completionReadiness = getCompletionReadinessMeta(report);
                      const invoiceDisplayValue =
                        report.totalInvoiceValue ?? report.invoiceValue;

                      return (
                      <tr key={report.id}>
                        <td style={styles.td}>
                          <div style={styles.compactMetaStack}>
                            <span style={styles.compactMetaPrimary}>
                              {formatDisplayDate(report.dispatchDate)}
                            </span>
                            <span style={styles.compactMetaSecondary}>
                              {report.sourceType || "Source not set"}
                            </span>
                          </div>
                        </td>
                        <td style={styles.td}>{report.plantName || report.sourceName}</td>
                        <td style={styles.td}>{report.partyName || "-"}</td>
                        <td style={styles.td}>{report.materialName || report.materialType}</td>
                        <td style={styles.td}>{report.partyOrderNumber || "-"}</td>
                        <td style={styles.td}>
                          {report.linkedVehicleNumber || report.vehicleNumber}
                        </td>
                        <td style={styles.td}>{report.destinationName}</td>
                        <td style={styles.td}>{formatMetric(report.quantityTons)} tons</td>
	                        <td style={styles.td}>
	                          {invoiceDisplayValue === null || invoiceDisplayValue === undefined
                              ? "-"
                              : formatCurrency(invoiceDisplayValue)}
	                        </td>
	                        <td style={styles.td}>
	                          <div style={styles.compactMetaStack}>
	                            <span style={styles.compactMetaPrimary}>
	                              {report.invoiceNumber || "-"}
	                            </span>
	                            <span style={styles.compactMetaSecondary}>
	                              {report.invoiceDate
	                                ? formatDisplayDate(report.invoiceDate)
	                                : "Invoice date missing"}
	                            </span>
	                          </div>
	                        </td>
	                        <td style={styles.td}>
                            <div style={styles.compactMetaStack}>
                              <span style={styles.compactMetaPrimary}>{report.ewbNumber || "-"}</span>
                              <span style={styles.compactMetaSecondary}>
                                {report.ewbDate
                                  ? `Date ${formatDisplayDate(report.ewbDate)}`
                                  : "EWB date missing"}
                              </span>
                            </div>
                          </td>
	                        <td style={styles.td}>
	                          <span style={getStatusBadgeStyle(report.status || "completed")}>
	                            {report.status || "completed"}
	                          </span>
	                        </td>
	                        <td style={styles.td}>
                            <div style={styles.compactMetaStack}>
                              <span
                                style={{
                                  ...(completionReadiness.isReady
                                    ? styles.readinessPillReady
                                    : styles.readinessPillBlocked),
                                }}
                              >
                                {completionReadiness.pillLabel}
                              </span>
                              <span style={styles.compactMetaSecondary}>
                                {completionReadiness.detail}
                              </span>
                            </div>
	                        </td>
	                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button
                              type="button"
                              style={{ ...styles.smallButton, background: "#2563eb" }}
                              onClick={() => navigate(`/dispatch-print/${report.id}`)}
                              disabled={statusUpdatingId === report.id}
                            >
                              Print
                            </button>
                            <button
                              type="button"
                              style={styles.smallButton}
                              onClick={() => openEditPanel(report)}
                              disabled={statusUpdatingId === report.id || !canManageDispatchRecords}
                            >
                              Edit
                            </button>

                            {canManageDispatchRecords && report.status !== "pending" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.pendingButton }}
                                onClick={() => handleStatusChange(report, "pending")}
                                disabled={statusUpdatingId === report.id}
                              >
                                {statusUpdatingId === report.id
                                  ? "Updating..."
                                  : "Pending"}
                              </button>
                            )}

                            {canManageDispatchRecords && report.status !== "completed" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.completedButton }}
                                onClick={() => handleStatusChange(report, "completed")}
                                disabled={statusUpdatingId === report.id || !canCompleteDispatch}
                                title={
                                  canCompleteDispatch
                                    ? "Mark dispatch as completed"
                                    : completionBlockMessage
                                }
                              >
                                {statusUpdatingId === report.id
                                  ? "Updating..."
                                  : "Complete"}
                              </button>
                            )}

                            {canManageDispatchRecords && report.status !== "cancelled" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.cancelledButton }}
                                onClick={() => handleStatusChange(report, "cancelled")}
                                disabled={statusUpdatingId === report.id}
                              >
                                {statusUpdatingId === report.id
                                  ? "Updating..."
                                  : "Cancel"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "28px",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(249,115,22,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
  },
  heroGlowOne: {
    position: "absolute",
    top: "-80px",
    right: "-40px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    background: "rgba(14,165,233,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(249,115,22,0.16)",
    filter: "blur(40px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
    alignItems: "center",
  },
  heroEyebrow: {
    margin: 0,
    marginBottom: "10px",
    color: "rgba(255,255,255,0.7)",
    fontSize: "12px",
    letterSpacing: "1.8px",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    marginBottom: "12px",
    fontSize: "34px",
    lineHeight: 1.08,
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },
  heroText: {
    margin: 0,
    maxWidth: "760px",
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  heroPills: {
    display: "grid",
    gap: "12px",
  },
  heroPill: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "16px",
    backdropFilter: "blur(8px)",
  },
  heroPillLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  heroPillValue: {
    fontSize: "15px",
    color: "#ffffff",
  },
  controlBrief: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    padding: "22px",
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 18px 38px rgba(15,23,42,0.07)",
  },
  controlBriefCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  controlBriefStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(255,255,255,0.96) 100%)",
  },
  controlBriefAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(254,242,242,0.96) 100%)",
  },
  controlBriefCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxWidth: "760px",
  },
  controlBriefEyebrow: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  controlBriefTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.12,
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },
  controlBriefText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.7,
  },
  controlBriefActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  focusTileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  focusTile: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.06)",
  },
  focusTileCalm: {
    background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.96))",
  },
  focusTileStrong: {
    background: "linear-gradient(180deg, rgba(239,246,255,0.98), rgba(255,255,255,0.96))",
  },
  focusTileAttention: {
    background: "linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.96))",
  },
  focusTileLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.9px",
  },
  focusTileValue: {
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: "800",
    lineHeight: 1.15,
  },
  focusTileText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
    minHeight: "40px",
  },
  messageError: {
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(239,68,68,0.08)",
  },
  messageSuccess: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    color: "#047857",
    border: "1px solid #a7f3d0",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(16,185,129,0.08)",
  },
  advisoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  advisoryCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #dbe5f0",
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
  inlineInfoBanner: {
    marginBottom: "14px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: "600",
  },
  loadingBanner: {
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(37,99,235,0.08)",
  },
  warningPanel: {
    marginTop: "14px",
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  warningPanelWarn: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    color: "#9a3412",
    border: "1px solid #fdba74",
  },
  warningPanelDanger: {
    background: "linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)",
    color: "#b45309",
    border: "1px solid #fca5a5",
  },
  warningItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  warningDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "currentColor",
    marginTop: "6px",
    flexShrink: 0,
  },
  syncBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)",
    border: "1px solid rgba(15,118,110,0.14)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
    flexWrap: "wrap",
  },
  syncLabel: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  syncValue: {
    display: "block",
    marginTop: "5px",
    color: "#0f172a",
    fontSize: "16px",
  },
  syncNote: {
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
    maxWidth: "560px",
    fontWeight: "600",
  },
  healthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginTop: "16px",
  },
  healthCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(135deg, #fffdf8 0%, #ffffff 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  },
  healthLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  healthValue: {
    display: "block",
    marginTop: "10px",
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  healthNote: {
    margin: "8px 0 0",
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    borderRadius: "22px",
    padding: "20px",
    border: "1px solid rgba(255,255,255,0.35)",
    boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
  },
  summaryBlue: {
    background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
  },
  summaryGreen: {
    background: "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)",
  },
  summaryAmber: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
  },
  summaryPurple: {
    background: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)",
  },
  summaryRose: {
    background: "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)",
  },
  summaryTag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.8)",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: "800",
    marginBottom: "12px",
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
    marginBottom: "8px",
    color: "#0f172a",
    fontSize: "32px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  sectionSubtitle: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  filterMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  filterMetaText: {
    color: "#52606d",
    fontSize: "13px",
    fontWeight: "700",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid rgba(148,163,184,0.16)",
  },
  quickFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  quickFilterButton: {
    border: "1px solid rgba(15, 118, 110, 0.16)",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "rgba(240,253,250,0.92)",
    color: "#115e59",
    fontWeight: "700",
    cursor: "pointer",
  },
  quickFilterButtonActive: {
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    border: "1px solid #0f766e",
    color: "#ffffff",
    boxShadow: "0 12px 24px rgba(15,118,110,0.22)",
  },
  workspaceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  workspaceTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  workspaceTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  workspaceActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  blockTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
  },
  blockSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  formSectionStack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  fieldGroupCard: {
    borderRadius: "22px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #dbe5f0",
    boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  fieldGroupEyebrow: {
    margin: 0,
    marginBottom: "6px",
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  fieldGroupTitle: {
    color: "#0f172a",
    fontSize: "17px",
    fontWeight: "800",
  },
  formGroupTitle: {
    margin: "0 0 12px",
    color: "#111827",
    fontSize: "15px",
    fontWeight: "800",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  fullWidthField: {
    gridColumn: "1 / -1",
  },
  fieldStack: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldLabel: {
    color: "#334155",
    fontSize: "12px",
    fontWeight: "700",
  },
  inlineFieldWithAction: {
    display: "flex",
    gap: "10px",
    alignItems: "stretch",
    flexWrap: "wrap",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },
  dispatchAssistantCard: {
    borderRadius: "20px",
    border: "1px solid rgba(37,99,235,0.14)",
    background:
      "linear-gradient(135deg, rgba(239,246,255,0.94) 0%, rgba(248,250,252,0.98) 100%)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 14px 30px rgba(37,99,235,0.08)",
  },
  dispatchAssistantHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  dispatchAssistantEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  dispatchAssistantTitle: {
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "800",
  },
  dispatchAssistantBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(37,99,235,0.10)",
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: "13px",
  },
  dispatchAssistantGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  dispatchAssistantBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  dispatchAssistantLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#334155",
  },
  dispatchAssistantHint: {
    fontSize: "12px",
    color: "#64748b",
    lineHeight: 1.5,
  },
  dispatchAssistantSummary: {
    minHeight: "92px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148,163,184,0.18)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#334155",
    lineHeight: 1.6,
  },
  dispatchAssistantActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  helperLinkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: "999px",
    textDecoration: "none",
    background: "#ffffff",
    color: "#1d4ed8",
    border: "1px solid rgba(37,99,235,0.18)",
    fontWeight: "700",
    boxShadow: "0 10px 20px rgba(15,23,42,0.05)",
  },
  quantityModeCard: {
    borderRadius: "16px",
    padding: "16px",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px dashed #93c5fd",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  readinessStrip: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid transparent",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  readinessOk: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    borderColor: "#a7f3d0",
    color: "#047857",
  },
  readinessWarn: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    borderColor: "#fdba74",
    color: "#9a3412",
  },
  previewCard: {
    borderRadius: "16px",
    padding: "16px",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  previewCardStrong: {
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    border: "1px solid #bfdbfe",
  },
  previewCardWarn: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
    border: "1px solid #fdba74",
  },
  previewLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  previewValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  previewHint: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
  },
  backendPreviewWrap: {
    marginTop: "16px",
    borderRadius: "20px",
    border: "1px solid rgba(14,165,233,0.16)",
    background:
      "linear-gradient(135deg, rgba(239,246,255,0.96) 0%, rgba(255,255,255,0.98) 100%)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 14px 30px rgba(14,165,233,0.08)",
  },
  backendPreviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
    boxShadow: "0 12px 24px rgba(15,23,42,0.14)",
    alignSelf: "flex-start",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
  },
  actionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  emptyState: {
    color: "#6b7280",
    fontSize: "14px",
    margin: 0,
  },
  emptyStateCard: {
    padding: "20px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #f8fafc 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
  },
  emptyStateTitle: {
    display: "block",
    color: "#1f2933",
    fontSize: "16px",
    marginBottom: "8px",
  },
  emptyStateText: {
    margin: 0,
    color: "#52606d",
    lineHeight: 1.7,
    fontSize: "14px",
  },
  billingFlowNote: {
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(15,118,110,0.08) 0%, rgba(249,115,22,0.10) 100%)",
    border: "1px solid rgba(15,118,110,0.14)",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.7,
    fontWeight: "600",
  },
  overrideWarningCard: {
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: "600",
  },
  orderPreviewCard: {
    marginTop: "14px",
    padding: "16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    border: "1px solid #bfdbfe",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  orderPreviewHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: "#0f172a",
  },
  orderPreviewMeta: {
    color: "#475569",
    fontSize: "13px",
  },
  orderPreviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  orderPreviewMetric: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(191,219,254,0.9)",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "14px 12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "13px",
    fontWeight: "800",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  compactMetaStack: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: "140px",
  },
  compactMetaPrimary: {
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "700",
  },
  compactMetaSecondary: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  readinessPillReady: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: "999px",
    padding: "4px 9px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    fontWeight: "800",
    fontSize: "11px",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  readinessPillBlocked: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: "999px",
    padding: "4px 9px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#b45309",
    fontWeight: "800",
    fontSize: "11px",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  readinessReady: {
    display: "inline-block",
    maxWidth: "220px",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: 1.4,
  },
  readinessBlocked: {
    display: "inline-block",
    maxWidth: "260px",
    color: "#b45309",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: 1.45,
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  completedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  pendingBadge: {
    background: "#fef3c7",
    color: "#92400e",
  },
  cancelledBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  inlineActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },
  completedButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  pendingButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  cancelledButton: {
    background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
  },
};

export default DispatchReportsPage;
