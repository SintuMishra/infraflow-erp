import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SummaryCard from "../components/dashboard/SummaryCard";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { formatDateTimeLabel, formatDisplayDate } from "../utils/date";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const EXCEPTION_LABELS = {
  overdue_order: "Overdue Order",
  active_order_missing_rate: "Missing Active Rate",
  unlinked_dispatch: "Unlinked Dispatch",
  incomplete_dispatch_closure: "Incomplete Closure",
};

const formatExceptionLabel = (value) =>
  EXCEPTION_LABELS[value] ||
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const resolveWorkspaceScopeLabel = (currentUser) => {
  const candidates = [
    currentUser?.company?.companyName,
    currentUser?.company?.company_name,
    currentUser?.company?.name,
    currentUser?.companyName,
    currentUser?.company_name,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }

  if (currentUser?.companyId) {
    return `Company #${currentUser.companyId}`;
  }

  return "Current workspace";
};

function DashboardPage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [commercialInsights, setCommercialInsights] = useState(null);
  const [reviewedCommercialInsights, setReviewedCommercialInsights] = useState(null);
  const [myCommercialInsights, setMyCommercialInsights] = useState(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const requests = [
        api.get("/dashboard/summary"),
        api.get("/dashboard/commercial-exceptions", {
          params: { includeReviewed: true, limit: 50 },
        }),
        api.get("/dashboard/commercial-exceptions", {
          params: { includeReviewed: true, reviewedOnly: true, limit: 20 },
        }),
      ];

      if (currentUser?.employeeId) {
        requests.push(
          api.get("/dashboard/commercial-exceptions", {
            params: {
              assignedEmployeeId: currentUser.employeeId,
              limit: 20,
            },
          })
        );
      }

      const [summaryRes, commercialRes, reviewedCommercialRes, myCommercialRes] =
        await Promise.all(requests);
      setData(summaryRes.data.data);
      setCommercialInsights(commercialRes.data?.data || null);
      setReviewedCommercialInsights(reviewedCommercialRes.data?.data || null);
      setMyCommercialInsights(myCommercialRes?.data?.data || null);
      setLastRefreshedAt(new Date().toISOString());
      setError("");
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser?.employeeId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const operationalInsights = useMemo(() => {
    if (!data) return null;

    const dispatchLoad = Number(data.dispatch.todayQuantity || 0);
    const fleetUsage = Number(data.dispatch.vehiclesUsedToday || 0);
    const production = Number(data.crusher.todayProduction || 0);
    const inUseVehicles = Number(data.fleet.vehiclesInUse || 0);
    const totalActiveVehicles = Number(data.fleet.totalActiveVehicles || 0);
    const pendingDispatch = Number(data.dispatch.pendingCount || 0);
    const completedDispatch = Number(data.dispatch.completedCount || 0);
    const yesterdayProduction = Number(data.crusher.yesterdayProduction || 0);
    const equipmentHoursToday = Number(data.fleet.equipmentHoursToday || 0);
    const projectReportsToday = Number(data.projects.todayReports || 0);
    const fleetUtilization = totalActiveVehicles
      ? Math.round((inUseVehicles / totalActiveVehicles) * 100)
      : 0;
    const completionRatio =
      pendingDispatch + completedDispatch > 0
        ? Math.round(
            (completedDispatch / (pendingDispatch + completedDispatch)) * 100
          )
        : 0;
    const productionDelta = production - yesterdayProduction;
    const busiestPlant = [...(data.plants.dispatchSummary || [])].sort(
      (a, b) => Number(b.todayDispatchTons || 0) - Number(a.todayDispatchTons || 0)
    )[0];

    let health = "Stable Operations";
    let healthTone = "calm";
    const priorities = [];

    if (pendingDispatch >= 8) {
      health = "Dispatch backlog needs attention";
      healthTone = "attention";
      priorities.push(`${pendingDispatch} pending dispatch records need clearance`);
    }

    if (fleetUtilization >= 85) {
      health = "Fleet running near full utilization";
      healthTone = "attention";
      priorities.push(`Fleet utilization is at ${fleetUtilization}% today`);
    }

    if (dispatchLoad >= 500 || production >= 800) {
      health = "High-volume operating day";
      if (healthTone !== "attention") {
        healthTone = "strong";
      }
      priorities.push("Monitor turnaround time and billing closure for peak load");
    }

    if (priorities.length === 0) {
      priorities.push("Operations look balanced across dispatch, production, and fleet");
      priorities.push("Use this window to close billing and documentation gaps");
    }

    return {
      health,
      healthTone,
      dispatchLoad,
      fleetUsage,
      production,
      inUseVehicles,
      pendingDispatch,
      totalActiveVehicles,
      fleetUtilization,
      completionRatio,
      productionDelta,
      equipmentHoursToday,
      projectReportsToday,
      busiestPlant,
      priorities: priorities.slice(0, 3),
    };
  }, [data]);

  const focusMetrics = useMemo(() => {
    if (!operationalInsights) return [];

    return [
      {
        title: "Fleet Utilization",
        value: `${operationalInsights.fleetUtilization}%`,
        note: `${operationalInsights.inUseVehicles}/${operationalInsights.totalActiveVehicles} active vehicles engaged`,
        tone:
          operationalInsights.fleetUtilization >= 85 ? "attention" : "calm",
      },
      {
        title: "Dispatch Closure",
        value: `${operationalInsights.completionRatio}%`,
        note: `${operationalInsights.pendingDispatch} pending vs live completed dispatch mix`,
        tone:
          operationalInsights.pendingDispatch >= 8 ? "attention" : "strong",
      },
      {
        title: "Production Delta",
        value: `${operationalInsights.productionDelta >= 0 ? "+" : ""}${formatMetric(
          operationalInsights.productionDelta
        )} tons`,
        note: `Compared with yesterday's ${formatMetric(
          data?.crusher?.yesterdayProduction || 0
        )} tons`,
        tone:
          operationalInsights.productionDelta >= 0 ? "strong" : "attention",
      },
    ];
  }, [data, operationalInsights]);

  const workspaceScopeLabel = resolveWorkspaceScopeLabel(currentUser);

  const hasMeaningfulActivity = useMemo(() => {
    if (!data) return false;

    return (
      Number(data.dispatch.todayQuantity || 0) > 0 ||
      Number(data.crusher.todayProduction || 0) > 0 ||
      Number(data.fleet.vehiclesInUse || 0) > 0 ||
      Number(data.projects.todayReports || 0) > 0
    );
  }, [data]);

  const commercialQueue = useMemo(() => {
    const items = commercialInsights?.items || [];
    const summary = commercialInsights?.summary || {};
    const meta = commercialInsights?.meta || {};

    return {
      items,
      summary,
      meta,
      activeExceptionCount: Number(meta.filteredTotalCount || 0),
      reviewedCount: Number(summary.reviewedCount || 0),
      unreviewedCount: Math.max(
        0,
        Number(meta.filteredTotalCount || 0) - Number(summary.reviewedCount || 0)
      ),
      escalatedReviewedCount: Number(summary.escalatedReviewedCount || 0),
      slaBreachedCount: Number(summary.slaBreachedCount || 0),
      assignedCount: Number(summary.assignedCount || 0),
      unassignedCount: Number(summary.unassignedCount || 0),
      escalatedUnassignedCount: Number(summary.escalatedUnassignedCount || 0),
      slaBreachedUnassignedCount: Number(summary.slaBreachedUnassignedCount || 0),
      overdueOrders: items.filter((item) => item.exceptionType === "overdue_order"),
      missingRates: items.filter(
        (item) => item.exceptionType === "active_order_missing_rate"
      ),
      unlinkedDispatches: items.filter(
        (item) => item.exceptionType === "unlinked_dispatch"
      ),
      incompleteClosures: items.filter(
        (item) => item.exceptionType === "incomplete_dispatch_closure"
      ),
      slaBreachedItems: items.filter((item) => item.isSlaBreached),
    };
  }, [commercialInsights]);

  const reviewedQueue = useMemo(() => {
    const items = reviewedCommercialInsights?.items || [];
    return items.filter((item) => item.isReviewed).slice(0, 6);
  }, [reviewedCommercialInsights]);

  const myQueue = useMemo(() => {
    const items = myCommercialInsights?.items || [];
    return {
      items,
      count: Number(myCommercialInsights?.meta?.filteredTotalCount || items.length || 0),
    };
  }, [myCommercialInsights]);

  const commercialSpotlight = useMemo(() => {
    if (!commercialInsights) {
      return null;
    }

    const ownerSummary = commercialQueue.summary?.ownerSummary || [];
    const topOwner = ownerSummary[0] || null;
    const highestRiskItem = commercialQueue.slaBreachedItems[0] || commercialQueue.items[0] || null;

    let headline = "Commercial controls are stable";
    let detail =
      "Queue pressure is contained, so managers can stay focused on throughput and closure quality.";
    let tone = "calm";

    if (commercialQueue.slaBreachedUnassignedCount > 0) {
      headline = "Late exceptions still lack direct ownership";
      detail = `${formatMetric(
        commercialQueue.slaBreachedUnassignedCount
      )} SLA-breached item(s) are unassigned and should be routed immediately.`;
      tone = "attention";
    } else if (commercialQueue.slaBreachedCount > 0) {
      headline = "Commercial exceptions have crossed SLA";
      detail = `${formatMetric(
        commercialQueue.slaBreachedCount
      )} item(s) are officially late, but the queue still has accountable owners in place.`;
      tone = "strong";
    } else if (commercialQueue.activeExceptionCount > 0) {
      headline = "Commercial queue is active but still inside control limits";
      detail = `${formatMetric(
        commercialQueue.activeExceptionCount
      )} live item(s) need follow-through before they become late.`;
    }

    return {
      headline,
      detail,
      tone,
      topOwner,
      highestRiskItem,
    };
  }, [commercialInsights, commercialQueue]);

  const commandDeck = useMemo(() => {
    if (!commercialInsights) {
      return [];
    }

    return [
      {
        label: "Late And Unowned",
        value: formatMetric(commercialQueue.slaBreachedUnassignedCount),
        note: "Immediate routing needed",
        tone: commercialQueue.slaBreachedUnassignedCount > 0 ? "attention" : "calm",
        actionLabel: "Open Exception Queue",
        actionPath: "/commercial-exceptions",
      },
      {
        label: "My Exception Load",
        value: formatMetric(myQueue.count),
        note: currentUser?.employeeId
          ? "Assigned to my employee profile"
          : "No employee-linked queue in this session",
        tone: myQueue.count > 0 ? "strong" : "calm",
        actionLabel: "Review My Queue",
        actionPath: "/commercial-exceptions",
      },
      {
        label: "Top Owner",
        value: commercialSpotlight?.topOwner?.assigneeName || "Unassigned Pool",
        note: commercialSpotlight?.topOwner
          ? `${formatMetric(commercialSpotlight.topOwner.assignedCount)} live items owned`
          : "No ownership concentration yet",
        tone: commercialSpotlight?.topOwner?.slaBreachedCount ? "attention" : "strong",
        actionLabel: "Review Accountability",
        actionPath: "/commercial-exceptions",
      },
    ];
  }, [commercialInsights, commercialQueue, currentUser?.employeeId, myQueue.count, commercialSpotlight]);

  const formattedLastRefreshedAt = lastRefreshedAt
    ? formatDateTimeLabel(lastRefreshedAt, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <AppShell
      title="Operations Dashboard"
      subtitle="Live view of dispatch, production, and fleet"
    >
      {error && <p style={styles.error}>{error}</p>}

      {!data ? (
        <div style={styles.loadingState}>Loading dashboard...</div>
      ) : (
        <div style={styles.pageStack}>
          <div style={styles.scopeBanner}>
            <div>
              <p style={styles.scopeEyebrow}>Live Company Scope</p>
              <strong style={styles.scopeTitle}>{workspaceScopeLabel}</strong>
            </div>
          </div>

          <div style={styles.hero}>
            <div style={styles.heroGlowOne} />
            <div style={styles.heroGlowTwo} />

            <div style={styles.heroContent}>
              <div style={styles.heroLeft}>
                <p style={styles.heroEyebrow}>Operations Command Center</p>
                <h1 style={styles.heroTitle}>Live Multi-Plant Overview</h1>
                <p style={styles.heroText}>
                  Track dispatch, production, and fleet signals from one dashboard.
                </p>

                <div
                  style={{
                    ...styles.systemHealth,
                    ...(operationalInsights.healthTone === "attention"
                      ? styles.healthAttention
                      : operationalInsights.healthTone === "strong"
                        ? styles.healthStrong
                        : styles.healthCalm),
                  }}
                >
                  System Activity: <strong>{operationalInsights.health}</strong>
                </div>
              </div>

              <div style={styles.heroSide}>
                <div style={styles.heroMetrics}>
                  <div style={styles.metricCard}>
                    <span style={styles.metricLabel}>Dispatch Today</span>
                    <strong style={styles.metricValue}>
                      {formatMetric(operationalInsights.dispatchLoad)} tons
                    </strong>
                  </div>

                  <div style={styles.metricCard}>
                    <span style={styles.metricLabel}>Vehicles Used</span>
                    <strong style={styles.metricValue}>
                      {formatMetric(operationalInsights.fleetUsage)}
                    </strong>
                  </div>

                  <div style={styles.metricCard}>
                    <span style={styles.metricLabel}>Vehicles In Use</span>
                    <strong style={styles.metricValue}>
                      {formatMetric(operationalInsights.inUseVehicles)}
                    </strong>
                  </div>

                  <div style={styles.metricCard}>
                    <span style={styles.metricLabel}>Pending Dispatch</span>
                    <strong style={styles.metricValue}>
                      {formatMetric(operationalInsights.pendingDispatch)}
                    </strong>
                  </div>
                </div>

                <div style={styles.refreshRow}>
                  <div style={styles.refreshMeta}>
                    <span style={styles.refreshLabel}>Decision Snapshot</span>
                    <strong style={styles.refreshValue}>
                      {operationalInsights.busiestPlant?.plantName || "All plants balanced"}
                    </strong>
                    <span style={styles.refreshSubtext}>
                      {formattedLastRefreshedAt
                        ? `Last refreshed ${formattedLastRefreshedAt}`
                        : "Waiting for first refresh"}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={styles.refreshButton}
                    onClick={loadDashboard}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {commercialSpotlight ? (
            <div style={styles.commandDeckWrap}>
              <div
                style={{
                  ...styles.commandBrief,
                  ...(commercialSpotlight.tone === "attention"
                    ? styles.commandBriefAttention
                    : commercialSpotlight.tone === "strong"
                      ? styles.commandBriefStrong
                      : styles.commandBriefCalm),
                }}
              >
                <div style={styles.commandBriefCopy}>
                  <p style={styles.commandBriefEyebrow}>Commercial Control Brief</p>
                  <h2 style={styles.commandBriefTitle}>{commercialSpotlight.headline}</h2>
                  <p style={styles.commandBriefText}>{commercialSpotlight.detail}</p>
                </div>

                <div style={styles.commandBriefMeta}>
                  <div style={styles.commandBriefCard}>
                    <span style={styles.commandBriefLabel}>Highest-Risk Exception</span>
                    <strong style={styles.commandBriefValue}>
                      {commercialSpotlight.highestRiskItem
                        ? formatExceptionLabel(commercialSpotlight.highestRiskItem.exceptionType)
                        : "No live exception"}
                    </strong>
                    <span style={styles.commandBriefSubtext}>
                      {commercialSpotlight.highestRiskItem?.reference || "Queue currently clear"}
                    </span>
                  </div>
                  <div style={styles.commandBriefCard}>
                    <span style={styles.commandBriefLabel}>Owner With Most Load</span>
                    <strong style={styles.commandBriefValue}>
                      {commercialSpotlight.topOwner?.assigneeName || "No owner assigned"}
                    </strong>
                    <span style={styles.commandBriefSubtext}>
                      {commercialSpotlight.topOwner
                        ? `${formatMetric(commercialSpotlight.topOwner.assignedCount)} active item(s)`
                        : "Ownership remains distributed or empty"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.commandDeckGrid}>
                {commandDeck.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      ...styles.commandDeckCard,
                      ...(item.tone === "attention"
                        ? styles.commandDeckAttention
                        : item.tone === "strong"
                          ? styles.commandDeckStrong
                          : styles.commandDeckCalm),
                    }}
                  >
                    <span style={styles.commandDeckLabel}>{item.label}</span>
                    <strong style={styles.commandDeckValue}>{item.value}</strong>
                    <p style={styles.commandDeckNote}>{item.note}</p>
                    <Link to={item.actionPath} style={styles.commandDeckAction}>
                      {item.actionLabel}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={styles.focusGrid}>
            {focusMetrics.map((item) => (
              <div
                key={item.title}
                style={{
                  ...styles.focusCard,
                  ...(item.tone === "attention"
                    ? styles.focusAttention
                    : item.tone === "strong"
                      ? styles.focusStrong
                      : styles.focusCalm),
                }}
              >
                <span style={styles.focusTitle}>{item.title}</span>
                <strong style={styles.focusValue}>{item.value}</strong>
                <p style={styles.focusNote}>{item.note}</p>
              </div>
            ))}
          </div>

          {!hasMeaningfulActivity && (
            <div style={styles.emptyInsight}>
              <strong style={styles.emptyInsightTitle}>Quiet operating window</strong>
              <p style={styles.emptyInsightText}>
                No major crusher, dispatch, fleet, or project activity is visible in the current company scope yet.
                That can be expected for a fresh rollout, a new tenant, or off-hours usage.
              </p>
            </div>
          )}

          <div style={styles.grid}>
            <SummaryCard
              title="Total Employees"
              value={formatMetric(data.employees.total)}
              accent="#2563eb"
            />
            <SummaryCard
              title="Active Plants"
              value={formatMetric(data.plants.active)}
              accent="#0ea5e9"
            />
            <SummaryCard
              title="Today's Crusher Production"
              value={formatMetric(data.crusher.todayProduction)}
              accent="#10b981"
            />
            <SummaryCard
              title="Yesterday Production"
              value={formatMetric(data.crusher.yesterdayProduction)}
              accent="#f59e0b"
            />
            <SummaryCard
              title="Weekly Production"
              value={formatMetric(data.crusher.weeklyProduction)}
              accent="#8b5cf6"
            />
            <SummaryCard
              title="Today's Dispatch Quantity"
              value={formatMetric(data.dispatch.todayQuantity)}
              accent="#ef4444"
            />
            <SummaryCard
              title="Vehicles Used Today"
              value={formatMetric(data.dispatch.vehiclesUsedToday)}
              accent="#06b6d4"
            />
            <SummaryCard
              title="Pending Dispatch"
              value={formatMetric(data.dispatch.pendingCount)}
              accent="#d97706"
            />
            <SummaryCard
              title="Completed Dispatch"
              value={formatMetric(data.dispatch.completedCount)}
              accent="#059669"
            />
            <SummaryCard
              title="Active Vehicles"
              value={formatMetric(data.fleet.totalActiveVehicles)}
              accent="#f97316"
            />
            <SummaryCard
              title="Vehicles In Use"
              value={formatMetric(data.fleet.vehiclesInUse)}
              accent="#3b82f6"
            />
            <SummaryCard
              title="Equipment Hours Today"
              value={formatMetric(data.fleet.equipmentHoursToday)}
              accent="#14b8a6"
            />
            <SummaryCard
              title="Project Reports Today"
              value={formatMetric(data.projects.todayReports)}
              accent="#84cc16"
            />
            {commercialInsights && (
              <>
                <SummaryCard
                  title="Open Orders"
                  value={formatMetric(commercialInsights.summary?.openOrdersCount)}
                  accent="#1d4ed8"
                />
                <SummaryCard
                  title="Pending Order Qty"
                  value={formatMetric(commercialInsights.summary?.pendingQuantity)}
                  accent="#7c3aed"
                />
                <SummaryCard
                  title="In-Transit Order Qty"
                  value={formatMetric(commercialInsights.summary?.inTransitQuantity)}
                  accent="#ea580c"
                />
                <SummaryCard
                  title="Dispatch Against Orders Today"
                  value={formatMetric(
                    commercialInsights.summary?.dispatchAgainstOrdersToday
                  )}
                  accent="#059669"
                />
                <SummaryCard
                  title="Overdue Orders"
                  value={formatMetric(commercialInsights.summary?.overdueOrdersCount)}
                  accent="#dc2626"
                />
                <SummaryCard
                  title="Parties Missing Rates"
                  value={formatMetric(
                    commercialInsights.summary?.partiesWithNoActiveRatesCount
                  )}
                  accent="#b45309"
                />
                <SummaryCard
                  title="Unlinked Dispatch Exceptions"
                  value={formatMetric(
                    commercialInsights.summary?.unlinkedDispatchesCount
                  )}
                  accent="#dc2626"
                />
                <SummaryCard
                  title="Incomplete Dispatch Closures"
                  value={formatMetric(
                    commercialInsights.summary?.incompleteClosuresCount
                  )}
                  accent="#ea580c"
                />
                <SummaryCard
                  title="Active Exception Queue"
                  value={formatMetric(commercialQueue.activeExceptionCount)}
                  accent="#7c2d12"
                />
                <SummaryCard
                  title="Reviewed Exceptions"
                  value={formatMetric(commercialQueue.reviewedCount)}
                  accent="#475569"
                />
                <SummaryCard
                  title="Unreviewed Exceptions"
                  value={formatMetric(commercialQueue.unreviewedCount)}
                  accent="#047857"
                />
                <SummaryCard
                  title="Escalated Reviewed Exceptions"
                  value={formatMetric(commercialQueue.escalatedReviewedCount)}
                  accent="#b91c1c"
                />
                <SummaryCard
                  title="SLA Breached Exceptions"
                  value={formatMetric(commercialQueue.slaBreachedCount)}
                  accent="#991b1b"
                />
                <SummaryCard
                  title="Assigned Exceptions"
                  value={formatMetric(commercialQueue.assignedCount)}
                  accent="#1d4ed8"
                />
                <SummaryCard
                  title="Escalated Unassigned"
                  value={formatMetric(commercialQueue.escalatedUnassignedCount)}
                  accent="#c2410c"
                />
                <SummaryCard
                  title="Unassigned SLA Breaches"
                  value={formatMetric(commercialQueue.slaBreachedUnassignedCount)}
                  accent="#b45309"
                />
              </>
            )}
          </div>

          <div style={styles.twoColumnGrid}>
            <SectionCard title="Management Priorities">
              <div style={styles.priorityList}>
                {operationalInsights.priorities.map((item) => (
                  <div key={item} style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Today's Operating Base">
              <div style={styles.snapshotList}>
                <div style={styles.snapshotRow}>
                  <span style={styles.snapshotLabel}>Busiest Dispatch Plant</span>
                  <strong style={styles.snapshotValue}>
                    {operationalInsights.busiestPlant?.plantName || "-"}
                  </strong>
                </div>
                <div style={styles.snapshotRow}>
                  <span style={styles.snapshotLabel}>Peak Dispatch Tons</span>
                  <strong style={styles.snapshotValue}>
                    {formatMetric(
                      operationalInsights.busiestPlant?.todayDispatchTons || 0
                    )}
                  </strong>
                </div>
                <div style={styles.snapshotRow}>
                  <span style={styles.snapshotLabel}>Equipment Hours Today</span>
                  <strong style={styles.snapshotValue}>
                    {formatMetric(operationalInsights.equipmentHoursToday)}
                  </strong>
                </div>
                <div style={styles.snapshotRow}>
                  <span style={styles.snapshotLabel}>Project Reports Logged</span>
                  <strong style={styles.snapshotValue}>
                    {formatMetric(operationalInsights.projectReportsToday)}
                  </strong>
                </div>
              </div>
            </SectionCard>
          </div>

          {commercialInsights && (
            <div style={styles.twoColumnGrid}>
              <SectionCard title="Commercial Control Queue">
                <div style={styles.snapshotList}>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Active exception queue</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.activeExceptionCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Reviewed exceptions</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.reviewedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Unreviewed exceptions</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.unreviewedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Reviewed 48h+ still open</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.escalatedReviewedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>SLA breached exceptions</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.slaBreachedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Assigned exceptions</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.assignedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Unassigned SLA breaches</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.slaBreachedUnassignedCount)}
                    </strong>
                  </div>
                  <div style={styles.snapshotRow}>
                    <span style={styles.snapshotLabel}>Visible dashboard rows</span>
                    <strong style={styles.snapshotValue}>
                      {formatMetric(commercialQueue.items.length)}
                    </strong>
                  </div>
                  <div style={styles.quickActionRow}>
                    <Link to="/commercial-exceptions" style={styles.linkActionButton}>
                      Open Exception Queue
                    </Link>
                    <Link to="/dispatch-reports" style={styles.linkGhostButton}>
                      Dispatch Workspace
                    </Link>
                    <Link to="/party-orders" style={styles.linkGhostButton}>
                      Orders Workspace
                    </Link>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Missing Rate Exceptions">
                {commercialQueue.missingRates.length === 0 ? (
                  <p style={styles.emptyState}>
                    No open orders are missing active commercial rates right now.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Order</th>
                          <th style={styles.th}>Party</th>
                          <th style={styles.th}>Plant</th>
                          <th style={styles.th}>Material</th>
                          <th style={styles.th}>Review</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.missingRates.slice(0, 5).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>{item.reference || "-"}</td>
                            <td style={styles.td}>{item.partyName || "-"}</td>
                            <td style={styles.td}>{item.plantName || "-"}</td>
                            <td style={styles.td}>{item.materialName || "-"}</td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.reviewBadge,
                                  ...(item.isReviewed
                                    ? styles.reviewedBadge
                                    : styles.activeBadge),
                                }}
                              >
                                {item.isReviewed ? "Reviewed" : "Active"}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.actionLabel}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {commercialInsights && (
            <SectionCard title="Owner Accountability">
              {(commercialQueue.summary?.ownerSummary || []).length === 0 ? (
                <p style={styles.emptyState}>
                  No exception owners have been assigned yet.
                </p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Owner</th>
                        <th style={styles.th}>Employee Code</th>
                        <th style={styles.th}>Assigned</th>
                        <th style={styles.th}>Escalated</th>
                        <th style={styles.th}>SLA Breached</th>
                        <th style={styles.th}>Unreviewed</th>
                        <th style={styles.th}>Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commercialQueue.summary?.ownerSummary || []).slice(0, 8).map((owner) => (
                        <tr key={owner.assigneeEmployeeId}>
                          <td style={styles.td}>{owner.assigneeName || "-"}</td>
                          <td style={styles.td}>{owner.assigneeEmployeeCode || "-"}</td>
                          <td style={styles.td}>{formatMetric(owner.assignedCount)}</td>
                          <td style={styles.td}>{formatMetric(owner.escalatedCount)}</td>
                          <td style={styles.td}>{formatMetric(owner.slaBreachedCount)}</td>
                          <td style={styles.td}>{formatMetric(owner.unreviewedCount)}</td>
                          <td style={styles.td}>{formatMetric(owner.reviewedCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {commercialInsights && (
            <div style={styles.twoColumnGrid}>
              <SectionCard title="SLA Breach Queue">
                {commercialQueue.slaBreachedItems.length === 0 ? (
                  <p style={styles.emptyState}>
                    No commercial exceptions have crossed their SLA threshold right now.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Owner</th>
                          <th style={styles.th}>Age</th>
                          <th style={styles.th}>SLA</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.slaBreachedItems.slice(0, 6).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>{formatExceptionLabel(item.exceptionType)}</td>
                            <td style={styles.td}>{item.reference || "-"}</td>
                            <td style={styles.td}>
                              {item.assigneeName || "Unassigned"}
                              {item.assigneeEmployeeCode ? (
                                <div style={styles.mutedMeta}>
                                  {item.assigneeEmployeeCode}
                                </div>
                              ) : null}
                            </td>
                            <td style={styles.td}>{item.exceptionAgeDays || 0} day(s)</td>
                            <td style={styles.td}>{item.slaDays || 0} day(s)</td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.actionLabel}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Escalated Reviewed Exceptions">
                {commercialQueue.items.filter((item) => item.isEscalated).length === 0 ? (
                  <p style={styles.emptyState}>
                    No reviewed exceptions have aged past 48 hours while still open.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Reviewed By</th>
                          <th style={styles.th}>Aging</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.items
                          .filter((item) => item.isEscalated)
                          .slice(0, 6)
                          .map((item) => (
                            <tr key={item.id}>
                              <td style={styles.td}>{formatExceptionLabel(item.exceptionType)}</td>
                              <td style={styles.td}>{item.reference || "-"}</td>
                              <td style={styles.td}>
                                {item.reviewedByName || "-"}
                                {item.reviewNotes ? (
                                  <div style={styles.mutedMeta}>{item.reviewNotes}</div>
                                ) : null}
                                {item.assigneeName ? (
                                  <div style={styles.mutedMeta}>
                                    Owner: {item.assigneeName}
                                    {item.assigneeEmployeeCode
                                      ? ` (${item.assigneeEmployeeCode})`
                                      : ""}
                                  </div>
                                ) : null}
                              </td>
                              <td style={styles.td}>{item.reviewAgeDays || 0} day(s)</td>
                              <td style={styles.td}>
                                <Link to={item.actionPath} style={styles.inlineLink}>
                                  {item.actionLabel}
                                </Link>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Assigned To Me">
                {!currentUser?.employeeId ? (
                  <p style={styles.emptyState}>
                    Personal assignment view is available once the session is linked to an employee record.
                  </p>
                ) : myQueue.items.length === 0 ? (
                  <p style={styles.emptyState}>
                    No commercial exceptions are currently assigned to you.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myQueue.items.slice(0, 6).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>{formatExceptionLabel(item.exceptionType)}</td>
                            <td style={styles.td}>{item.reference || "-"}</td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.reviewBadge,
                                  ...(item.isEscalated
                                    ? styles.activeBadge
                                    : item.isReviewed
                                      ? styles.reviewedBadge
                                      : styles.activeBadge),
                                }}
                              >
                                {item.isEscalated
                                  ? `Escalated ${item.reviewAgeDays || 0}d`
                                  : item.isSlaBreached
                                    ? `SLA ${item.exceptionAgeDays || 0}d`
                                  : item.isReviewed
                                    ? "Reviewed"
                                    : "Active"}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.actionLabel}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Recently Reviewed Exceptions">
                {reviewedQueue.length === 0 ? (
                  <p style={styles.emptyState}>
                    No commercial exceptions have been reviewed yet.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Reviewed By</th>
                          <th style={styles.th}>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewedQueue.map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>
                              <span style={{ ...styles.reviewBadge, ...styles.reviewedBadge }}>
                                {formatExceptionLabel(item.exceptionType)}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.reference || item.actionLabel}
                              </Link>
                            </td>
                            <td style={styles.td}>
                              {item.reviewedByName || "-"}
                              {item.reviewedAt ? (
                                <div style={styles.mutedMeta}>
                                  {formatDisplayDate(item.reviewedAt)}
                                </div>
                              ) : null}
                              {item.assigneeName ? (
                                <div style={styles.mutedMeta}>
                                  Owner: {item.assigneeName}
                                  {item.assigneeEmployeeCode
                                    ? ` (${item.assigneeEmployeeCode})`
                                    : ""}
                                </div>
                              ) : null}
                            </td>
                            <td style={styles.td}>{item.reviewNotes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Review Workflow">
                <div style={styles.priorityList}>
                  <div style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>
                      Review marks are saved to the audit log, so acknowledgement is
                      persistent and traceable by company scope.
                    </span>
                  </div>
                  <div style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>
                      Active queue cards still reflect unresolved exceptions only, so
                      reviewed history does not inflate operational urgency.
                    </span>
                  </div>
                  <div style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>
                      Use the exception queue for full review notes and the dashboard
                      for quick management visibility.
                    </span>
                  </div>
                  <div style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>
                      Any reviewed exception that stays unresolved for 48+ hours is
                      surfaced separately as an escalation risk.
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {commercialInsights && (
            <div style={styles.twoColumnGrid}>
              <SectionCard title="Commercial Alerts">
                <div style={styles.priorityList}>
                  <div style={styles.priorityItem}>
                    <span style={styles.priorityDot} />
                    <span>
                      Reviewed exceptions still remain visible here until the underlying
                      data issue is actually resolved.
                    </span>
                  </div>
                  {(commercialInsights.summary?.priorityAlerts || []).map((item) => (
                    <div key={item} style={styles.priorityItem}>
                      <span style={styles.priorityDot} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Overdue Order Exceptions">
                {commercialQueue.overdueOrders.length === 0 ? (
                  <p style={styles.emptyState}>
                    No overdue commercial orders need attention right now.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Party</th>
                          <th style={styles.th}>Exception Date</th>
                          <th style={styles.th}>Detail</th>
                          <th style={styles.th}>Review</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.overdueOrders.slice(0, 5).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>{item.reference || "-"}</td>
                            <td style={styles.td}>{item.partyName || "-"}</td>
                            <td style={styles.td}>{item.dateValue || "-"}</td>
                            <td style={styles.td}>{item.detail || "-"}</td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.reviewBadge,
                                  ...(item.isReviewed
                                    ? styles.reviewedBadge
                                    : styles.activeBadge),
                                }}
                              >
                                {item.isReviewed ? "Reviewed" : "Active"}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.actionLabel}
                              </Link>
                              {item.reviewNotes ? (
                                <div style={styles.mutedMeta}>{item.reviewNotes}</div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {commercialInsights && (
            <div style={styles.twoColumnGrid}>
              <SectionCard title="Unlinked Dispatch Exceptions">
                {commercialQueue.unlinkedDispatches.length === 0 ? (
                  <p style={styles.emptyState}>
                    No dispatch records currently need order-link correction.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Date</th>
                          <th style={styles.th}>Party</th>
                          <th style={styles.th}>Plant</th>
                          <th style={styles.th}>Material</th>
                          <th style={styles.th}>Issue</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.unlinkedDispatches.slice(0, 8).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>{item.dateValue || "-"}</td>
                            <td style={styles.td}>{item.partyName || "-"}</td>
                            <td style={styles.td}>{item.plantName || "-"}</td>
                            <td style={styles.td}>{item.materialName || "-"}</td>
                            <td style={styles.td}>
                              {item.detail || "-"}
                              {item.isReviewed ? (
                                <div style={styles.mutedMeta}>
                                  Reviewed by {item.reviewedByName || "team"}
                                  {item.reviewNotes ? ` • ${item.reviewNotes}` : ""}
                                </div>
                              ) : null}
                            </td>
                            <td style={styles.td}>
                              <Link to={item.actionPath} style={styles.inlineLink}>
                                {item.reference || item.actionLabel}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Incomplete Dispatch Closures">
                {commercialQueue.incompleteClosures.length === 0 ? (
                  <p style={styles.emptyState}>
                    No completed dispatches are missing invoice or E-Way details.
                  </p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Date</th>
                          <th style={styles.th}>Party</th>
                          <th style={styles.th}>Plant</th>
                          <th style={styles.th}>Reference</th>
                          <th style={styles.th}>Issue</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commercialQueue.incompleteClosures.slice(0, 8).map((item) => (
                            <tr key={item.id}>
                              <td style={styles.td}>{item.dateValue || "-"}</td>
                              <td style={styles.td}>{item.partyName || "-"}</td>
                              <td style={styles.td}>{item.plantName || "-"}</td>
                              <td style={styles.td}>{item.reference || "-"}</td>
                              <td style={styles.td}>
                                {item.detail || "-"}
                                {item.isReviewed ? (
                                  <div style={styles.mutedMeta}>
                                    Reviewed by {item.reviewedByName || "team"}
                                    {item.reviewNotes ? ` • ${item.reviewNotes}` : ""}
                                  </div>
                                ) : null}
                              </td>
                              <td style={styles.td}>
                                <Link to={item.actionPath} style={styles.inlineLink}>
                                  {item.actionLabel}
                                </Link>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          <div style={styles.twoColumnGrid}>
            <SectionCard title="Plant-wise Dispatch Today">
              {data.plants.dispatchSummary.length === 0 ? (
                <p style={styles.emptyState}>No plant dispatch summary available.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Dispatch Tons</th>
                        <th style={styles.th}>Dispatch Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.plants.dispatchSummary.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.plantName}</td>
                          <td style={styles.td}>
                            {formatMetric(item.todayDispatchTons)}
                          </td>
                          <td style={styles.td}>
                            {formatMetric(item.dispatchCount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Plant-wise Active Vehicles">
              {data.plants.activeVehicleSummary.length === 0 ? (
                <p style={styles.emptyState}>No plant fleet summary available.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Active Vehicles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.plants.activeVehicleSummary.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.plantName}</td>
                          <td style={styles.td}>
                            {formatMetric(item.activeVehicles)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent Dispatch Activity">
            {data.dispatch.recentActivity.length === 0 ? (
              <p style={styles.emptyState}>No recent dispatch activity available.</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Plant</th>
                      <th style={styles.th}>Material</th>
                      <th style={styles.th}>Vehicle</th>
                      <th style={styles.th}>Destination</th>
                      <th style={styles.th}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dispatch.recentActivity.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{formatDisplayDate(item.dispatchDate)}</td>
                        <td style={styles.td}>{item.plantName || "-"}</td>
                        <td style={styles.td}>{item.materialType || "-"}</td>
                        <td style={styles.td}>{item.vehicleNumber || "-"}</td>
                        <td style={styles.td}>{item.destinationName || "-"}</td>
                        <td style={styles.td}>{formatMetric(item.quantityTons)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}

const styles = {
  error: {
    color: "#b91c1c",
    marginBottom: "16px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #fecaca",
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
  },
  loadingState: {
    minHeight: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    fontSize: "15px",
  },
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  scopeBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "13px 16px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(240,253,250,0.95) 0%, rgba(255,251,235,0.95) 100%)",
    border: "1px solid rgba(15,118,110,0.14)",
    boxShadow: "0 18px 34px rgba(15, 23, 42, 0.06)",
    flexWrap: "wrap",
  },
  scopeEyebrow: {
    margin: 0,
    fontSize: "11px",
    fontWeight: "800",
    color: "#0f766e",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  scopeTitle: {
    display: "block",
    marginTop: "4px",
    color: "#1f2933",
    fontSize: "16px",
  },
  scopeNote: {
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
    maxWidth: "520px",
    fontWeight: "600",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "32px",
    borderRadius: "24px",
    background:
      "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(168,85,247,0.16), transparent 24%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
    color: "#fff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
  },
  heroGlowOne: {
    position: "absolute",
    top: "-70px",
    right: "-30px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    background: "rgba(14,165,233,0.15)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(249,115,22,0.14)",
    filter: "blur(40px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "24px",
    alignItems: "center",
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroEyebrow: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    letterSpacing: "1.8px",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "34px",
    fontWeight: "800",
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
  },
  heroText: {
    margin: 0,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  heroSide: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  heroMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  metricCard: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "16px",
    backdropFilter: "blur(8px)",
  },
  metricLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  metricValue: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 1.1,
  },
  systemHealth: {
    marginTop: "8px",
    fontSize: "13px",
    padding: "10px 14px",
    borderRadius: "999px",
    width: "fit-content",
    border: "1px solid transparent",
  },
  healthCalm: {
    background: "rgba(16,185,129,0.14)",
    borderColor: "rgba(110,231,183,0.3)",
    color: "#d1fae5",
  },
  healthStrong: {
    background: "rgba(59,130,246,0.16)",
    borderColor: "rgba(147,197,253,0.34)",
    color: "#dbeafe",
  },
  healthAttention: {
    background: "rgba(249,115,22,0.18)",
    borderColor: "rgba(253,186,116,0.34)",
    color: "#ffedd5",
  },
  refreshRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(8px)",
  },
  refreshMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  refreshLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    fontWeight: "700",
  },
  refreshValue: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
  },
  refreshSubtext: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  refreshButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },
  focusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px",
  },
  commandDeckWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  commandBrief: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: "18px",
    padding: "24px",
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
  },
  commandBriefCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  commandBriefStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(240,249,255,0.94) 100%)",
  },
  commandBriefAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.96) 0%, rgba(254,242,242,0.94) 100%)",
  },
  commandBriefCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  commandBriefEyebrow: {
    margin: 0,
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#0f766e",
    textTransform: "uppercase",
  },
  commandBriefTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  },
  commandBriefText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  commandBriefMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  commandBriefCard: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.62)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  commandBriefLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  commandBriefValue: {
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
    lineHeight: 1.3,
  },
  commandBriefSubtext: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  commandDeckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  commandDeckCard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "20px",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.06)",
  },
  commandDeckCalm: {
    background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.96))",
  },
  commandDeckStrong: {
    background: "linear-gradient(180deg, rgba(239,246,255,0.98), rgba(255,255,255,0.96))",
  },
  commandDeckAttention: {
    background: "linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.96))",
  },
  commandDeckLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.9px",
  },
  commandDeckValue: {
    color: "#0f172a",
    fontSize: "26px",
    fontWeight: "800",
    lineHeight: 1.1,
  },
  commandDeckNote: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
    minHeight: "40px",
  },
  commandDeckAction: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 13px",
    borderRadius: "12px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: "700",
    marginTop: "6px",
  },
  emptyInsight: {
    padding: "18px 20px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #fffdf8 0%, #f8fafc 100%)",
    border: "1px solid rgba(148, 131, 107, 0.16)",
    boxShadow: "0 18px 34px rgba(15, 23, 42, 0.05)",
  },
  emptyInsightTitle: {
    display: "block",
    color: "#1f2933",
    fontSize: "16px",
    marginBottom: "8px",
  },
  emptyInsightText: {
    margin: 0,
    color: "#52606d",
    lineHeight: 1.7,
    fontSize: "14px",
    maxWidth: "900px",
  },
  focusCard: {
    borderRadius: "22px",
    padding: "20px",
    border: "1px solid transparent",
    boxShadow: "0 16px 32px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  focusCalm: {
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    borderColor: "#bfdbfe",
  },
  focusStrong: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 100%)",
    borderColor: "#a7f3d0",
  },
  focusAttention: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    borderColor: "#fdba74",
  },
  focusTitle: {
    color: "#475569",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    fontWeight: "800",
  },
  focusValue: {
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  focusNote: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },
  emptyState: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  priorityList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  priorityItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.7,
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
  },
  priorityDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#f97316",
    marginTop: "6px",
    flexShrink: 0,
  },
  snapshotList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  snapshotRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    paddingBottom: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  snapshotLabel: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "700",
  },
  snapshotValue: {
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "800",
    textAlign: "right",
  },
  quickActionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "8px",
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
  linkActionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 14px",
    borderRadius: "12px",
    background: "#0f766e",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: "700",
  },
  linkGhostButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: "700",
  },
  inlineLink: {
    color: "#1d4ed8",
    textDecoration: "none",
    fontWeight: "700",
  },
  reviewBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },
  activeBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  reviewedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  mutedMeta: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
    marginTop: "4px",
  },
};

export default DashboardPage;
