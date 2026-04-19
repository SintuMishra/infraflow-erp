import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import {
  formatDisplayDate,
  getTodayDateValue,
  parseDateOnlyValue,
} from "../utils/date";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

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

const createQuickRateState = () => ({
  plantId: "",
  materialId: "",
  ratePerTon: "",
  royaltyMode: "per_ton",
  royaltyValue: "",
  tonsPerBrass: "",
  loadingCharge: "",
  notes: "",
});

const createQuickOrderState = () => ({
  orderNumber: "",
  orderDate: getTodayDateValue(),
  plantId: "",
  materialId: "",
  orderedQuantityTons: "",
  targetDispatchDate: "",
  remarks: "",
});

function PartyCommercialProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { partyId } = useParams();
  const timelinePreferenceKey = `party-commercial-timeline:${partyId}`;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showQuickRateForm, setShowQuickRateForm] = useState(false);
  const [showQuickOrderForm, setShowQuickOrderForm] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [rateStatusUpdatingId, setRateStatusUpdatingId] = useState(null);
  const [orderStatusUpdatingId, setOrderStatusUpdatingId] = useState(null);
  const [editingRateId, setEditingRateId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [quickRateForm, setQuickRateForm] = useState(createQuickRateState);
  const [quickOrderForm, setQuickOrderForm] = useState(createQuickOrderState);
  const [party, setParty] = useState(null);
  const [plants, setPlants] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [rates, setRates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [orderAuditLogs, setOrderAuditLogs] = useState([]);
  const [showActivityTimeline, setShowActivityTimeline] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(timelinePreferenceKey) === "open";
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const [
        partiesRes,
        ratesRes,
        ordersRes,
        dispatchRes,
        plantsRes,
        mastersRes,
        auditLogsRes,
      ] = await Promise.allSettled([
        api.get("/parties"),
        api.get("/party-material-rates"),
        api.get("/party-orders"),
        api.get("/dispatch-reports"),
        api.get("/plants"),
        api.get("/masters"),
        api.get("/audit-logs", {
          params: {
            targetType: "party_order",
            limit: 200,
          },
        }),
      ]);

      if (
        partiesRes.status !== "fulfilled" ||
        ratesRes.status !== "fulfilled" ||
        ordersRes.status !== "fulfilled" ||
        dispatchRes.status !== "fulfilled" ||
        plantsRes.status !== "fulfilled" ||
        mastersRes.status !== "fulfilled"
      ) {
        throw new Error("profile-load-failed");
      }

      const allParties = partiesRes.value.data?.data || [];
      const selectedParty = allParties.find(
        (item) => String(item.id) === String(partyId)
      );

      setParty(selectedParty || null);
      setRates(
        (ratesRes.value.data?.data || []).filter(
          (item) => String(item.partyId) === String(partyId)
        )
      );
      setOrders(
        (ordersRes.value.data?.data || []).filter(
          (item) => String(item.partyId) === String(partyId)
        )
      );
      setDispatches(
        (dispatchRes.value.data?.data || []).filter(
          (item) => String(item.partyId) === String(partyId)
        )
      );
      setPlants(plantsRes.value.data?.data || []);
      setMaterials(mastersRes.value.data?.data?.materials || []);
      setOrderAuditLogs(
        auditLogsRes.status === "fulfilled" ? auditLogsRes.value.data?.data || [] : []
      );
      setError(selectedParty ? "" : "Party was not found");
    } catch {
      setError("Failed to load party commercial profile");
    } finally {
      setIsLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      timelinePreferenceKey,
      showActivityTimeline ? "open" : "closed"
    );
  }, [showActivityTimeline, timelinePreferenceKey]);

  useEffect(() => {
    const profileMessage = location.state?.profileMessage;
    if (!profileMessage) {
      return;
    }

    setSuccess(profileMessage);
    const timeoutId = window.setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [location.state]);

  const plantMap = useMemo(
    () => new Map(plants.map((item) => [String(item.id), item.plantName])),
    [plants]
  );

  const materialMap = useMemo(
    () => new Map(materials.map((item) => [String(item.id), item.materialName])),
    [materials]
  );

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) =>
          new Date(right.orderDate || right.createdAt || 0).getTime() -
          new Date(left.orderDate || left.createdAt || 0).getTime()
      ),
    [orders]
  );

  const sortedDispatches = useMemo(
    () =>
      [...dispatches].sort(
        (left, right) =>
          new Date(right.dispatchDate || right.createdAt || 0).getTime() -
          new Date(left.dispatchDate || left.createdAt || 0).getTime()
      ),
    [dispatches]
  );

  const summary = useMemo(() => {
    const openOrders = orders.filter((item) => item.status === "open");
    const activeRates = rates.filter((item) => item.isActive);
    const today = parseDateOnlyValue(getTodayDateValue());
    const overdueOrders = openOrders.filter((item) => {
      const targetDate = parseDateOnlyValue(item.targetDispatchDate);
      return (
        targetDate &&
        today &&
        targetDate < today &&
        Number(item.pendingQuantityTons || 0) > 0
      );
    });

    return {
      activeRates: activeRates.length,
      openOrders: openOrders.length,
      overdueOrders: overdueOrders.length,
      pendingQuantity: orders.reduce(
        (sum, item) => sum + Number(item.pendingQuantityTons || 0),
        0
      ),
      completedDispatch: orders.reduce(
        (sum, item) => sum + Number(item.completedQuantityTons || 0),
        0
      ),
      inTransitDispatch: orders.reduce(
        (sum, item) => sum + Number(item.inProgressQuantityTons || 0),
        0
      ),
      totalDispatches: dispatches.length,
    };
  }, [dispatches.length, orders, rates]);

  const agedOrderInsights = useMemo(() => {
    const today = parseDateOnlyValue(getTodayDateValue());

    return orders.map((item) => {
      const targetDate = parseDateOnlyValue(item.targetDispatchDate);
      const orderDate = parseDateOnlyValue(item.orderDate);
      const pendingQuantity = Number(item.pendingQuantityTons || 0);
      const isOpen = item.status === "open";
      const isOverdue =
        Boolean(targetDate && today && targetDate < today && pendingQuantity > 0 && isOpen);

      let ageDays = null;
      if (orderDate && today) {
        ageDays = Math.max(
          0,
          Math.round((today.getTime() - orderDate.getTime()) / 86400000)
        );
      }

      return {
        ...item,
        isOverdue,
        ageDays,
      };
    });
  }, [orders]);

  const sortedOrderInsights = useMemo(
    () =>
      [...agedOrderInsights].sort((left, right) => {
        if (left.isOverdue !== right.isOverdue) {
          return left.isOverdue ? -1 : 1;
        }

        return (
          new Date(right.orderDate || right.createdAt || 0).getTime() -
          new Date(left.orderDate || left.createdAt || 0).getTime()
        );
      }),
    [agedOrderInsights]
  );

  const orderActivityMap = useMemo(() => {
    const auditMap = new Map();
    const partyOrderIds = new Set(orders.map((item) => String(item.id)));

    orderAuditLogs.forEach((log) => {
      const orderId = String(log.targetId || "");
      if (!partyOrderIds.has(orderId)) {
        return;
      }

      const actorName =
        log.actorFullName || log.actorUsername || log.actorEmployeeCode || "System";

      const current = auditMap.get(orderId) || {
        createdAt: null,
        createdByName: "",
        updatedAt: null,
        updatedByName: "",
        latestStatusAt: null,
        latestStatusLabel: "",
      };

      if (log.action === "party_order.created") {
        current.createdAt = log.createdAt || current.createdAt;
        current.createdByName = actorName || current.createdByName;
      }

      if (
        log.action === "party_order.updated" ||
        log.action === "party_order.status_updated"
      ) {
        if (
          !current.updatedAt ||
          new Date(log.createdAt || 0).getTime() >=
            new Date(current.updatedAt || 0).getTime()
        ) {
          current.updatedAt = log.createdAt || current.updatedAt;
          current.updatedByName = actorName || current.updatedByName;
        }
      }

      if (log.action === "party_order.status_updated") {
        if (
          !current.latestStatusAt ||
          new Date(log.createdAt || 0).getTime() >=
            new Date(current.latestStatusAt || 0).getTime()
        ) {
          current.latestStatusAt = log.createdAt || current.latestStatusAt;
          current.latestStatusLabel =
            log.details?.status || current.latestStatusLabel || "";
        }
      }

      auditMap.set(orderId, current);
    });

    const dispatchMap = new Map();
    dispatches.forEach((dispatch) => {
      if (!dispatch.partyOrderId) {
        return;
      }

      const key = String(dispatch.partyOrderId);
      const current = dispatchMap.get(key);
      const currentTime = new Date(current?.dispatchDate || 0).getTime();
      const nextTime = new Date(dispatch.dispatchDate || dispatch.createdAt || 0).getTime();

      if (!current || nextTime >= currentTime) {
        dispatchMap.set(key, dispatch);
      }
    });

    return orders.reduce((acc, order) => {
      const key = String(order.id);
      const audit = auditMap.get(key) || {};
      const latestDispatch = dispatchMap.get(key) || null;

      acc[key] = {
        createdAt: audit.createdAt || order.createdAt || null,
        createdByName: audit.createdByName || "",
        updatedAt: audit.updatedAt || order.updatedAt || null,
        updatedByName: audit.updatedByName || "",
        latestStatusAt: audit.latestStatusAt || null,
        latestStatusLabel: audit.latestStatusLabel || "",
        latestDispatchDate: latestDispatch?.dispatchDate || latestDispatch?.createdAt || null,
      };

      return acc;
    }, {});
  }, [dispatches, orderAuditLogs, orders]);

  const readinessChecks = useMemo(
    () => [
      {
        label: "Party is active",
        ready: Boolean(party?.isActive),
      },
      {
        label: "Tax identity captured",
        ready: Boolean(String(party?.gstin || "").trim()),
      },
      {
        label: "At least one active material rate",
        ready: rates.some((item) => item.isActive),
      },
      {
        label: "Open order available for dispatch linkage",
        ready: orders.some(
          (item) =>
            item.status === "open" && Number(item.pendingQuantityTons || 0) > 0
        ),
      },
    ],
    [orders, party, rates]
  );

  const latestOpenOrder = useMemo(
    () =>
      sortedOrders.find(
        (item) =>
          item.status === "open" && Number(item.pendingQuantityTons || 0) > 0
      ) || null,
    [sortedOrders]
  );

  const editingOrder = useMemo(
    () => orders.find((item) => String(item.id) === String(editingOrderId)) || null,
    [editingOrderId, orders]
  );

  const editingOrderHasLinkedDispatches = hasLinkedDispatches(editingOrder);

  const activityTimeline = useMemo(() => {
    const rateEvents = rates.map((item) => ({
      id: `rate-${item.id}`,
      dateValue: item.updatedAt || item.createdAt || null,
      displayDate: formatDisplayDate(item.updatedAt || item.createdAt),
      title: `${item.isActive ? "Rate active" : "Rate inactive"} • ${
        item.materialName || materialMap.get(String(item.materialId)) || "Material"
      }`,
      detail: `${
        item.plantName || plantMap.get(String(item.plantId)) || "Plant"
      } • ${formatCurrency(item.ratePerTon)} / ton`,
      tone: item.isActive ? "ok" : "muted",
      category: "Rate",
    }));

    const orderEvents = orders.map((item) => ({
      id: `order-${item.id}`,
      dateValue: item.orderDate || item.updatedAt || item.createdAt || null,
      displayDate: formatDisplayDate(item.orderDate || item.updatedAt || item.createdAt),
      title: `${item.orderNumber} • ${item.status}`,
      detail: `${
        item.materialName || materialMap.get(String(item.materialId)) || "Material"
      } • Pending ${formatMetric(item.pendingQuantityTons)} tons`,
      tone:
        item.status === "completed"
          ? "ok"
          : item.status === "cancelled"
            ? "danger"
            : "accent",
      category: "Order",
    }));

    const dispatchEvents = dispatches.map((item) => ({
      id: `dispatch-${item.id}`,
      dateValue: item.dispatchDate || item.createdAt || null,
      displayDate: formatDisplayDate(item.dispatchDate || item.createdAt),
      title: `Dispatch ${formatMetric(item.quantityTons)} tons • ${item.status || "-"}`,
      detail: `${
        item.materialName || item.materialType || "Material"
      } • ${item.destinationName || "Destination"}${
        item.partyOrderNumber ? ` • ${item.partyOrderNumber}` : ""
      }`,
      tone:
        item.status === "completed"
          ? "ok"
          : item.status === "cancelled"
            ? "danger"
            : "accent",
      category: "Dispatch",
    }));

    return [...dispatchEvents, ...orderEvents, ...rateEvents]
      .sort((left, right) => {
        const leftTime = left.dateValue ? new Date(left.dateValue).getTime() : 0;
        const rightTime = right.dateValue ? new Date(right.dateValue).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 18);
  }, [dispatches, materialMap, orders, plantMap, rates]);

  const handleCreateRate = () => {
    setShowQuickRateForm(true);
    setShowQuickOrderForm(false);
    setEditingRateId(null);
    setQuickRateForm(createQuickRateState());
    setSuccess("");
    setError("");
  };

  const handleCreateOrder = () => {
    setShowQuickOrderForm(true);
    setShowQuickRateForm(false);
    setEditingOrderId(null);
    setQuickOrderForm(createQuickOrderState());
    setSuccess("");
    setError("");
  };

  const handleEditRate = (rate) => {
    setShowQuickRateForm(true);
    setShowQuickOrderForm(false);
    setEditingRateId(rate.id);
    setQuickRateForm({
      plantId: rate.plantId ? String(rate.plantId) : "",
      materialId: rate.materialId ? String(rate.materialId) : "",
      ratePerTon:
        rate.ratePerTon !== null && rate.ratePerTon !== undefined
          ? String(rate.ratePerTon)
          : "",
      royaltyMode: rate.royaltyMode || "per_ton",
      royaltyValue:
        rate.royaltyValue !== null && rate.royaltyValue !== undefined
          ? String(rate.royaltyValue)
          : "",
      tonsPerBrass:
        rate.tonsPerBrass !== null && rate.tonsPerBrass !== undefined
          ? String(rate.tonsPerBrass)
          : "",
      loadingCharge:
        rate.loadingCharge !== null && rate.loadingCharge !== undefined
          ? String(rate.loadingCharge)
          : "",
      notes: rate.notes || "",
    });
    setSuccess("");
    setError("");
  };

  const handleEditOrder = (order) => {
    setShowQuickOrderForm(true);
    setShowQuickRateForm(false);
    setEditingOrderId(order.id);
    setQuickOrderForm({
      orderNumber: order.orderNumber || "",
      orderDate: order.orderDate || getTodayDateValue(),
      plantId: order.plantId ? String(order.plantId) : "",
      materialId: order.materialId ? String(order.materialId) : "",
      orderedQuantityTons:
        order.orderedQuantityTons !== null && order.orderedQuantityTons !== undefined
          ? String(order.orderedQuantityTons)
          : "",
      targetDispatchDate: order.targetDispatchDate || "",
      remarks: order.remarks || "",
    });
    setSuccess("");
    setError("");
  };

  const handleDispatch = useCallback(() => {
    const prefillDispatch = latestOpenOrder
      ? {
          sourceType: "Plant",
          plantId: latestOpenOrder.plantId
            ? String(latestOpenOrder.plantId)
            : "",
          materialId: latestOpenOrder.materialId
            ? String(latestOpenOrder.materialId)
            : "",
          partyId: String(partyId),
          partyOrderId: latestOpenOrder.id ? String(latestOpenOrder.id) : "",
          remarks: latestOpenOrder.remarks || "",
        }
      : {
          partyId: String(partyId),
        };

    navigate("/dispatch-reports", {
      state: {
        prefillDispatch,
      },
    });
  }, [latestOpenOrder, navigate, partyId]);

  const handleDispatchAgainstOrder = (order) => {
    navigate("/dispatch-reports", {
      state: {
        prefillDispatch: {
          sourceType: "Plant",
          plantId: order.plantId ? String(order.plantId) : "",
          materialId: order.materialId ? String(order.materialId) : "",
          partyId: String(partyId),
          partyOrderId: order.id ? String(order.id) : "",
          remarks: order.remarks || "",
        },
      },
    });
  };

  const handleToggleRateStatus = async (rate) => {
    setError("");
    setSuccess("");

    const confirmed = window.confirm(
      rate.isActive
        ? `Deactivate the rate for ${rate.materialName || "this material"} at ${rate.plantName || "this plant"}? Dispatch billing will stop using it until reactivated.`
        : `Activate the rate for ${rate.materialName || "this material"} at ${rate.plantName || "this plant"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRateStatusUpdatingId(rate.id);
      await api.patch(`/party-material-rates/${rate.id}/status`, {
        isActive: !rate.isActive,
      });
      setSuccess(
        rate.isActive
          ? "Party material rate deactivated successfully"
          : "Party material rate activated successfully"
      );
      await loadProfile();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update party material rate status"
      );
    } finally {
      setRateStatusUpdatingId(null);
    }
  };

  const handleOrderStatusChange = async (order, status) => {
    setError("");
    setSuccess("");

    const confirmations = {
      completed: `Mark order ${order.orderNumber} as completed? Use this only when no further dispatch should be linked.`,
      cancelled: `Cancel order ${order.orderNumber}? This removes it from active fulfillment and should only be used for genuine cancellation.`,
    };

    if (confirmations[status] && !window.confirm(confirmations[status])) {
      return;
    }

    try {
      setOrderStatusUpdatingId(order.id);
      await api.patch(`/party-orders/${order.id}/status`, { status });
      setSuccess(`Order status changed to ${status}`);
      await loadProfile();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update party order status"
      );
    } finally {
      setOrderStatusUpdatingId(null);
    }
  };

  const setupGuide = useMemo(() => {
    const hasActiveRate = rates.some((item) => item.isActive);
    const hasOpenOrder = orders.some(
      (item) => item.status === "open" && Number(item.pendingQuantityTons || 0) > 0
    );

    return [
      {
        label: "Confirm billing identity and tax data",
        description:
          "GSTIN and address should be ready before rate setup and invoice generation.",
        complete: Boolean(String(party?.gstin || "").trim()),
        actionLabel: "Edit Party",
        action: () => navigate("/parties"),
      },
      {
        label: "Create at least one active material rate",
        description:
          "Dispatch billing depends on a valid party-material rate for the plant and material.",
        complete: hasActiveRate,
        actionLabel: "Add Rate",
        action: handleCreateRate,
      },
      {
        label: "Create an open order with pending quantity",
        description:
          "Open orders keep fulfillment and pending dispatch quantity visible during operations.",
        complete: hasOpenOrder,
        actionLabel: "Add Order",
        action: handleCreateOrder,
      },
      {
        label: "Dispatch against the linked order",
        description:
          "Once rate and order exist, dispatch can be linked directly and pending quantity updates automatically.",
        complete: summary.totalDispatches > 0,
        actionLabel: "Dispatch",
        action: handleDispatch,
      },
    ];
  }, [handleDispatch, navigate, orders, party?.gstin, rates, summary.totalDispatches]);

  const nextSetupStep = useMemo(
    () => setupGuide.find((item) => !item.complete) || null,
    [setupGuide]
  );

  const commercialGuidance = useMemo(() => {
    let title = "Party is commercially ready for daily operations";
    let text =
      "Rates, orders, and dispatch linkage can now be managed from one workspace without bouncing between modules.";
    let tone = "calm";

    if (summary.overdueOrders > 0) {
      title = "Open orders are already beyond target date";
      text = `${formatMetric(
        summary.overdueOrders
      )} open order(s) are overdue and still carry pending quantity for this party.`;
      tone = "attention";
    } else if (nextSetupStep) {
      title = "One setup step still blocks a cleaner workflow";
      text = `Recommended next move: ${nextSetupStep.label}. Completing it will reduce manual intervention during dispatch and billing.`;
      tone = "strong";
    }

    return { title, text, tone };
  }, [nextSetupStep, summary.overdueOrders]);

  const commercialFocusTiles = useMemo(
    () => [
      {
        label: "Next Best Step",
        value: nextSetupStep ? nextSetupStep.label : "Ready",
        note: nextSetupStep
          ? nextSetupStep.description
          : "This party can move directly through rate, order, and dispatch workflow",
        tone: nextSetupStep ? "strong" : "calm",
      },
      {
        label: "Open Orders",
        value: formatMetric(summary.openOrders),
        note: "Commercial demand currently waiting on fulfillment",
        tone: summary.openOrders > 0 ? "strong" : "calm",
      },
      {
        label: "Pending Balance",
        value: formatMetric(summary.pendingQuantity),
        note: "Tons still left to dispatch against active orders",
        tone: summary.pendingQuantity > 0 ? "attention" : "calm",
      },
      {
        label: "Active Rates",
        value: formatMetric(summary.activeRates),
        note: "Material pricing rules available for this party",
        tone: summary.activeRates > 0 ? "strong" : "attention",
      },
    ],
    [nextSetupStep, summary.activeRates, summary.openOrders, summary.pendingQuantity]
  );

  const handleQuickRateChange = (e) => {
    const { name, value } = e.target;
    setQuickRateForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuickOrderChange = (e) => {
    const { name, value } = e.target;
    setQuickOrderForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuickRateSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!quickRateForm.plantId || !quickRateForm.materialId || !quickRateForm.ratePerTon) {
      setError("Plant, material, and rate per ton are required for quick rate setup");
      return;
    }

    if (Number(quickRateForm.ratePerTon) <= 0) {
      setError("Rate per ton must be greater than 0");
      return;
    }

    if (
      quickRateForm.royaltyMode === "per_brass" &&
      (quickRateForm.tonsPerBrass === "" || Number(quickRateForm.tonsPerBrass) <= 0)
    ) {
      setError("Tons per brass must be greater than 0 for royalty per brass");
      return;
    }

    try {
      setIsSavingRate(true);
      const payload = {
        plantId: Number(quickRateForm.plantId),
        partyId: Number(partyId),
        materialId: Number(quickRateForm.materialId),
        ratePerTon: Number(quickRateForm.ratePerTon),
        royaltyMode: quickRateForm.royaltyMode,
        royaltyValue:
          quickRateForm.royaltyMode === "none"
            ? 0
            : quickRateForm.royaltyValue === ""
              ? 0
              : Number(quickRateForm.royaltyValue),
        tonsPerBrass:
          quickRateForm.royaltyMode === "per_brass"
            ? quickRateForm.tonsPerBrass === ""
              ? null
              : Number(quickRateForm.tonsPerBrass)
            : null,
        loadingCharge:
          quickRateForm.loadingCharge === ""
            ? 0
            : Number(quickRateForm.loadingCharge),
        notes: quickRateForm.notes || "",
      };

      if (editingRateId) {
        await api.patch(`/party-material-rates/${editingRateId}`, payload);
      } else {
        await api.post("/party-material-rates", payload);
      }
      setQuickRateForm(createQuickRateState());
      setShowQuickRateForm(false);
      setEditingRateId(null);
      setSuccess(
        editingRateId
          ? "Party material rate updated successfully"
          : "Party material rate added successfully"
      );
      await loadProfile();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add party material rate");
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleQuickOrderSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !quickOrderForm.orderDate ||
      !quickOrderForm.plantId ||
      !quickOrderForm.materialId ||
      quickOrderForm.orderedQuantityTons === ""
    ) {
      setError("Order date, plant, material, and quantity are required for quick order setup");
      return;
    }

    if (Number(quickOrderForm.orderedQuantityTons) <= 0) {
      setError("Ordered quantity must be greater than 0");
      return;
    }

    try {
      setIsSavingOrder(true);
      const payload = {
        orderNumber: String(quickOrderForm.orderNumber || "").trim(),
        orderDate: quickOrderForm.orderDate,
        partyId: Number(partyId),
        plantId: Number(quickOrderForm.plantId),
        materialId: Number(quickOrderForm.materialId),
        orderedQuantityTons: Number(quickOrderForm.orderedQuantityTons),
        targetDispatchDate: quickOrderForm.targetDispatchDate || null,
        remarks: quickOrderForm.remarks || "",
      };

      if (editingOrderId) {
        await api.patch(`/party-orders/${editingOrderId}`, payload);
      } else {
        await api.post("/party-orders", payload);
      }
      setQuickOrderForm(createQuickOrderState());
      setShowQuickOrderForm(false);
      setEditingOrderId(null);
      setSuccess(
        editingOrderId
          ? "Party order updated successfully"
          : "Party order created successfully"
      );
      await loadProfile();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create party order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const renderReadinessBadge = (ready) => (
    <span
      style={{
        ...styles.readinessBadge,
        ...(ready ? styles.readinessOk : styles.readinessWarn),
      }}
    >
      {ready ? "Ready" : "Needs setup"}
    </span>
  );

  return (
    <AppShell
      title="Party Commercial Profile"
      subtitle="Operate one party from a single commercial workspace instead of spreading entry across disconnected pages."
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div>
            <p style={styles.heroEyebrow}>Commercial Workspace</p>
            <h1 style={styles.heroTitle}>{party?.partyName || "Party Profile"}</h1>
            <p style={styles.heroText}>
              Review billing identity, material rates, live order book position,
              and recent dispatch movement for this party in one place.
            </p>
          </div>

          <div style={styles.heroMeta}>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Party Code</span>
              <strong style={styles.heroMetaValue}>{party?.partyCode || "-"}</strong>
            </div>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Contact</span>
              <strong style={styles.heroMetaValue}>
                {party?.contactPerson || party?.mobileNumber || "-"}
              </strong>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.guidancePanel,
            ...(commercialGuidance.tone === "attention"
              ? styles.guidancePanelAttention
              : commercialGuidance.tone === "strong"
                ? styles.guidancePanelStrong
                : styles.guidancePanelCalm),
          }}
        >
          <div style={styles.guidanceCopy}>
            <p style={styles.guidanceEyebrow}>Commercial Guidance</p>
            <h2 style={styles.guidanceTitle}>{commercialGuidance.title}</h2>
            <p style={styles.guidanceText}>{commercialGuidance.text}</p>
          </div>

          <div style={styles.guidanceActions}>
            {nextSetupStep ? (
              <button type="button" style={styles.button} onClick={nextSetupStep.action}>
                {nextSetupStep.actionLabel}
              </button>
            ) : (
              <button type="button" style={styles.button} onClick={handleDispatch}>
                Create Dispatch
              </button>
            )}
            <button type="button" style={styles.secondaryButton} onClick={handleCreateRate}>
              Add Rate
            </button>
            <button type="button" style={styles.secondaryButton} onClick={handleCreateOrder}>
              Add Order
            </button>
          </div>
        </div>

        <div style={styles.focusTileGrid}>
          {commercialFocusTiles.map((tile) => (
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

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        {isLoading && (
          <div style={styles.infoBanner}>
            Loading party rates, orders, and dispatch history...
          </div>
        )}

        <SectionCard title="Commercial Snapshot">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Rates</span>
              <p style={styles.summaryLabel}>Active Material Rates</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.activeRates)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Orders</span>
              <p style={styles.summaryLabel}>Open Orders</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.openOrders)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
              <span style={styles.summaryTag}>Pending</span>
              <p style={styles.summaryLabel}>Balance Pending Tons</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.pendingQuantity)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Completed</span>
              <p style={styles.summaryLabel}>Completed Dispatch Tons</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.completedDispatch)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Overdue</span>
              <p style={styles.summaryLabel}>Open Orders Past Target Date</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.overdueOrders)}
              </h3>
            </div>
          </div>
        </SectionCard>

        {summary.overdueOrders > 0 && (
          <div style={styles.attentionBanner}>
            <strong>{summary.overdueOrders} order(s) need attention</strong>
            <span>
              Some open orders are past their target dispatch date and still carry pending quantity.
            </span>
          </div>
        )}

        <SectionCard title="Quick Setup Guide">
          <div style={styles.setupGuidePanel}>
            <div style={styles.setupGuideHeader}>
              <div>
                <span style={styles.setupGuideLabel}>Recommended Flow</span>
                <strong style={styles.setupGuideTitle}>
                  {nextSetupStep
                    ? `Next best step: ${nextSetupStep.label}`
                    : "This party is commercially ready for daily use"}
                </strong>
                <p style={styles.setupGuideText}>
                  Follow this sequence to make the party operational without missing rates, orders, or dispatch linkage.
                </p>
              </div>

              {nextSetupStep ? (
                <button
                  type="button"
                  style={styles.button}
                  onClick={nextSetupStep.action}
                >
                  {nextSetupStep.actionLabel}
                </button>
              ) : (
                <div style={styles.setupReadyPill}>Ready for dispatch workflow</div>
              )}
            </div>

            <div style={styles.setupChecklist}>
              {setupGuide.map((item, index) => (
                <div key={item.label} style={styles.setupStepCard}>
                  <div style={styles.setupStepMeta}>
                    <span
                      style={{
                        ...styles.setupStepIndex,
                        ...(item.complete
                          ? styles.setupStepIndexComplete
                          : styles.setupStepIndexPending),
                      }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <strong style={styles.setupStepTitle}>{item.label}</strong>
                      <p style={styles.setupStepText}>{item.description}</p>
                    </div>
                  </div>

                  <div style={styles.setupStepActions}>
                    <span
                      style={{
                        ...styles.readinessBadge,
                        ...(item.complete ? styles.readinessOk : styles.readinessWarn),
                      }}
                    >
                      {item.complete ? "Done" : "Pending"}
                    </span>
                    {!item.complete ? (
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={item.action}
                      >
                        {item.actionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {(showQuickRateForm || showQuickOrderForm) && (
              <div style={styles.inlineSetupPanel}>
                <div style={styles.inlineSetupHeader}>
                  <div>
                    <span style={styles.setupGuideLabel}>Inline Setup</span>
                    <strong style={styles.setupGuideTitle}>
                      {showQuickRateForm
                        ? editingRateId
                          ? "Edit party material rate"
                          : "Create party material rate"
                        : editingOrderId
                          ? "Edit party order"
                          : "Create party order"}
                    </strong>
                    <p style={styles.setupGuideText}>
                      Finish the missing setup here without leaving this commercial page.
                    </p>
                  </div>

                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => {
                      setShowQuickRateForm(false);
                      setShowQuickOrderForm(false);
                      setEditingRateId(null);
                      setEditingOrderId(null);
                      setQuickRateForm(createQuickRateState());
                      setQuickOrderForm(createQuickOrderState());
                    }}
                  >
                    Close
                  </button>
                </div>

                {showQuickRateForm && (
                  <form onSubmit={handleQuickRateSubmit} style={styles.inlineFormGrid}>
                    <select
                      name="plantId"
                      value={quickRateForm.plantId}
                      onChange={handleQuickRateChange}
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
                      value={quickRateForm.materialId}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                    >
                      <option value="">Select Material</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.materialName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      name="ratePerTon"
                      placeholder="Rate Per Ton"
                      value={quickRateForm.ratePerTon}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                    />
                    <select
                      name="royaltyMode"
                      value={quickRateForm.royaltyMode}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                    >
                      <option value="per_ton">Royalty Per Ton</option>
                      <option value="per_brass">Royalty Per Brass</option>
                      <option value="fixed">Fixed Royalty</option>
                      <option value="none">No Royalty</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      name="royaltyValue"
                      placeholder="Royalty Value"
                      value={quickRateForm.royaltyValue}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                      disabled={quickRateForm.royaltyMode === "none"}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      name="tonsPerBrass"
                      placeholder={
                        quickRateForm.royaltyMode === "per_brass"
                          ? "Tons Per Brass"
                          : "Tons/Brass not required"
                      }
                      value={quickRateForm.tonsPerBrass}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                      disabled={quickRateForm.royaltyMode !== "per_brass"}
                    />
                    <input
                      type="number"
                      step="0.01"
                      name="loadingCharge"
                      placeholder="Loading Charge"
                      value={quickRateForm.loadingCharge}
                      onChange={handleQuickRateChange}
                      style={styles.input}
                    />
                    <input
                      name="notes"
                      placeholder="Commercial Notes"
                      value={quickRateForm.notes}
                      onChange={handleQuickRateChange}
                      style={{ ...styles.input, gridColumn: "1 / -1" }}
                    />
                    <button type="submit" style={styles.button} disabled={isSavingRate}>
                      {isSavingRate
                        ? "Saving Rate..."
                        : editingRateId
                          ? "Update Rate"
                          : "Save Rate"}
                    </button>
                  </form>
                )}

                {showQuickOrderForm && (
                  <form onSubmit={handleQuickOrderSubmit} style={styles.inlineFormGrid}>
                    {editingOrderHasLinkedDispatches && (
                      <div style={styles.inlineLockNotice}>
                        Core commercial fields are locked because dispatch has already
                        been linked to this order. You can still increase quantity,
                        update the target date, and revise remarks.
                      </div>
                    )}
                    <input
                      name="orderNumber"
                      placeholder="Leave blank to auto-generate"
                      value={quickOrderForm.orderNumber}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                    />
                    <input
                      type="date"
                      name="orderDate"
                      value={quickOrderForm.orderDate}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                    />
                    <select
                      name="plantId"
                      value={quickOrderForm.plantId}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                      disabled={editingOrderHasLinkedDispatches}
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
                      value={quickOrderForm.materialId}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                      disabled={editingOrderHasLinkedDispatches}
                    >
                      <option value="">Select Material</option>
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
                      value={quickOrderForm.orderedQuantityTons}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                    />
                    <input
                      type="date"
                      name="targetDispatchDate"
                      value={quickOrderForm.targetDispatchDate}
                      onChange={handleQuickOrderChange}
                      style={styles.input}
                    />
                    <input
                      name="remarks"
                      placeholder="Order Remarks"
                      value={quickOrderForm.remarks}
                      onChange={handleQuickOrderChange}
                      style={{ ...styles.input, gridColumn: "1 / -1" }}
                    />
                    <button type="submit" style={styles.button} disabled={isSavingOrder}>
                      {isSavingOrder
                        ? "Saving Order..."
                        : editingOrderId
                          ? "Update Order"
                          : "Save Order"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Operator Actions">
          <div style={styles.actionPanel}>
            <div style={styles.actionCopy}>
              <span style={styles.actionLabel}>Suggested Next Step</span>
              <strong style={styles.actionValue}>
                {latestOpenOrder
                  ? `Dispatch against ${latestOpenOrder.orderNumber}`
                  : "Set a rate or create an order before dispatch"}
              </strong>
              <span style={styles.actionHint}>
                This workspace is designed to reduce re-entry and make missed commercial setup less likely.
              </span>
            </div>

            <div style={styles.actionButtons}>
              <button
                type="button"
                style={{ ...styles.secondaryButton, ...styles.rateButton }}
                onClick={handleCreateRate}
              >
                Add Rate
              </button>
              <button
                type="button"
                style={{ ...styles.secondaryButton, ...styles.orderButton }}
                onClick={handleCreateOrder}
              >
                Add Order
              </button>
              <button type="button" style={styles.button} onClick={handleDispatch}>
                Dispatch
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Activity Timeline">
          <div style={styles.timelineShell}>
            <div style={styles.timelineHeader}>
              <div>
                <span style={styles.timelineLabel}>Optional Audit View</span>
                <strong style={styles.timelineTitle}>
                  Recent commercial activity for this party
                </strong>
                <p style={styles.timelineText}>
                  Keep this collapsed for a cleaner workspace, and expand it only when you need quick traceability across rates, orders, and dispatches.
                </p>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowActivityTimeline((prev) => !prev)}
              >
                {showActivityTimeline ? "Hide Timeline" : "Show Timeline"}
              </button>
            </div>

            {showActivityTimeline && (
              activityTimeline.length === 0 ? (
                <div style={styles.emptyState}>
                  No commercial activity is available for this party yet.
                </div>
              ) : (
                <div style={styles.timelineList}>
                  {activityTimeline.map((event) => (
                    <div key={event.id} style={styles.timelineItem}>
                      <div
                        style={{
                          ...styles.timelineDot,
                          ...(event.tone === "ok"
                            ? styles.timelineDotOk
                            : event.tone === "danger"
                              ? styles.timelineDotDanger
                              : event.tone === "accent"
                                ? styles.timelineDotAccent
                                : styles.timelineDotMuted),
                        }}
                      />
                      <div style={styles.timelineBody}>
                        <div style={styles.timelineMetaRow}>
                          <span style={styles.timelineCategory}>{event.category}</span>
                          <span style={styles.timelineDate}>{event.displayDate}</span>
                        </div>
                        <strong style={styles.timelineItemTitle}>{event.title}</strong>
                        <p style={styles.timelineItemText}>{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </SectionCard>

        <SectionCard title="Readiness">
          <div style={styles.readinessGrid}>
            {readinessChecks.map((item) => (
              <div key={item.label} style={styles.readinessCard}>
                <div>
                  <strong style={styles.readinessTitle}>{item.label}</strong>
                </div>
                {renderReadinessBadge(item.ready)}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Party Identity">
          <div style={styles.identityGrid}>
            <div style={styles.identityCard}>
              <span style={styles.identityLabel}>GSTIN</span>
              <strong style={styles.identityValue}>{party?.gstin || "-"}</strong>
            </div>
            <div style={styles.identityCard}>
              <span style={styles.identityLabel}>PAN</span>
              <strong style={styles.identityValue}>{party?.pan || "-"}</strong>
            </div>
            <div style={styles.identityCard}>
              <span style={styles.identityLabel}>Address</span>
              <strong style={styles.identityValue}>
                {[
                  party?.addressLine1,
                  party?.addressLine2,
                  party?.city,
                  party?.stateName,
                  party?.pincode,
                ]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Material Rates">
          {rates.length === 0 ? (
            <div style={styles.emptyState}>
              No material rates found for this party yet.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Plant</th>
                    <th style={styles.th}>Material</th>
                    <th style={styles.th}>Rate / Ton</th>
                    <th style={styles.th}>Royalty</th>
                    <th style={styles.th}>Loading</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>
                        {item.plantName || plantMap.get(String(item.plantId)) || "-"}
                      </td>
                      <td style={styles.td}>
                        {item.materialName ||
                          materialMap.get(String(item.materialId)) ||
                          "-"}
                      </td>
                      <td style={styles.td}>{formatCurrency(item.ratePerTon)}</td>
                      <td style={styles.td}>
                        {item.royaltyMode === "none"
                          ? "None"
                          : item.royaltyMode === "per_brass"
                            ? `per_brass (${formatMetric(item.royaltyValue)}, ${
                                item.tonsPerBrass === null ||
                                item.tonsPerBrass === undefined ||
                                item.tonsPerBrass === ""
                                  ? "-"
                                  : formatMetric(item.tonsPerBrass)
                              } ton/brass)`
                            : `${item.royaltyMode} (${formatMetric(item.royaltyValue)})`}
                      </td>
                      <td style={styles.td}>{formatCurrency(item.loadingCharge)}</td>
                      <td style={styles.td}>{item.isActive ? "Active" : "Inactive"}</td>
                      <td style={styles.td}>
                        <div style={styles.inlineTableActions}>
                          <button
                            type="button"
                            style={styles.smallActionButton}
                            onClick={() => handleEditRate(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.smallActionButton,
                              ...(item.isActive
                                ? styles.warnActionButton
                                : styles.successActionButton),
                            }}
                            onClick={() => handleToggleRateStatus(item)}
                            disabled={rateStatusUpdatingId === item.id}
                          >
                            {rateStatusUpdatingId === item.id
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
          )}
        </SectionCard>

        <SectionCard title="Orders">
          {sortedOrderInsights.length === 0 ? (
            <div style={styles.emptyState}>No orders have been created for this party yet.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Order</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Plant</th>
                    <th style={styles.th}>Material</th>
                    <th style={styles.th}>Order Qty</th>
                    <th style={styles.th}>Age</th>
                    <th style={styles.th}>Target Date</th>
                    <th style={styles.th}>Completed</th>
                    <th style={styles.th}>In Transit</th>
                    <th style={styles.th}>Pending</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrderInsights.map((item) => (
                    <tr
                      key={item.id}
                      style={item.isOverdue ? styles.overdueRow : undefined}
                    >
                      <td style={styles.td}>
                        <strong>{item.orderNumber}</strong>
                        <div style={styles.subtleText}>{item.remarks || "No remarks"}</div>
                      </td>
                      <td style={styles.td}>{formatDisplayDate(item.orderDate)}</td>
                      <td style={styles.td}>
                        {item.plantName || plantMap.get(String(item.plantId)) || "-"}
                      </td>
                      <td style={styles.td}>
                        {item.materialName ||
                          materialMap.get(String(item.materialId)) ||
                          "-"}
                      </td>
                      <td style={styles.td}>
                        {formatMetric(item.orderedQuantityTons)}
                      </td>
                      <td style={styles.td}>
                        {item.ageDays !== null ? `${item.ageDays} days` : "-"}
                      </td>
                      <td style={styles.td}>
                        <div>
                          <strong>{formatDisplayDate(item.targetDispatchDate)}</strong>
                          {item.isOverdue ? (
                            <div style={styles.overdueHint}>Past target date</div>
                          ) : null}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {formatMetric(item.completedQuantityTons)}
                      </td>
                      <td style={styles.td}>
                        {formatMetric(item.inProgressQuantityTons)}
                      </td>
                      <td style={styles.td}>
                        {formatMetric(item.pendingQuantityTons)}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(getFulfillmentState(item).tone === "completed"
                              ? styles.statusCompleted
                              : getFulfillmentState(item).tone === "cancelled"
                                ? styles.statusCancelled
                                : getFulfillmentState(item).tone === "partial"
                                  ? styles.statusPartial
                                  : styles.statusOpen),
                          }}
                        >
                          {getFulfillmentState(item).label}
                        </span>
                        {(() => {
                          const activity = orderActivityMap[String(item.id)] || {};

                          return (
                            <div style={styles.orderActivityMeta}>
                              <div>
                                Created:{" "}
                                <strong>
                                  {activity.createdByName
                                    ? `${activity.createdByName} • `
                                    : ""}
                                  {formatDisplayDate(activity.createdAt)}
                                </strong>
                              </div>
                              <div>
                                Updated:{" "}
                                <strong>
                                  {activity.updatedByName
                                    ? `${activity.updatedByName} • `
                                    : ""}
                                  {formatDisplayDate(activity.updatedAt)}
                                </strong>
                              </div>
                              <div>
                                Last status change:{" "}
                                <strong>
                                  {activity.latestStatusLabel
                                    ? `${activity.latestStatusLabel} • `
                                    : ""}
                                  {formatDisplayDate(activity.latestStatusAt)}
                                </strong>
                              </div>
                              <div>
                                Last linked dispatch:{" "}
                                <strong>{formatDisplayDate(activity.latestDispatchDate)}</strong>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.inlineTableActions}>
                          {item.status === "open" &&
                          Number(item.pendingQuantityTons || 0) > 0 ? (
                            <button
                              type="button"
                              style={styles.smallActionButton}
                              onClick={() => handleDispatchAgainstOrder(item)}
                            >
                              Dispatch
                            </button>
                          ) : null}
                          <button
                            type="button"
                            style={styles.smallActionButton}
                            onClick={() => handleEditOrder(item)}
                          >
                            Edit
                          </button>
                          {item.status !== "completed" ? (
                            <button
                              type="button"
                              style={{ ...styles.smallActionButton, ...styles.successActionButton }}
                              onClick={() => handleOrderStatusChange(item, "completed")}
                              disabled={orderStatusUpdatingId === item.id}
                            >
                              {orderStatusUpdatingId === item.id
                                ? "Updating..."
                                : "Complete"}
                            </button>
                          ) : null}
                          {item.status !== "cancelled" ? (
                            <button
                              type="button"
                              style={{ ...styles.smallActionButton, ...styles.warnActionButton }}
                              onClick={() => handleOrderStatusChange(item, "cancelled")}
                              disabled={
                                orderStatusUpdatingId === item.id ||
                                !canManageLinkedOrderStatus(item, currentUser?.role)
                              }
                              title={getLinkedOrderStatusRestriction(item, "cancelled")}
                            >
                              {orderStatusUpdatingId === item.id
                                ? "Updating..."
                                : "Cancel"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Dispatches">
          {sortedDispatches.length === 0 ? (
            <div style={styles.emptyState}>
              No dispatch reports are linked to this party yet.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Material</th>
                    <th style={styles.th}>Destination</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Linked Order</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDispatches.slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{formatDisplayDate(item.dispatchDate)}</td>
                      <td style={styles.td}>
                        {item.materialName || item.materialType || "-"}
                      </td>
                      <td style={styles.td}>{item.destinationName || "-"}</td>
                      <td style={styles.td}>{formatMetric(item.quantityTons)}</td>
                      <td style={styles.td}>
                        {item.partyOrderNumber || item.orderNumber || item.partyOrderId || "-"}
                      </td>
                      <td style={styles.td}>{item.status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "18px",
    padding: "28px",
    borderRadius: "28px",
    background:
      "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(249,115,22,0.18), transparent 26%), linear-gradient(135deg, #0f172a 0%, #1f2937 100%)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  heroEyebrow: {
    margin: 0,
    marginBottom: "10px",
    color: "rgba(255,255,255,0.68)",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.08,
    fontWeight: "800",
  },
  heroText: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  heroMeta: {
    display: "grid",
    gap: "12px",
  },
  heroMetaCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  heroMetaLabel: {
    display: "block",
    color: "rgba(255,255,255,0.66)",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "6px",
  },
  heroMetaValue: {
    fontSize: "15px",
  },
  guidancePanel: {
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
  guidancePanelCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  guidancePanelStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(255,255,255,0.96) 100%)",
  },
  guidancePanelAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(254,242,242,0.96) 100%)",
  },
  guidanceCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxWidth: "760px",
  },
  guidanceEyebrow: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  guidanceTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.12,
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },
  guidanceText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.7,
  },
  guidanceActions: {
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
  infoBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
  },
  errorBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    border: "1px solid #fecaca",
    color: "#b91c1c",
  },
  successBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    border: "1px solid #a7f3d0",
    color: "#047857",
  },
  attentionBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
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
  summaryAmber: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
  },
  summaryPurple: {
    background: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)",
  },
  summaryGreen: {
    background: "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)",
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
  actionPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #ffffff 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
  },
  timelineShell: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #f8fafc 0%, #fffdf8 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
  timelineLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  timelineTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  timelineText: {
    margin: "8px 0 0",
    color: "#52606d",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  timelineList: {
    display: "grid",
    gap: "14px",
  },
  timelineItem: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid #e5e7eb",
  },
  timelineDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    marginTop: "6px",
    flexShrink: 0,
  },
  timelineDotOk: {
    background: "#16a34a",
    boxShadow: "0 0 0 6px rgba(22,163,74,0.12)",
  },
  timelineDotDanger: {
    background: "#dc2626",
    boxShadow: "0 0 0 6px rgba(220,38,38,0.12)",
  },
  timelineDotAccent: {
    background: "#2563eb",
    boxShadow: "0 0 0 6px rgba(37,99,235,0.12)",
  },
  timelineDotMuted: {
    background: "#64748b",
    boxShadow: "0 0 0 6px rgba(100,116,139,0.12)",
  },
  timelineBody: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  timelineMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  timelineCategory: {
    display: "inline-flex",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  timelineDate: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
  },
  timelineItemTitle: {
    color: "#0f172a",
    fontSize: "15px",
  },
  timelineItemText: {
    margin: 0,
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  setupGuidePanel: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  setupGuideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #eff6ff 0%, #fff7ed 100%)",
    border: "1px solid rgba(59,130,246,0.14)",
  },
  setupGuideLabel: {
    display: "block",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  setupGuideTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  setupGuideText: {
    margin: "8px 0 0",
    color: "#52606d",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  setupReadyPill: {
    padding: "12px 16px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "13px",
    fontWeight: "800",
  },
  setupChecklist: {
    display: "grid",
    gap: "14px",
  },
  inlineSetupPanel: {
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #ffffff 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inlineSetupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  inlineFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  inlineLockNotice: {
    gridColumn: "1 / -1",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "rgba(219, 234, 254, 0.8)",
    border: "1px solid rgba(59,130,246,0.22)",
    color: "#1d4ed8",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  setupStepCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid #e5e7eb",
  },
  setupStepMeta: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    flex: "1 1 420px",
  },
  setupStepIndex: {
    minWidth: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
  },
  setupStepIndexComplete: {
    background: "#dcfce7",
    color: "#166534",
  },
  setupStepIndexPending: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  setupStepTitle: {
    color: "#0f172a",
    fontSize: "15px",
  },
  setupStepText: {
    margin: "6px 0 0",
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  setupStepActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  actionLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  actionValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  actionHint: {
    color: "#52606d",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  actionButtons: {
    display: "flex",
    gap: "10px",
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
  rateButton: {
    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
    color: "#ffffff",
    border: "1px solid rgba(13,148,136,0.35)",
    boxShadow: "0 12px 24px rgba(13,148,136,0.18)",
  },
  orderButton: {
    background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
    color: "#ffffff",
    border: "1px solid rgba(234,88,12,0.35)",
    boxShadow: "0 12px 24px rgba(234,88,12,0.18)",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  readinessCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    borderRadius: "18px",
    padding: "16px",
    background: "#fff",
    border: "1px solid #e5e7eb",
  },
  readinessTitle: {
    color: "#0f172a",
    fontSize: "14px",
  },
  readinessBadge: {
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },
  readinessOk: {
    background: "#dcfce7",
    color: "#166534",
  },
  readinessWarn: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  identityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  identityCard: {
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #ffffff 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
  },
  identityLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  identityValue: {
    display: "block",
    marginTop: "8px",
    color: "#0f172a",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  emptyState: {
    padding: "18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #fffdf8 0%, #f8fafc 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    color: "#52606d",
    lineHeight: 1.7,
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
  orderActivityMeta: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  statusBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },
  statusOpen: {
    background: "#fef3c7",
    color: "#92400e",
  },
  statusPartial: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  statusCompleted: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusCancelled: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  overdueRow: {
    background: "linear-gradient(135deg, rgba(255,247,237,0.85) 0%, rgba(255,255,255,1) 100%)",
  },
  overdueHint: {
    marginTop: "4px",
    color: "#c2410c",
    fontSize: "12px",
    fontWeight: "700",
  },
  inlineTableActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallActionButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },
  successActionButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  warnActionButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  subtleText: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
  },
};

export default PartyCommercialProfilePage;
