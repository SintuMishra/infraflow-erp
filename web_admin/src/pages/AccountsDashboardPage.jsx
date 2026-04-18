import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatAmount,
  formatUiDate,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

function AccountsDashboardPage() {
  const [trialBalance, setTrialBalance] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [periodNotes, setPeriodNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPeriods, setShowPeriods] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [tbRes, arRes, apRes, periodRes] = await Promise.all([
        api.get("/accounts/reports/trial-balance"),
        api.get("/accounts/receivables"),
        api.get("/accounts/payables"),
        api.get("/accounts/masters/accounting-periods"),
      ]);

      setTrialBalance(tbRes.data?.data?.rows || []);
      setReceivables(Array.isArray(arRes.data?.data) ? arRes.data.data : []);
      setPayables(Array.isArray(apRes.data?.data) ? apRes.data.data : []);
      setPeriods(Array.isArray(periodRes.data?.data) ? periodRes.data.data : []);
      setMessage("Dashboard refreshed");
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load accounts dashboard"));
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

  const metrics = useMemo(() => {
    const tbDebit = trialBalance.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const tbCredit = trialBalance.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const arOutstanding = receivables.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);
    const apOutstanding = payables.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);

    return {
      tbDebit,
      tbCredit,
      arOutstanding,
      apOutstanding,
      voucherGap: Math.abs(tbDebit - tbCredit),
      openPeriods: periods.filter((period) => period.status === "open").length,
      closedPeriods: periods.filter((period) => period.status === "closed").length,
    };
  }, [trialBalance, receivables, payables, periods]);

  const updatePeriodStatus = async (periodId, status) => {
    setError("");
    setMessage("");
    try {
      await api.patch(`/accounts/masters/accounting-periods/${periodId}/status`, {
        status,
        statusNotes: periodNotes[periodId] || "",
      });
      setMessage(`Period updated to ${status}`);
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to update period status"));
    }
  };

  const exportSnapshotCsv = () => {
    const exported = downloadCsvFile({
      filePrefix: "accounts-dashboard-snapshot",
      columns: [
        { key: "metric", header: "Metric" },
        { key: "value", header: "Value" },
      ],
      rows: [
        { metric: "Trial Balance Debit", value: metrics.tbDebit.toFixed(2) },
        { metric: "Trial Balance Credit", value: metrics.tbCredit.toFixed(2) },
        { metric: "AR Outstanding", value: metrics.arOutstanding.toFixed(2) },
        { metric: "AP Outstanding", value: metrics.apOutstanding.toFixed(2) },
        { metric: "Balance Difference", value: metrics.voucherGap.toFixed(2) },
        { metric: "Open Periods", value: String(metrics.openPeriods) },
        { metric: "Closed Periods", value: String(metrics.closedPeriods) },
      ],
    });

    if (!exported) {
      setError("Unable to export dashboard snapshot");
      return;
    }

    setMessage("Dashboard snapshot CSV exported");
  };

  return (
    <AppShell title="Accounts Dashboard" subtitle="Production finance control: books health, receivables, payables, and period discipline">
      <SectionCard title="Finance Snapshot">
        <div style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" style={styles.mutedButton} onClick={exportSnapshotCsv}>
            Export Snapshot CSV
          </button>
          {message ? <span style={styles.success}>{message}</span> : null}
          {error ? <span style={styles.error}>{error}</span> : null}
        </div>

        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Trial Balance Debit</p>
            <p style={styles.statValue}>{formatAmount(metrics.tbDebit)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Trial Balance Credit</p>
            <p style={styles.statValue}>{formatAmount(metrics.tbCredit)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>AR Outstanding</p>
            <p style={styles.statValue}>{formatAmount(metrics.arOutstanding)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>AP Outstanding</p>
            <p style={styles.statValue}>{formatAmount(metrics.apOutstanding)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Balance Difference</p>
            <p style={styles.statValue}>{formatAmount(metrics.voucherGap)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Open Periods</p>
            <p style={styles.statValue}>{metrics.openPeriods}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Period Control">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Inline close/reopen operations for finance control users.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowPeriods((prev) => !prev)}>
            {showPeriods ? "Hide Periods" : "Show Periods"}
          </button>
        </div>

        {showPeriods ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Code</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Closed By</th>
                  <th style={styles.th}>Reopened By</th>
                  <th style={styles.th}>Remarks</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
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
                ))}
                {periods.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={7}>
                      No accounting periods configured.
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

export default AccountsDashboardPage;
