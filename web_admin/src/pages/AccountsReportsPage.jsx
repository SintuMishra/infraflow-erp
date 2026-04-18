import { useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatAmount,
  resolveApiErrorMessage,
} from "./accountsCommon";

const REPORT_OPTIONS = [
  { key: "trial-balance", label: "Trial Balance" },
  { key: "voucher-register", label: "Voucher Register" },
  { key: "receivable-ageing", label: "Receivable Ageing" },
  { key: "payable-ageing", label: "Payable Ageing" },
  { key: "cash-book", label: "Cash Book" },
  { key: "bank-book", label: "Bank Book" },
  { key: "finance-transition-history", label: "Finance Transition History" },
];

function AccountsReportsPage() {
  const [reportKey, setReportKey] = useState("trial-balance");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyAction, setHistoryAction] = useState("");
  const [historyEntityType, setHistoryEntityType] = useState("");
  const [historyActor, setHistoryActor] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  const isHistoryReport = reportKey === "finance-transition-history";
  const isAgeingReport = reportKey === "receivable-ageing" || reportKey === "payable-ageing";

  const runQueryParams = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      asOfDate: isAgeingReport ? asOfDate : undefined,
      action: isHistoryReport ? historyAction || undefined : undefined,
      entityType: isHistoryReport ? historyEntityType || undefined : undefined,
      performedByUserId: isHistoryReport ? historyActor || undefined : undefined,
      limit: isHistoryReport ? 300 : undefined,
    }),
    [asOfDate, dateFrom, dateTo, historyAction, historyActor, historyEntityType, isAgeingReport, isHistoryReport]
  );

  const loadReport = async () => {
    setError("");
    setMessage("");
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setError("dateTo cannot be earlier than dateFrom");
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(
        isHistoryReport ? "/accounts/general-ledger/workflow/history" : `/accounts/reports/${reportKey}`,
        { params: runQueryParams }
      );

      const reportData = response.data?.data;
      if (response.data?.meta?.total >= 0) {
        const actionCounts = (Array.isArray(reportData) ? reportData : []).reduce((acc, row) => {
          const action = String(row.action || "unknown");
          acc[action] = (acc[action] || 0) + 1;
          return acc;
        }, {});
        setSummary({
          totalRows: Number(response.data.meta.total || 0),
          page: Number(response.data.meta.page || 1),
          limit: Number(response.data.meta.limit || 0),
          ...actionCounts,
        });
      } else if (reportData?.bucketTotals) {
        setSummary(reportData.bucketTotals);
      } else if (reportData?.totals) {
        setSummary(reportData.totals);
      } else {
        setSummary(null);
      }

      if (Array.isArray(reportData)) {
        setRows(reportData);
      } else if (Array.isArray(reportData?.rows)) {
        setRows(reportData.rows);
      } else if (Array.isArray(reportData?.items)) {
        setRows(reportData.items);
      } else if (Array.isArray(reportData?.lines)) {
        setRows(reportData.lines);
      } else {
        setRows([]);
      }
      setMessage("Report loaded successfully");
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load report"));
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  const exportCurrentRowsCsv = async () => {
    setError("");
    setMessage("");

    if (!rows.length) {
      setError("No report rows available to export");
      return;
    }

    if (isHistoryReport) {
      try {
        const response = await api.get("/accounts/general-ledger/workflow/history", {
          params: {
            ...runQueryParams,
            format: "csv",
            limit: 1000,
            page: 1,
          },
          responseType: "blob",
        });

        const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `finance-transition-history-${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setMessage("Transition history CSV exported");
        return;
      } catch (err) {
        setError(resolveApiErrorMessage(err, "Failed to export transition history CSV"));
        return;
      }
    }

    const exported = downloadCsvFile({
      filePrefix: `accounts-${reportKey}`,
      columns: columns.map((column) => ({ key: column, header: column })),
      rows: rows.map((row) => ({
        ...row,
        debit: row.debit ?? undefined,
        credit: row.credit ?? undefined,
        amount: row.amount ?? undefined,
        outstandingAmount: row.outstandingAmount ?? undefined,
      })),
    });

    if (!exported) {
      setError("No report rows available to export");
      return;
    }

    setMessage("CSV export completed");
  };

  return (
    <AppShell title="Finance Reports" subtitle="Trial balance, ageing, cash/bank books, and workflow compliance views">
      <SectionCard title="Report Controls">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Use date range and workflow filters to run accountant-ready report outputs.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
        {showFilters ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={reportKey} onChange={(e) => setReportKey(e.target.value)}>
              {REPORT_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <input style={styles.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input style={styles.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {isHistoryReport ? (
              <>
                <select style={styles.input} value={historyEntityType} onChange={(e) => setHistoryEntityType(e.target.value)}>
                  <option value="">All Entities</option>
                  <option value="voucher">Voucher</option>
                  <option value="accounting_period">Accounting Period</option>
                </select>
                <select style={styles.input} value={historyAction} onChange={(e) => setHistoryAction(e.target.value)}>
                  <option value="">All Actions</option>
                  <option value="create">create</option>
                  <option value="submit">submit</option>
                  <option value="approve">approve</option>
                  <option value="post">post</option>
                  <option value="reject">reject</option>
                  <option value="reverse">reverse</option>
                  <option value="close">close</option>
                  <option value="reopen">reopen</option>
                </select>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  placeholder="Actor User ID"
                  value={historyActor}
                  onChange={(e) => setHistoryActor(e.target.value)}
                />
              </>
            ) : null}
            {isAgeingReport ? (
              <input style={styles.input} type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            ) : null}
            <button type="button" style={styles.button} onClick={loadReport}>
              {loading ? "Running..." : "Run Report"}
            </button>
            <button type="button" style={styles.mutedButton} onClick={exportCurrentRowsCsv}>
              Export CSV
            </button>
          </div>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Report Output">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Table updates are live from backend report endpoints in company scope.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowSummary((prev) => !prev)}>
            {showSummary ? "Hide Summary" : "Show Summary"}
          </button>
        </div>

        {showSummary && summary ? (
          <div style={{ ...styles.statGrid, marginBottom: "14px" }}>
            {Object.entries(summary).map(([key, value]) => (
              <article key={key} style={styles.statCard}>
                <p style={styles.statLabel}>{key}</p>
                <p style={styles.statValue}>
                  {/debit|credit|amount|balance|outstanding|total/i.test(key)
                    ? formatAmount(value)
                    : String(value)}
                </p>
              </article>
            ))}
          </div>
        ) : null}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} style={styles.th}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`row-${index}`}>
                  {columns.map((column) => {
                    const value = row[column];
                    const isAmountLike = /debit|credit|amount|balance|outstanding/i.test(column);
                    return (
                      <td key={`${index}-${column}`} style={styles.td}>
                        {isAmountLike && typeof value !== "string" ? formatAmount(value) : String(value ?? "-")}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={Math.max(columns.length, 1)}>
                    {loading ? "Loading report..." : "Run a report to view or export data."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}

export default AccountsReportsPage;
