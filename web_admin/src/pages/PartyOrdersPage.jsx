import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getCachedResource } from "../services/clientCache";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useMasters } from "../hooks/useMasters";
import { useAuth } from "../hooks/useAuth";
import {
  formatDisplayDate,
  getTimestampFileLabel,
  getTodayDateValue,
  toDateOnlyValue,
} from "../utils/date";

const buildOrderNumberPreview = (orderDate) =>
  orderDate ? `PO-${String(orderDate).replace(/-/g, "")}-0001` : "PO-YYYYMMDD-0001";
const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

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

const hasLinkedDispatches = (order) =>
  Number(order?.plannedQuantityTons || 0) > 0;

const getFulfillmentState = (order) => {
  if (order.status === "cancelled") {
    return {
      label: "Cancelled",
      tone: "cancelled",
    };
  }

  if (order.status === "completed") {
    return {
      label: "Completed",
      tone: "completed",
    };
  }

  if (
    Number(order.completedQuantityTons || 0) > 0 ||
    Number(order.inProgressQuantityTons || 0) > 0
  ) {
    return {
      label: "Partially Fulfilled",
      tone: "partial",
    };
  }

  return {
    label: "Open",
    tone: "open",
  };
};

const canManageLinkedOrderStatus = (order, role) => {
  if (!hasLinkedDispatches(order)) {
    return true;
  }

  return ["super_admin", "manager"].includes(String(role || ""));
};

const getLinkedOrderStatusRestriction = (order, targetStatus) => {
  if (!hasLinkedDispatches(order)) {
    return "";
  }

  if (targetStatus === "cancelled") {
    return "Only managers or super admins can cancel an order after dispatch has been linked.";
  }

  if (
    targetStatus === "open" &&
    ["completed", "cancelled"].includes(String(order?.status || ""))
  ) {
    return "Only managers or super admins can reopen an order after dispatch has been linked.";
  }

  return "";
};

const createOrderFormState = () => ({
  orderNumber: "",
  orderDate: getTodayDateValue(),
  partyId: "",
  plantId: "",
  materialId: "",
  orderedQuantityTons: "",
  targetDispatchDate: "",
  remarks: "",
  status: "open",
});

function PartyOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const hasAppliedPrefillRef = useRef(false);
  const focusedOrderIdRef = useRef("");
  const { masters, loadingMasters } = useMasters();
  const [orders, setOrders] = useState([]);
  const [plants, setPlants] = useState([]);
  const [parties, setParties] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [showList, setShowList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [pendingOnlyFilter, setPendingOnlyFilter] = useState(false);
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [form, setForm] = useState(createOrderFormState);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(createOrderFormState);

  const materials = masters?.materials || [];
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const focusOrderId = queryParams.get("focusOrderId") || "";

  async function loadAll() {
    setIsLoadingData(true);

    try {
      const [ordersRes, plantsRes, partiesRes] = await Promise.all([
        api.get("/party-orders"),
        getCachedResource("lookup:plants", 60_000, async () => (await api.get("/plants/lookup")).data?.data || []),
        getCachedResource("lookup:parties", 60_000, async () => (await api.get("/parties/lookup")).data?.data || []),
      ]);

      setOrders(ordersRes.data?.data || []);
      setPlants(plantsRes);
      setParties(partiesRes);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load party orders");
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const prefillOrder = location.state?.prefillOrder;
    if (!prefillOrder || hasAppliedPrefillRef.current) {
      return;
    }

    hasAppliedPrefillRef.current = true;
    setShowForm(true);
    setShowList(true);
    setForm((prev) => ({
      ...prev,
      ...prefillOrder,
    }));
  }, [location.state]);

  useEffect(() => {
    setSearch(queryParams.get("search") || "");
    setStatusFilter(queryParams.get("status") || "");
    setPartyFilter(queryParams.get("partyId") || "");
    setPlantFilter(queryParams.get("plantId") || "");
    setMaterialFilter(queryParams.get("materialId") || "");
    setFulfillmentFilter(queryParams.get("fulfillment") || "");
    setPendingOnlyFilter(queryParams.get("pendingOnly") === "true");
    setDateFromFilter(queryParams.get("dateFrom") || "");
    setDateToFilter(queryParams.get("dateTo") || "");
  }, [queryParams]);

  const returnToPartyCommercialProfile =
    location.state?.returnToPartyCommercialProfile || null;

  const handleChange = (setter) => (e) => {
    const { name, value } = e.target;

    setter((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "plantId") {
        next.materialId = "";
      }

      return next;
    });
  };

  const validateOrderPayload = (payload) => {
    if (
      !payload.orderDate ||
      !payload.partyId ||
      !payload.plantId ||
      !payload.materialId ||
      payload.orderedQuantityTons === ""
    ) {
      return "Order date, party, plant, material, and ordered quantity are required";
    }

    if (Number(payload.orderedQuantityTons) <= 0) {
      return "Ordered quantity must be greater than 0";
    }

    if (
      payload.targetDispatchDate &&
      new Date(`${payload.targetDispatchDate}T00:00:00`) <
        new Date(`${payload.orderDate}T00:00:00`)
    ) {
      return "Target dispatch date cannot be before order date";
    }

    return "";
  };

  const normalizePayload = (payload) => ({
    ...payload,
    orderNumber: String(payload.orderNumber || "").trim(),
    partyId: Number(payload.partyId),
    plantId: Number(payload.plantId),
    materialId: Number(payload.materialId),
    orderedQuantityTons: Number(payload.orderedQuantityTons),
    targetDispatchDate: payload.targetDispatchDate || null,
    remarks: payload.remarks || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateOrderPayload(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/party-orders", normalizePayload(form));
      setSuccess("Party order created successfully");
      setForm(createOrderFormState());
      setShowForm(false);
      setShowList(true);
      await loadAll();

      if (returnToPartyCommercialProfile) {
        navigate(`/parties/${returnToPartyCommercialProfile}/commercial`, {
          state: {
            profileMessage: "Party order created successfully",
          },
        });
        return;
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create party order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPanel = (item) => {
    setEditItem(item);
    setEditForm({
      orderNumber: item.orderNumber || "",
      orderDate: item.orderDate || getTodayDateValue(),
      partyId: item.partyId ? String(item.partyId) : "",
      plantId: item.plantId ? String(item.plantId) : "",
      materialId: item.materialId ? String(item.materialId) : "",
      orderedQuantityTons:
        item.orderedQuantityTons !== null && item.orderedQuantityTons !== undefined
          ? String(item.orderedQuantityTons)
          : "",
      targetDispatchDate: item.targetDispatchDate || "",
      remarks: item.remarks || "",
      status: item.status || "open",
    });
    setError("");
    setSuccess("");
  };

  const closeEditPanel = () => {
    setEditItem(null);
    setEditForm(createOrderFormState());
  };

  const editOrderHasLinkedDispatches = hasLinkedDispatches(editItem);

  useEffect(() => {
    if (!focusOrderId) {
      focusedOrderIdRef.current = "";
      return;
    }

    if (focusedOrderIdRef.current === String(focusOrderId)) {
      return;
    }

    const targetOrder = orders.find(
      (item) => String(item.id) === String(focusOrderId)
    );

    if (!targetOrder) {
      return;
    }

    openEditPanel(targetOrder);
    setShowList(true);
    setShowForm(false);
    setSuccess("Focused order opened from the commercial exceptions queue.");
    setError("");
    focusedOrderIdRef.current = String(focusOrderId);
  }, [focusOrderId, orders]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateOrderPayload(editForm);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setIsUpdating(true);
      await api.patch(`/party-orders/${editItem.id}`, normalizePayload(editForm));
      setSuccess("Party order updated successfully");
      closeEditPanel();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update party order");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (item, status) => {
    setError("");
    setSuccess("");

    try {
      setStatusUpdatingId(item.id);
      await api.patch(`/party-orders/${item.id}/status`, { status });
      setSuccess(`Order status changed to ${status}`);
      await loadAll();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update party order status"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openDispatchAgainstOrder = (order) => {
    navigate("/dispatch-reports", {
      state: {
        prefillDispatch: {
          sourceType: "Plant",
          plantId: order.plantId ? String(order.plantId) : "",
          materialId: order.materialId ? String(order.materialId) : "",
          partyId: order.partyId ? String(order.partyId) : "",
          partyOrderId: order.id ? String(order.id) : "",
          remarks: order.remarks || "",
        },
      },
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.toLowerCase();
      const fulfillmentState = getFulfillmentState(order);
      const orderDateValue = toDateOnlyValue(order.orderDate);

      const matchesSearch =
        order.orderNumber?.toLowerCase().includes(q) ||
        order.partyName?.toLowerCase().includes(q) ||
        order.plantName?.toLowerCase().includes(q) ||
        order.materialName?.toLowerCase().includes(q) ||
        order.remarks?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "" ? true : order.status === statusFilter;
      const matchesParty =
        partyFilter === "" ? true : String(order.partyId) === String(partyFilter);
      const matchesPlant =
        plantFilter === "" ? true : String(order.plantId) === String(plantFilter);
      const matchesMaterial =
        materialFilter === ""
          ? true
          : String(order.materialId) === String(materialFilter);
      const matchesFulfillment =
        fulfillmentFilter === ""
          ? true
          : fulfillmentState.label === fulfillmentFilter;
      const matchesPendingOnly = pendingOnlyFilter
        ? Number(order.pendingQuantityTons || 0) > 0
        : true;
      const matchesDateFrom =
        dateFromFilter === "" ? true : orderDateValue >= dateFromFilter;
      const matchesDateTo =
        dateToFilter === "" ? true : orderDateValue <= dateToFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesParty &&
        matchesPlant &&
        matchesMaterial &&
        matchesFulfillment &&
        matchesPendingOnly &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    partyFilter,
    plantFilter,
    materialFilter,
    fulfillmentFilter,
    pendingOnlyFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const summary = useMemo(
    () => ({
      totalOrders: orders.length,
      orderedQuantity: orders.reduce(
        (sum, order) => sum + Number(order.orderedQuantityTons || 0),
        0
      ),
      plannedQuantity: orders.reduce(
        (sum, order) => sum + Number(order.plannedQuantityTons || 0),
        0
      ),
      completedQuantity: orders.reduce(
        (sum, order) => sum + Number(order.completedQuantityTons || 0),
        0
      ),
      inProgressQuantity: orders.reduce(
        (sum, order) => sum + Number(order.inProgressQuantityTons || 0),
        0
      ),
      pendingQuantity: orders.reduce(
        (sum, order) => sum + Number(order.pendingQuantityTons || 0),
        0
      ),
      open: orders.filter((order) => order.status === "open").length,
      completed: orders.filter((order) => order.status === "completed").length,
    }),
    [orders]
  );

  const activeParties = useMemo(
    () => parties.filter((party) => party.isActive),
    [parties]
  );

  const canApplyStatusAction = (order, targetStatus) => {
    if (targetStatus === "cancelled" || targetStatus === "open") {
      return canManageLinkedOrderStatus(order, currentUser?.role);
    }

    return true;
  };

  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      setError("No party orders match the current filters for export");
      setSuccess("");
      return;
    }

    const rows = filteredOrders.map((order) => ({
      order_number: order.orderNumber || "",
      order_date: toDateOnlyValue(order.orderDate),
      party: order.partyName || "",
      plant: order.plantName || "",
      material: order.materialName || "",
      fulfillment_state: getFulfillmentState(order).label,
      backend_status: order.status || "",
      ordered_quantity_tons: Number(order.orderedQuantityTons || 0),
      allocated_quantity_tons: Number(order.plannedQuantityTons || 0),
      completed_quantity_tons: Number(order.completedQuantityTons || 0),
      in_transit_quantity_tons: Number(order.inProgressQuantityTons || 0),
      pending_quantity_tons: Number(order.pendingQuantityTons || 0),
      target_dispatch_date: toDateOnlyValue(order.targetDispatchDate),
      remarks: order.remarks || "",
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = getTimestampFileLabel();

    anchor.href = url;
    anchor.download = `party-orders-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    setSuccess("Party orders export downloaded");
    setError("");
  };

  const formReadiness = useMemo(() => {
    const checks = [
      Boolean(form.orderDate),
      Boolean(form.partyId && form.plantId && form.materialId),
      Number(form.orderedQuantityTons || 0) > 0,
    ];

    return checks.every(Boolean);
  }, [form]);

  const orderControlBrief = useMemo(() => {
    const today = getTodayDateValue();
    const overdueOrders = orders.filter(
      (order) =>
        order.status === "open" &&
        Number(order.pendingQuantityTons || 0) > 0 &&
        toDateOnlyValue(order.targetDispatchDate) &&
        toDateOnlyValue(order.targetDispatchDate) < today
    );

    let title = "Order book is in operational control";
    let text =
      "Use this workspace to keep booking, allocation, and pending balance aligned before dispatch pressure builds.";
    let tone = "calm";

    if (overdueOrders.length > 0) {
      title = "Open orders are slipping past target dates";
      text = `${formatMetric(
        overdueOrders.length
      )} order(s) are past target dispatch date and still carry pending balance.`;
      tone = "attention";
    } else if (summary.pendingQuantity > 0) {
      title = "Order fulfillment is active and needs tracking";
      text = `${formatMetric(
        summary.pendingQuantity
      )} tons remain pending across the live order book, so allocation discipline still matters.`;
      tone = "strong";
    }

    return {
      title,
      text,
      tone,
      overdueOrders: overdueOrders.length,
    };
  }, [orders, summary.pendingQuantity]);

  const orderCommandTiles = useMemo(
    () => [
      {
        label: "Open Orders",
        value: formatMetric(summary.open),
        note: "Orders still eligible for dispatch allocation",
        tone: summary.open > 0 ? "strong" : "calm",
      },
      {
        label: "Pending Balance",
        value: formatMetric(summary.pendingQuantity),
        note: "Tons still waiting to be fulfilled",
        tone: summary.pendingQuantity > 0 ? "attention" : "calm",
      },
      {
        label: "Allocated",
        value: formatMetric(summary.plannedQuantity),
        note: "Already routed into dispatch planning",
        tone: summary.plannedQuantity > 0 ? "strong" : "calm",
      },
      {
        label: "Current View",
        value: formatMetric(filteredOrders.length),
        note: "Orders matching current search and filter context",
        tone: filteredOrders.length < orders.length ? "strong" : "calm",
      },
    ],
    [
      filteredOrders.length,
      orders.length,
      summary.open,
      summary.pendingQuantity,
      summary.plannedQuantity,
    ]
  );

  const renderStatusBadge = (order) => {
    const fulfillmentState = getFulfillmentState(order);
    const palette = {
      open: { background: "#fef3c7", color: "#92400e" },
      completed: { background: "#dcfce7", color: "#166534" },
      cancelled: { background: "#fee2e2", color: "#991b1b" },
      partial: { background: "#dbeafe", color: "#1d4ed8" },
    };

    return (
      <span
        style={{
          ...styles.statusBadge,
          ...(palette[fulfillmentState.tone] || palette.open),
        }}
      >
        {fulfillmentState.label}
      </span>
    );
  };

  const renderProgressCell = (order) => {
    const progressPercent = Number(order.orderedQuantityTons || 0)
      ? Math.min(
          100,
          Math.max(
            0,
            (Number(order.completedQuantityTons || 0) /
              Number(order.orderedQuantityTons || 1)) *
              100
          )
        )
      : 0;

    return (
      <div style={styles.progressCell}>
        <div style={styles.progressMeta}>
          <strong>{formatMetric(progressPercent)}%</strong>
          <span style={styles.progressHint}>completed</span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Party Orders"
      subtitle="Run the commercial order book with live ordered, planned, in-progress, and pending dispatch quantities."
    >
      <div style={styles.pageStack}>
        {(error || success) && (
          <div style={error ? styles.errorBanner : styles.successBanner}>
            {error || success}
          </div>
        )}

        <div
          style={{
            ...styles.heroCard,
            ...(orderControlBrief.tone === "attention"
              ? styles.heroCardAttention
              : orderControlBrief.tone === "strong"
                ? styles.heroCardStrong
                : styles.heroCardCalm),
          }}
        >
          <div style={styles.heroCopy}>
            <p style={styles.heroEyebrow}>Commercial Order Control</p>
            <h2 style={styles.heroTitle}>{orderControlBrief.title}</h2>
            <p style={styles.heroText}>{orderControlBrief.text}</p>
            <div style={styles.heroActionRow}>
              <button
                type="button"
                style={styles.button}
                onClick={() => setShowForm(true)}
              >
                Create Order
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setPendingOnlyFilter(true)}
              >
                Focus Pending Balance
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={handleExportCsv}
              >
                Export Order Book
              </button>
            </div>
          </div>

          <div style={styles.heroMetaGrid}>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Overdue Orders</span>
              <strong style={styles.heroMetaValue}>
                {formatMetric(orderControlBrief.overdueOrders)}
              </strong>
              <span style={styles.heroMetaText}>Open orders already past target date</span>
            </div>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Completed Orders</span>
              <strong style={styles.heroMetaValue}>{formatMetric(summary.completed)}</strong>
              <span style={styles.heroMetaText}>Closed cleanly in the current workspace</span>
            </div>
          </div>
        </div>

        <div style={styles.commandTileGrid}>
          {orderCommandTiles.map((tile) => (
            <div
              key={tile.label}
              style={{
                ...styles.commandTile,
                ...(tile.tone === "attention"
                  ? styles.commandTileAttention
                  : tile.tone === "strong"
                    ? styles.commandTileStrong
                    : styles.commandTileCalm),
              }}
            >
              <span style={styles.commandTileLabel}>{tile.label}</span>
              <strong style={styles.commandTileValue}>{tile.value}</strong>
              <p style={styles.commandTileText}>{tile.note}</p>
            </div>
          ))}
        </div>

        {returnToPartyCommercialProfile && (
          <div style={styles.returnBanner}>
            <span>You opened this page from a party commercial profile.</span>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() =>
                navigate(`/parties/${returnToPartyCommercialProfile}/commercial`)
              }
            >
              Back To Party Commercial
            </button>
          </div>
        )}

        <SectionCard title="Order Book Snapshot">
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryTag}>Orders</span>
              <p style={styles.summaryLabel}>Total Orders</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.totalOrders)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Booked</span>
              <p style={styles.summaryLabel}>Ordered Quantity</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.orderedQuantity)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Allocated</span>
              <p style={styles.summaryLabel}>Allocated To Dispatch</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.plannedQuantity)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
              <span style={styles.summaryTag}>Pending</span>
              <p style={styles.summaryLabel}>Balance Pending</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.pendingQuantity)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Completed</span>
              <p style={styles.summaryLabel}>Completed Dispatch Tons</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.completedQuantity)}</h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Order Workspace">
          <div style={styles.workspaceHeader}>
            <div>
              <h3 style={styles.blockTitle}>Commercial Order Register</h3>
              <p style={styles.blockSubtitle}>
                Create customer orders first, then link dispatch against them so pending balance stays visible throughout fulfillment.
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
              >
                {showForm ? "Hide Form" : "Add Order"}
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} style={styles.formSectionStack}>
              <div>
                <p style={styles.formGroupTitle}>Order Details</p>
                <div style={styles.form}>
                  <input
                    name="orderNumber"
                    placeholder="Leave blank to auto-generate"
                    value={form.orderNumber}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    type="date"
                    name="orderDate"
                    value={form.orderDate}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <select
                    name="partyId"
                    value={form.partyId}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  >
                    <option value="">Select Party</option>
                    {activeParties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.partyName}
                      </option>
                    ))}
                  </select>
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
                    name="materialId"
                    value={form.materialId}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                    disabled={loadingMasters || !form.plantId}
                  >
                    <option value="">
                      {form.plantId ? "Select Material" : "Select Plant First"}
                    </option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    name="orderedQuantityTons"
                    placeholder="Ordered Quantity (Tons)"
                    value={form.orderedQuantityTons}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    type="date"
                    name="targetDispatchDate"
                    value={form.targetDispatchDate}
                    onChange={handleChange(setForm)}
                    style={styles.input}
                  />
                  <input
                    name="remarks"
                    placeholder="Remarks"
                    value={form.remarks}
                    onChange={handleChange(setForm)}
                    style={{ ...styles.input, gridColumn: "1 / -1" }}
                  />
                </div>
                <p style={styles.formHelperText}>
                  Order number is auto-generated if you leave it blank, so operators do not need to remember the last sequence.
                </p>
                <p style={styles.formHelperText}>
                  Default order status is `open`. Suggested number format: {buildOrderNumberPreview(form.orderDate)}.
                </p>
              </div>

              <div
                style={{
                  ...styles.readinessStrip,
                  ...(formReadiness ? styles.readinessOk : styles.readinessWarn),
                }}
              >
                <strong>{formReadiness ? "Ready to save" : "Complete the order details"}</strong>
                <span>
                  {formReadiness
                    ? "The order has the key commercial and operational links required for dispatch allocation."
                    : "Fill date, party, plant, material, and quantity before saving."}
                </span>
              </div>

              <button type="submit" style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? "Saving Order..." : "Add Party Order"}
              </button>
            </form>
          )}
        </SectionCard>

        {editItem && (
          <SectionCard title={`Edit Order — ${editItem.orderNumber}`}>
            <form onSubmit={handleEditSubmit} style={styles.formSectionStack}>
              {editOrderHasLinkedDispatches && (
                <div style={styles.lockNotice}>
                  Core commercial fields are locked because this order already has
                  linked dispatch quantity. You can still increase quantity,
                  adjust target date, remarks, and update status safely.
                </div>
              )}

              <div style={styles.form}>
                <input
                  name="orderNumber"
                  placeholder="Leave blank to keep current number"
                  value={editForm.orderNumber}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
                <input
                  type="date"
                  name="orderDate"
                  value={editForm.orderDate}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
                <select
                  name="partyId"
                  value={editForm.partyId}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                  disabled={editOrderHasLinkedDispatches}
                >
                  <option value="">Select Party</option>
                  {activeParties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.partyName}
                    </option>
                  ))}
                </select>
                <select
                  name="plantId"
                  value={editForm.plantId}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                  disabled={editOrderHasLinkedDispatches}
                >
                  <option value="">Select Plant</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>
                <select
                  name="materialId"
                  value={editForm.materialId}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                  disabled={
                    loadingMasters || !editForm.plantId || editOrderHasLinkedDispatches
                  }
                >
                  <option value="">
                    {editForm.plantId ? "Select Material" : "Select Plant First"}
                  </option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.materialName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  name="orderedQuantityTons"
                  placeholder="Ordered Quantity (Tons)"
                  value={editForm.orderedQuantityTons}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
                <input
                  type="date"
                  name="targetDispatchDate"
                  value={editForm.targetDispatchDate}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  name="remarks"
                  placeholder="Remarks"
                  value={editForm.remarks}
                  onChange={handleChange(setEditForm)}
                  style={{ ...styles.input, gridColumn: "1 / -1" }}
                />
              </div>

              <div style={styles.actionRow}>
                <button type="submit" style={styles.button} disabled={isUpdating}>
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
          <div style={styles.quickFilterRow}>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("open");
                setPendingOnlyFilter(true);
              }}
            >
              Open With Pending Balance
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setFulfillmentFilter("Partially Fulfilled");
                setPendingOnlyFilter(false);
              }}
            >
              Partial Fulfillment
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("completed");
                setPendingOnlyFilter(false);
              }}
            >
              Completed Orders
            </button>
          </div>

          <div style={styles.form}>
            <input
              placeholder="Search order number, party, plant, material, remarks"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Parties</option>
              {activeParties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyName}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Materials</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.materialName}
                </option>
              ))}
            </select>
            <select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Fulfillment States</option>
              <option value="Open">Open</option>
              <option value="Partially Fulfilled">Partially Fulfilled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              style={styles.input}
            />
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              style={styles.input}
            />
            <label style={styles.checkboxCard}>
              <input
                type="checkbox"
                checked={pendingOnlyFilter}
                onChange={(e) => setPendingOnlyFilter(e.target.checked)}
              />
              <span>Only pending balance {">"} 0</span>
            </label>
          </div>

          <div style={styles.filterActionRow}>
            <span style={styles.filterSummary}>
              Showing {formatMetric(filteredOrders.length)} orders in the current view
            </span>
            <div style={styles.inlineActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setPartyFilter("");
                  setPlantFilter("");
                  setMaterialFilter("");
                  setFulfillmentFilter("");
                  setPendingOnlyFilter(false);
                  setDateFromFilter("");
                  setDateToFilter("");
                }}
              >
                Clear Filters
              </button>
              <button type="button" style={styles.button} onClick={handleExportCsv}>
                Export CSV
              </button>
            </div>
          </div>
        </SectionCard>

        {showList && (
          <SectionCard title="Party Order List">
            {isLoadingData ? (
              <div style={styles.emptyStateCard}>
                <strong style={styles.emptyStateTitle}>Loading order book...</strong>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={styles.emptyStateCard}>
                <strong style={styles.emptyStateTitle}>
                  No party orders match the current filters
                </strong>
                <p style={styles.emptyStateText}>
                  Create a new order or loosen the filters to review the commercial order register.
                </p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Party</th>
                      <th style={styles.th}>Plant</th>
                      <th style={styles.th}>Material</th>
                      <th style={styles.th}>Order Qty</th>
                      <th style={styles.th}>Allocated</th>
                      <th style={styles.th}>Completed</th>
                      <th style={styles.th}>In Transit</th>
                      <th style={styles.th}>Balance Pending</th>
                      <th style={styles.th}>Progress</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={styles.td}>
                          <strong>{order.orderNumber}</strong>
                          <div style={styles.cellMeta}>
                            {order.remarks || "No remarks added"}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {formatDisplayDate(order.orderDate)}
                          {order.targetDispatchDate ? (
                            <div style={styles.cellMeta}>
                              Target: {formatDisplayDate(order.targetDispatchDate)}
                            </div>
                          ) : null}
                        </td>
                        <td style={styles.td}>{order.partyName}</td>
                        <td style={styles.td}>{order.plantName}</td>
                        <td style={styles.td}>{order.materialName}</td>
                        <td style={styles.td}>{formatMetric(order.orderedQuantityTons)}</td>
                        <td style={styles.td}>{formatMetric(order.plannedQuantityTons)}</td>
                        <td style={styles.td}>{formatMetric(order.completedQuantityTons)}</td>
                        <td style={styles.td}>{formatMetric(order.inProgressQuantityTons)}</td>
                        <td style={styles.td}>{formatMetric(order.pendingQuantityTons)}</td>
                        <td style={styles.td}>{renderProgressCell(order)}</td>
                        <td style={styles.td}>{renderStatusBadge(order)}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button
                              type="button"
                              style={styles.smallButton}
                              onClick={() => openDispatchAgainstOrder(order)}
                              disabled={statusUpdatingId === order.id}
                            >
                              Dispatch
                            </button>
                            <button
                              type="button"
                              style={styles.smallButton}
                              onClick={() => openEditPanel(order)}
                              disabled={statusUpdatingId === order.id}
                            >
                              Edit
                            </button>
                            {order.status !== "open" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.pendingButton }}
                                onClick={() => handleStatusChange(order, "open")}
                                disabled={
                                  statusUpdatingId === order.id ||
                                  !canApplyStatusAction(order, "open")
                                }
                                title={getLinkedOrderStatusRestriction(order, "open")}
                              >
                                Open
                              </button>
                            )}
                            {order.status !== "completed" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.completedButton }}
                                onClick={() => handleStatusChange(order, "completed")}
                                disabled={statusUpdatingId === order.id}
                              >
                                Complete
                              </button>
                            )}
                            {order.status !== "cancelled" && (
                              <button
                                type="button"
                                style={{ ...styles.smallButton, ...styles.cancelledButton }}
                                onClick={() => handleStatusChange(order, "cancelled")}
                                disabled={
                                  statusUpdatingId === order.id ||
                                  !canApplyStatusAction(order, "cancelled")
                                }
                                title={getLinkedOrderStatusRestriction(order, "cancelled")}
                              >
                                Cancel
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
    display: "grid",
    gridTemplateColumns: "1.4fr 0.9fr",
    gap: "18px",
    padding: "24px",
    borderRadius: "26px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 22px 48px rgba(15,23,42,0.08)",
  },
  heroCardCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  heroCardStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(255,255,255,0.96) 100%)",
  },
  heroCardAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(254,242,242,0.96) 100%)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroEyebrow: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  heroTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "30px",
    fontWeight: "800",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  heroText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  heroActionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "6px",
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  heroMetaCard: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.62)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
  },
  heroMetaLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.85px",
  },
  heroMetaValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
    lineHeight: 1.25,
  },
  heroMetaText: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  commandTileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  commandTile: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.06)",
  },
  commandTileCalm: {
    background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.96))",
  },
  commandTileStrong: {
    background: "linear-gradient(180deg, rgba(239,246,255,0.98), rgba(255,255,255,0.96))",
  },
  commandTileAttention: {
    background: "linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.96))",
  },
  commandTileLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.9px",
  },
  commandTileValue: {
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: "800",
    lineHeight: 1.15,
  },
  commandTileText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
    minHeight: "40px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    padding: "18px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 18px 40px rgba(148, 163, 184, 0.12)",
  },
  summaryAmber: {
    background: "linear-gradient(180deg, rgba(251,191,36,0.16), rgba(255,255,255,0.9))",
  },
  summaryGreen: {
    background: "linear-gradient(180deg, rgba(34,197,94,0.14), rgba(255,255,255,0.9))",
  },
  summaryPurple: {
    background: "linear-gradient(180deg, rgba(59,130,246,0.12), rgba(255,255,255,0.9))",
  },
  summaryRose: {
    background: "linear-gradient(180deg, rgba(244,63,94,0.10), rgba(255,255,255,0.9))",
  },
  summaryTag: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.08)",
    color: "#475569",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  summaryLabel: {
    margin: "12px 0 6px",
    color: "#475569",
    fontSize: "13px",
  },
  summaryValue: {
    margin: 0,
    fontSize: "28px",
    color: "#0f172a",
  },
  workspaceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  workspaceActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  blockTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#0f172a",
  },
  blockSubtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    color: "#475569",
    lineHeight: 1.6,
  },
  formSectionStack: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  formGroupTitle: {
    margin: "0 0 12px",
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    color: "#64748b",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
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
  checkboxCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "50px",
    padding: "13px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "rgba(255,255,255,0.88)",
    color: "#0f172a",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "rgba(255,255,255,0.88)",
    color: "#0f172a",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  formHelperText: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  button: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "rgba(255,255,255,0.82)",
    color: "#0f172a",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  filterActionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  filterSummary: {
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  readinessStrip: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "14px 16px",
    borderRadius: "18px",
  },
  readinessOk: {
    background: "rgba(34,197,94,0.10)",
    color: "#166534",
  },
  readinessWarn: {
    background: "rgba(251,191,36,0.14)",
    color: "#92400e",
  },
  lockNotice: {
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(219, 234, 254, 0.7)",
    color: "#1d4ed8",
    border: "1px solid rgba(59, 130, 246, 0.22)",
    lineHeight: 1.6,
    fontSize: "13px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1100px",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#64748b",
    borderBottom: "1px solid rgba(148, 163, 184, 0.22)",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
    color: "#0f172a",
    verticalAlign: "top",
  },
  cellMeta: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#64748b",
  },
  progressCell: {
    minWidth: "110px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  progressMeta: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "8px",
    color: "#0f172a",
    fontSize: "13px",
  },
  progressHint: {
    color: "#64748b",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  progressTrack: {
    width: "100%",
    height: "8px",
    borderRadius: "999px",
    background: "rgba(148, 163, 184, 0.22)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #0f766e 0%, #16a34a 100%)",
  },
  statusBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  inlineActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    border: "none",
    borderRadius: "12px",
    padding: "9px 12px",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
  },
  pendingButton: {
    background: "#b45309",
  },
  completedButton: {
    background: "#15803d",
  },
  cancelledButton: {
    background: "#b91c1c",
  },
  emptyStateCard: {
    padding: "24px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
  emptyStateTitle: {
    display: "block",
    marginBottom: "6px",
    color: "#0f172a",
  },
  emptyStateText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  errorBanner: {
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(239,68,68,0.12)",
    color: "#991b1b",
    border: "1px solid rgba(239,68,68,0.18)",
  },
  successBanner: {
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(34,197,94,0.12)",
    color: "#166534",
    border: "1px solid rgba(34,197,94,0.18)",
  },
  returnBanner: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: "13px",
    fontWeight: "700",
  },
};

export default PartyOrdersPage;
