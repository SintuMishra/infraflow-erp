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

function AccountsReceivablesPage() {
  const [dispatchRows, setDispatchRows] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [settleDrafts, setSettleDrafts] = useState({});
  const [defaultDueDate, setDefaultDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDispatchPanel, setShowDispatchPanel] = useState(true);
  const [showSettlementPanel, setShowSettlementPanel] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [dispatchRes, receivableRes] = await Promise.all([
        api.get("/dispatch-reports", { params: { limit: 80, status: "completed" } }),
        api.get("/accounts/receivables"),
      ]);

      const dispatchData = Array.isArray(dispatchRes.data?.data) ? dispatchRes.data.data : [];
      setDispatchRows(dispatchData);
      setReceivables(Array.isArray(receivableRes.data?.data) ? receivableRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load receivables workspace"));
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

  const filteredReceivables = useMemo(() => {
    return receivables.filter((row) => {
      if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const needle = search.trim().toLowerCase();
      return [row.invoiceNumber, row.partyName, row.status, row.referenceNumber]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle));
    });
  }, [receivables, search, statusFilter]);

  const receivableSummary = useMemo(
    () => ({
      totalRows: filteredReceivables.length,
      totalOutstanding: filteredReceivables.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0),
      overdueRows: filteredReceivables.filter((row) => Number(row.overdueDays || 0) > 0).length,
    }),
    [filteredReceivables]
  );

  const markReady = async (dispatchId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/receivables/dispatch/${dispatchId}/mark-ready`, {
        financeNotes: "Reviewed and approved for receivable posting",
      });
      setMessage("Dispatch marked ready for finance posting");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to mark dispatch ready"));
    }
  };

  const createReceivable = async (dispatchId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/receivables/dispatch/${dispatchId}/create`, {
        dueDate: defaultDueDate,
      });
      setMessage("Receivable posted from dispatch");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to create receivable"));
    }
  };

  const settle = async (row) => {
    const receivableId = row.id;
    const draft = settleDrafts[receivableId] || {};
    const amount = Number(draft.amount || 0);
    const outstandingAmount = Number(row.outstandingAmount || 0);
    setError("");
    setMessage("");

    if (!(amount > 0)) {
      setError("Settlement amount must be greater than zero");
      return;
    }

    if (amount > outstandingAmount) {
      setError("Settlement amount cannot exceed outstanding amount");
      return;
    }

    try {
      await api.post(`/accounts/receivables/${receivableId}/settle`, {
        amount,
        settlementDate: draft.settlementDate || new Date().toISOString().slice(0, 10),
        referenceNumber: draft.referenceNumber || "",
        notes: draft.notes || "",
      });
      setMessage("Receivable settlement posted");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to settle receivable"));
    }
  };

  const exportReceivablesCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "accounts-receivables",
      columns: [
        { key: "invoiceNumber", header: "Invoice" },
        { key: "partyName", header: "Party" },
        { key: "invoiceDate", header: "Invoice Date" },
        { key: "dueDate", header: "Due Date" },
        { key: "amount", header: "Amount" },
        { key: "outstandingAmount", header: "Outstanding" },
        { key: "status", header: "Status" },
      ],
      rows: filteredReceivables.map((row) => ({
        invoiceNumber: row.invoiceNumber || `AR-${row.id}`,
        partyName: row.partyName || "-",
        invoiceDate: formatUiDate(row.invoiceDate),
        dueDate: formatUiDate(row.dueDate),
        amount: Number(row.amount || 0).toFixed(2),
        outstandingAmount: Number(row.outstandingAmount || 0).toFixed(2),
        status: row.status || "-",
      })),
    });

    if (!exported) {
      setError("No receivable rows available to export");
      return;
    }
    setMessage("Receivables CSV exported");
  };

  const exportDispatchControlCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "dispatch-finance-control",
      columns: [
        { key: "dispatchId", header: "Dispatch ID" },
        { key: "invoiceNumber", header: "Invoice" },
        { key: "partyName", header: "Party" },
        { key: "amount", header: "Amount" },
        { key: "financeStatus", header: "Finance Status" },
      ],
      rows: dispatchRows.map((dispatch) => ({
        dispatchId: dispatch.id,
        invoiceNumber: dispatch.invoiceNumber || "-",
        partyName: dispatch.partyName || "-",
        amount: Number(dispatch.totalInvoiceValue || dispatch.invoiceValue || 0).toFixed(2),
        financeStatus: dispatch.financeStatus || "not_ready",
      })),
    });

    if (!exported) {
      setError("No dispatch rows available to export");
      return;
    }
    setMessage("Dispatch finance control CSV exported");
  };

  return (
    <AppShell title="Accounts Receivable" subtitle="Dispatch-linked receivable posting, settlement safety, and export-ready controls">
      <SectionCard title="Dispatch Finance Control">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Use this queue for mark-ready and AR posting from completed dispatch rows.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowDispatchPanel((prev) => !prev)}>
            {showDispatchPanel ? "Hide Queue" : "Show Queue"}
          </button>
        </div>

        {showDispatchPanel ? (
          <>
            <div style={styles.toolbar}>
              <input style={styles.input} type="date" value={defaultDueDate} onChange={(e) => setDefaultDueDate(e.target.value)} />
              <button style={styles.mutedButton} type="button" onClick={load}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button style={styles.mutedButton} type="button" onClick={exportDispatchControlCsv}>
                Export CSV
              </button>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Dispatch ID</th>
                    <th style={styles.th}>Invoice</th>
                    <th style={styles.th}>Party</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Finance Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchRows.map((dispatch) => (
                    <tr key={dispatch.id}>
                      <td style={styles.td}>#{dispatch.id}</td>
                      <td style={styles.td}>{dispatch.invoiceNumber || "-"}</td>
                      <td style={styles.td}>{dispatch.partyName || "-"}</td>
                      <td style={styles.td}>{formatAmount(dispatch.totalInvoiceValue || dispatch.invoiceValue)}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(dispatch.financeStatus || "not_ready")}>
                          {dispatch.financeStatus || "not_ready"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.toolbar}>
                          <button type="button" style={styles.mutedButton} onClick={() => markReady(dispatch.id)}>
                            Mark Ready
                          </button>
                          <button type="button" style={styles.button} onClick={() => createReceivable(dispatch.id)}>
                            Post AR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {dispatchRows.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={6}>
                        {loading ? "Loading completed dispatch rows..." : "No completed dispatch rows found."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Open Receivables">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Filter open items by status/search and settle only valid outstanding amounts.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowSettlementPanel((prev) => !prev)}>
            {showSettlementPanel ? "Hide Receivables" : "Show Receivables"}
          </button>
        </div>

        {showSettlementPanel ? (
          <>
            <div style={styles.toolbar}>
              <input
                style={{ ...styles.input, minWidth: "220px" }}
                placeholder="Search invoice / party"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="partial">Partial</option>
                <option value="settled">Settled</option>
              </select>
              <button type="button" style={styles.mutedButton} onClick={exportReceivablesCsv}>
                Export CSV
              </button>
            </div>

            <div style={styles.statGrid}>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Visible Items</p>
                <p style={styles.statValue}>{receivableSummary.totalRows}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Visible Outstanding</p>
                <p style={styles.statValue}>{formatAmount(receivableSummary.totalOutstanding)}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Overdue Items</p>
                <p style={styles.statValue}>{receivableSummary.overdueRows}</p>
              </article>
            </div>

            <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Invoice</th>
                    <th style={styles.th}>Party</th>
                    <th style={styles.th}>Due</th>
                    <th style={styles.th}>Outstanding</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivables.map((row) => (
                    <tr key={row.id}>
                      <td style={styles.td}>{row.invoiceNumber || `AR-${row.id}`}</td>
                      <td style={styles.td}>{row.partyName || "-"}</td>
                      <td style={styles.td}>{formatUiDate(row.dueDate)}</td>
                      <td style={styles.td}>{formatAmount(row.outstandingAmount)}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(row.status)}>{row.status}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.toolbar}>
                          <input
                            style={{ ...styles.input, minWidth: "90px" }}
                            type="number"
                            placeholder="Amount"
                            value={settleDrafts[row.id]?.amount || ""}
                            onChange={(e) =>
                              setSettleDrafts((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] || {}),
                                  amount: e.target.value,
                                },
                              }))
                            }
                          />
                          <input
                            style={styles.input}
                            type="date"
                            value={settleDrafts[row.id]?.settlementDate || new Date().toISOString().slice(0, 10)}
                            onChange={(e) =>
                              setSettleDrafts((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] || {}),
                                  settlementDate: e.target.value,
                                },
                              }))
                            }
                          />
                          <button type="button" style={styles.mutedButton} onClick={() => settle(row)}>
                            Settle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReceivables.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={6}>
                        {loading ? "Loading receivable rows..." : "No receivable rows found for the current filters."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>
    </AppShell>
  );
}

export default AccountsReceivablesPage;
