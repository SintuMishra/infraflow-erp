import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import SummaryCard from "../components/dashboard/SummaryCard";
import { getTimestampFileLabel } from "../utils/date";

const AUDIT_PRESETS = [
  {
    label: "All Activity",
    values: {
      actionFilter: "",
      targetTypeFilter: "",
      search: "",
    },
  },
  {
    label: "Onboarding",
    values: {
      actionFilter: "",
      targetTypeFilter: "onboarding",
      search: "onboarding.",
    },
  },
  {
    label: "Auth",
    values: {
      actionFilter: "",
      targetTypeFilter: "",
      search: "auth.",
    },
  },
  {
    label: "Commercial Exceptions",
    values: {
      actionFilter: "",
      targetTypeFilter: "commercial_exception",
      search: "commercial_exception",
    },
  },
];

const EVENT_VIEW_ALL = "all";
const EVENT_VIEW_USER = "user";
const EVENT_VIEW_SYSTEM = "system";

const COLUMN_KEY_TIME = "time";
const COLUMN_KEY_ACTION = "action";
const COLUMN_KEY_ACTOR = "actor";
const COLUMN_KEY_TARGET = "target";
const COLUMN_KEY_DETAILS = "details";

const DEFAULT_VISIBLE_COLUMNS = {
  [COLUMN_KEY_TIME]: true,
  [COLUMN_KEY_ACTION]: true,
  [COLUMN_KEY_ACTOR]: true,
  [COLUMN_KEY_TARGET]: true,
  [COLUMN_KEY_DETAILS]: true,
};
const AUDIT_SAVED_VIEWS_STORAGE_KEY = "audit_logs_saved_views_v1";

function AuditLogsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialFilters = useMemo(
    () => parseAuditQuery(location.search),
    [location.search]
  );

  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState(initialFilters.actionFilter);
  const [targetTypeFilter, setTargetTypeFilter] = useState(initialFilters.targetTypeFilter);
  const [search, setSearch] = useState(initialFilters.search);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [page, setPage] = useState(initialFilters.page);

  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
    summary: {
      totalMatching: 0,
      userEvents: 0,
      systemEvents: 0,
      uniqueActors: 0,
    },
    facets: {
      actions: [],
      targetTypes: [],
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isFiltersVisible, setIsFiltersVisible] = useState(true);
  const [eventView, setEventView] = useState(EVENT_VIEW_ALL);
  const [denseRows, setDenseRows] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [selectedLog, setSelectedLog] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [savedViewName, setSavedViewName] = useState("");
  const [activeSavedViewId, setActiveSavedViewId] = useState("");

  useEffect(() => {
    setActionFilter(initialFilters.actionFilter);
    setTargetTypeFilter(initialFilters.targetTypeFilter);
    setSearch(initialFilters.search);
    setStartDate(initialFilters.startDate);
    setEndDate(initialFilters.endDate);
    setPage(initialFilters.page);
  }, [initialFilters]);

  useEffect(() => {
    setSavedViews(loadSavedAuditViews());
  }, []);

  useEffect(() => {
    writeSavedAuditViews(savedViews);
  }, [savedViews]);

  const syncQuery = ({
    nextActionFilter = actionFilter,
    nextTargetTypeFilter = targetTypeFilter,
    nextSearch = search,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextPage = page,
  } = {}) => {
    const params = new URLSearchParams();

    if (nextActionFilter) params.set("action", nextActionFilter);
    if (nextTargetTypeFilter) params.set("targetType", nextTargetTypeFilter);
    if (nextSearch) params.set("search", nextSearch);
    if (nextStartDate) params.set("startDate", nextStartDate);
    if (nextEndDate) params.set("endDate", nextEndDate);
    if (nextPage > 1) params.set("page", String(nextPage));

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true }
    );
  };

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/audit-logs", {
        params: {
          action: actionFilter || undefined,
          targetType: targetTypeFilter || undefined,
          search: search || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit: 25,
        },
      });

      setLogs(response.data?.data || []);
      setMeta(
        response.data?.meta || {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
          summary: {
            totalMatching: 0,
            userEvents: 0,
            systemEvents: 0,
            uniqueActors: 0,
          },
          facets: {
            actions: [],
            targetTypes: [],
          },
        }
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, endDate, page, search, startDate, targetTypeFilter]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const actionOptions = useMemo(() => meta.facets?.actions || [], [meta.facets]);
  const targetTypeOptions = useMemo(() => meta.facets?.targetTypes || [], [meta.facets]);

  const summaryCards = useMemo(
    () => [
      {
        title: "Matching Events",
        value: meta.summary?.totalMatching || meta.total || 0,
        accent: "#0f172a",
      },
      {
        title: "User Events",
        value: meta.summary?.userEvents || 0,
        accent: "#0ea5e9",
      },
      {
        title: "System Events",
        value: meta.summary?.systemEvents || 0,
        accent: "#64748b",
      },
      {
        title: "Unique Actors",
        value: meta.summary?.uniqueActors || 0,
        accent: "#10b981",
      },
    ],
    [meta.summary, meta.total]
  );

  const visibleLogs = useMemo(() => {
    if (eventView === EVENT_VIEW_USER) {
      return logs.filter((log) => Boolean(log.actorUserId));
    }

    if (eventView === EVENT_VIEW_SYSTEM) {
      return logs.filter((log) => !log.actorUserId);
    }

    return logs;
  }, [eventView, logs]);

  const activeFilterTokens = useMemo(() => {
    const tokens = [];
    if (actionFilter) tokens.push({ key: "action", label: `Action: ${actionFilter}` });
    if (targetTypeFilter) {
      tokens.push({ key: "targetType", label: `Target: ${targetTypeFilter}` });
    }
    if (search) tokens.push({ key: "search", label: `Search: ${search}` });
    if (startDate) tokens.push({ key: "startDate", label: `From: ${startDate}` });
    if (endDate) tokens.push({ key: "endDate", label: `To: ${endDate}` });
    if (eventView !== EVENT_VIEW_ALL) {
      tokens.push({
        key: "eventView",
        label: eventView === EVENT_VIEW_USER ? "View: User Events" : "View: System Events",
      });
    }
    return tokens;
  }, [actionFilter, endDate, eventView, search, startDate, targetTypeFilter]);

  const topActions = useMemo(() => actionOptions.slice(0, 8), [actionOptions]);
  const topTargetTypes = useMemo(() => targetTypeOptions.slice(0, 8), [targetTypeOptions]);
  const visibleColumnCount = useMemo(
    () => Object.values(visibleColumns).filter(Boolean).length + 1,
    [visibleColumns]
  );
  const currentViewSnapshot = useMemo(
    () => ({
      actionFilter,
      targetTypeFilter,
      search,
      startDate,
      endDate,
      eventView,
      denseRows,
      visibleColumns,
      isFiltersVisible,
    }),
    [
      actionFilter,
      targetTypeFilter,
      search,
      startDate,
      endDate,
      eventView,
      denseRows,
      visibleColumns,
      isFiltersVisible,
    ]
  );

  const handleExportCsv = () => {
    const rows = visibleLogs.map((log) => ({
      time: formatAuditTimestamp(log.createdAt),
      action: log.action || "",
      actor_name: log.actorFullName || "System / Unknown",
      actor_reference: log.actorEmployeeCode || log.actorUsername || "",
      target_type: log.targetType || "",
      target_id: log.targetId ?? "",
      details: formatDetails(log.details),
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = getTimestampFileLabel();

    anchor.href = url;
    anchor.download = `audit-logs-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    syncQuery({ nextPage: 1 });
  };

  const handlePageChange = (nextPage) => {
    const safeNextPage = Math.max(1, nextPage);
    setPage(safeNextPage);
    syncQuery({ nextPage: safeNextPage });
  };

  const handleResetFilters = () => {
    setActionFilter("");
    setTargetTypeFilter("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    setEventView(EVENT_VIEW_ALL);
    setActiveSavedViewId("");
    syncQuery({
      nextActionFilter: "",
      nextTargetTypeFilter: "",
      nextSearch: "",
      nextStartDate: "",
      nextEndDate: "",
      nextPage: 1,
    });
  };

  const applyPreset = (preset) => {
    setActionFilter(preset.values.actionFilter);
    setTargetTypeFilter(preset.values.targetTypeFilter);
    setSearch(preset.values.search);
    setPage(1);
    setActiveSavedViewId("");
    syncQuery({
      nextActionFilter: preset.values.actionFilter,
      nextTargetTypeFilter: preset.values.targetTypeFilter,
      nextSearch: preset.values.search,
      nextPage: 1,
    });
  };

  const clearFilterToken = (tokenKey) => {
    if (tokenKey === "action") setActionFilter("");
    if (tokenKey === "targetType") setTargetTypeFilter("");
    if (tokenKey === "search") setSearch("");
    if (tokenKey === "startDate") setStartDate("");
    if (tokenKey === "endDate") setEndDate("");
    if (tokenKey === "eventView") setEventView(EVENT_VIEW_ALL);
    setActiveSavedViewId("");

    const nextState = {
      nextActionFilter: tokenKey === "action" ? "" : actionFilter,
      nextTargetTypeFilter: tokenKey === "targetType" ? "" : targetTypeFilter,
      nextSearch: tokenKey === "search" ? "" : search,
      nextStartDate: tokenKey === "startDate" ? "" : startDate,
      nextEndDate: tokenKey === "endDate" ? "" : endDate,
      nextPage: 1,
    };

    setPage(1);
    syncQuery(nextState);
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const isPresetActive = (preset) =>
    actionFilter === preset.values.actionFilter &&
    targetTypeFilter === preset.values.targetTypeFilter &&
    search === preset.values.search;

  const openLogInspector = (log) => {
    setSelectedLog(log);
  };

  useEffect(() => {
    if (!selectedLog) return;
    const stillVisible = visibleLogs.some((log) => log.id === selectedLog.id);
    if (!stillVisible) {
      setSelectedLog(null);
    }
  }, [selectedLog, visibleLogs]);

  const saveCurrentView = () => {
    const normalizedName = String(savedViewName || "").trim();
    if (!normalizedName) {
      setError("Enter a view name before saving");
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = savedViews.find((view) => view.name.toLowerCase() === normalizedName.toLowerCase());
    let nextSavedViews = [];
    let nextActiveId = "";

    if (existing) {
      nextSavedViews = savedViews.map((view) =>
        view.id === existing.id
          ? {
              ...view,
              snapshot: currentViewSnapshot,
              updatedAt: nowIso,
            }
          : view
      );
      nextActiveId = existing.id;
    } else {
      const newView = {
        id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: normalizedName,
        snapshot: currentViewSnapshot,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSavedViews = [newView, ...savedViews].slice(0, 20);
      nextActiveId = newView.id;
    }

    setSavedViews(nextSavedViews);
    setActiveSavedViewId(nextActiveId);
    setSavedViewName(normalizedName);
    setError("");
  };

  const applySavedView = (savedView) => {
    const snapshot = savedView?.snapshot || {};
    const nextColumns = {
      ...DEFAULT_VISIBLE_COLUMNS,
      ...(snapshot.visibleColumns || {}),
    };

    setActionFilter(snapshot.actionFilter || "");
    setTargetTypeFilter(snapshot.targetTypeFilter || "");
    setSearch(snapshot.search || "");
    setStartDate(snapshot.startDate || "");
    setEndDate(snapshot.endDate || "");
    setEventView(snapshot.eventView || EVENT_VIEW_ALL);
    setDenseRows(Boolean(snapshot.denseRows));
    setVisibleColumns(nextColumns);
    setIsFiltersVisible(snapshot.isFiltersVisible !== false);
    setPage(1);
    setActiveSavedViewId(savedView.id);
    setSavedViewName(savedView.name);
    syncQuery({
      nextActionFilter: snapshot.actionFilter || "",
      nextTargetTypeFilter: snapshot.targetTypeFilter || "",
      nextSearch: snapshot.search || "",
      nextStartDate: snapshot.startDate || "",
      nextEndDate: snapshot.endDate || "",
      nextPage: 1,
    });
  };

  const deleteSavedView = (viewId) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
    if (activeSavedViewId === viewId) {
      setActiveSavedViewId("");
    }
  };

  return (
    <AppShell
      title="Audit Logs"
      subtitle="Production-grade traceability across auth, onboarding, dispatch, commercial and operational workflows"
    >
      <div style={styles.stack}>
        <section style={styles.heroCard}>
          <div>
            <h3 style={styles.heroTitle}>Audit Command Center</h3>
            <p style={styles.heroSubtitle}>
              Fast forensic review with cleaner controls, richer visibility, and confident export-ready activity timelines.
            </p>
          </div>
          <div style={styles.heroActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setIsFiltersVisible((prev) => !prev)}
            >
              {isFiltersVisible ? "Hide Filters" : "Show Filters"}
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setDenseRows((prev) => !prev)}
            >
              {denseRows ? "Comfortable Rows" : "Compact Rows"}
            </button>
            <button
              type="button"
              style={styles.button}
              onClick={loadAuditLogs}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Logs"}
            </button>
          </div>
        </section>

        <SectionCard title="Audit Overview">
          <div style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.title}
                title={card.title}
                value={card.value}
                accent={card.accent}
              />
            ))}
          </div>

          <div style={styles.quickInsightsWrap}>
            <div style={styles.quickInsightBlock}>
              <p style={styles.quickInsightTitle}>Top Actions</p>
              <div style={styles.chipWrap}>
                {topActions.length ? (
                  topActions.map((action) => (
                    <button
                      type="button"
                      key={action}
                      style={styles.chipButton}
                      onClick={() => {
                        setActionFilter(action);
                        setPage(1);
                        syncQuery({ nextActionFilter: action, nextPage: 1 });
                      }}
                    >
                      {action}
                    </button>
                  ))
                ) : (
                  <span style={styles.mutedText}>No action facets yet</span>
                )}
              </div>
            </div>

            <div style={styles.quickInsightBlock}>
              <p style={styles.quickInsightTitle}>Top Target Types</p>
              <div style={styles.chipWrap}>
                {topTargetTypes.length ? (
                  topTargetTypes.map((targetType) => (
                    <button
                      type="button"
                      key={targetType}
                      style={styles.chipButton}
                      onClick={() => {
                        setTargetTypeFilter(targetType);
                        setPage(1);
                        syncQuery({ nextTargetTypeFilter: targetType, nextPage: 1 });
                      }}
                    >
                      {targetType}
                    </button>
                  ))
                ) : (
                  <span style={styles.mutedText}>No target facets yet</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {isFiltersVisible ? (
          <SectionCard title="Filters">
            <div style={styles.presetRow}>
              {AUDIT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    ...styles.presetButton,
                    ...(isPresetActive(preset) ? styles.presetButtonActive : {}),
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={styles.savedViewPanel}>
              <p style={styles.savedViewTitle}>Saved Views</p>
              <div style={styles.savedViewControls}>
                <input
                  value={savedViewName}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  placeholder="Name this current view (for example: Auth Failures)"
                  style={styles.input}
                />
                <button type="button" style={styles.secondaryButton} onClick={saveCurrentView}>
                  Save View
                </button>
              </div>
              <div style={styles.savedViewList}>
                {savedViews.length ? (
                  savedViews.map((view) => (
                    <div key={view.id} style={styles.savedViewItem}>
                      <button
                        type="button"
                        style={
                          activeSavedViewId === view.id
                            ? { ...styles.savedViewApplyButton, ...styles.savedViewApplyButtonActive }
                            : styles.savedViewApplyButton
                        }
                        onClick={() => applySavedView(view)}
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        style={styles.savedViewDeleteButton}
                        onClick={() => deleteSavedView(view.id)}
                        title="Delete saved view"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <span style={styles.mutedText}>No saved views yet</span>
                )}
              </div>
            </div>

            <div style={styles.filters}>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                style={styles.input}
              >
                <option value="">All Actions</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>

              <select
                value={targetTypeFilter}
                onChange={(event) => setTargetTypeFilter(event.target.value)}
                style={styles.input}
              >
                <option value="">All Targets</option>
                {targetTypeOptions.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {targetType}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearchSubmit();
                  }
                }}
                placeholder="Search actor, action, employee code, or details"
                style={styles.input}
              />

              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={styles.input}
              />

              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={styles.input}
              />

              <div style={styles.eventViewGroup}>
                <button
                  type="button"
                  style={
                    eventView === EVENT_VIEW_ALL
                      ? { ...styles.eventViewButton, ...styles.eventViewButtonActive }
                      : styles.eventViewButton
                  }
                  onClick={() => setEventView(EVENT_VIEW_ALL)}
                >
                  All Events
                </button>
                <button
                  type="button"
                  style={
                    eventView === EVENT_VIEW_USER
                      ? { ...styles.eventViewButton, ...styles.eventViewButtonActive }
                      : styles.eventViewButton
                  }
                  onClick={() => setEventView(EVENT_VIEW_USER)}
                >
                  User Events
                </button>
                <button
                  type="button"
                  style={
                    eventView === EVENT_VIEW_SYSTEM
                      ? { ...styles.eventViewButton, ...styles.eventViewButtonActive }
                      : styles.eventViewButton
                  }
                  onClick={() => setEventView(EVENT_VIEW_SYSTEM)}
                >
                  System Events
                </button>
              </div>

              <div style={styles.actionRow}>
                <button
                  style={styles.secondaryButton}
                  onClick={handleSearchSubmit}
                  disabled={loading}
                  type="button"
                >
                  Apply Filters
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={handleResetFilters}
                  disabled={loading}
                  type="button"
                >
                  Reset
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={handleExportCsv}
                  disabled={!visibleLogs.length}
                  type="button"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {activeFilterTokens.length > 0 ? (
              <div style={styles.activeFiltersRow}>
                {activeFilterTokens.map((token) => (
                  <button
                    type="button"
                    key={token.key}
                    style={styles.activeFilterToken}
                    onClick={() => clearFilterToken(token.key)}
                    title="Click to clear this filter"
                  >
                    {token.label} ×
                  </button>
                ))}
              </div>
            ) : null}

            {error && <div style={styles.messageError}>{error}</div>}
            {!error ? (
              <div style={styles.helperText}>
                Showing {visibleLogs.length} visible rows on page {meta.page} of {Math.max(meta.totalPages || 1, 1)}.
                Total matching server records: {meta.total}. Event-view toggle is applied client-side for operational triage speed.
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard title="Recent Activity">
          <div style={styles.columnToolbar}>
            <span style={styles.columnToolbarLabel}>Show / Hide Columns</span>
            <div style={styles.columnToggleRow}>
              {Object.entries({
                [COLUMN_KEY_TIME]: "Time",
                [COLUMN_KEY_ACTION]: "Action",
                [COLUMN_KEY_ACTOR]: "Actor",
                [COLUMN_KEY_TARGET]: "Target",
                [COLUMN_KEY_DETAILS]: "Details",
              }).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  style={
                    visibleColumns[key]
                      ? { ...styles.columnToggleButton, ...styles.columnToggleButtonActive }
                      : styles.columnToggleButton
                  }
                  onClick={() => toggleColumn(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {visibleColumns[COLUMN_KEY_TIME] ? <th style={styles.th}>Time</th> : null}
                  {visibleColumns[COLUMN_KEY_ACTION] ? <th style={styles.th}>Action</th> : null}
                  {visibleColumns[COLUMN_KEY_ACTOR] ? <th style={styles.th}>Actor</th> : null}
                  {visibleColumns[COLUMN_KEY_TARGET] ? <th style={styles.th}>Target</th> : null}
                  {visibleColumns[COLUMN_KEY_DETAILS] ? <th style={styles.th}>Details</th> : null}
                  <th style={styles.th}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.length === 0 ? (
                  <tr>
                    <td style={styles.emptyCell} colSpan={visibleColumnCount}>
                      {loading
                        ? "Loading audit logs..."
                        : "No audit records found for the current filters/event view."}
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map((log) => (
                    <tr key={log.id} style={denseRows ? styles.tableRowDense : undefined}>
                      {visibleColumns[COLUMN_KEY_TIME] ? (
                        <td style={styles.td}>{formatAuditTimestamp(log.createdAt)}</td>
                      ) : null}

                      {visibleColumns[COLUMN_KEY_ACTION] ? (
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...getActionBadgeTone(log.action),
                            }}
                          >
                            {log.action || "-"}
                          </span>
                        </td>
                      ) : null}

                      {visibleColumns[COLUMN_KEY_ACTOR] ? (
                        <td style={styles.td}>
                          <div style={styles.actorCell}>
                            <strong>{log.actorFullName || "System / Unknown"}</strong>
                            <span style={styles.mutedText}>
                              {log.actorEmployeeCode || log.actorUsername || "-"}
                            </span>
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns[COLUMN_KEY_TARGET] ? (
                        <td style={styles.td}>
                          <div style={styles.actorCell}>
                            <strong>{log.targetType || "-"}</strong>
                            <span style={styles.mutedText}>ID: {log.targetId ?? "-"}</span>
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns[COLUMN_KEY_DETAILS] ? (
                        <td style={styles.td}>
                          <pre style={styles.detailsPreview}>{formatDetailsPreview(log.details)}</pre>
                        </td>
                      ) : null}

                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.secondaryButtonSmall}
                          onClick={() => openLogInspector(log)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.paginationRow}>
            <button
              style={styles.secondaryButton}
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={loading || meta.page <= 1}
            >
              Previous
            </button>
            <div style={styles.paginationText}>
              Page {meta.page} of {Math.max(meta.totalPages || 1, 1)}
            </div>
            <button
              style={styles.secondaryButton}
              onClick={() =>
                handlePageChange(
                  Math.min(meta.page + 1, Math.max(meta.totalPages || 1, 1))
                )
              }
              disabled={loading || meta.page >= Math.max(meta.totalPages || 1, 1)}
            >
              Next
            </button>
          </div>
        </SectionCard>

        {selectedLog ? (
          <SectionCard title="Event Inspector">
            <div style={styles.inspectorHeader}>
              <div>
                <p style={styles.inspectorTitle}>{selectedLog.action || "Unknown Action"}</p>
                <p style={styles.inspectorMeta}>
                  {formatAuditTimestamp(selectedLog.createdAt)} | {selectedLog.targetType || "-"} | ID: {selectedLog.targetId ?? "-"}
                </p>
              </div>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setSelectedLog(null)}
              >
                Hide Inspector
              </button>
            </div>

            <div style={styles.inspectorGrid}>
              <div style={styles.inspectorBlock}>
                <p style={styles.inspectorLabel}>Actor</p>
                <p style={styles.inspectorValue}>{selectedLog.actorFullName || "System / Unknown"}</p>
                <p style={styles.inspectorMuted}>
                  {selectedLog.actorEmployeeCode || selectedLog.actorUsername || "No actor reference"}
                </p>
              </div>

              <div style={styles.inspectorBlock}>
                <p style={styles.inspectorLabel}>Context</p>
                <p style={styles.inspectorValue}>User Event: {selectedLog.actorUserId ? "Yes" : "No"}</p>
                <p style={styles.inspectorMuted}>Event ID: {selectedLog.id}</p>
              </div>

              <div style={{ ...styles.inspectorBlock, ...styles.inspectorBlockFull }}>
                <p style={styles.inspectorLabel}>Details Payload</p>
                <pre style={styles.inspectorDetails}>{formatDetails(selectedLog.details)}</pre>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}

const getActionBadgeTone = (action = "") => {
  const lower = String(action).toLowerCase();

  if (lower.includes("failed") || lower.includes("error") || lower.includes("rejected")) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (lower.includes("created") || lower.includes("saved") || lower.includes("completed")) {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (lower.includes("updated") || lower.includes("changed")) {
    return {
      background: "#fef9c3",
      color: "#854d0e",
    };
  }

  return {
    background: "#e0f2fe",
    color: "#075985",
  };
};

const formatDetails = (details) => {
  if (!details) return "-";

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

const formatDetailsPreview = (details) => {
  const normalized = formatDetails(details);
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180)}...`;
};

const parseAuditQuery = (searchValue) => {
  const params = new URLSearchParams(searchValue);

  return {
    actionFilter: params.get("action") || "",
    targetTypeFilter: params.get("targetType") || "",
    search: params.get("search") || "",
    startDate: params.get("startDate") || "",
    endDate: params.get("endDate") || "",
    page: Math.max(Number(params.get("page")) || 1, 1),
  };
};

const formatAuditTimestamp = (value) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const escapeCsvValue = (value) => {
  const normalizedValue = String(value ?? "");

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
};

const buildCsv = (rows) => {
  if (!rows.length) {
    return "time,action,actor_name,actor_reference,target_type,target_id,details\n";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
};

const loadSavedAuditViews = () => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(AUDIT_SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (view) =>
        view &&
        typeof view.id === "string" &&
        typeof view.name === "string" &&
        typeof view.snapshot === "object"
    );
  } catch {
    return [];
  }
};

const writeSavedAuditViews = (savedViews) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AUDIT_SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify(Array.isArray(savedViews) ? savedViews : [])
    );
  } catch {
    // Ignore storage write failures and keep in-memory state only.
  }
};

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  heroCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    borderRadius: "18px",
    padding: "20px 22px",
    background:
      "linear-gradient(120deg, rgba(15,23,42,0.97) 0%, rgba(30,64,175,0.92) 52%, rgba(13,148,136,0.88) 100%)",
    color: "#f8fafc",
    boxShadow: "0 16px 34px rgba(15,23,42,0.18)",
  },
  heroTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "800",
  },
  heroSubtitle: {
    margin: "8px 0 0 0",
    color: "#dbeafe",
    fontSize: "13px",
    lineHeight: 1.6,
    maxWidth: "720px",
  },
  heroActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  quickInsightsWrap: {
    marginTop: "16px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
  },
  quickInsightBlock: {
    border: "1px solid #dbe3f0",
    borderRadius: "12px",
    padding: "12px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  quickInsightTitle: {
    margin: "0 0 8px 0",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#334155",
    fontWeight: "700",
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chipButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: "700",
    fontSize: "12px",
    padding: "6px 10px",
    cursor: "pointer",
  },
  presetRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "14px",
  },
  presetButton: {
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
  },
  presetButtonActive: {
    background: "#0f172a",
    color: "#fff",
    border: "1px solid #0f172a",
  },
  savedViewPanel: {
    border: "1px solid #dbe3f0",
    borderRadius: "12px",
    padding: "12px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    marginBottom: "14px",
  },
  savedViewTitle: {
    margin: "0 0 8px 0",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#334155",
    fontWeight: "700",
  },
  savedViewControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
    alignItems: "center",
  },
  savedViewList: {
    marginTop: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  savedViewItem: {
    display: "inline-flex",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#fff",
  },
  savedViewApplyButton: {
    border: "none",
    borderRight: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  savedViewApplyButtonActive: {
    background: "#0f172a",
    color: "#fff",
    borderRight: "1px solid #0f172a",
  },
  savedViewDeleteButton: {
    border: "none",
    background: "#fff",
    color: "#b91c1c",
    padding: "7px 9px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    alignItems: "center",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    width: "100%",
  },
  eventViewGroup: {
    display: "inline-flex",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    overflow: "hidden",
    background: "#fff",
  },
  eventViewButton: {
    border: "none",
    borderRight: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  eventViewButtonActive: {
    background: "#0f172a",
    color: "#fff",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "600",
  },
  secondaryButtonSmall: {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "12px",
  },
  activeFiltersRow: {
    marginTop: "12px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  activeFilterToken: {
    border: "1px solid #93c5fd",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: "12px",
    fontWeight: "700",
    padding: "6px 10px",
    cursor: "pointer",
  },
  helperText: {
    marginTop: "14px",
    color: "#475569",
    fontSize: "13px",
  },
  messageError: {
    marginTop: "14px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "700",
  },
  columnToolbar: {
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  columnToolbarLabel: {
    color: "#334155",
    fontWeight: "700",
    fontSize: "13px",
  },
  columnToggleRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  columnToggleButton: {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#334155",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  columnToggleButtonActive: {
    background: "#0f172a",
    color: "#fff",
    border: "1px solid #0f172a",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "920px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  tableRowDense: {
    lineHeight: 1.2,
  },
  emptyCell: {
    padding: "24px 12px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },
  actorCell: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  mutedText: {
    color: "#64748b",
    fontSize: "12px",
  },
  detailsPreview: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#334155",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  paginationRow: {
    marginTop: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  paginationText: {
    color: "#475569",
    fontSize: "13px",
    fontWeight: "600",
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  inspectorTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#0f172a",
    fontWeight: "800",
  },
  inspectorMeta: {
    margin: "6px 0 0 0",
    color: "#64748b",
    fontSize: "12px",
  },
  inspectorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  inspectorBlock: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#fff",
    padding: "12px",
  },
  inspectorBlockFull: {
    gridColumn: "1 / -1",
  },
  inspectorLabel: {
    margin: "0 0 8px 0",
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: "800",
  },
  inspectorValue: {
    margin: 0,
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: "700",
  },
  inspectorMuted: {
    margin: "6px 0 0 0",
    color: "#64748b",
    fontSize: "12px",
  },
  inspectorDetails: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "#334155",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
};

export default AuditLogsPage;
