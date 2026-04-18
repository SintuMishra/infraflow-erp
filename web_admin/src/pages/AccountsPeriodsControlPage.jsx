import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatUiDate,
  formatUiDateTime,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

function AccountsPeriodsControlPage() {
  const [periods, setPeriods] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [periodNotes, setPeriodNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [periodRes, historyRes] = await Promise.all([
        api.get("/accounts/masters/accounting-periods"),
        api.get("/accounts/general-ledger/workflow/history", {
          params: {
            entityType: "accounting_period",
            limit: 200,
          },
        }),
      ]);

      setPeriods(Array.isArray(periodRes.data?.data) ? periodRes.data.data : []);
      setHistoryRows(Array.isArray(historyRes.data?.data) ? historyRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load period controls"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const periodHistoryByEntity = useMemo(() => {
    const map = new Map();
    historyRows.forEach((row) => {
      if (!map.has(Number(row.entityId))) {
        map.set(Number(row.entityId), row);
      }
    });
    return map;
  }, [historyRows]);

  const summary = useMemo(
    () => ({
      open: periods.filter((period) => period.status === "open").length,
      softClosed: periods.filter((period) => period.status === "soft_closed").length,
      closed: periods.filter((period) => period.status === "closed").length,
    }),
    [periods]
  );

  const updatePeriodStatus = async (periodId, status) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/accounts/masters/accounting-periods/${periodId}/status`, {
        status,
        statusNotes: periodNotes[periodId] || "",
      });
      setMessage(`Period ${status} action completed`);
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to update period status"));
    }
  };

  const exportPeriodsCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "accounting-periods",
      columns: [
        { key: "periodCode", header: "Period Code" },
        { key: "periodStart", header: "Period Start" },
        { key: "periodEnd", header: "Period End" },
        { key: "status", header: "Status" },
        { key: "closedBy", header: "Closed By" },
        { key: "reopenedBy", header: "Reopened By" },
        { key: "statusNotes", header: "Status Notes" },
      ],
      rows: periods.map((period) => ({
        periodCode: period.periodCode,
        periodStart: formatUiDate(period.periodStart),
        periodEnd: formatUiDate(period.periodEnd),
        status: period.status,
        closedBy: period.closedByDisplayName || period.closedByUserId || "-",
        reopenedBy: period.reopenedByDisplayName || period.reopenedByUserId || "-",
        statusNotes: period.statusNotes || "",
      })),
    });

    if (!exported) {
      setError("No period rows available to export");
      return;
    }

    setMessage("Accounting periods CSV exported");
  };

  const exportPeriodHistoryCsv = async () => {
    setError("");
    setMessage("");
    try {
      const response = await api.get("/accounts/general-ledger/workflow/history", {
        params: {
          entityType: "accounting_period",
          format: "csv",
          limit: 1000,
          page: 1,
        },
        responseType: "blob",
      });

      const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `period-control-history-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Period transition history CSV exported");
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to export period transition history"));
    }
  };

  return (
    <AppShell title="Accounting Period Controls" subtitle="Close, reopen, and evidence period governance for posting discipline">
      <SectionCard title="Period Operations">
        <div style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" style={styles.mutedButton} onClick={exportPeriodsCsv}>
            Export Period CSV
          </button>
          <button type="button" style={styles.mutedButton} onClick={exportPeriodHistoryCsv}>
            Export History CSV
          </button>
          {message ? <span style={styles.success}>{message}</span> : null}
          {error ? <span style={styles.error}>{error}</span> : null}
        </div>

        <div style={styles.statGrid}>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Open</p>
            <p style={styles.statValue}>{summary.open}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Soft Closed</p>
            <p style={styles.statValue}>{summary.softClosed}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Closed</p>
            <p style={styles.statValue}>{summary.closed}</p>
          </article>
        </div>

        <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Closed By</th>
                <th style={styles.th}>Reopened By</th>
                <th style={styles.th}>Evidence</th>
                <th style={styles.th}>Remarks</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const evidence = periodHistoryByEntity.get(Number(period.id));
                return (
                  <tr key={period.id}>
                    <td style={styles.td}>{period.periodCode}</td>
                    <td style={styles.td}>
                      {formatUiDate(period.periodStart)} to {formatUiDate(period.periodEnd)}
                    </td>
                    <td style={styles.td}>
                      <span style={getStatusBadgeStyle(period.status)}>{period.status}</span>
                    </td>
                    <td style={styles.td}>{period.closedByDisplayName || period.closedByUserId || "-"}</td>
                    <td style={styles.td}>{period.reopenedByDisplayName || period.reopenedByUserId || "-"}</td>
                    <td style={styles.td}>
                      {evidence ? (
                        <>
                          <div>{evidence.action}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            {evidence.performedByDisplayName || `user ${evidence.performedByUserId || "-"}`} · {formatUiDateTime(evidence.createdAt)}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={styles.td}>
                      <input
                        style={{ ...styles.input, minWidth: "220px" }}
                        placeholder="Close/reopen remarks"
                        value={periodNotes[period.id] || period.statusNotes || ""}
                        onChange={(e) =>
                          setPeriodNotes((prev) => ({
                            ...prev,
                            [period.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={styles.toolbar}>
                        {period.status !== "soft_closed" ? (
                          <button type="button" style={styles.mutedButton} onClick={() => updatePeriodStatus(period.id, "soft_closed")}>
                            Soft Close
                          </button>
                        ) : null}
                        {period.status !== "closed" ? (
                          <button type="button" style={styles.mutedButton} onClick={() => updatePeriodStatus(period.id, "closed")}>
                            Close
                          </button>
                        ) : null}
                        {period.status !== "open" ? (
                          <button type="button" style={styles.button} onClick={() => updatePeriodStatus(period.id, "open")}>
                            Reopen
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {periods.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={8}>
                    {loading ? "Loading periods..." : "No accounting periods configured yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Period Compliance History">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Latest transition history for accounting period close/reopen actions.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowHistory((prev) => !prev)}>
            {showHistory ? "Hide History" : "Show History"}
          </button>
        </div>

        {showHistory ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>From</th>
                  <th style={styles.th}>To</th>
                  <th style={styles.th}>Actor</th>
                  <th style={styles.th}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{formatUiDateTime(row.createdAt)}</td>
                    <td style={styles.td}>{row.action}</td>
                    <td style={styles.td}>{row.fromState || "-"}</td>
                    <td style={styles.td}>{row.toState || "-"}</td>
                    <td style={styles.td}>{row.performedByDisplayName || row.performedByUserId || "-"}</td>
                    <td style={styles.td}>{row.remarks || "-"}</td>
                  </tr>
                ))}
                {historyRows.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      No period transition history available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </AppShell>
  );
}

export default AccountsPeriodsControlPage;
