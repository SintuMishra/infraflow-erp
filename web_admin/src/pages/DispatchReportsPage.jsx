import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../services/api";
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
const ALL_SOURCE_TYPES = ["Crusher", "Project", "Plant", "Store"];
const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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
  remarks: "",
  ewbNumber: "",
  ewbDate: "",
  ewbValidUpto: "",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceValue: "",
  distanceKm: "",
  otherCharge: "",
  billingNotes: "",
});

function DispatchReportsPage() {
  const location = useLocation();
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

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      ] = await Promise.all([
        api.get("/plants"),
        api.get("/vehicles"),
        api.get("/vendors"),
        api.get("/parties"),
        api.get("/party-material-rates"),
        api.get("/transport-rates"),
        api.get("/party-orders"),
      ]);

      setPlants(plantsRes.data?.data || []);
      setVehicles(vehiclesRes.data?.data || []);
      setVendors(vendorsRes.data?.data || []);
      setPartyRates(partyRatesRes.data?.data || []);
      setTransportRates(transportRatesRes.data?.data || []);
      setPartyOrders(partyOrdersRes.data?.data || []);
      setParties(partiesRes.data?.data || []);
      setError("");
    } catch {
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
    }, 250);

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

  const handleChange = (setter) => (e) => {
    const { name, value } = e.target;

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
      }

      if (name === "partyId") {
        next.partyOrderId = "";
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

  const partyRateOptionsForEdit = useMemo(() => {
    if (!editForm.plantId || !editForm.materialId) return [];

    return activePartyRates.filter(
      (rate) =>
        String(rate.plantId) === String(editForm.plantId) &&
        String(rate.materialId) === String(editForm.materialId)
    );
  }, [activePartyRates, editForm.plantId, editForm.materialId]);

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

    return activePartyRates.find(
      (rate) =>
        String(rate.plantId) === String(payload.plantId) &&
        String(rate.materialId) === String(payload.materialId) &&
        String(rate.partyId) === String(payload.partyId)
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

  const buildBillingPreview = (payload) => {
    const quantity = Number(payload.quantityTons || 0);
    const distance = Number(payload.distanceKm || 0);
    const otherCharge = roundMoney(payload.otherCharge || 0);

    const partyRate = getSelectedPartyRate(payload);
    const transportRate = getSelectedTransportRate(payload);
    const requiresPartyRate =
      Boolean(payload.plantId) && Boolean(payload.materialId) && Boolean(payload.partyId);
    const hasPartyRate = Boolean(partyRate);

    const materialRatePerTon = Number(partyRate?.ratePerTon || 0);
    const materialAmount = roundMoney(quantity * materialRatePerTon);

    const royaltyMode = partyRate?.royaltyMode || "none";
    const royaltyValue = Number(partyRate?.royaltyValue || 0);
    const tonsPerBrass =
      partyRate?.tonsPerBrass === null || partyRate?.tonsPerBrass === undefined
        ? null
        : Number(partyRate?.tonsPerBrass);
    let royaltyAmount = 0;

    if (royaltyMode === "per_ton") {
      royaltyAmount = roundMoney(quantity * royaltyValue);
    } else if (
      royaltyMode === "per_brass" &&
      Number.isFinite(tonsPerBrass) &&
      tonsPerBrass > 0
    ) {
      royaltyAmount = roundMoney((quantity / tonsPerBrass) * royaltyValue);
    } else if (royaltyMode === "fixed") {
      royaltyAmount = roundMoney(royaltyValue);
    }

    const loadingCharge = roundMoney(partyRate?.loadingCharge || 0);

    let transportCost = 0;
    let transportRateType = transportRate?.rateType || null;
    let transportRateValue = Number(transportRate?.rateValue || 0);

    if (transportRate) {
      if (transportRate.rateType === "per_trip" || transportRate.rateType === "per_day") {
        transportCost = transportRate.rateValue;
      } else if (transportRate.rateType === "per_ton") {
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

    return {
      partyRate,
      hasPartyRate,
      requiresPartyRate,
      transportRate,
      materialRatePerTon,
      materialAmount,
      royaltyMode,
      royaltyValue,
      royaltyAmount,
      loadingCharge,
      transportRateType,
      transportRateValue,
      transportCost,
      otherCharge,
      computedTotal,
      finalInvoiceValue,
      hasManualOverride,
      overrideAmount,
    };
  };

  const formBillingPreview = buildBillingPreview(formData);

  const editBillingPreview = buildBillingPreview(editForm);
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
    if (
      !payload.dispatchDate ||
      !payload.sourceType ||
      !payload.plantId ||
      !payload.materialId ||
      !payload.partyId ||
      !payload.vehicleId ||
      !payload.destinationName ||
      !payload.quantityTons
    ) {
      return "Dispatch date, source type, plant, material, party, vehicle, destination, and quantity are required";
    }

    const quantityTons = Number(payload.quantityTons);
    if (!Number.isFinite(quantityTons) || quantityTons <= 0) {
      return "Quantity tons must be a valid number greater than 0";
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

    if (!String(payload.destinationName || "").trim()) {
      return "Destination name is required";
    }

    const billingPreview = buildBillingPreview(payload);
    if (
      billingPreview.hasManualOverride &&
      !String(payload.billingNotes || "").trim()
    ) {
      return "Billing notes are required when manually overriding the taxable invoice value";
    }

    if (
      hasMatchingPartyOrders(payload, payload.partyOrderId) &&
      !payload.partyOrderId
    ) {
      return "Select a party order before dispatching this load so pending quantity is updated correctly";
    }

    const selectedPartyOrder = getSelectedPartyOrder(payload, payload.partyOrderId);
    if (
      selectedPartyOrder &&
      Number(payload.quantityTons || 0) >
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
    invoiceValue:
      payload.invoiceValue === "" ? null : Number(payload.invoiceValue),
    distanceKm: payload.distanceKm === "" ? null : Number(payload.distanceKm),
    otherCharge: payload.otherCharge === "" ? 0 : Number(payload.otherCharge),
    billingNotes: payload.billingNotes || "",
  });

  const buildDispatchReadiness = (payload, billingPreview) => {
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
        label: "Destination and quantity filled",
        ready: Boolean(
          payload.destinationName && Number(payload.quantityTons || 0) > 0
        ),
      },
      {
        label: "Active party billing rate found",
        ready: Boolean(billingPreview.partyRate),
      },
      {
        label: "Invoice value available",
        ready: Number(billingPreview.finalInvoiceValue || 0) > 0,
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
        "No active material rate exists for this party, plant, and material combination."
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
      await api.post(
        "/dispatch-reports",
        normalizeDispatchPayload(formData)
      );

      setSuccess("Dispatch report added successfully");
      setFormData(createDispatchFormState());
      setShowForm(false);
      setShowList(true);
      setPage(1);
      await Promise.all([loadDispatchReports(1), loadReferenceData()]);
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
      await api.patch(
        `/dispatch-reports/${editRecord.id}`,
        normalizeDispatchPayload(editForm)
      );

      setSuccess("Dispatch report updated successfully");
      closeEditPanel();
      await Promise.all([loadDispatchReports(page), loadReferenceData()]);
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
      await Promise.all([loadDispatchReports(page), loadReferenceData()]);
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

  const renderBillingPreview = (billingPreview) => (
    <>
      <div style={styles.billingFlowNote}>
        Party material rate drives the material side. Transporter rate adds only the transportation side. Taxable value is auto-computed from material amount + royalty + loading + transport + other charges unless you explicitly override it.
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

      <div style={styles.previewGrid}>
        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Party Material Rate / Ton</span>
          <strong style={styles.previewValue}>
            {billingPreview.materialRatePerTon || 0}
          </strong>
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
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Transport Rate Type</span>
          <strong style={styles.previewValue}>
            {billingPreview.transportRateType || "Not linked"}
          </strong>
        </div>

        <div style={styles.previewCard}>
          <span style={styles.previewLabel}>Transport Cost</span>
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
          <span style={styles.previewLabel}>Computed Dispatch Value</span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.computedTotal)}
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
              ? "Manual Taxable Value Override"
              : "Final Taxable Value"}
          </span>
          <strong style={styles.previewValue}>
            {formatCurrency(billingPreview.finalInvoiceValue)}
          </strong>
        </div>
      </div>
    </>
  );

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

              {selectedPlantForForm ? (
                <div style={styles.inlineInfoBanner}>
                  Dispatching from <strong>{selectedPlantForForm.plantName}</strong>.
                  {" "}Type: {selectedPlantForForm.plantType || "Not set"}.
                  {" "}Recommended source: {getRecommendedSourceType(selectedPlantForForm.plantType)}.
                  {!selectedPlantForForm.isActive ? " Status: inactive in masters." : ""}
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

              <div>
                <p style={styles.formGroupTitle}>Dispatch Details</p>
                <div style={styles.form}>
                  <input
                    type="date"
                    name="dispatchDate"
                    value={formData.dispatchDate}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <select
                    name="sourceType"
                    value={formData.sourceType}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  >
                    <option value="">Select Source Type</option>
                    {sourceTypeOptionsForForm.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <select
                    name="plantId"
                    value={formData.plantId}
                    onChange={handleChange(setFormData, formData)}
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

                  <select
                    name="materialId"
                    value={formData.materialId}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    disabled={loadingMasters || !formData.plantId}
                  >
                    <option value="">
                      {formData.plantId ? "Select Material" : "Select Plant First"}
                    </option>
                    {availableMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>

                  <select
                    name="partyId"
                    value={formData.partyId}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    disabled={!formData.plantId || !formData.materialId}
                  >
                    <option value="">
                      {formData.materialId ? "Select Party / Customer" : "Select Material First"}
                    </option>
                    {parties
                      .filter((party) => party.isActive)
                      .map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.partyName}
                        </option>
                      ))}
                  </select>

                  <div style={styles.fullWidthField}>
                    {renderDispatchLogisticsAssistant({
                      payload: formData,
                      selectedVehicle: selectedVehicleForForm,
                      selectedTransportVendor: selectedTransportVendorForForm,
                      billingPreview: formBillingPreview,
                      vehicleSearchValue: vehicleSearch,
                      onVehicleSearchChange: setVehicleSearch,
                    })}
                  </div>

                  <select
                    name="vehicleId"
                    value={formData.vehicleId}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    disabled={!formData.plantId}
                  >
                    <option value="">
                      {formData.plantId ? "Select Vehicle" : "Select Plant First"}
                    </option>
                    {vehiclesForPlant(formData.plantId, vehicleSearch).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {renderVehicleOptionLabel(vehicle)}
                      </option>
                    ))}
                  </select>

                  <select
                    name="partyOrderId"
                    value={formData.partyOrderId}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    disabled={!formData.partyId || !formData.materialId}
                  >
                    <option value="">
                      {formData.partyId
                        ? hasMatchingPartyOrders(formData, formData.partyOrderId)
                          ? "Select Party Order for fulfillment"
                          : "Link Party Order (optional)"
                        : "Select Party First"}
                    </option>
                    {getAvailablePartyOrders(formData, formData.partyOrderId).map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} • Pending {formatMetric(order.pendingQuantityTons)} tons
                      </option>
                    ))}
                  </select>

                  <select
                    name="transportVendorId"
                    value={formData.transportVendorId}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    disabled={!formData.materialId}
                  >
                    <option value="">Auto from vehicle or select manually</option>
                    {transportVendorOptionsForForm.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>

                  <input
                    name="destinationName"
                    placeholder="Destination Name"
                    value={formData.destinationName}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="quantityTons"
                    placeholder="Quantity Tons"
                    value={formData.quantityTons}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    name="remarks"
                    placeholder="Dispatch Remarks"
                    value={formData.remarks}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />
                </div>
                {renderPartyOrderPreview(formPartyOrder)}
                {!formPartyOrder && hasMatchingPartyOrders(formData, formData.partyOrderId) && (
                  <div style={styles.orderPreviewCard}>
                    <div style={styles.orderPreviewHeader}>
                      <strong>Select a party order</strong>
                      <span style={styles.orderPreviewMeta}>
                        Matching pending orders exist for this party, plant, and material. Link one before saving so the remaining balance updates correctly.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p style={styles.formGroupTitle}>Billing Preview</p>
                <div
                  style={{
                    ...styles.readinessStrip,
                    ...(formReadiness.isReady
                      ? styles.readinessOk
                      : styles.readinessWarn),
                  }}
                >
                  <strong>
                    {formReadiness.isReady
                      ? "Ready to submit"
                      : "Complete the remaining dispatch links"}
                  </strong>
                  <span>
                    {formReadiness.isReady
                      ? "Billing preview and required dispatch details are in place."
                      : formReadiness.missingItems.join(" • ")}
                  </span>
                </div>
                <WarningList warnings={formWarnings} />
                {renderBillingPreview(formBillingPreview)}
              </div>

              <div>
                <p style={styles.formGroupTitle}>Invoice & E-Way Details</p>
                <div style={styles.inlineInfoBanner}>
                  Leave manual taxable value override blank for normal billing. Use it only when a
                  deliberate commercial correction is required. E-Way details become operationally
                  important once invoice processing has started. Leave invoice number blank if you
                  want the system to generate it automatically at completion.
                </div>
                <div style={styles.form}>
                  <input
                    name="invoiceNumber"
                    placeholder="Invoice Number (blank = auto on completion)"
                    value={formData.invoiceNumber}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="date"
                    name="invoiceDate"
                    value={formData.invoiceDate}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="invoiceValue"
                    placeholder="Manual Taxable Value Override (blank = auto)"
                    value={formData.invoiceValue}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="distanceKm"
                    placeholder="Distance (KM)"
                    value={formData.distanceKm}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="otherCharge"
                    placeholder="Other Charge"
                    value={formData.otherCharge}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    name="billingNotes"
                    placeholder="Billing Notes / Commercial remarks"
                    value={formData.billingNotes}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    name="ewbNumber"
                    placeholder="E-Way Bill Number (12 digits)"
                    value={formData.ewbNumber}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                    inputMode="numeric"
                    maxLength={12}
                  />

                  <input
                    type="date"
                    name="ewbDate"
                    value={formData.ewbDate}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />

                  <input
                    type="date"
                    name="ewbValidUpto"
                    value={formData.ewbValidUpto}
                    onChange={handleChange(setFormData, formData)}
                    style={styles.input}
                  />
                </div>
              </div>

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
              {selectedPlantForEdit ? (
                <div style={styles.inlineInfoBanner}>
                  Editing dispatch from <strong>{selectedPlantForEdit.plantName}</strong>.
                  {" "}Type: {selectedPlantForEdit.plantType || "Not set"}.
                  {" "}Recommended source: {getRecommendedSourceType(selectedPlantForEdit.plantType)}.
                  {!selectedPlantForEdit.isActive ? " Status: inactive in masters." : ""}
                </div>
              ) : null}

              <div>
                <p style={styles.formGroupTitle}>Dispatch Details</p>
                <div style={styles.form}>
                  <input
                    type="date"
                    name="dispatchDate"
                    value={editForm.dispatchDate}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <select
                    name="sourceType"
                    value={editForm.sourceType}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  >
                    <option value="">Select Source Type</option>
                    {sourceTypeOptionsForEdit.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <select
                    name="plantId"
                    value={editForm.plantId}
                    onChange={handleChange(setEditForm, editForm)}
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

                  <select
                    name="materialId"
                    value={editForm.materialId}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    disabled={!editForm.plantId}
                  >
                    <option value="">
                      {editForm.plantId ? "Select Material" : "Select Plant First"}
                    </option>
                    {availableMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>

                  <select
                    name="partyId"
                    value={editForm.partyId}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    disabled={!editForm.materialId}
                  >
                    <option value="">
                      {editForm.materialId ? "Select Party / Customer" : "Select Material First"}
                    </option>
                    {partyRateOptionsForEdit.map((rate) => (
                      <option key={rate.id} value={rate.partyId}>
                        {rate.partyName}
                      </option>
                      ))}
                  </select>

                  <div style={styles.fullWidthField}>
                    {renderDispatchLogisticsAssistant({
                      payload: editForm,
                      selectedVehicle: selectedVehicleForEdit,
                      selectedTransportVendor: selectedTransportVendorForEdit,
                      billingPreview: editBillingPreview,
                      vehicleSearchValue: editVehicleSearch,
                      onVehicleSearchChange: setEditVehicleSearch,
                      isEdit: true,
                    })}
                  </div>

                  <select
                    name="vehicleId"
                    value={editForm.vehicleId}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    disabled={!editForm.plantId}
                  >
                    <option value="">
                      {editForm.plantId ? "Select Vehicle" : "Select Plant First"}
                    </option>
                    {vehiclesForPlant(editForm.plantId, editVehicleSearch).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {renderVehicleOptionLabel(vehicle)}
                      </option>
                    ))}
                  </select>

                  <select
                    name="partyOrderId"
                    value={editForm.partyOrderId}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    disabled={!editForm.partyId || !editForm.materialId}
                  >
                    <option value="">
                      {editForm.partyId
                        ? hasMatchingPartyOrders(editForm, editForm.partyOrderId)
                          ? "Select Party Order for fulfillment"
                          : "Link Party Order (optional)"
                        : "Select Party First"}
                    </option>
                    {getAvailablePartyOrders(editForm, editForm.partyOrderId).map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} • Pending {formatMetric(order.pendingQuantityTons)} tons
                      </option>
                    ))}
                  </select>

                  <select
                    name="transportVendorId"
                    value={editForm.transportVendorId}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    disabled={!editForm.materialId}
                  >
                    <option value="">Auto from vehicle or select manually</option>
                    {transportVendorOptionsForEdit.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>

                  <input
                    name="destinationName"
                    placeholder="Destination Name"
                    value={editForm.destinationName}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="quantityTons"
                    placeholder="Quantity Tons"
                    value={editForm.quantityTons}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    name="remarks"
                    placeholder="Dispatch Remarks"
                    value={editForm.remarks}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />
                </div>
                {renderPartyOrderPreview(editPartyOrder)}
                {!editPartyOrder && hasMatchingPartyOrders(editForm, editForm.partyOrderId) && (
                  <div style={styles.orderPreviewCard}>
                    <div style={styles.orderPreviewHeader}>
                      <strong>Select a party order</strong>
                      <span style={styles.orderPreviewMeta}>
                        This dispatch matches at least one pending order. Link it before saving to keep fulfillment balances accurate.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p style={styles.formGroupTitle}>Billing Preview</p>
                <div
                  style={{
                    ...styles.readinessStrip,
                    ...(editReadiness.isReady
                      ? styles.readinessOk
                      : styles.readinessWarn),
                  }}
                >
                  <strong>
                    {editReadiness.isReady
                      ? "Ready to update"
                      : "Resolve the remaining billing inputs"}
                  </strong>
                  <span>
                    {editReadiness.isReady
                      ? "The edited record has the required dispatch and billing links."
                      : editReadiness.missingItems.join(" • ")}
                  </span>
                </div>
                <WarningList warnings={editWarnings} tone="danger" />
                {renderBillingPreview(editBillingPreview)}
              </div>

              <div>
                <p style={styles.formGroupTitle}>Invoice & E-Way Details</p>
                <div style={styles.inlineInfoBanner}>
                  Leave invoice number blank if you want the system to generate it automatically
                  when this dispatch is completed.
                </div>
                <div style={styles.form}>
                  <input
                    name="invoiceNumber"
                    placeholder="Invoice Number (blank = auto on completion)"
                    value={editForm.invoiceNumber}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="date"
                    name="invoiceDate"
                    value={editForm.invoiceDate}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="invoiceValue"
                    placeholder="Manual Taxable Value Override (blank = auto)"
                    value={editForm.invoiceValue}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="distanceKm"
                    placeholder="Distance (KM)"
                    value={editForm.distanceKm}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="otherCharge"
                    placeholder="Other Charge"
                    value={editForm.otherCharge}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    name="billingNotes"
                    placeholder="Billing Notes / Commercial remarks"
                    value={editForm.billingNotes}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    name="ewbNumber"
                    placeholder="E-Way Bill Number (12 digits)"
                    value={editForm.ewbNumber}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                    inputMode="numeric"
                    maxLength={12}
                  />

                  <input
                    type="date"
                    name="ewbDate"
                    value={editForm.ewbDate}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />

                  <input
                    type="date"
                    name="ewbValidUpto"
                    value={editForm.ewbValidUpto}
                    onChange={handleChange(setEditForm, editForm)}
                    style={styles.input}
                  />
                </div>
              </div>

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
                              onClick={() => window.open(`/dispatch-print/${report.id}`, "_blank")}
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
