import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { getCachedResource } from "../services/clientCache";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

const formatRateType = (value) => {
  if (!value) return "-";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const BILLING_BASIS_OPTIONS = [
  { value: "per_trip", label: "Per Trip" },
  { value: "per_ton", label: "Per Ton" },
  { value: "per_km", label: "Per KM" },
  { value: "per_day", label: "Per Day" },
  { value: "per_unit", label: "Per Unit" },
];

const LEGACY_RATE_TYPE_BY_BILLING_BASIS = {
  per_trip: "per_trip",
  per_ton: "per_ton",
  per_km: "per_km",
  per_day: "per_day",
  per_unit: "per_ton",
};

const getBillingBasisLabel = (value) =>
  BILLING_BASIS_OPTIONS.find((option) => option.value === value)?.label ||
  formatRateType(value);

const getUnitCode = (units, rateUnitId) =>
  units.find((unit) => String(unit.id) === String(rateUnitId))?.unitCode || "unit";

const getPerUnitCompatibilityNote = (rate, units) => {
  if (rate.billingBasis !== "per_unit") {
    return "";
  }

  return `Unit-aware transport rate stored as ${formatCurrency(rate.rateValue)} / ${getUnitCode(
    units,
    rate.rateUnitId
  )}. Legacy dispatch costing still follows ${formatRateType(rate.rateType)} until dispatch integration is completed.`;
};

const getListData = (response) =>
  Array.isArray(response?.data?.data) ? response.data.data : [];

function TransportRatesPage() {
  const { currentUser } = useAuth();
  const canManageTransportRates = ["super_admin", "manager"].includes(
    String(currentUser?.role || "")
  );
  const [rates, setRates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [plants, setPlants] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unitsWarning, setUnitsWarning] = useState("");

  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showList, setShowList] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    plantId: "",
    vendorId: "",
    materialId: "",
    billingBasis: "per_trip",
    rateUnitId: "",
    minimumCharge: "",
    rateType: "",
    rateValue: "",
    distanceKm: "",
  });

  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({
    plantId: "",
    vendorId: "",
    materialId: "",
    billingBasis: "per_trip",
    rateUnitId: "",
    minimumCharge: "",
    rateType: "",
    rateValue: "",
    distanceKm: "",
  });

  useEffect(() => {
    if (search || plantFilter || vendorFilter || statusFilter) {
      const timeoutId = window.setTimeout(() => {
        setShowList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [search, plantFilter, vendorFilter, statusFilter]);

  async function loadAll() {
    try {
      const [ratesRes, vendorsRes, plantsRes, mastersRes, unitsRes] = await Promise.allSettled([
        api.get("/transport-rates"),
        getCachedResource("lookup:vendors", 60_000, async () => (await api.get("/vendors")).data?.data || []),
        getCachedResource("lookup:plants", 60_000, async () => (await api.get("/plants/lookup")).data?.data || []),
        getCachedResource("lookup:materials", 60_000, async () => (await api.get("/masters/materials/lookup")).data?.data || []),
        getCachedResource("reference:units", 60_000, async () => (await api.get("/masters/units")).data?.data || []),
      ]);

      const requiredResponses = [ratesRes, vendorsRes, plantsRes, mastersRes];
      const failedRequiredResponse = requiredResponses.find(
        (response) => response.status !== "fulfilled"
      );

      if (failedRequiredResponse) {
        throw failedRequiredResponse.reason;
      }

      setRates(getListData(ratesRes.value));
      setVendors(vendorsRes.value);
      setPlants(plantsRes.value);
      setMaterials(mastersRes.value);

      if (unitsRes.status === "fulfilled") {
        setUnits(unitsRes.value);
        setUnitsWarning("");
      } else {
        setUnits([]);
        setUnitsWarning(
          "Unit master data could not be loaded. Legacy transport rates are still available, but unit labels may be incomplete."
        );
      }

      setError("");
    } catch {
      setUnitsWarning("");
      setError("Failed to load transport rate data");
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredRates = useMemo(() => {
    return rates.filter((rate) => {
      const q = search.toLowerCase();

      const matchesSearch =
        rate.vendorName?.toLowerCase().includes(q) ||
        rate.materialName?.toLowerCase().includes(q) ||
        rate.plantName?.toLowerCase().includes(q) ||
        rate.rateType?.toLowerCase().includes(q) ||
        rate.billingBasis?.toLowerCase().includes(q);

      const matchesPlant = plantFilter
        ? String(rate.plantId) === String(plantFilter)
        : true;

      const matchesVendor = vendorFilter
        ? String(rate.vendorId) === String(vendorFilter)
        : true;

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
          ? rate.isActive
          : !rate.isActive;

      return matchesSearch && matchesPlant && matchesVendor && matchesStatus;
    });
  }, [rates, search, plantFilter, vendorFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: rates.length,
      active: rates.filter((r) => r.isActive).length,
      inactive: rates.filter((r) => !r.isActive).length,
      perTrip: rates.filter((r) => (r.billingBasis || r.rateType) === "per_trip").length,
    };
  }, [rates]);

  const filteredSummary = useMemo(() => {
    const activeRates = filteredRates.filter((rate) => rate.isActive);
    const totalRateValue = activeRates.reduce(
      (sum, rate) => sum + Number(rate.rateValue || 0),
      0
    );

    return {
      visible: filteredRates.length,
      activeVisible: activeRates.length,
      averageRate:
        activeRates.length > 0 ? totalRateValue / activeRates.length : 0,
      perKmVisible: filteredRates.filter((rate) => (rate.billingBasis || rate.rateType) === "per_km")
        .length,
    };
  }, [filteredRates]);

  const workspaceHealth = useMemo(() => {
    return {
      plants: plants.length,
      vendors: vendors.length,
      materials: materials.length,
    };
  }, [materials.length, plants.length, vendors.length]);

  const transportBrief = useMemo(() => {
    let title = "Transport costing layer is usable";
    let text =
      "Keep vendor transport logic clean here so dispatch costing stays separate from material selling price.";
    let tone = "calm";

    if (summary.inactive > 0) {
      title = "Some transport rates are inactive";
      text = `${summary.inactive} inactive rate record(s) exist, so costing should be reviewed before the next dispatch cycle.`;
      tone = "strong";
    }

    if (filteredSummary.activeVisible === 0 && filteredRates.length > 0) {
      title = "Current view has no active transport cost rules";
      text = "The current filter set only shows inactive or unavailable transport rates, which can break costing confidence.";
      tone = "attention";
    }

    return { title, text, tone };
  }, [filteredRates.length, filteredSummary.activeVisible, summary.inactive]);

  const controlTiles = useMemo(
    () => [
      {
        label: "Active In View",
        value: filteredSummary.activeVisible,
        note: "Usable transport rates in the current view",
        tone: filteredSummary.activeVisible > 0 ? "strong" : "attention",
      },
      {
        label: "Average Stored Rate Value",
        value: formatCurrency(filteredSummary.averageRate),
        note: "Average of the stored rate value across active visible records. Compare only within matching billing bases.",
        tone: filteredSummary.averageRate > 0 ? "strong" : "calm",
      },
      {
        label: "Per KM Visible",
        value: filteredSummary.perKmVisible,
        note: "Distance-based rates in the current view",
        tone: filteredSummary.perKmVisible > 0 ? "strong" : "calm",
      },
      {
        label: "Vendor Coverage",
        value: `${workspaceHealth.vendors}/${workspaceHealth.materials}`,
        note: "Available vendors versus materials in this workspace",
        tone: workspaceHealth.vendors > 0 && workspaceHealth.materials > 0 ? "calm" : "attention",
      },
    ],
    [
      filteredSummary.activeVisible,
      filteredSummary.averageRate,
      filteredSummary.perKmVisible,
      workspaceHealth.materials,
      workspaceHealth.vendors,
    ]
  );

  const logisticsWorkflow = [
    {
      label: "Vendor Registry",
      value: workspaceHealth.vendors,
      text: "Transport rates become usable only after the transporter exists in the shared vendor registry.",
      to: "/vendors",
      action: "Open Vendors",
    },
    {
      label: "Fleet Linkage",
      value: "Vehicle-linked",
      text: "Best dispatch experience comes when transporter-owned vehicles are already attached to the matching vendor.",
      to: "/vehicles",
      action: "Open Vehicles",
    },
    {
      label: "Dispatch Usage",
      value: filteredSummary.activeVisible,
      text: "These rates are consumed inside dispatch billing, so missing active rates create friction at entry time.",
      to: "/dispatch-reports",
      action: "Open Dispatch",
    },
  ];

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleBillingBasisChange = (setter) => (e) => {
    const nextBasis = e.target.value;
    setter((prev) => ({
      ...prev,
      billingBasis: nextBasis,
      rateType: LEGACY_RATE_TYPE_BY_BILLING_BASIS[nextBasis] || prev.rateType,
      ...(nextBasis === "per_unit" ? {} : { rateUnitId: "" }),
      ...(nextBasis === "per_km" ? {} : { distanceKm: "" }),
    }));
  };

  const validateTransportRateForm = (data) => {
    if (!data.plantId || !data.vendorId || !data.materialId || !data.billingBasis || !data.rateValue) {
      setError("Plant, vendor, material, billing basis, and rate value are required");
      return false;
    }

    if (Number(data.rateValue) <= 0) {
      setError("Rate value must be greater than 0");
      return false;
    }

    if (data.billingBasis === "per_unit" && !data.rateUnitId) {
      setError("Unit is required for per unit billing");
      return false;
    }

    if (data.billingBasis === "per_km" && !data.distanceKm) {
      setError("Distance is required for per KM rates");
      return false;
    }

    if (
      data.minimumCharge !== "" &&
      (Number.isNaN(Number(data.minimumCharge)) || Number(data.minimumCharge) < 0)
    ) {
      setError("Minimum charge must be 0 or more");
      return false;
    }

    return true;
  };

  const normalizePayload = (data) => ({
    ...data,
    billingBasis: data.billingBasis,
    rateType: LEGACY_RATE_TYPE_BY_BILLING_BASIS[data.billingBasis] || data.rateType,
    rateUnitId: data.rateUnitId === "" ? null : Number(data.rateUnitId),
    rateValue: Number(data.rateValue),
    minimumCharge: data.minimumCharge === "" ? null : Number(data.minimumCharge),
    distanceKm: data.distanceKm === "" ? null : Number(data.distanceKm),
  });

  const renderCountBadge = (count) => (
    <span style={styles.countBadge}>{count} records</span>
  );

  const renderStatusBadge = (isActive) => (
    <span
      style={{
        ...styles.statusBadge,
        ...(isActive ? styles.activeBadge : styles.inactiveBadge),
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateTransportRateForm(form)) {
      return;
    }

    try {
      await api.post("/transport-rates", normalizePayload(form));

      setSuccess("Transport rate added successfully");
      setForm({
        plantId: "",
        vendorId: "",
        materialId: "",
        billingBasis: "per_trip",
        rateUnitId: "",
        minimumCharge: "",
        rateType: "",
        rateValue: "",
        distanceKm: "",
      });
      setShowForm(false);
      setShowList(true);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add transport rate");
    }
  };

  const openEditPanel = (rate) => {
    setEditItem(rate);
    setEditForm({
      plantId: String(rate.plantId || ""),
      vendorId: String(rate.vendorId || ""),
      materialId: String(rate.materialId || ""),
      billingBasis: rate.billingBasis || rate.rateType || "per_trip",
      rateUnitId:
        rate.rateUnitId !== null && rate.rateUnitId !== undefined
          ? String(rate.rateUnitId)
          : "",
      minimumCharge:
        rate.minimumCharge !== null && rate.minimumCharge !== undefined
          ? String(rate.minimumCharge)
          : "",
      rateType: rate.rateType || LEGACY_RATE_TYPE_BY_BILLING_BASIS[rate.billingBasis] || "",
      rateValue:
        rate.rateValue !== null && rate.rateValue !== undefined
          ? String(rate.rateValue)
          : "",
      distanceKm:
        rate.distanceKm !== null && rate.distanceKm !== undefined
          ? String(rate.distanceKm)
          : "",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    setError("");
    setSuccess("");

    if (!editItem) return;

    if (!validateTransportRateForm(editForm)) {
      return;
    }

    try {
      await api.patch(`/transport-rates/${editItem.id}`, normalizePayload(editForm));

      setSuccess("Transport rate updated successfully");
      setEditItem(null);
      setShowList(true);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update transport rate");
    }
  };

  const handleToggleStatus = async (rate) => {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/transport-rates/${rate.id}/status`, {
        isActive: !rate.isActive,
      });

      setSuccess(
        rate.isActive
          ? "Transport rate deactivated successfully"
          : "Transport rate activated successfully"
      );
      setShowList(true);
      await loadAll();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update transport rate status"
      );
    }
  };

  return (
    <AppShell
      title="Transport Rates"
      subtitle="Manage plant-wise vendor transport rates for costing and dispatch logic"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>Commercial Rate Layer</p>
              <h1 style={styles.heroTitle}>Transport Rate Control Center</h1>
              <p style={styles.heroText}>
                Manage plant-wise, vendor-wise, and material-wise transport rates
                to power dispatch costing and future commercial analytics.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Business Role</span>
                <strong style={styles.heroPillValue}>Dispatch cost engine</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Setup Pattern</span>
                <strong style={styles.heroPillValue}>List first, form second</strong>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={styles.messageError}>{error}</div>}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {unitsWarning && <div style={styles.messageWarning}>{unitsWarning}</div>}

        <div
          style={{
            ...styles.controlBrief,
            ...(transportBrief.tone === "attention"
              ? styles.controlBriefAttention
              : transportBrief.tone === "strong"
                ? styles.controlBriefStrong
                : styles.controlBriefCalm),
          }}
        >
          <div style={styles.controlBriefCopy}>
            <p style={styles.controlBriefEyebrow}>Costing Guidance</p>
            <h2 style={styles.controlBriefTitle}>{transportBrief.title}</h2>
            <p style={styles.controlBriefText}>{transportBrief.text}</p>
          </div>

          <div style={styles.controlBriefActions}>
            <button type="button" style={styles.button} onClick={() => setShowForm(true)}>
              Add Rate
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setStatusFilter("active")}
            >
              Focus Active
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadAll}
            >
              Refresh Rates
            </button>
          </div>
        </div>

        <div style={styles.focusTileGrid}>
          {controlTiles.map((tile) => (
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

        <SectionCard title="Overview">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Total</span>
              <p style={styles.summaryLabel}>All Rates</p>
              <h3 style={styles.summaryValue}>{summary.total}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Active</span>
              <p style={styles.summaryLabel}>Active Rates</p>
              <h3 style={styles.summaryValue}>{summary.active}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Inactive</span>
              <p style={styles.summaryLabel}>Inactive Rates</p>
              <h3 style={styles.summaryValue}>{summary.inactive}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Per Trip</span>
              <p style={styles.summaryLabel}>Per Trip Rates</p>
              <h3 style={styles.summaryValue}>{summary.perTrip}</h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Search & Filters">
          <div style={styles.quickFilterRow}>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("active");
                setVendorFilter("");
                setPlantFilter("");
              }}
            >
              Active Rates
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setSearch("per_km");
                setStatusFilter("");
              }}
            >
              Distance Rates
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("inactive");
                setSearch("");
              }}
            >
              Inactive Rates
            </button>
          </div>

          <p style={styles.sectionSubtitle}>
            Search by plant, vendor, material, or rate type. Filter by plant, vendor, and active status.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search transport rates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />

            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Plants</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                </option>
              ))}
            </select>

            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setSearch("");
                setPlantFilter("");
                setVendorFilter("");
                setStatusFilter("");
              }}
            >
              Clear Filters
            </button>
          </div>

          <div style={styles.workspaceMetrics}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Visible Rates</span>
              <strong style={styles.metricValue}>{filteredSummary.visible}</strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Active In View</span>
              <strong style={styles.metricValue}>
                {filteredSummary.activeVisible}
              </strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Avg Transport Rate</span>
              <strong style={styles.metricValue}>
                {formatCurrency(filteredSummary.averageRate)}
              </strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Per KM In View</span>
              <strong style={styles.metricValue}>
                {filteredSummary.perKmVisible}
              </strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Costing Readiness">
          <div style={styles.readinessStrip}>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Plants Ready</span>
              <strong style={styles.readinessValue}>{workspaceHealth.plants}</strong>
            </div>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Vendors Ready</span>
              <strong style={styles.readinessValue}>{workspaceHealth.vendors}</strong>
            </div>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Materials Ready</span>
              <strong style={styles.readinessValue}>
                {workspaceHealth.materials}
              </strong>
            </div>
          </div>

          <div style={styles.logicNote}>
            <div style={styles.logicTitle}>Costing Logic Reminder</div>
            <p style={styles.logicText}>
              Transport rates are only for transportation cost. They should cover
              trip, tonnage, distance, or day-based movement charges depending on
              the vendor agreement.
            </p>
            <p style={styles.logicText}>
              Unit-aware transport rates can be configured now, but live dispatch
              costing still uses the legacy transport type until dispatch integration
              is implemented. Minimum charge is stored for later use and is not applied
              automatically in this phase.
            </p>
            <p style={styles.logicText}>
              Material selling price belongs in Party Material Rates. Keeping
              those two layers separate makes total dispatch costing more reliable
              for real production usage.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Connected Workflow">
          <p style={styles.sectionSubtitle}>
            Transport rates are part of the live logistics workflow, not a standalone master. This setup feeds directly into vehicle selection and dispatch billing.
          </p>

          <div style={styles.workflowGrid}>
            {logisticsWorkflow.map((item) => (
              <div key={item.label} style={styles.workflowCard}>
                <span style={styles.workflowLabel}>{item.label}</span>
                <strong style={styles.workflowValue}>{item.value}</strong>
                <p style={styles.workflowText}>{item.text}</p>
                <Link to={item.to} style={styles.workflowLink}>
                  {item.action}
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Transport Rate Workspace">
          {!canManageTransportRates && (
            <div style={styles.readOnlyBanner}>
              This role can review transport costing setup, but adding, editing, and activating rates is restricted to commercial administrators.
            </div>
          )}

          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Transport Rate List</h3>
                {renderCountBadge(filteredRates.length)}
              </div>
              <p style={styles.blockSubtitle}>
                Review rates first and open the add form only when needed.
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
                disabled={!canManageTransportRates}
              >
                {showForm ? "Hide Form" : "Add Rate"}
              </button>
            </div>
          </div>

          {showList && (
            <>
              {filteredRates.length === 0 ? (
                <div style={styles.emptyState}>
                  <strong style={styles.emptyStateTitle}>
                    No transport rates match the current filters
                  </strong>
                  <p style={styles.emptyStateText}>
                    Clear the filters or add a vendor rate so dispatch costing can
                    calculate transportation cleanly for this plant and material mix.
                  </p>
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Vendor</th>
                        <th style={styles.th}>Material</th>
                        <th style={styles.th}>Billing Basis</th>
                        <th style={styles.th}>Rate Value</th>
                        <th style={styles.th}>Distance KM</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRates.map((rate) => (
                        <tr key={rate.id}>
                          <td style={styles.td}>{rate.plantName}</td>
                          <td style={styles.td}>{rate.vendorName}</td>
                          <td style={styles.td}>{rate.materialName}</td>
                          <td style={styles.td}>
                            <div>{getBillingBasisLabel(rate.billingBasis || rate.rateType)}</div>
                            {rate.billingBasis === "per_unit" && rate.rateUnitId ? (
                              <div style={styles.tdSubtle}>
                                Unit: {getUnitCode(units, rate.rateUnitId)}
                              </div>
                            ) : null}
                            {getPerUnitCompatibilityNote(rate, units) ? (
                              <div style={styles.tdSubtle}>
                                {getPerUnitCompatibilityNote(rate, units)}
                              </div>
                            ) : null}
                            {rate.billingBasis && rate.billingBasis !== rate.rateType ? (
                              <div style={styles.tdSubtle}>
                                Legacy dispatch type placeholder: {formatRateType(rate.rateType)}
                              </div>
                            ) : null}
                          </td>
                          <td style={styles.td}>
                            {formatCurrency(rate.rateValue)}
                            {rate.minimumCharge !== null && rate.minimumCharge !== undefined ? (
                              <div style={styles.tdSubtle}>
                                Min charge: {formatCurrency(rate.minimumCharge)}
                              </div>
                            ) : null}
                          </td>
                          <td style={styles.td}>{rate.distanceKm || "-"}</td>
                          <td style={styles.td}>
                            {renderStatusBadge(rate.isActive)}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.inlineActions}>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => openEditPanel(rate)}
                                disabled={!canManageTransportRates}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                style={{
                                  ...styles.smallButton,
                                  ...(rate.isActive
                                    ? styles.warnButton
                                    : styles.successButton),
                                }}
                                onClick={() => handleToggleStatus(rate)}
                                disabled={!canManageTransportRates}
                              >
                                {rate.isActive ? "Deactivate" : "Activate"}
                              </button>
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

          {showForm && canManageTransportRates && (
            <div style={styles.compactFormShell}>
              <h3 style={styles.blockTitle}>Add Transport Rate</h3>
              <p style={styles.blockSubtitle}>
                Create a plant-wise vendor rate for a specific material and charging method.
              </p>
              <p style={styles.logicText}>
                Per unit transport rates are saved as unit-aware records now, but live
                dispatch costing will continue using the legacy transport type until the
                dispatch integration phase is implemented.
              </p>

              <form onSubmit={handleSubmit} style={styles.form}>
                <select
                  name="plantId"
                  value={form.plantId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Plant</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>

                <select
                  name="vendorId"
                  value={form.vendorId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName}
                    </option>
                  ))}
                </select>

                <select
                  name="materialId"
                  value={form.materialId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Material</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.materialName}
                    </option>
                  ))}
                </select>

                <select
                  name="billingBasis"
                  value={form.billingBasis}
                  onChange={handleBillingBasisChange(setForm)}
                  style={styles.input}
                >
                  {BILLING_BASIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {form.billingBasis === "per_unit" && (
                  <select
                    name="rateUnitId"
                    value={form.rateUnitId}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  >
                    <option value="">Select Billing Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitCode} - {unit.unitName}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  name="rateValue"
                  type="number"
                  step="0.01"
                  placeholder={
                    form.billingBasis === "per_unit" ? "Price Per Unit" : "Rate Value"
                  }
                  value={form.rateValue}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                />

                <input
                  name="minimumCharge"
                  type="number"
                  step="0.01"
                  placeholder="Minimum Charge (optional)"
                  value={form.minimumCharge}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                />

                {form.billingBasis === "per_km" && (
                  <input
                    name="distanceKm"
                    type="number"
                    step="0.01"
                    placeholder="Distance KM"
                    value={form.distanceKm}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                )}

                <button type="submit" style={styles.button}>
                  Save Rate
                </button>
              </form>
            </div>
          )}
        </SectionCard>

        {editItem && canManageTransportRates && (
          <SectionCard title={`Edit Rate — ${editItem.vendorName}`}>
            <div style={styles.editHeader}>
              <h3 style={styles.editTitle}>Update selected rate</h3>
              <p style={styles.editSubtitle}>
                Edit this transport rate carefully and save the changes.
              </p>
              <p style={styles.logicText}>
                Unit-aware transport pricing is stored safely here, while live dispatch
                costing still follows the legacy transport type until the dispatch
                integration phase is completed.
              </p>
            </div>

            <div style={styles.form}>
              <select
                name="plantId"
                value={editForm.plantId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Plant</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.plantName}
                  </option>
                ))}
              </select>

              <select
                name="vendorId"
                value={editForm.vendorId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendorName}
                  </option>
                ))}
              </select>

              <select
                name="materialId"
                value={editForm.materialId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.materialName}
                  </option>
                ))}
              </select>

              <select
                name="billingBasis"
                value={editForm.billingBasis}
                onChange={handleBillingBasisChange(setEditForm)}
                style={styles.input}
              >
                {BILLING_BASIS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {editForm.billingBasis === "per_unit" && (
                <select
                  name="rateUnitId"
                  value={editForm.rateUnitId}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                >
                  <option value="">Select Billing Unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitCode} - {unit.unitName}
                    </option>
                  ))}
                </select>
              )}

              <input
                name="rateValue"
                type="number"
                step="0.01"
                placeholder={
                  editForm.billingBasis === "per_unit" ? "Price Per Unit" : "Rate Value"
                }
                value={editForm.rateValue}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <input
                name="minimumCharge"
                type="number"
                step="0.01"
                placeholder="Minimum Charge (optional)"
                value={editForm.minimumCharge}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              {editForm.billingBasis === "per_km" && (
                <input
                  name="distanceKm"
                  type="number"
                  step="0.01"
                  placeholder="Distance KM"
                  value={editForm.distanceKm}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
              )}
            </div>

            <div style={styles.editActions}>
              <button type="button" style={styles.button} onClick={handleEditSave}>
                Save Changes
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setEditItem(null)}
              >
                Cancel
              </button>
            </div>
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
      "radial-gradient(circle at top left, rgba(249,115,22,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(234,88,12,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
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
    background: "rgba(249,115,22,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(234,88,12,0.16)",
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
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,246,237,0.94) 100%)",
  },
  controlBriefStrong: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.96) 0%, rgba(255,255,255,0.96) 100%)",
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
    color: "#c2410c",
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
    background: "linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.96))",
  },
  focusTileAttention: {
    background: "linear-gradient(180deg, rgba(255,237,213,0.98), rgba(255,255,255,0.96))",
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
  messageWarning: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    color: "#9a3412",
    border: "1px solid #fdba74",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
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
  quickFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  quickFilterButton: {
    border: "1px solid rgba(194, 65, 12, 0.16)",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "rgba(255,237,213,0.92)",
    color: "#9a3412",
    fontWeight: "700",
    cursor: "pointer",
  },
  workspaceMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginTop: "16px",
  },
  metricCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  metricLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    color: "#9a3412",
  },
  metricValue: {
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: "800",
  },
  readinessStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  readinessCard: {
    padding: "18px",
    borderRadius: "18px",
    border: "1px solid #fed7aa",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
  },
  readinessLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "800",
    color: "#9a3412",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },
  readinessValue: {
    color: "#0f172a",
    fontSize: "26px",
    fontWeight: "800",
  },
  logicNote: {
    padding: "18px",
    borderRadius: "20px",
    background:
      "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(251,191,36,0.08) 100%)",
    border: "1px solid #fed7aa",
  },
  logicTitle: {
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "800",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  logicText: {
    margin: "0 0 8px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
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
  workflowValue: {
    fontSize: "22px",
    color: "#0f172a",
    fontWeight: "800",
  },
  workflowText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
    fontSize: "14px",
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
  readOnlyBanner: {
    marginBottom: "16px",
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    color: "#92400e",
    border: "1px solid rgba(245,158,11,0.28)",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    lineHeight: 1.6,
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
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
    background: "#ffedd5",
    color: "#9a3412",
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
  editHeader: {
    marginBottom: "12px",
  },
  editTitle: {
    margin: "0 0 4px",
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
  },
  editSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
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
  editActions: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
    flexWrap: "wrap",
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
  warnButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  successButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  statusBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
  },
  activeBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  inactiveBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  muted: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  emptyState: {
    padding: "20px",
    borderRadius: "18px",
    border: "1px dashed #fed7aa",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
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
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
    marginTop: "14px",
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
};

export default TransportRatesPage;
