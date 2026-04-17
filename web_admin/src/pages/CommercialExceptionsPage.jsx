import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { formatDisplayDate, getTimestampFileLabel } from "../utils/date";

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

function CommercialExceptionsPage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    overdueOrdersCount: 0,
    partiesWithNoActiveRatesCount: 0,
    unlinkedDispatchesCount: 0,
    incompleteClosuresCount: 0,
    reviewedCount: 0,
    escalatedReviewedCount: 0,
    slaBreachedCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
    slaBreachedUnassignedCount: 0,
  });
  const [meta, setMeta] = useState({
    filteredCount: 0,
    filteredTotalCount: 0,
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 25,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewingKey, setReviewingKey] = useState("");
  const [assigningKey, setAssigningKey] = useState("");
  const [reviewNotes, setReviewNotes] = useState({});
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});

  const [partyFilter, setPartyFilter] = useState("");
  const [exceptionFilter, setExceptionFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [includeReviewed, setIncludeReviewed] = useState(true);
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [page, setPage] = useState(1);

  const loadParties = useCallback(async () => {
    try {
      const [partyResponse, employeeResponse] = await Promise.all([
        api.get("/parties"),
        api.get("/employees"),
      ]);
      setParties(partyResponse.data?.data || []);
      setEmployeeOptions(
        (employeeResponse.data?.data || []).filter(
          (employee) => String(employee.status || "").toLowerCase() === "active"
        )
      );
    } catch {
      setParties([]);
      setEmployeeOptions([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/dashboard/commercial-exceptions", {
        params: {
          partyId: partyFilter || undefined,
          exceptionType: exceptionFilter || undefined,
          assignedEmployeeId:
            assignedToMeOnly && currentUser?.employeeId
              ? currentUser.employeeId
              : undefined,
          dateFrom: dateFromFilter || undefined,
          dateTo: dateToFilter || undefined,
          includeReviewed,
          page,
          limit: 25,
        },
      });

      setItems(response.data?.data?.items || []);
      setSummary(
        response.data?.data?.summary || {
          total: 0,
          overdueOrdersCount: 0,
          partiesWithNoActiveRatesCount: 0,
          unlinkedDispatchesCount: 0,
          incompleteClosuresCount: 0,
          reviewedCount: 0,
          escalatedReviewedCount: 0,
          slaBreachedCount: 0,
          assignedCount: 0,
          unassignedCount: 0,
          slaBreachedUnassignedCount: 0,
        }
      );
      setMeta(
        response.data?.data?.meta || {
          filteredCount: 0,
          filteredTotalCount: 0,
          totalCount: 0,
          currentPage: 1,
          totalPages: 1,
          limit: 25,
          hasPreviousPage: false,
          hasNextPage: false,
        }
      );
      setError("");
    } catch {
      setError("Failed to load commercial exception data");
    } finally {
      setLoading(false);
    }
  }, [
    assignedToMeOnly,
    currentUser?.employeeId,
    dateFromFilter,
    dateToFilter,
    exceptionFilter,
    includeReviewed,
    page,
    partyFilter,
  ]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [
    assignedToMeOnly,
    dateFromFilter,
    dateToFilter,
    exceptionFilter,
    includeReviewed,
    partyFilter,
  ]);

  const unreviewedCount = Math.max(
    0,
    Number(summary.total || 0) - Number(summary.reviewedCount || 0)
  );
  const assignedCount = Number(summary.assignedCount || 0);
  const unassignedCount = Number(summary.unassignedCount || 0);
  const slaBreachedCount = Number(summary.slaBreachedCount || 0);
  const slaBreachedUnassignedCount = Number(summary.slaBreachedUnassignedCount || 0);
  const highlightedItem = items.find((item) => item.isSlaBreached) || items[0] || null;

  const controlNarrative = useMemo(() => {
    let title = "Commercial queue is under watch";
    let text =
      "Use this queue to separate issues that are merely pending from those that are officially late.";
    let tone = "calm";

    if (slaBreachedUnassignedCount > 0) {
      title = "Late exceptions still lack direct ownership";
      text = `${formatMetric(
        slaBreachedUnassignedCount
      )} SLA-breached item(s) are still unassigned, which is the highest commercial risk in the current queue.`;
      tone = "attention";
    } else if (slaBreachedCount > 0) {
      title = "Commercial exceptions have crossed SLA";
      text = `${formatMetric(
        slaBreachedCount
      )} item(s) are now officially late, but ownership and review actions are already in motion.`;
      tone = "strong";
    } else if (summary.total > 0) {
      title = "Queue is active but still within SLA tolerance";
      text = `${formatMetric(
        summary.total
      )} live exception row(s) need monitoring before they turn into late commercial exposure.`;
    }

    return { title, text, tone };
  }, [slaBreachedCount, slaBreachedUnassignedCount, summary.total]);

  const focusTiles = useMemo(
    () => [
      {
        label: "Late And Unassigned",
        value: formatMetric(slaBreachedUnassignedCount),
        note: "Highest immediate routing risk",
        tone: slaBreachedUnassignedCount > 0 ? "attention" : "calm",
      },
      {
        label: "Reviewed 48h+ Still Open",
        value: formatMetric(summary.escalatedReviewedCount),
        note: "Acknowledged but not truly closed",
        tone: Number(summary.escalatedReviewedCount || 0) > 0 ? "attention" : "strong",
      },
      {
        label: "Owned Exceptions",
        value: formatMetric(assignedCount),
        note: `${formatMetric(unassignedCount)} still waiting for an owner`,
        tone: assignedCount >= unassignedCount ? "strong" : "calm",
      },
      {
        label: "Current Highlight",
        value: highlightedItem ? formatExceptionLabel(highlightedItem.exceptionType) : "Queue Clear",
        note: highlightedItem?.reference || "No commercial exception needs action right now",
        tone: highlightedItem?.isSlaBreached ? "attention" : "calm",
      },
    ],
    [
      assignedCount,
      highlightedItem,
      slaBreachedUnassignedCount,
      summary.escalatedReviewedCount,
      unassignedCount,
    ]
  );

  const handleReviewItem = async (item) => {
    setReviewingKey(item.exceptionKey);
    setError("");
    setSuccess("");

    try {
      const reviewNote = String(reviewNotes[item.exceptionKey] || "").trim();
      await api.post("/dashboard/commercial-exceptions/review", {
        exceptionKey: item.exceptionKey,
        exceptionType: item.exceptionType,
        entityId: item.entityId,
        reference: item.reference,
        notes: reviewNote,
      });
      setReviewNotes((current) => {
        const next = { ...current };
        delete next[item.exceptionKey];
        return next;
      });
      setSuccess("Exception marked as reviewed");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to mark exception as reviewed");
    } finally {
      setReviewingKey("");
    }
  };

  const handleAssignItem = async (item) => {
    const assigneeEmployeeId = assignmentDrafts[item.exceptionKey] || "";

    if (!assigneeEmployeeId) {
      setError("Select an active employee before assigning ownership");
      setSuccess("");
      return;
    }

    setAssigningKey(item.exceptionKey);
    setError("");
    setSuccess("");

    try {
      await api.post("/dashboard/commercial-exceptions/assign", {
        exceptionKey: item.exceptionKey,
        exceptionType: item.exceptionType,
        entityId: item.entityId,
        reference: item.reference,
        assigneeEmployeeId,
      });
      setSuccess("Exception ownership assigned");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to assign exception owner");
    } finally {
      setAssigningKey("");
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) {
      setError("No exception rows match the current filters for export");
      setSuccess("");
      return;
    }

    const csv = buildCsv(
      items.map((item) => ({
        date: item.dateValue,
        exception_type: item.exceptionType,
        party: item.partyName || "",
        plant: item.plantName || "",
        material: item.materialName || "",
        reference: item.reference || "",
        detail: item.detail || "",
        sla_days: item.slaDays ?? "",
        exception_age_days: item.exceptionAgeDays ?? "",
        sla_breached: item.isSlaBreached ? "Yes" : "No",
      }))
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = getTimestampFileLabel();

    anchor.href = url;
    anchor.download = `commercial-exceptions-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    setSuccess("Commercial exceptions export downloaded");
    setError("");
  };

  return (
    <AppShell
      title="Commercial Exceptions"
      subtitle="Review overdue orders, missing rates, unlinked dispatches, and incomplete commercial closures from one operational queue."
    >
      <div style={styles.pageStack}>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        {loading && <div style={styles.infoBanner}>Refreshing commercial exceptions...</div>}

        <div
          style={{
            ...styles.heroPanel,
            ...(controlNarrative.tone === "attention"
              ? styles.heroPanelAttention
              : controlNarrative.tone === "strong"
                ? styles.heroPanelStrong
                : styles.heroPanelCalm),
          }}
        >
          <div style={styles.heroPanelCopy}>
            <p style={styles.heroEyebrow}>Commercial Control Tower</p>
            <h2 style={styles.heroTitle}>{controlNarrative.title}</h2>
            <p style={styles.heroText}>{controlNarrative.text}</p>
            <div style={styles.heroActions}>
              <button type="button" style={styles.button} onClick={loadData}>
                {loading ? "Refreshing..." : "Refresh Queue"}
              </button>
              <button type="button" style={styles.secondaryButton} onClick={handleExportCsv}>
                Export Current View
              </button>
              <Link to="/audit-logs" style={styles.ghostLink}>
                Audit Trail
              </Link>
            </div>
          </div>

          <div style={styles.heroPanelMeta}>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Queue Volume</span>
              <strong style={styles.heroMetaValue}>{formatMetric(meta.filteredTotalCount)}</strong>
              <span style={styles.heroMetaText}>Rows matching the current operational scope</span>
            </div>
            <div style={styles.heroMetaCard}>
              <span style={styles.heroMetaLabel}>Top Priority</span>
              <strong style={styles.heroMetaValue}>
                {highlightedItem
                  ? formatExceptionLabel(highlightedItem.exceptionType)
                  : "No active breach"}
              </strong>
              <span style={styles.heroMetaText}>
                {highlightedItem?.reference || "No live commercial exception needs escalation"}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.focusTileGrid}>
          {focusTiles.map((tile) => (
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

        <SectionCard title="Exception Snapshot">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Total</span>
              <p style={styles.summaryLabel}>Total Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.total)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Overdue</span>
              <p style={styles.summaryLabel}>Overdue Orders</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.overdueOrdersCount)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Rates</span>
              <p style={styles.summaryLabel}>Orders Missing Rates</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.partiesWithNoActiveRatesCount)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
              <span style={styles.summaryTag}>Linkage</span>
              <p style={styles.summaryLabel}>Unlinked Dispatches</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.unlinkedDispatchesCount)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryOrange }}>
              <span style={styles.summaryTag}>Closure</span>
              <p style={styles.summaryLabel}>Incomplete Closures</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.incompleteClosuresCount)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summarySlate }}>
              <span style={styles.summaryTag}>Reviewed</span>
              <p style={styles.summaryLabel}>Reviewed Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(summary.reviewedCount)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryMint }}>
              <span style={styles.summaryTag}>Unreviewed</span>
              <p style={styles.summaryLabel}>Unreviewed Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(unreviewedCount)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRed }}>
              <span style={styles.summaryTag}>Escalated</span>
              <p style={styles.summaryLabel}>Reviewed 48h+ Still Open</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(summary.escalatedReviewedCount)}
              </h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryRed }}>
              <span style={styles.summaryTag}>SLA</span>
              <p style={styles.summaryLabel}>SLA Breached Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(slaBreachedCount)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Assigned</span>
              <p style={styles.summaryLabel}>Owned Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(assignedCount)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Unassigned</span>
              <p style={styles.summaryLabel}>Unassigned Exceptions</p>
              <h3 style={styles.summaryValue}>{formatMetric(unassignedCount)}</h3>
            </div>
            <div style={{ ...styles.summaryCard, ...styles.summaryOrange }}>
              <span style={styles.summaryTag}>Risk</span>
              <p style={styles.summaryLabel}>Unassigned SLA Breaches</p>
              <h3 style={styles.summaryValue}>
                {formatMetric(slaBreachedUnassignedCount)}
              </h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Filters">
          <div style={styles.quickFilterRow}>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setExceptionFilter("overdue_order");
                setPage(1);
              }}
            >
              Focus Overdue Orders
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setExceptionFilter("active_order_missing_rate");
                setPage(1);
              }}
            >
              Focus Missing Rates
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setExceptionFilter("unlinked_dispatch");
                setPage(1);
              }}
            >
              Focus Dispatch Linkage
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setExceptionFilter("");
                setAssignedToMeOnly(true);
                setPage(1);
              }}
            >
              Show My Queue
            </button>
          </div>

          <div style={styles.form}>
            <select
              value={partyFilter}
              onChange={(event) => setPartyFilter(event.target.value)}
              style={styles.input}
            >
              <option value="">All Parties</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyName}
                </option>
              ))}
            </select>

            <select
              value={exceptionFilter}
              onChange={(event) => setExceptionFilter(event.target.value)}
              style={styles.input}
            >
              <option value="">All Exception Types</option>
              <option value="overdue_order">Overdue Orders</option>
              <option value="active_order_missing_rate">Active Orders Missing Rates</option>
              <option value="unlinked_dispatch">Unlinked Dispatches</option>
              <option value="incomplete_dispatch_closure">Incomplete Closures</option>
            </select>

            <input
              type="date"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
              style={styles.input}
            />

            <input
              type="date"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.actionRow}>
            <span style={styles.filterMeta}>
              Showing {formatMetric(items.length)} of {formatMetric(meta.filteredTotalCount)} active exception rows. Reviewed items remain visible until the underlying issue is actually fixed.
            </span>
            <div style={styles.actionButtons}>
              <label style={styles.toggleChip}>
                <input
                  type="checkbox"
                  checked={includeReviewed}
                  onChange={(event) => setIncludeReviewed(event.target.checked)}
                />
                <span>Include reviewed</span>
              </label>
              {currentUser?.employeeId ? (
                <label style={styles.toggleChip}>
                  <input
                    type="checkbox"
                    checked={assignedToMeOnly}
                    onChange={(event) => setAssignedToMeOnly(event.target.checked)}
                  />
                  <span>Assigned to me</span>
                </label>
              ) : null}
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setPartyFilter("");
                  setExceptionFilter("");
                  setDateFromFilter("");
                  setDateToFilter("");
                  setIncludeReviewed(true);
                  setAssignedToMeOnly(false);
                  setPage(1);
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

        <SectionCard title="Exception Queue">
          {items.length === 0 ? (
            <div style={styles.emptyState}>
              No commercial exceptions match the current filters.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Party</th>
                    <th style={styles.th}>Plant</th>
                    <th style={styles.th}>Material</th>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Detail</th>
                    <th style={styles.th}>SLA</th>
                    <th style={styles.th}>Owner</th>
                    <th style={styles.th}>Review</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      style={
                        item.isSlaBreached
                          ? styles.tableRowAttention
                          : item.isEscalated
                            ? styles.tableRowEscalated
                            : undefined
                      }
                    >
                      <td style={styles.td}>{formatDisplayDate(item.dateValue)}</td>
                      <td style={styles.td}>
                        <span style={styles.exceptionBadge}>
                          {formatExceptionLabel(item.exceptionType)}
                        </span>
                      </td>
                      <td style={styles.td}>{item.partyName || "-"}</td>
                      <td style={styles.td}>{item.plantName || "-"}</td>
                      <td style={styles.td}>{item.materialName || "-"}</td>
                      <td style={styles.td}>
                        <div style={styles.referenceTitle}>{item.reference || "-"}</div>
                        <div style={styles.referenceMeta}>
                          {formatExceptionLabel(item.exceptionType)}
                        </div>
                      </td>
                      <td style={styles.td}>{item.detail || "-"}</td>
                      <td style={styles.td}>
                        <div style={styles.reviewMeta}>
                          <span
                            style={{
                              ...styles.reviewBadge,
                              ...(item.isSlaBreached
                                ? styles.slaBreachedBadge
                                : styles.slaWithinBadge),
                            }}
                          >
                            {item.isSlaBreached ? "Breached" : "Within SLA"}
                          </span>
                          <span style={styles.reviewText}>
                            Age {item.exceptionAgeDays ?? 0}d
                            {Number.isFinite(item.slaDays)
                              ? ` • SLA ${item.slaDays}d`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        {item.assigneeEmployeeId ? (
                          <div style={styles.reviewMeta}>
                            <span style={styles.ownerBadge}>
                              {item.assigneeName || "Assigned"}
                            </span>
                            <span style={styles.reviewText}>
                              {item.assigneeEmployeeCode || "-"}
                              {item.assignedAt
                                ? ` • ${formatDisplayDate(item.assignedAt)}`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <div style={styles.reviewForm}>
                            <select
                              value={assignmentDrafts[item.exceptionKey] || ""}
                              onChange={(event) =>
                                setAssignmentDrafts((current) => ({
                                  ...current,
                                  [item.exceptionKey]: event.target.value,
                                }))
                              }
                              style={styles.reviewInput}
                            >
                              <option value="">Assign owner</option>
                              {employeeOptions.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.fullName} ({employee.employeeCode})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={() => handleAssignItem(item)}
                              disabled={assigningKey === item.exceptionKey}
                            >
                              {assigningKey === item.exceptionKey ? "Assigning..." : "Assign"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        {item.isReviewed ? (
                          <div style={styles.reviewMeta}>
                            <span style={styles.reviewBadge}>Reviewed</span>
                            <span style={styles.reviewText}>
                              {item.reviewedByName || "Reviewed"}{" "}
                              {item.reviewedAt
                                ? `• ${formatDisplayDate(item.reviewedAt)}`
                                : ""}
                            </span>
                            {item.isEscalated ? (
                              <span style={styles.escalationBadge}>
                                Escalated {item.reviewAgeDays}+ day(s)
                              </span>
                            ) : null}
                            {item.reviewNotes ? (
                              <span style={styles.reviewNote}>{item.reviewNotes}</span>
                            ) : null}
                          </div>
                        ) : (
                          <div style={styles.reviewForm}>
                            <input
                              type="text"
                              value={reviewNotes[item.exceptionKey] || ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [item.exceptionKey]: event.target.value,
                                }))
                              }
                              placeholder="Optional review note"
                              style={styles.reviewInput}
                            />
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={() => handleReviewItem(item)}
                              disabled={reviewingKey === item.exceptionKey}
                            >
                              {reviewingKey === item.exceptionKey
                                ? "Reviewing..."
                                : "Mark Reviewed"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <Link to={item.actionPath} style={styles.linkButton}>
                          {item.actionLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={styles.paginationRow}>
            <span style={styles.paginationText}>
              Page {formatMetric(meta.currentPage)} of {formatMetric(meta.totalPages)} • {formatMetric(meta.filteredTotalCount)} matching rows
            </span>
            <div style={styles.actionButtons}>
              <button
                type="button"
                style={styles.secondaryButton}
                disabled={!meta.hasPreviousPage || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                disabled={!meta.hasNextPage || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
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
  infoBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
  },
  heroPanel: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.9fr",
    gap: "18px",
    padding: "24px",
    borderRadius: "26px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 22px 48px rgba(15,23,42,0.08)",
  },
  heroPanelCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  heroPanelStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(255,255,255,0.96) 100%)",
  },
  heroPanelAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(254,242,242,0.96) 100%)",
  },
  heroPanelCopy: {
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
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "6px",
    alignItems: "center",
  },
  heroPanelMeta: {
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
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 18px 40px rgba(148, 163, 184, 0.12)",
  },
  summaryRose: {
    background: "linear-gradient(180deg, rgba(244,63,94,0.10), rgba(255,255,255,0.9))",
  },
  summaryAmber: {
    background: "linear-gradient(180deg, rgba(251,191,36,0.16), rgba(255,255,255,0.9))",
  },
  summaryBlue: {
    background: "linear-gradient(180deg, rgba(59,130,246,0.12), rgba(255,255,255,0.9))",
  },
  summaryPurple: {
    background: "linear-gradient(180deg, rgba(124,58,237,0.12), rgba(255,255,255,0.9))",
  },
  summaryOrange: {
    background: "linear-gradient(180deg, rgba(249,115,22,0.14), rgba(255,255,255,0.9))",
  },
  summarySlate: {
    background: "linear-gradient(180deg, rgba(71,85,105,0.12), rgba(255,255,255,0.9))",
  },
  summaryMint: {
    background: "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(255,255,255,0.9))",
  },
  summaryRed: {
    background: "linear-gradient(180deg, rgba(220,38,38,0.12), rgba(255,255,255,0.9))",
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
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  filterMeta: {
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  actionButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  toggleChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    background: "rgba(255,255,255,0.82)",
    color: "#0f172a",
    fontWeight: "600",
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
  ghostLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    background: "rgba(255,255,255,0.72)",
    color: "#0f172a",
    fontWeight: "700",
    textDecoration: "none",
  },
  emptyState: {
    padding: "24px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    color: "#475569",
    lineHeight: 1.6,
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
    lineHeight: 1.6,
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
  tableRowAttention: {
    background: "linear-gradient(90deg, rgba(254,242,242,0.95), rgba(255,255,255,0.98))",
  },
  tableRowEscalated: {
    background: "linear-gradient(90deg, rgba(255,247,237,0.92), rgba(255,255,255,0.98))",
  },
  exceptionBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "700",
  },
  referenceTitle: {
    color: "#0f172a",
    fontWeight: "700",
    lineHeight: 1.4,
  },
  referenceMeta: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
    marginTop: "4px",
  },
  reviewMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  reviewForm: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "190px",
  },
  reviewBadge: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
  },
  reviewText: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  escalationBadge: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: "700",
  },
  slaBreachedBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  slaWithinBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  ownerBadge: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "700",
  },
  reviewNote: {
    color: "#334155",
    fontSize: "12px",
    lineHeight: 1.5,
    padding: "8px 10px",
    borderRadius: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  reviewInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "#fff",
    color: "#0f172a",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 12px",
    borderRadius: "12px",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: "700",
    textDecoration: "none",
  },
};

export default CommercialExceptionsPage;
