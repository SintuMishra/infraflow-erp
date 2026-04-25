import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useMasters } from "../hooks/useMasters";
import { useAuth } from "../hooks/useAuth";
import {
  formatDateTimeLabel,
  formatDisplayDate,
  getTimestampFileLabel,
  getTodayDateValue,
  toDateOnlyValue,
} from "../utils/date";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const createVehicleFormState = () => ({
  vehicleNumber: "",
  vehicleType: "",
  assignedDriver: "",
  status: "active",
  ownershipType: "company",
  vendorId: "",
  plantId: "",
  vehicleCapacityTons: "",
});

const createEquipmentFormState = () => ({
  usageDate: getTodayDateValue(),
  equipmentName: "",
  equipmentType: "",
  siteName: "",
  openingMeterReading: "",
  closingMeterReading: "",
  usageHours: "",
  fuelUsed: "",
  remarks: "",
  plantId: "",
});

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

function VehiclesPage() {
  const { currentUser } = useAuth();
  const {
    masters,
    loadingMasters,
    refreshingMasters,
    mastersError,
    mastersLoadedAt,
  } = useMasters();

  const [vehicles, setVehicles] = useState([]);
  const [equipmentLogs, setEquipmentLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [plants, setPlants] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [isSubmittingEquipment, setIsSubmittingEquipment] = useState(false);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [lastWorkspaceSyncAt, setLastWorkspaceSyncAt] = useState(null);

  const [showVehicleList, setShowVehicleList] = useState(true);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showEquipmentList, setShowEquipmentList] = useState(true);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleOwnershipFilter, setVehicleOwnershipFilter] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("");
  const [vehiclePlantFilter, setVehiclePlantFilter] = useState("");

  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentPlantFilter, setEquipmentPlantFilter] = useState("");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState("");
  const [equipmentDateFrom, setEquipmentDateFrom] = useState("");
  const [equipmentDateTo, setEquipmentDateTo] = useState("");

  const [vehicleFormData, setVehicleFormData] = useState(createVehicleFormState);

  const [equipmentFormData, setEquipmentFormData] = useState(createEquipmentFormState);
  const [equipmentReadingContext, setEquipmentReadingContext] = useState(null);
  const [loadingEquipmentContext, setLoadingEquipmentContext] = useState(false);

  const [editVehicle, setEditVehicle] = useState(null);
  const [editVehicleForm, setEditVehicleForm] = useState(createVehicleFormState);
  const canManageVehicles = ["super_admin", "manager", "hr"].includes(
    String(currentUser?.role || "")
  );
  const canManageEquipmentLogs = [
    "super_admin",
    "manager",
    "crusher_supervisor",
    "site_engineer",
  ].includes(String(currentUser?.role || ""));

  useEffect(() => {
    const hasVehicleSearch =
      vehicleSearch ||
      vehicleOwnershipFilter ||
      vehicleStatusFilter ||
      vehiclePlantFilter;

    if (hasVehicleSearch) {
      const timeoutId = window.setTimeout(() => {
        setShowVehicleList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    vehicleSearch,
    vehicleOwnershipFilter,
    vehicleStatusFilter,
    vehiclePlantFilter,
  ]);

  useEffect(() => {
    const hasEquipmentSearch =
      equipmentSearch ||
      equipmentPlantFilter ||
      equipmentTypeFilter ||
      equipmentDateFrom ||
      equipmentDateTo;

    if (hasEquipmentSearch) {
      const timeoutId = window.setTimeout(() => {
        setShowEquipmentList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    equipmentSearch,
    equipmentPlantFilter,
    equipmentTypeFilter,
    equipmentDateFrom,
    equipmentDateTo,
  ]);

  async function loadVehicles() {
    try {
      const res = await api.get("/vehicles");
      setVehicles(res.data?.data || []);
      setLastWorkspaceSyncAt(Date.now());
      setError("");
    } catch {
      setError("Failed to load vehicles");
    }
  }

  async function loadEquipmentLogs() {
    try {
      const res = await api.get("/vehicles/equipment-logs");
      setEquipmentLogs(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load equipment logs");
    }
  }

  async function loadVendors() {
    try {
      const res = await api.get("/vendors");
      setVendors(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load vendors");
    }
  }

  async function loadPlants() {
    try {
      const res = await api.get("/plants");
      setPlants(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load plants");
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsLoadingData(true);
      Promise.all([
        loadVehicles(),
        loadEquipmentLogs(),
        loadVendors(),
        loadPlants(),
      ])
        .then(() => {
          setError("");
        })
        .catch(() => {
          setError("Failed to refresh vehicle workspace");
        })
        .finally(() => {
          setIsLoadingData(false);
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const shouldLoadContext =
      equipmentFormData.equipmentName.trim() &&
      equipmentFormData.equipmentType.trim() &&
      equipmentFormData.plantId;

    if (!shouldLoadContext) {
      setEquipmentReadingContext(null);
      setLoadingEquipmentContext(false);
      setEquipmentFormData((prev) => ({
        ...prev,
        openingMeterReading: "",
      }));
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoadingEquipmentContext(true);
        const res = await api.get("/vehicles/equipment-logs/context", {
          params: {
            equipmentName: equipmentFormData.equipmentName.trim(),
            equipmentType: equipmentFormData.equipmentType.trim(),
            plantId: equipmentFormData.plantId,
          },
        });

        if (!isActive) {
          return;
        }

        const context = res.data?.data || null;
        setEquipmentReadingContext(context);
        setEquipmentFormData((prev) => ({
          ...prev,
          openingMeterReading:
            context?.suggestedOpeningMeterReading !== null &&
            context?.suggestedOpeningMeterReading !== undefined
              ? String(context.suggestedOpeningMeterReading)
              : prev.closingMeterReading === "" && prev.openingMeterReading
                ? prev.openingMeterReading
                : "",
        }));
      } catch {
        if (isActive) {
          setEquipmentReadingContext(null);
        }
      } finally {
        if (isActive) {
          setLoadingEquipmentContext(false);
        }
      }
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    equipmentFormData.equipmentName,
    equipmentFormData.equipmentType,
    equipmentFormData.plantId,
  ]);

  const equipmentUsageHoursPreview = useMemo(() => {
    const opening = Number(equipmentFormData.openingMeterReading);
    const closing = Number(equipmentFormData.closingMeterReading);

    if (
      equipmentFormData.openingMeterReading === "" ||
      equipmentFormData.closingMeterReading === "" ||
      Number.isNaN(opening) ||
      Number.isNaN(closing) ||
      closing < opening
    ) {
      return "";
    }

    return (Math.round((closing - opening) * 100) / 100).toFixed(2);
  }, [
    equipmentFormData.openingMeterReading,
    equipmentFormData.closingMeterReading,
  ]);

  async function refreshWorkspace() {
    setIsLoadingData(true);

    try {
      await Promise.all([
        loadVehicles(),
        loadEquipmentLogs(),
        loadVendors(),
        loadPlants(),
      ]);
      setError("");
    } catch {
      setError("Failed to refresh vehicle workspace");
    } finally {
      setIsLoadingData(false);
    }
  }

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;

    setVehicleFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "ownershipType" && value === "company") {
        next.vendorId = "";
      }

      return next;
    });
  };

  const handleEditVehicleChange = (e) => {
    const { name, value } = e.target;

    setEditVehicleForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "ownershipType" && value === "company") {
        next.vendorId = "";
      }

      return next;
    });
  };

  const handleEquipmentChange = (e) => {
    const { name, value } = e.target;

    setEquipmentFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (
        name === "equipmentName" ||
        name === "equipmentType" ||
        name === "plantId"
      ) {
        next.closingMeterReading = "";
      }

      return next;
    });
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!vehicleFormData.vehicleNumber || !vehicleFormData.vehicleType) {
      setError("Vehicle number and vehicle type are required");
      return;
    }

    if (!vehicleFormData.plantId) {
      setError("Please select a plant / unit for the vehicle");
      return;
    }

    if (
      vehicleFormData.ownershipType !== "company" &&
      !vehicleFormData.vendorId
    ) {
      setError("Vendor / transporter is required for non-company vehicles");
      return;
    }

    if (
      vehicleFormData.vehicleCapacityTons &&
      Number(vehicleFormData.vehicleCapacityTons) <= 0
    ) {
      setError("Vehicle capacity must be greater than 0");
      return;
    }

    try {
      setIsSubmittingVehicle(true);
      await api.post("/vehicles", {
        ...vehicleFormData,
        vendorId: vehicleFormData.vendorId || null,
        plantId: vehicleFormData.plantId || null,
        vehicleCapacityTons:
          vehicleFormData.vehicleCapacityTons === ""
            ? null
            : Number(vehicleFormData.vehicleCapacityTons),
      });

      setSuccess("Vehicle added successfully");
      setVehicleFormData(createVehicleFormState());
      setShowVehicleForm(false);
      setShowVehicleList(true);

      await loadVehicles();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add vehicle");
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleEquipmentSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !equipmentFormData.usageDate ||
      !equipmentFormData.equipmentName ||
      !equipmentFormData.equipmentType
    ) {
      setError("Usage date, equipment name, and equipment type are required");
      return;
    }

    if (!equipmentFormData.plantId) {
      setError("Please select a plant / unit for the equipment log");
      return;
    }

    if (!equipmentFormData.siteName.trim()) {
      setError("Please enter the site / area for the equipment log");
      return;
    }

    if (equipmentFormData.openingMeterReading === "") {
      setError("Opening meter reading is required");
      return;
    }

    if (equipmentFormData.closingMeterReading === "") {
      setError("Closing meter reading is required");
      return;
    }

    if (equipmentUsageHoursPreview === "") {
      setError(
        "Closing meter reading must be greater than or equal to opening meter reading"
      );
      return;
    }

    try {
      setIsSubmittingEquipment(true);
      await api.post("/vehicles/equipment-logs", {
        ...equipmentFormData,
        openingMeterReading: Number(equipmentFormData.openingMeterReading || 0),
        closingMeterReading: Number(equipmentFormData.closingMeterReading || 0),
        usageHours: Number(equipmentUsageHoursPreview || 0),
        fuelUsed: Number(equipmentFormData.fuelUsed || 0),
        plantId: equipmentFormData.plantId || null,
      });

      setSuccess("Equipment usage log added successfully");
      setEquipmentFormData(createEquipmentFormState());
      setEquipmentReadingContext(null);
      setShowEquipmentForm(false);
      setShowEquipmentList(true);

      await loadEquipmentLogs();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to add equipment usage log"
      );
    } finally {
      setIsSubmittingEquipment(false);
    }
  };

  const openEditVehiclePanel = (vehicle) => {
    setEditVehicle(vehicle);
    setEditVehicleForm({
      vehicleNumber: vehicle.vehicleNumber || "",
      vehicleType: vehicle.vehicleType || "",
      assignedDriver: vehicle.assignedDriver || "",
      status: vehicle.status || "active",
      ownershipType: vehicle.ownershipType || "company",
      vendorId: vehicle.vendorId ? String(vehicle.vendorId) : "",
      plantId: vehicle.plantId ? String(vehicle.plantId) : "",
      vehicleCapacityTons:
        vehicle.vehicleCapacityTons !== null &&
        vehicle.vehicleCapacityTons !== undefined
          ? String(vehicle.vehicleCapacityTons)
          : "",
    });
    setError("");
    setSuccess("");
  };

  const closeEditVehiclePanel = () => {
    setEditVehicle(null);
    setEditVehicleForm(createVehicleFormState());
  };

  const handleEditVehicleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!editVehicle) return;

    if (!editVehicleForm.vehicleNumber || !editVehicleForm.vehicleType) {
      setError("Vehicle number and vehicle type are required");
      return;
    }

    if (!editVehicleForm.plantId) {
      setError("Please select a plant / unit for the vehicle");
      return;
    }

    if (
      editVehicleForm.ownershipType !== "company" &&
      !editVehicleForm.vendorId
    ) {
      setError("Vendor / transporter is required for non-company vehicles");
      return;
    }

    if (
      editVehicleForm.vehicleCapacityTons &&
      Number(editVehicleForm.vehicleCapacityTons) <= 0
    ) {
      setError("Vehicle capacity must be greater than 0");
      return;
    }

    try {
      setIsUpdatingVehicle(true);
      await api.patch(`/vehicles/${editVehicle.id}`, {
        ...editVehicleForm,
        vendorId: editVehicleForm.vendorId || null,
        plantId: editVehicleForm.plantId || null,
        vehicleCapacityTons:
          editVehicleForm.vehicleCapacityTons === ""
            ? null
            : Number(editVehicleForm.vehicleCapacityTons),
      });

      setSuccess("Vehicle updated successfully");
      closeEditVehiclePanel();
      setShowVehicleList(true);
      await loadVehicles();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update vehicle");
    } finally {
      setIsUpdatingVehicle(false);
    }
  };

  const handleVehicleStatusUpdate = async (vehicle, nextStatus) => {
    setError("");
    setSuccess("");

    try {
      setStatusUpdatingId(vehicle.id);
      await api.patch(`/vehicles/${vehicle.id}/status`, {
        status: nextStatus,
      });

      setSuccess(`Vehicle status changed to ${nextStatus}`);
      setShowVehicleList(true);
      await loadVehicles();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update vehicle status"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const resetWorkspaceView = () => {
    setVehicleSearch("");
    setVehicleOwnershipFilter("");
    setVehicleStatusFilter("");
    setVehiclePlantFilter("");
    setEquipmentSearch("");
    setEquipmentPlantFilter("");
    setEquipmentTypeFilter("");
    setEquipmentDateFrom("");
    setEquipmentDateTo("");
    setShowVehicleList(false);
    setShowVehicleForm(false);
    setShowEquipmentList(false);
    setShowEquipmentForm(false);
    closeEditVehiclePanel();
    setVehicleFormData(createVehicleFormState());
    setEquipmentFormData(createEquipmentFormState());
    setEquipmentReadingContext(null);
    setError("");
    setSuccess("");
  };

  const transporterVendorOptions = vendors.filter((v) =>
    ["Transporter", "Equipment Supplier", "Other"].includes(v.vendorType)
  );

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const q = vehicleSearch.toLowerCase();

      const matchesSearch =
        vehicle.vehicleNumber?.toLowerCase().includes(q) ||
        vehicle.vehicleType?.toLowerCase().includes(q) ||
        vehicle.assignedDriver?.toLowerCase().includes(q) ||
        vehicle.vendorName?.toLowerCase().includes(q) ||
        vehicle.plantName?.toLowerCase().includes(q);

      const matchesOwnership = vehicleOwnershipFilter
        ? vehicle.ownershipType === vehicleOwnershipFilter
        : true;

      const matchesStatus = vehicleStatusFilter
        ? vehicle.status === vehicleStatusFilter
        : true;

      const matchesPlant = vehiclePlantFilter
        ? String(vehicle.plantId) === String(vehiclePlantFilter)
        : true;

      return matchesSearch && matchesOwnership && matchesStatus && matchesPlant;
    });
  }, [
    vehicles,
    vehicleSearch,
    vehicleOwnershipFilter,
    vehicleStatusFilter,
    vehiclePlantFilter,
  ]);

  const filteredEquipmentLogs = useMemo(() => {
    return equipmentLogs.filter((log) => {
      const q = equipmentSearch.toLowerCase();
      const logDate = toDateOnlyValue(log.usageDate);

      const matchesSearch =
        log.equipmentName?.toLowerCase().includes(q) ||
        log.equipmentType?.toLowerCase().includes(q) ||
        log.siteName?.toLowerCase().includes(q) ||
        log.remarks?.toLowerCase().includes(q) ||
        log.plantName?.toLowerCase().includes(q) ||
        logDate.includes(q);

      const matchesPlant = equipmentPlantFilter
        ? String(log.plantId) === String(equipmentPlantFilter)
        : true;

      const matchesType = equipmentTypeFilter
        ? log.equipmentType === equipmentTypeFilter
        : true;

      const matchesDateFrom = equipmentDateFrom
        ? logDate >= equipmentDateFrom
        : true;

      const matchesDateTo = equipmentDateTo ? logDate <= equipmentDateTo : true;

      return (
        matchesSearch &&
        matchesPlant &&
        matchesType &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    equipmentLogs,
    equipmentSearch,
    equipmentPlantFilter,
    equipmentTypeFilter,
    equipmentDateFrom,
    equipmentDateTo,
  ]);

  const summary = useMemo(() => {
    return {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status === "active").length,
      maintenanceVehicles: vehicles.filter((v) => v.status === "maintenance")
        .length,
      inactiveVehicles: vehicles.filter((v) => v.status === "inactive").length,
      equipmentLogs: equipmentLogs.length,
    };
  }, [vehicles, equipmentLogs]);

  const filteredSummary = useMemo(() => {
    return {
      vehicles: filteredVehicles.length,
      activeVehicles: filteredVehicles.filter((v) => v.status === "active").length,
      equipmentLogs: filteredEquipmentLogs.length,
      equipmentHours: filteredEquipmentLogs.reduce(
        (sum, log) => sum + Number(log.usageHours || 0),
        0
      ),
      equipmentFuel: filteredEquipmentLogs.reduce(
        (sum, log) => sum + Number(log.fuelUsed || 0),
        0
      ),
      totalCapacity: filteredVehicles.reduce(
        (sum, vehicle) => sum + Number(vehicle.vehicleCapacityTons || 0),
        0
      ),
    };
  }, [filteredVehicles, filteredEquipmentLogs]);

  const workspaceHealth = useMemo(
    () => ({
      activePlants: plants.filter((plant) => plant.isActive).length,
      transporterLinks: vehicles.filter((vehicle) => Boolean(vehicle.vendorId)).length,
      inUseVehicles: vehicles.filter((vehicle) => vehicle.status === "in_use").length,
      maintenanceVehicles: vehicles.filter((vehicle) => vehicle.status === "maintenance").length,
    }),
    [plants, vehicles]
  );

  const hasVehicleFilters = Boolean(
    vehicleSearch ||
      vehicleOwnershipFilter ||
      vehicleStatusFilter ||
      vehiclePlantFilter
  );

  const hasEquipmentFilters = Boolean(
    equipmentSearch ||
      equipmentPlantFilter ||
      equipmentTypeFilter ||
      equipmentDateFrom ||
      equipmentDateTo
  );

  const equipmentTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...(masters?.vehicleTypes || []).map((type) => type.typeName), ...equipmentLogs.map((log) => log.equipmentType)].filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [equipmentLogs, masters]
  );

  const latestEquipmentLog = filteredEquipmentLogs[0] || null;

  const syncLabel = (lastWorkspaceSyncAt || mastersLoadedAt)
    ? formatDateTimeLabel(lastWorkspaceSyncAt || mastersLoadedAt, {
        day: "2-digit",
        month: "short",
      })
    : "Waiting for first sync";

  const getStatusBadgeStyle = (status) => {
    if (status === "active") {
      return { ...styles.statusBadge, ...styles.activeBadge };
    }

    if (status === "in_use") {
      return { ...styles.statusBadge, ...styles.infoBadge };
    }

    if (status === "maintenance") {
      return { ...styles.statusBadge, ...styles.warningBadge };
    }

    return { ...styles.statusBadge, ...styles.inactiveBadge };
  };

  const renderCountBadge = (count) => (
    <span style={styles.countBadge}>{count} records</span>
  );

  const handleEquipmentExportCsv = () => {
    if (filteredEquipmentLogs.length === 0) {
      setError("No equipment logs match the current filters for export");
      setSuccess("");
      return;
    }

    const rows = filteredEquipmentLogs.map((log) => ({
      usage_date: toDateOnlyValue(log.usageDate),
      equipment_name: log.equipmentName || "",
      equipment_type: log.equipmentType || "",
      plant: log.plantName || "",
      site: log.siteName || "",
      opening_meter_reading: Number(log.openingMeterReading || 0),
      closing_meter_reading: Number(log.closingMeterReading || 0),
      usage_hours: Number(log.usageHours || 0),
      fuel_used: Number(log.fuelUsed || 0),
      fuel_per_hour:
        Number(log.usageHours || 0) > 0
          ? (Number(log.fuelUsed || 0) / Number(log.usageHours || 0)).toFixed(2)
          : "",
      remarks: log.remarks || "",
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = getTimestampFileLabel();

    anchor.href = url;
    anchor.download = `equipment-usage-logs-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    setSuccess("Equipment logs CSV downloaded");
    setError("");
  };

  const handleEquipmentPrintPdf = () => {
    if (filteredEquipmentLogs.length === 0) {
      setError("No equipment logs match the current filters for print export");
      setSuccess("");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900");

    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print or save PDF.");
      setSuccess("");
      return;
    }

    const rowsMarkup = filteredEquipmentLogs
      .map(
        (log) => `
          <tr>
            <td>${formatDisplayDate(log.usageDate)}</td>
            <td>${log.equipmentName || "-"}</td>
            <td>${log.equipmentType || "-"}</td>
            <td>${log.plantName || "-"}</td>
            <td>${log.siteName || "-"}</td>
            <td>${formatMetric(log.openingMeterReading)}</td>
            <td>${formatMetric(log.closingMeterReading)}</td>
            <td>${formatMetric(log.usageHours)}</td>
            <td>${formatMetric(log.fuelUsed)}</td>
            <td>${
              Number(log.usageHours || 0) > 0
                ? formatMetric(Number(log.fuelUsed || 0) / Number(log.usageHours || 0))
                : "-"
            }</td>
            <td>${log.remarks || "-"}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Equipment Usage Logs</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 6px; color: #475569; }
            .meta { margin: 16px 0 20px; display: flex; gap: 20px; flex-wrap: wrap; }
            .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; min-width: 180px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Equipment Usage Log Register</h1>
          <p>Professional export optimized for print and Save as PDF workflow.</p>
          <p>Generated on ${new Date().toLocaleString("en-IN")}</p>
          <div class="meta">
            <div class="card"><strong>Total Logs</strong><br />${filteredEquipmentLogs.length}</div>
            <div class="card"><strong>Total Usage Hours</strong><br />${formatMetric(filteredSummary.equipmentHours)}</div>
            <div class="card"><strong>Total Fuel Used</strong><br />${formatMetric(filteredSummary.equipmentFuel)} L</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Equipment</th>
                <th>Type</th>
                <th>Plant</th>
                <th>Site</th>
                <th>Opening Meter</th>
                <th>Closing Meter</th>
                <th>Usage Hours</th>
                <th>Fuel Used</th>
                <th>Fuel / Hour</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>${rowsMarkup}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setSuccess("Equipment logs print view opened");
    setError("");
  };

  const logisticsWorkflow = [
    {
      label: "Vendor Registry",
      title: "Transporters and suppliers",
      text: "Vendor records should exist before transporter-owned vehicles are created so dispatch can inherit the transporter cleanly.",
      to: "/vendors",
      action: "Open Vendors",
    },
    {
      label: "Transport Rate Setup",
      title: "Plant and material-wise costing",
      text: "Once transporter linkage is done, active transport rates make dispatch billing automatic instead of manual.",
      to: "/transport-rates",
      action: "Open Rates",
    },
    {
      label: "Dispatch Usage",
      title: "Vehicle assignment in live dispatch",
      text: "Dispatch users should be able to find the right vehicle quickly and understand which transporter and cost rule will apply.",
      to: "/dispatch-reports",
      action: "Open Dispatch",
    },
  ];

  return (
    <AppShell
      title="Vehicles & Equipment"
      subtitle="Manage fleet records, plant assignment, vendors, equipment usage, and live vehicle status"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>Fleet Operations Layer</p>
              <h1 style={styles.heroTitle}>Vehicles & Equipment Control Center</h1>
              <p style={styles.heroText}>
                Manage company-owned, attached, and transporter-linked vehicles
                with plant-aware ERP workflows, operational equipment logs, and
                practical vehicle capacity controls.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Current Scope</span>
                <strong style={styles.heroPillValue}>
                  Fleet + edit + status control
                </strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>ERP Benefit</span>
                <strong style={styles.heroPillValue}>
                  Dispatch capacity validation ready
                </strong>
              </div>
            </div>
          </div>
        </div>

        {(mastersError || error) && (
          <div style={styles.messageError}>{mastersError || error}</div>
        )}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {isLoadingData && (
          <div style={styles.loadingBanner}>
            Refreshing vehicles, plants, vendors, and equipment logs...
          </div>
        )}

        <SectionCard title="Workspace Health">
          <div style={styles.syncBanner}>
            <div>
              <p style={styles.syncLabel}>Fleet Source Of Truth</p>
              <strong style={styles.syncValue}>
                {isLoadingData || refreshingMasters
                  ? "Refreshing fleet and reference data..."
                  : `Last sync: ${syncLabel}`}
              </strong>
            </div>
            <span style={styles.syncNote}>
              Vehicle assignment now stays aligned with scoped plants, transporter links, capacity checks, and dispatch usage expectations.
            </span>
          </div>

          <div style={styles.healthGrid}>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Active Plants</span>
              <strong style={styles.healthValue}>{formatMetric(workspaceHealth.activePlants)}</strong>
              <p style={styles.healthNote}>Fleet operating points currently available</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Vendor-linked Fleet</span>
              <strong style={styles.healthValue}>{formatMetric(workspaceHealth.transporterLinks)}</strong>
              <p style={styles.healthNote}>Vehicles attached to transporters or suppliers</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Vehicles In Use</span>
              <strong style={styles.healthValue}>{formatMetric(workspaceHealth.inUseVehicles)}</strong>
              <p style={styles.healthNote}>Fleet units currently occupied by live dispatch activity</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Under Maintenance</span>
              <strong style={styles.healthValue}>{formatMetric(workspaceHealth.maintenanceVehicles)}</strong>
              <p style={styles.healthNote}>Units needing attention before becoming operational again</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Connected Logistics Flow">
          <p style={styles.sectionSubtitle}>
            Vehicles are only one part of dispatch readiness. These linked workspaces help operations complete transporter setup without jumping blindly between modules.
          </p>

          <div style={styles.workflowGrid}>
            {logisticsWorkflow.map((step) => (
              <div key={step.label} style={styles.workflowCard}>
                <span style={styles.workflowLabel}>{step.label}</span>
                <strong style={styles.workflowTitle}>{step.title}</strong>
                <p style={styles.workflowText}>{step.text}</p>
                <Link to={step.to} style={styles.workflowLink}>
                  {step.action}
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Fleet Overview">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Fleet</span>
              <p style={styles.summaryLabel}>Total Vehicles</p>
              <h3 style={styles.summaryValue}>{summary.totalVehicles}</h3>
              <p style={styles.summaryHint}>
                All vehicle records currently available.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Operational</span>
              <p style={styles.summaryLabel}>Active Vehicles</p>
              <h3 style={styles.summaryValue}>{summary.activeVehicles}</h3>
              <p style={styles.summaryHint}>
                Vehicles ready for daily operations.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Attention</span>
              <p style={styles.summaryLabel}>Maintenance</p>
              <h3 style={styles.summaryValue}>
                {summary.maintenanceVehicles}
              </h3>
              <p style={styles.summaryHint}>
                Vehicles currently under maintenance.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Inactive</span>
              <p style={styles.summaryLabel}>Inactive Vehicles</p>
              <h3 style={styles.summaryValue}>{summary.inactiveVehicles}</h3>
              <p style={styles.summaryHint}>
                Vehicles currently not in use.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
              <span style={styles.summaryTag}>Logs</span>
              <p style={styles.summaryLabel}>Equipment Logs</p>
              <h3 style={styles.summaryValue}>{summary.equipmentLogs}</h3>
              <p style={styles.summaryHint}>
                Usage entries recorded in the ERP.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Workspace Controls">
          <div style={styles.workspaceControlBar}>
            <div style={styles.workspaceControlCopy}>
              <span style={styles.workspaceControlLabel}>Current View</span>
              <strong style={styles.workspaceControlValue}>
                Fleet and equipment workspace
              </strong>
              <span style={styles.workspaceControlMeta}>
                Vehicle search: {vehicleSearch.trim() || "none"} | Equipment search: {equipmentSearch.trim() || "none"}
              </span>
            </div>

            <div style={styles.workspaceControlActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetWorkspaceView}
                disabled={
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle ||
                  Boolean(statusUpdatingId)
                }
              >
                Reset View
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={refreshWorkspace}
                disabled={
                  isLoadingData ||
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle
                }
              >
                {isLoadingData ? "Refreshing..." : "Refresh Workspace"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Vehicle Search & Filters">
          <p style={styles.sectionSubtitle}>
            Search vehicles by number, type, driver, vendor, or plant. Filter by
            plant, ownership, and status.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search by vehicle number, type, driver, vendor, or plant"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              style={styles.input}
            />

            <select
              value={vehiclePlantFilter}
              onChange={(e) => setVehiclePlantFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Plants / Units</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                </option>
              ))}
            </select>

            <select
              value={vehicleOwnershipFilter}
              onChange={(e) => setVehicleOwnershipFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Ownership Types</option>
              <option value="company">Company</option>
              <option value="attached_private">Attached Private</option>
              <option value="transporter">Transporter</option>
            </select>

            <select
              value={vehicleStatusFilter}
              onChange={(e) => setVehicleStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="active">Active / Available</option>
              <option value="in_use">In Use</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.vehicles)} vehicles • {formatMetric(filteredSummary.activeVehicles)} active • {formatMetric(filteredSummary.totalCapacity)} tons total visible capacity
            </span>

            {hasVehicleFilters && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setVehicleSearch("");
                  setVehicleOwnershipFilter("");
                  setVehicleStatusFilter("");
                  setVehiclePlantFilter("");
                }}
              >
                Clear Vehicle Filters
              </button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Fleet Workspace">
          {!canManageVehicles && (
            <div style={styles.readOnlyBanner}>
              This role can review fleet records here, but vehicle master creation, editing, and status changes are restricted to admin operations.
            </div>
          )}

          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Vehicle List</h3>
                {renderCountBadge(filteredVehicles.length)}
              </div>
              <p style={styles.blockSubtitle}>
                Review fleet data first. Open forms only when needed to keep the
                page clean and scalable.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowVehicleList((prev) => !prev)}
                disabled={
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle ||
                  Boolean(statusUpdatingId)
                }
              >
                {showVehicleList ? "Hide Vehicles" : "Show Vehicles"}
              </button>

              <button
                type="button"
                style={showVehicleForm ? styles.secondaryButton : styles.button}
                onClick={() => setShowVehicleForm((prev) => !prev)}
                disabled={
                  !canManageVehicles ||
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle ||
                  Boolean(statusUpdatingId)
                }
              >
                {showVehicleForm ? "Hide Add Vehicle" : "Add Vehicle"}
              </button>
            </div>
          </div>

          {showVehicleList && (
            <>
              {filteredVehicles.length === 0 ? (
                <div style={styles.emptyStateCard}>
                  <strong style={styles.emptyStateTitle}>
                    {hasVehicleFilters
                      ? "No vehicles match the current filters"
                      : "No vehicles found yet"}
                  </strong>
                  <p style={styles.emptyStateText}>
                    {hasVehicleFilters
                      ? "Broaden plant, ownership, status, or search terms to find the required fleet record."
                      : "Once vehicles are added, they will appear here with plant, capacity, transporter, and live status controls."}
                  </p>
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Vehicle Number</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Capacity</th>
                        <th style={styles.th}>Driver</th>
                        <th style={styles.th}>Ownership</th>
                        <th style={styles.th}>Vendor / Transporter</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td style={styles.td}>{vehicle.vehicleNumber}</td>
                          <td style={styles.td}>{vehicle.vehicleType}</td>
                          <td style={styles.td}>{vehicle.plantName || "-"}</td>
                          <td style={styles.td}>
                            {vehicle.vehicleCapacityTons
                              ? `${vehicle.vehicleCapacityTons} tons`
                              : "-"}
                          </td>
                          <td style={styles.td}>
                            {vehicle.assignedDriver || "-"}
                          </td>
                          <td style={styles.td}>
                            {vehicle.ownershipType || "-"}
                          </td>
                          <td style={styles.td}>{vehicle.vendorName || "-"}</td>
                          <td style={styles.td}>
                            <span style={getStatusBadgeStyle(vehicle.status)}>
                              {vehicle.status}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={styles.inlineActions}>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => openEditVehiclePanel(vehicle)}
                                disabled={
                                  !canManageVehicles ||
                                  isSubmittingVehicle ||
                                  isSubmittingEquipment ||
                                  isUpdatingVehicle ||
                                  Boolean(statusUpdatingId)
                                }
                              >
                                Edit
                              </button>

                              {vehicle.status !== "active" && (
                                <button
                                  type="button"
                                  style={{
                                    ...styles.smallButton,
                                    ...styles.successButton,
                                  }}
                                  onClick={() =>
                                    handleVehicleStatusUpdate(vehicle, "active")
                                  }
                                  disabled={
                                    !canManageVehicles ||
                                    isSubmittingVehicle ||
                                    isSubmittingEquipment ||
                                    isUpdatingVehicle ||
                                    Boolean(statusUpdatingId)
                                  }
                                >
                                  {statusUpdatingId === vehicle.id ? "Updating..." : "Mark Active"}
                                </button>
                              )}

                              {vehicle.status !== "maintenance" && (
                                <button
                                  type="button"
                                  style={{
                                    ...styles.smallButton,
                                    ...styles.warningButton,
                                  }}
                                  onClick={() =>
                                    handleVehicleStatusUpdate(
                                      vehicle,
                                      "maintenance"
                                    )
                                  }
                                  disabled={
                                    !canManageVehicles ||
                                    isSubmittingVehicle ||
                                    isSubmittingEquipment ||
                                    isUpdatingVehicle ||
                                    Boolean(statusUpdatingId)
                                  }
                                >
                                  {statusUpdatingId === vehicle.id ? "Updating..." : "Maintenance"}
                                </button>
                              )}

                              {vehicle.status !== "inactive" && (
                                <button
                                  type="button"
                                  style={{
                                    ...styles.smallButton,
                                    ...styles.dangerButton,
                                  }}
                                  onClick={() =>
                                    handleVehicleStatusUpdate(vehicle, "inactive")
                                  }
                                  disabled={
                                    !canManageVehicles ||
                                    isSubmittingVehicle ||
                                    isSubmittingEquipment ||
                                    isUpdatingVehicle ||
                                    Boolean(statusUpdatingId)
                                  }
                                >
                                  {statusUpdatingId === vehicle.id ? "Updating..." : "Inactive"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {showVehicleForm && canManageVehicles && (
            <div style={styles.compactFormShell}>
              <h3 style={styles.blockTitle}>Add Vehicle</h3>
              <p style={styles.blockSubtitle}>
                Create fleet records for company, attached private, or
                transporter-linked vehicles.
              </p>

              <form onSubmit={handleVehicleSubmit} style={styles.form}>
                <input
                  name="vehicleNumber"
                  placeholder="Vehicle Number"
                  value={vehicleFormData.vehicleNumber}
                  onChange={handleVehicleChange}
                  style={styles.input}
                />

                <select
                  name="vehicleType"
                  value={vehicleFormData.vehicleType}
                  onChange={handleVehicleChange}
                  style={styles.input}
                  disabled={loadingMasters}
                >
                  <option value="">Select Vehicle Type</option>
                  {(masters?.vehicleTypes || []).map((type) => (
                    <option key={type.id} value={type.typeName}>
                      {type.typeName}
                    </option>
                  ))}
                </select>

                <input
                  name="assignedDriver"
                  placeholder="Assigned Driver"
                  value={vehicleFormData.assignedDriver}
                  onChange={handleVehicleChange}
                  style={styles.input}
                />

                <select
                  name="plantId"
                  value={vehicleFormData.plantId}
                  onChange={handleVehicleChange}
                  style={styles.input}
                >
                  <option value="">Select Plant / Unit</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  name="vehicleCapacityTons"
                  placeholder="Capacity (Tons)"
                  value={vehicleFormData.vehicleCapacityTons}
                  onChange={handleVehicleChange}
                  style={styles.input}
                />

                <select
                  name="ownershipType"
                  value={vehicleFormData.ownershipType}
                  onChange={handleVehicleChange}
                  style={styles.input}
                >
                  <option value="company">Company</option>
                  <option value="attached_private">Attached Private</option>
                  <option value="transporter">Transporter</option>
                </select>

                {vehicleFormData.ownershipType !== "company" && (
                  <select
                    name="vendorId"
                    value={vehicleFormData.vendorId}
                    onChange={handleVehicleChange}
                    style={styles.input}
                  >
                    <option value="">Select Vendor / Transporter</option>
                    {transporterVendorOptions.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  name="status"
                  value={vehicleFormData.status}
                  onChange={handleVehicleChange}
                  style={styles.input}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>

                <button type="submit" style={styles.button} disabled={isSubmittingVehicle}>
                  {isSubmittingVehicle ? "Saving..." : "Add Vehicle"}
                </button>
              </form>
            </div>
          )}
        </SectionCard>

        {editVehicle && canManageVehicles && (
          <SectionCard title={`Edit Vehicle — ${editVehicle.vehicleNumber}`}>
            <p style={styles.sectionSubtitle}>
              Update fleet assignment, plant linkage, ownership details, current
              operational status, and capacity.
            </p>

            <form onSubmit={handleEditVehicleSubmit} style={styles.form}>
              <input
                name="vehicleNumber"
                placeholder="Vehicle Number"
                value={editVehicleForm.vehicleNumber}
                onChange={handleEditVehicleChange}
                style={styles.input}
              />

              <select
                name="vehicleType"
                value={editVehicleForm.vehicleType}
                onChange={handleEditVehicleChange}
                style={styles.input}
                disabled={loadingMasters}
              >
                <option value="">Select Vehicle Type</option>
                {(masters?.vehicleTypes || []).map((type) => (
                  <option key={type.id} value={type.typeName}>
                    {type.typeName}
                  </option>
                ))}
              </select>

              <input
                name="assignedDriver"
                placeholder="Assigned Driver"
                value={editVehicleForm.assignedDriver}
                onChange={handleEditVehicleChange}
                style={styles.input}
              />

              <select
                name="plantId"
                value={editVehicleForm.plantId}
                onChange={handleEditVehicleChange}
                style={styles.input}
              >
                <option value="">Select Plant / Unit</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.plantName}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.01"
                name="vehicleCapacityTons"
                placeholder="Capacity (Tons)"
                value={editVehicleForm.vehicleCapacityTons}
                onChange={handleEditVehicleChange}
                style={styles.input}
              />

              <select
                name="ownershipType"
                value={editVehicleForm.ownershipType}
                onChange={handleEditVehicleChange}
                style={styles.input}
              >
                <option value="company">Company</option>
                <option value="attached_private">Attached Private</option>
                <option value="transporter">Transporter</option>
              </select>

              {editVehicleForm.ownershipType !== "company" && (
                <select
                  name="vendorId"
                  value={editVehicleForm.vendorId}
                  onChange={handleEditVehicleChange}
                  style={styles.input}
                >
                  <option value="">Select Vendor / Transporter</option>
                  {transporterVendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName}
                    </option>
                  ))}
                </select>
              )}

              <select
                name="status"
                value={editVehicleForm.status}
                onChange={handleEditVehicleChange}
                style={styles.input}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>

              <div style={styles.actionRow}>
                <button type="submit" style={styles.button} disabled={isUpdatingVehicle}>
                  {isUpdatingVehicle ? "Saving..." : "Save Vehicle Changes"}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeEditVehiclePanel}
                  disabled={isUpdatingVehicle}
                >
                  Cancel
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard title="Equipment Log Search & Filters">
          <p style={styles.sectionSubtitle}>
            Search equipment logs by date, equipment, site, remarks, or plant.
            Narrow the register by plant, equipment type, and date range before
            exporting.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search by equipment, site, plant, remarks, or date"
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
              style={styles.input}
            />

            <select
              value={equipmentPlantFilter}
              onChange={(e) => setEquipmentPlantFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Plants / Units</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                </option>
              ))}
            </select>

            <select
              value={equipmentTypeFilter}
              onChange={(e) => setEquipmentTypeFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Equipment Types</option>
              {equipmentTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={equipmentDateFrom}
              onChange={(e) => setEquipmentDateFrom(e.target.value)}
              style={styles.input}
            />

            <input
              type="date"
              value={equipmentDateTo}
              onChange={(e) => setEquipmentDateTo(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.equipmentLogs)} equipment logs in the current view
            </span>

            {hasEquipmentFilters && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setEquipmentSearch("");
                  setEquipmentPlantFilter("");
                  setEquipmentTypeFilter("");
                  setEquipmentDateFrom("");
                  setEquipmentDateTo("");
                }}
              >
                Clear Log Filters
              </button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Equipment Workspace">
          {!canManageEquipmentLogs && (
            <div style={styles.readOnlyBanner}>
              This role can review equipment history, but adding new equipment usage logs is restricted to site and operations owners.
            </div>
          )}

          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Equipment Usage Logs</h3>
                {renderCountBadge(filteredEquipmentLogs.length)}
              </div>
              <p style={styles.blockSubtitle}>
                Track meter continuity, auto-calculated usage hours, fuel
                consumption, and site-level execution notes in one industrial
                register.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={handleEquipmentExportCsv}
                disabled={filteredEquipmentLogs.length === 0}
              >
                Download CSV
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={handleEquipmentPrintPdf}
                disabled={filteredEquipmentLogs.length === 0}
              >
                Print / Save PDF
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowEquipmentList((prev) => !prev)}
                disabled={
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle ||
                  Boolean(statusUpdatingId)
                }
              >
                {showEquipmentList ? "Hide Logs" : "Show Logs"}
              </button>

              <button
                type="button"
                style={
                  showEquipmentForm ? styles.secondaryButton : styles.button
                }
                onClick={() => setShowEquipmentForm((prev) => !prev)}
                disabled={
                  !canManageEquipmentLogs ||
                  isSubmittingVehicle ||
                  isSubmittingEquipment ||
                  isUpdatingVehicle ||
                  Boolean(statusUpdatingId)
                }
              >
                {showEquipmentForm ? "Hide Add Log" : "Add Equipment Log"}
              </button>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Filtered Register</span>
              <p style={styles.summaryLabel}>Usage Hours</p>
              <h3 style={styles.summaryValue}>{formatMetric(filteredSummary.equipmentHours)}</h3>
              <p style={styles.summaryHint}>
                Auto-summed from the visible equipment log set.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Fuel</span>
              <p style={styles.summaryLabel}>Fuel Used</p>
              <h3 style={styles.summaryValue}>{formatMetric(filteredSummary.equipmentFuel)}</h3>
              <p style={styles.summaryHint}>
                Litres recorded across the current filtered period.
              </p>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Latest Meter</span>
              <p style={styles.summaryLabel}>Last Closing Reading</p>
              <h3 style={styles.summaryValue}>
                {latestEquipmentLog
                  ? formatMetric(latestEquipmentLog.closingMeterReading)
                  : "-"}
              </h3>
              <p style={styles.summaryHint}>
                {latestEquipmentLog
                  ? `${latestEquipmentLog.equipmentName} on ${formatDisplayDate(latestEquipmentLog.usageDate)}`
                  : "No filtered equipment history available yet."}
              </p>
            </div>
          </div>

          {showEquipmentList && (
            <>
              {filteredEquipmentLogs.length === 0 ? (
                <div style={styles.emptyStateCard}>
                  <strong style={styles.emptyStateTitle}>
                    {hasEquipmentFilters
                      ? "No equipment logs match the current filters"
                      : "No equipment logs found yet"}
                  </strong>
                  <p style={styles.emptyStateText}>
                    {hasEquipmentFilters
                      ? "Try broadening plant or search terms to reveal the required usage history."
                      : "Once logs are recorded, this section will show equipment movement, hours, fuel, and site notes."}
                  </p>
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Equipment</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Area / Site</th>
                        <th style={styles.th}>Opening Meter</th>
                        <th style={styles.th}>Closing Meter</th>
                        <th style={styles.th}>Usage Hours</th>
                        <th style={styles.th}>Fuel Used</th>
                        <th style={styles.th}>Fuel / Hour</th>
                        <th style={styles.th}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEquipmentLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={styles.td}>{formatDisplayDate(log.usageDate)}</td>
                          <td style={styles.td}>{log.equipmentName}</td>
                          <td style={styles.td}>{log.equipmentType}</td>
                          <td style={styles.td}>{log.plantName || "-"}</td>
                          <td style={styles.td}>{log.siteName || "-"}</td>
                          <td style={styles.td}>
                            {log.openingMeterReading !== null &&
                            log.openingMeterReading !== undefined
                              ? formatMetric(log.openingMeterReading)
                              : "-"}
                          </td>
                          <td style={styles.td}>
                            {log.closingMeterReading !== null &&
                            log.closingMeterReading !== undefined
                              ? formatMetric(log.closingMeterReading)
                              : "-"}
                          </td>
                          <td style={styles.td}>{formatMetric(log.usageHours)}</td>
                          <td style={styles.td}>{formatMetric(log.fuelUsed)}</td>
                          <td style={styles.td}>
                            {Number(log.usageHours || 0) > 0
                              ? formatMetric(
                                  Number(log.fuelUsed || 0) /
                                    Number(log.usageHours || 0)
                                )
                              : "-"}
                          </td>
                          <td style={styles.td}>{log.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {showEquipmentForm && canManageEquipmentLogs && (
            <div style={styles.compactFormShell}>
              <h3 style={styles.blockTitle}>Add Equipment Usage Log</h3>
              <p style={styles.blockSubtitle}>
                Record equipment meter movement with auto-carried opening
                reading, calculated usage hours, fuel consumption, and site
                remarks.
              </p>

              <div style={styles.contextPanel}>
                <div style={styles.contextStat}>
                  <span style={styles.contextLabel}>Meter Continuity</span>
                  <strong style={styles.contextValue}>
                    {loadingEquipmentContext
                      ? "Checking..."
                      : equipmentReadingContext?.isFirstLog
                        ? "First log"
                        : equipmentReadingContext?.latestLog
                          ? "Linked to last closing"
                          : "Select equipment"}
                  </strong>
                </div>
                <div style={styles.contextStat}>
                  <span style={styles.contextLabel}>Suggested Opening</span>
                  <strong style={styles.contextValue}>
                    {equipmentFormData.openingMeterReading
                      ? formatMetric(equipmentFormData.openingMeterReading)
                      : "-"}
                  </strong>
                </div>
                <div style={styles.contextStat}>
                  <span style={styles.contextLabel}>Calculated Usage Hours</span>
                  <strong style={styles.contextValue}>
                    {equipmentUsageHoursPreview || "-"}
                  </strong>
                </div>
              </div>

              {equipmentReadingContext?.latestLog && (
                <p style={styles.helperText}>
                  Last log found for this equipment: closing meter{" "}
                  {formatMetric(
                    equipmentReadingContext.latestLog.closingMeterReading
                  )}{" "}
                  on {formatDisplayDate(equipmentReadingContext.latestLog.usageDate)} at{" "}
                  {equipmentReadingContext.latestLog.siteName || "-"}.
                </p>
              )}

              <form onSubmit={handleEquipmentSubmit} style={styles.form}>
                <input
                  type="date"
                  name="usageDate"
                  value={equipmentFormData.usageDate}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <input
                  name="equipmentName"
                  placeholder="Equipment Name"
                  value={equipmentFormData.equipmentName}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <select
                  name="equipmentType"
                  value={equipmentFormData.equipmentType}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                  disabled={loadingMasters}
                >
                  <option value="">Select Equipment Type</option>
                  {equipmentTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <select
                  name="plantId"
                  value={equipmentFormData.plantId}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                >
                  <option value="">Select Plant / Unit</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="openingMeterReading"
                  placeholder="Opening Meter Reading"
                  value={equipmentFormData.openingMeterReading}
                  onChange={handleEquipmentChange}
                  style={{
                    ...styles.input,
                    ...(equipmentReadingContext?.latestLog ? styles.readOnlyInput : {}),
                  }}
                  readOnly={Boolean(equipmentReadingContext?.latestLog)}
                />

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="closingMeterReading"
                  placeholder="Closing Meter Reading"
                  value={equipmentFormData.closingMeterReading}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <input
                  name="siteName"
                  placeholder="Specific Site / Area Name"
                  value={equipmentFormData.siteName}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <input
                  type="number"
                  step="0.01"
                  name="usageHours"
                  placeholder="Usage Hours (Auto Calculated)"
                  value={equipmentUsageHoursPreview}
                  readOnly
                  style={{ ...styles.input, ...styles.readOnlyInput }}
                />

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="fuelUsed"
                  placeholder="Fuel Used (Litres)"
                  value={equipmentFormData.fuelUsed}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <input
                  name="remarks"
                  placeholder="Remarks"
                  value={equipmentFormData.remarks}
                  onChange={handleEquipmentChange}
                  style={styles.input}
                />

                <button type="submit" style={styles.button} disabled={isSubmittingEquipment}>
                  {isSubmittingEquipment ? "Saving..." : "Add Equipment Log"}
                </button>
              </form>
            </div>
          )}
        </SectionCard>
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
      "radial-gradient(circle at top left, rgba(6,182,212,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(37,99,235,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
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
    background: "rgba(6,182,212,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(37,99,235,0.16)",
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
  loadingBanner: {
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(37,99,235,0.08)",
  },
  readOnlyBanner: {
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    color: "#92400e",
    border: "1px solid rgba(245,158,11,0.28)",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    lineHeight: 1.6,
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
  },
  syncBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #ecfeff 0%, #eff6ff 100%)",
    border: "1px solid rgba(6,182,212,0.14)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
    flexWrap: "wrap",
  },
  syncLabel: {
    margin: 0,
    color: "#0891b2",
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
  workspaceControlBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  workspaceControlCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  workspaceControlLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  workspaceControlValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  workspaceControlMeta: {
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  workspaceControlActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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
  workflowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  workflowCard: {
    borderRadius: "20px",
    border: "1px solid rgba(148,163,184,0.18)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
    padding: "18px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  workflowLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "#0f766e",
  },
  workflowTitle: {
    fontSize: "16px",
    color: "#0f172a",
    fontWeight: "800",
  },
  workflowText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.6,
    flex: 1,
  },
  workflowLink: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(37,99,235,0.08)",
    color: "#1d4ed8",
    fontWeight: "700",
    textDecoration: "none",
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
  summaryHint: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
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
  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    background: "#eef2ff",
    color: "#3730a3",
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
  compactFormShell: {
    padding: "18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    marginTop: "18px",
  },
  contextPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginTop: "16px",
    marginBottom: "16px",
  },
  contextStat: {
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
  },
  contextLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#475569",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  contextValue: {
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "800",
  },
  helperText: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },
  readOnlyInput: {
    background: "#f8fafc",
    color: "#334155",
    borderColor: "#cbd5e1",
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
  statusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  activeBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  infoBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  inactiveBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  warningBadge: {
    background: "#fef3c7",
    color: "#92400e",
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
  successButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  warningButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  dangerButton: {
    background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
  },
};

export default VehiclesPage;
