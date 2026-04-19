import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const createPartyFormState = () => ({
  partyName: "",
  partyCode: "",
  contactPerson: "",
  mobileNumber: "",
  gstin: "",
  pan: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateName: "",
  stateCode: "",
  pincode: "",
  partyType: "customer",
});

function PartiesPage() {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [partyRates, setPartyRates] = useState([]);
  const [partyOrders, setPartyOrders] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showList, setShowList] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState(createPartyFormState);

  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(createPartyFormState);

  useEffect(() => {
    if (search || statusFilter) {
      const timeoutId = window.setTimeout(() => {
        setShowList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [search, statusFilter]);

  async function loadParties() {
    setIsLoadingData(true);

    try {
      const [partiesRes, ratesRes, ordersRes] = await Promise.all([
        api.get("/parties"),
        api.get("/party-material-rates"),
        api.get("/party-orders"),
      ]);

      setParties(partiesRes.data?.data || []);
      setPartyRates(ratesRes.data?.data || []);
      setPartyOrders(ordersRes.data?.data || []);
      setLastLoadedAt(Date.now());
      setError("");
    } catch {
      setError("Failed to load parties");
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadParties();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredParties = useMemo(() => {
    return parties.filter((party) => {
      const q = search.toLowerCase();

      const matchesSearch =
        party.partyName?.toLowerCase().includes(q) ||
        party.partyCode?.toLowerCase().includes(q) ||
        party.contactPerson?.toLowerCase().includes(q) ||
        party.mobileNumber?.toLowerCase().includes(q) ||
        party.gstin?.toLowerCase().includes(q) ||
        party.city?.toLowerCase().includes(q) ||
        party.stateName?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
            ? party.isActive
            : !party.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [parties, search, statusFilter]);

  const partyCommercialMap = useMemo(() => {
    return parties.reduce((acc, party) => {
      const activeRates = partyRates.filter(
        (rate) => String(rate.partyId) === String(party.id) && rate.isActive
      );
      const openOrders = partyOrders.filter(
        (order) =>
          String(order.partyId) === String(party.id) && order.status === "open"
      );
      const pendingQuantity = openOrders.reduce(
        (sum, order) => sum + Number(order.pendingQuantityTons || 0),
        0
      );

      let readinessLabel = "Setup pending";
      let readinessTone = "warn";

      if (activeRates.length > 0 && openOrders.length > 0) {
        readinessLabel = pendingQuantity > 0 ? "Ready for dispatch" : "Order book healthy";
        readinessTone = "ok";
      } else if (activeRates.length > 0 || openOrders.length > 0) {
        readinessLabel = "Partially configured";
        readinessTone = "partial";
      }

      acc[String(party.id)] = {
        activeRates: activeRates.length,
        openOrders: openOrders.length,
        pendingQuantity,
        readinessLabel,
        readinessTone,
      };

      return acc;
    }, {});
  }, [parties, partyOrders, partyRates]);

  const summary = useMemo(() => {
    return {
      total: parties.length,
      active: parties.filter((p) => p.isActive).length,
      inactive: parties.filter((p) => !p.isActive).length,
      withGstin: parties.filter((p) => Boolean(String(p.gstin || "").trim())).length,
      commerciallyReady: parties.filter((party) => {
        const commercial = partyCommercialMap[String(party.id)];
        return commercial?.readinessTone === "ok";
      }).length,
    };
  }, [parties, partyCommercialMap]);

  const filteredSummary = useMemo(() => {
    return {
      count: filteredParties.length,
      active: filteredParties.filter((party) => party.isActive).length,
      withGstin: filteredParties.filter((party) =>
        Boolean(String(party.gstin || "").trim())
      ).length,
      withBillingLocation: filteredParties.filter((party) =>
        Boolean(String(party.city || "").trim() || String(party.stateName || "").trim())
      ).length,
      commerciallyReady: filteredParties.filter((party) => {
        const commercial = partyCommercialMap[String(party.id)];
        return commercial?.readinessTone === "ok";
      }).length,
    };
  }, [filteredParties, partyCommercialMap]);

  const hasActiveFilters = Boolean(search.trim() || statusFilter);

  const readinessChecks = useMemo(() => {
    return [
      {
        label: "Party name entered",
        ready: Boolean(form.partyName.trim()),
      },
      {
        label: "Contact or mobile available",
        ready: Boolean(form.contactPerson.trim() || form.mobileNumber.trim()),
      },
      {
        label: "Billing region captured",
        ready: Boolean(form.city.trim() || form.stateName.trim() || form.stateCode.trim()),
      },
      {
        label: "Tax identity captured",
        ready: Boolean(form.gstin.trim() || form.pan.trim()),
      },
    ];
  }, [form]);

  const partyReadiness = useMemo(() => {
    const missingItems = readinessChecks
      .filter((check) => !check.ready)
      .map((check) => check.label);

    return {
      isReady: missingItems.length === 0,
      missingItems,
    };
  }, [readinessChecks]);

  const commercialBrief = useMemo(() => {
    const pendingSetup = Math.max(0, summary.total - summary.commerciallyReady);

    let title = "Party master is commercially usable";
    let text =
      "Use this workspace to keep billing identity clean before teams move into rates, orders, and dispatch execution.";
    let tone = "calm";

    if (pendingSetup > 0) {
      title = "Some parties still need commercial setup";
      text = `${formatMetric(
        pendingSetup
      )} party record(s) still need rates, orders, or identity completion before they are truly dispatch-ready.`;
      tone = "attention";
    } else if (summary.inactive > 0) {
      title = "Party master is healthy but includes inactive records";
      text = `${formatMetric(
        summary.inactive
      )} inactive record(s) remain available for audit history but should stay out of daily flow.`;
      tone = "strong";
    }

    return { title, text, tone, pendingSetup };
  }, [summary.commerciallyReady, summary.inactive, summary.total]);

  const controlTiles = useMemo(
    () => [
      {
        label: "Dispatch Ready",
        value: formatMetric(summary.commerciallyReady),
        note: "Parties already supported by rates and open order flow",
        tone: summary.commerciallyReady > 0 ? "strong" : "calm",
      },
      {
        label: "Need Setup",
        value: formatMetric(commercialBrief.pendingSetup),
        note: "Still missing enough commercial setup for daily use",
        tone: commercialBrief.pendingSetup > 0 ? "attention" : "calm",
      },
      {
        label: "Visible With GSTIN",
        value: formatMetric(filteredSummary.withGstin),
        note: "Tax-ready records inside the current view",
        tone: filteredSummary.withGstin > 0 ? "strong" : "calm",
      },
      {
        label: "Visible Active",
        value: formatMetric(filteredSummary.active),
        note: "Operational party records matching current filters",
        tone: filteredSummary.active > 0 ? "strong" : "calm",
      },
    ],
    [
      commercialBrief.pendingSetup,
      filteredSummary.active,
      filteredSummary.withGstin,
      summary.commerciallyReady,
    ]
  );

  const syncLabel = lastLoadedAt
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastLoadedAt))
    : "Waiting for first sync";

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setIsSubmitting(true);
      await api.post("/parties", form);
      setSuccess("Party created successfully");
      setForm(createPartyFormState());
      setShowForm(false);
      setShowList(true);
      await loadParties();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create party");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPanel = (item) => {
    setEditItem(item);
    setEditForm({
      partyName: item.partyName || "",
      partyCode: item.partyCode || "",
      contactPerson: item.contactPerson || "",
      mobileNumber: item.mobileNumber || "",
      gstin: item.gstin || "",
      pan: item.pan || "",
      addressLine1: item.addressLine1 || "",
      addressLine2: item.addressLine2 || "",
      city: item.city || "",
      stateName: item.stateName || "",
      stateCode: item.stateCode || "",
      pincode: item.pincode || "",
      partyType: item.partyType || "customer",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    try {
      setError("");
      setSuccess("");
      setIsUpdating(true);
      await api.patch(`/parties/${editItem.id}`, editForm);
      setSuccess("Party updated successfully");
      setEditItem(null);
      await loadParties();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update party");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      setError("");
      setSuccess("");
      setStatusUpdatingId(item.id);
      await api.patch(`/parties/${item.id}/status`, {
        isActive: !item.isActive,
      });
      setSuccess(
        item.isActive
          ? "Party deactivated successfully"
          : "Party activated successfully"
      );
      await loadParties();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update party status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const resetWorkspaceView = () => {
    setSearch("");
    setStatusFilter("");
    setShowList(true);
    setShowForm(false);
    setEditItem(null);
    setForm(createPartyFormState());
    setEditForm(createPartyFormState());
    setError("");
    setSuccess("");
  };

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

  const renderCommercialBadge = (partyId) => {
    const commercial = partyCommercialMap[String(partyId)] || {
      readinessLabel: "Setup pending",
      readinessTone: "warn",
    };

    const toneStyles = {
      ok: styles.commercialBadgeOk,
      partial: styles.commercialBadgePartial,
      warn: styles.commercialBadgeWarn,
    };

    return (
      <span
        style={{
          ...styles.statusBadge,
          ...(toneStyles[commercial.readinessTone] || styles.commercialBadgeWarn),
        }}
      >
        {commercial.readinessLabel}
      </span>
    );
  };

  const openCommercialWorkspace = (partyId, quickSetup = false) => {
    navigate(`/parties/${partyId}/commercial`, {
      state: quickSetup
        ? {
            profileMessage:
              "Quick setup mode: add the missing rate or order so this party becomes dispatch-ready.",
          }
        : undefined,
    });
  };

  return (
    <AppShell
      title="Parties"
      subtitle="Manage billing parties and customers"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>Commercial Master Layer</p>
              <h1 style={styles.heroTitle}>Party Billing Control Center</h1>
              <p style={styles.heroText}>
                Maintain billing parties used across dispatch, GST, and invoices.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Role In ERP</span>
                <strong style={styles.heroPillValue}>Billing and dispatch identity</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Experience</span>
                <strong style={styles.heroPillValue}>Search-first and list-aware</strong>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.controlBrief,
            ...(commercialBrief.tone === "attention"
              ? styles.controlBriefAttention
              : commercialBrief.tone === "strong"
                ? styles.controlBriefStrong
                : styles.controlBriefCalm),
          }}
        >
          <div style={styles.controlBriefCopy}>
            <p style={styles.controlBriefEyebrow}>Master Guidance</p>
            <h2 style={styles.controlBriefTitle}>{commercialBrief.title}</h2>
            <p style={styles.controlBriefText}>{commercialBrief.text}</p>
          </div>

          <div style={styles.controlBriefActions}>
            <button type="button" style={styles.button} onClick={() => setShowForm(true)}>
              Add Party
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
              onClick={loadParties}
              disabled={isLoadingData}
            >
              {isLoadingData ? "Refreshing..." : "Refresh Master"}
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
              <p style={styles.summaryLabel}>Total Parties</p>
              <h3 style={styles.summaryValue}>{summary.total}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Active</span>
              <p style={styles.summaryLabel}>Active Parties</p>
              <h3 style={styles.summaryValue}>{summary.active}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Inactive</span>
              <p style={styles.summaryLabel}>Inactive Parties</p>
              <h3 style={styles.summaryValue}>{summary.inactive}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Tax Ready</span>
              <p style={styles.summaryLabel}>With GSTIN</p>
              <h3 style={styles.summaryValue}>{summary.withGstin}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Commercial</span>
              <p style={styles.summaryLabel}>Dispatch-Ready Parties</p>
              <h3 style={styles.summaryValue}>{summary.commerciallyReady}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Quick Setup</span>
              <p style={styles.summaryLabel}>Still Need Setup</p>
              <h3 style={styles.summaryValue}>
                {Math.max(0, summary.total - summary.commerciallyReady)}
              </h3>
            </div>
          </div>
        </SectionCard>

        {error && <div style={styles.messageError}>{error}</div>}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {isLoadingData && (
          <div style={styles.loadingBanner}>
            Refreshing parties and billing contact records...
          </div>
        )}

        <SectionCard title="Workspace Health">
          <div style={styles.syncBanner}>
            <div>
              <p style={styles.syncLabel}>Commercial Identity Sync</p>
              <strong style={styles.syncValue}>
                {isLoadingData ? "Refreshing party master..." : `Last sync: ${syncLabel}`}
              </strong>
            </div>
            <span style={styles.syncNote}>
              Party records are now a stronger source of truth for billing identity, GST logic, and dispatch-linked customer selection.
            </span>
          </div>

          <div style={styles.healthGrid}>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Records</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.count)}</strong>
              <p style={styles.healthNote}>Records currently visible in this filtered workspace</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Active</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.active)}</strong>
              <p style={styles.healthNote}>Active parties currently available for operational linking</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>With GSTIN</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.withGstin)}</strong>
              <p style={styles.healthNote}>Filtered records already carrying tax identity</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>With Billing Region</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.withBillingLocation)}
              </strong>
              <p style={styles.healthNote}>Records with usable city or state data for documents</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Workspace Controls">
          <div style={styles.workspaceControlBar}>
            <div style={styles.workspaceControlCopy}>
              <span style={styles.workspaceControlLabel}>Current View</span>
              <strong style={styles.workspaceControlValue}>
                {hasActiveFilters ? "Filtered party workspace" : "All parties"}
              </strong>
              <span style={styles.workspaceControlMeta}>
                Search: {search.trim() || "none"} | Status: {statusFilter || "all"}
              </span>
            </div>

            <div style={styles.workspaceControlActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetWorkspaceView}
                disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                Reset View
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={loadParties}
                disabled={isLoadingData || isSubmitting || isUpdating}
              >
                {isLoadingData ? "Refreshing..." : "Refresh Parties"}
              </button>
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
                setSearch("");
              }}
            >
              Active Parties
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("inactive");
                setSearch("");
              }}
            >
              Inactive Parties
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setSearch("gst");
                setStatusFilter("");
              }}
            >
              Find Tax Records
            </button>
          </div>

          <div style={styles.form}>
            <input
              placeholder="Search by party, code, GSTIN, contact, city, or state"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.count)} records • {formatMetric(filteredSummary.withGstin)} with GSTIN • {formatMetric(filteredSummary.withBillingLocation)} with region data • {formatMetric(filteredSummary.commerciallyReady)} dispatch-ready
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Party Workspace">
          <div style={styles.workspaceHeader}>
            <div>
              <h3 style={styles.blockTitle}>Party Master List</h3>
              <p style={styles.blockSubtitle}>
                Maintain customer and buyer details used in dispatch billing,
                GST handling, invoice documents, and the new party-wise
                commercial workspace.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowList((prev) => !prev)}
                disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                {showList ? "Hide List" : "Show List"}
              </button>
              <button
                type="button"
                style={showForm ? styles.secondaryButton : styles.button}
                onClick={() => setShowForm((prev) => !prev)}
                disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                {showForm ? "Hide Form" : "Add Party"}
              </button>
            </div>
          </div>

          <div style={styles.commercialLaunchPanel}>
            <div style={styles.commercialLaunchCopy}>
              <span style={styles.commercialLaunchLabel}>New Practical Flow</span>
              <strong style={styles.commercialLaunchTitle}>
                Open a party and manage rates, orders, and dispatch from one place
              </strong>
              <p style={styles.commercialLaunchText}>
                Use the `Commercial` button in any party row to open the new
                party commercial profile. That page brings together material
                rates, live order status, pending quantity, and dispatch history
                so operators do not need to jump across separate modules.
              </p>
            </div>

            <div style={styles.commercialLaunchPoints}>
              <div style={styles.commercialLaunchPoint}>
                <span style={styles.commercialLaunchPointLabel}>Best For</span>
                <strong style={styles.commercialLaunchPointValue}>
                  Daily commercial operations
                </strong>
              </div>
              <div style={styles.commercialLaunchPoint}>
                <span style={styles.commercialLaunchPointLabel}>Entry Path</span>
                <strong style={styles.commercialLaunchPointValue}>
                  Parties → Commercial
                </strong>
              </div>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} style={styles.formSectionStack}>
              <div>
                <p style={styles.formGroupTitle}>Party Readiness</p>
                <div
                  style={{
                    ...styles.readinessStrip,
                    ...(partyReadiness.isReady
                      ? styles.readinessOk
                      : styles.readinessWarn),
                  }}
                >
                  <strong>
                    {partyReadiness.isReady
                      ? "Ready for commercial use"
                      : "A few identity details are still weak"}
                  </strong>
                  <span>
                    {partyReadiness.isReady
                      ? "This record has the essentials commonly needed for billing and dispatch linkage."
                      : partyReadiness.missingItems.join(" • ")}
                  </span>
                </div>
              </div>

              <div>
                <p style={styles.formGroupTitle}>Party Identity</p>
                <div style={styles.form}>
                  <input
                    name="partyName"
                    placeholder="Party Name"
                    value={form.partyName}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="partyCode"
                    placeholder="Party Code"
                    value={form.partyCode}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="contactPerson"
                    placeholder="Contact Person"
                    value={form.contactPerson}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="mobileNumber"
                    placeholder="Mobile Number"
                    value={form.mobileNumber}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="gstin"
                    placeholder="GSTIN"
                    value={form.gstin}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="pan"
                    placeholder="PAN"
                    value={form.pan}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div>
                <p style={styles.formGroupTitle}>Address</p>
                <div style={styles.form}>
                  <input
                    name="addressLine1"
                    placeholder="Address Line 1"
                    value={form.addressLine1}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="addressLine2"
                    placeholder="Address Line 2"
                    value={form.addressLine2}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="city"
                    placeholder="City"
                    value={form.city}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="stateName"
                    placeholder="State Name"
                    value={form.stateName}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="stateCode"
                    placeholder="State Code"
                    value={form.stateCode}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="pincode"
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Party"}
              </button>
            </form>
          )}

          {showList &&
            (filteredParties.length === 0 ? (
              <div style={styles.emptyStateCard}>
                <strong style={styles.emptyStateTitle}>
                  {hasActiveFilters
                    ? "No parties match the current filters"
                    : "No parties found yet"}
                </strong>
                <p style={styles.emptyStateText}>
                  {hasActiveFilters
                    ? "Broaden your search or status filter to find the right billing record."
                    : "Once parties are created, they will appear here for billing, GST, and dispatch linkage workflows."}
                </p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Party Name</th>
                      <th style={styles.th}>Code</th>
                      <th style={styles.th}>Contact</th>
                      <th style={styles.th}>GSTIN</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>Commercial Readiness</th>
                      <th style={styles.th}>Open Orders</th>
                      <th style={styles.th}>Pending Qty</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParties.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <strong>{item.partyName}</strong>
                          <div style={styles.rowHelperText}>
                            Open Commercial to manage this party operationally
                          </div>
                        </td>
                        <td style={styles.td}>{item.partyCode || "-"}</td>
                        <td style={styles.td}>{item.contactPerson || "-"}</td>
                        <td style={styles.td}>{item.gstin || "-"}</td>
                        <td style={styles.td}>{item.city || "-"}</td>
                        <td style={styles.td}>{renderCommercialBadge(item.id)}</td>
                        <td style={styles.td}>
                          {partyCommercialMap[String(item.id)]?.openOrders || 0}
                        </td>
                        <td style={styles.td}>
                          {formatMetric(
                            partyCommercialMap[String(item.id)]?.pendingQuantity || 0
                          )}
                        </td>
                        <td style={styles.td}>{renderStatusBadge(item.isActive)}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button
                              type="button"
                              style={{ ...styles.smallButton, ...styles.commercialButton }}
                              onClick={() => openCommercialWorkspace(item.id)}
                              disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
                            >
                              Commercial
                            </button>
                            {partyCommercialMap[String(item.id)]?.readinessTone !== "ok" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.quickSetupButton }}
                                onClick={() => openCommercialWorkspace(item.id, true)}
                                disabled={
                                  isSubmitting ||
                                  isUpdating ||
                                  Boolean(statusUpdatingId)
                                }
                              >
                                Quick Setup
                              </button>
                            )}
                            <button
                              type="button"
                              style={styles.smallButton}
                              onClick={() => openEditPanel(item)}
                              disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={{
                                ...styles.smallButton,
                                ...(item.isActive ? styles.warnButton : styles.successButton),
                              }}
                              onClick={() => handleToggleStatus(item)}
                              disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
                            >
                              {statusUpdatingId === item.id
                                ? "Updating..."
                                : item.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </SectionCard>

        {editItem && (
          <SectionCard title={`Edit Party — ${editItem.partyName}`}>
            <div style={styles.editHeader}>
              <h3 style={styles.editTitle}>Update billing identity</h3>
              <p style={styles.editSubtitle}>
                Edit the selected party carefully so linked dispatch and print
                documents stay clean and reliable.
              </p>
            </div>

            <div style={styles.form}>
              <input
                name="partyName"
                placeholder="Party Name"
                value={editForm.partyName}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="partyCode"
                placeholder="Party Code"
                value={editForm.partyCode}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="contactPerson"
                placeholder="Contact Person"
                value={editForm.contactPerson}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="mobileNumber"
                placeholder="Mobile Number"
                value={editForm.mobileNumber}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="gstin"
                placeholder="GSTIN"
                value={editForm.gstin}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="pan"
                placeholder="PAN"
                value={editForm.pan}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="addressLine1"
                placeholder="Address Line 1"
                value={editForm.addressLine1}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="addressLine2"
                placeholder="Address Line 2"
                value={editForm.addressLine2}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="city"
                placeholder="City"
                value={editForm.city}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="stateName"
                placeholder="State Name"
                value={editForm.stateName}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="stateCode"
                placeholder="State Code"
                value={editForm.stateCode}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
              <input
                name="pincode"
                placeholder="Pincode"
                value={editForm.pincode}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
            </div>

            <div style={styles.actionRow}>
              <button
                type="button"
                style={styles.button}
                onClick={handleEditSave}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setEditItem(null)}
                disabled={isUpdating}
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
      "radial-gradient(circle at top left, rgba(14,165,233,0.16), transparent 24%), radial-gradient(circle at bottom right, rgba(236,72,153,0.14), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
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
    background: "rgba(14,165,233,0.16)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(236,72,153,0.14)",
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
  summaryRose: {
    background: "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)",
  },
  summaryAmber: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
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
    fontWeight: "800",
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
  syncBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #fdf2f8 100%)",
    border: "1px solid rgba(59,130,246,0.12)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
    flexWrap: "wrap",
  },
  syncLabel: {
    margin: 0,
    color: "#1d4ed8",
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
  },
  workspaceControlActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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
  workspaceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  workspaceActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  commercialLaunchPanel: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    padding: "18px",
    marginBottom: "20px",
    borderRadius: "22px",
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.8) 0%, rgba(255,247,237,0.92) 100%)",
    border: "1px solid rgba(59,130,246,0.14)",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  },
  commercialLaunchCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  commercialLaunchLabel: {
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  commercialLaunchTitle: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
    lineHeight: 1.3,
  },
  commercialLaunchText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  commercialLaunchPoints: {
    display: "grid",
    gap: "12px",
  },
  commercialLaunchPoint: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.8)",
    border: "1px solid rgba(255,255,255,0.8)",
  },
  commercialLaunchPointLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  commercialLaunchPointValue: {
    color: "#0f172a",
    fontSize: "14px",
  },
  blockTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
  },
  blockSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "780px",
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
  readinessStrip: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
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
    boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
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
    marginTop: "16px",
    flexWrap: "wrap",
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
    lineHeight: 1.6,
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
  },
  td: {
    padding: "13px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  rowHelperText: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
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
  commercialButton: {
    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
  },
  warnButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  successButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  quickSetupButton: {
    background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
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
  commercialBadgeOk: {
    background: "#dcfce7",
    color: "#166534",
  },
  commercialBadgePartial: {
    background: "#fef3c7",
    color: "#92400e",
  },
  commercialBadgeWarn: {
    background: "#fee2e2",
    color: "#991b1b",
  },
};

export default PartiesPage;
