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

const INITIAL_BILL_DRAFT = {
  partyId: "",
  vendorId: "",
  referenceNumber: "",
  billDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  amount: "",
};

function AccountsPayablesPage() {
  const [payables, setPayables] = useState([]);
  const [parties, setParties] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [billDraft, setBillDraft] = useState(INITIAL_BILL_DRAFT);
  const [settleDrafts, setSettleDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(true);
  const [showSettlePanel, setShowSettlePanel] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [payableRes, partyRes, vendorRes] = await Promise.all([
        api.get("/accounts/payables"),
        api.get("/parties"),
        api.get("/vendors"),
      ]);

      setPayables(Array.isArray(payableRes.data?.data) ? payableRes.data.data : []);
      setParties(Array.isArray(partyRes.data?.data) ? partyRes.data.data : []);
      setVendors(Array.isArray(vendorRes.data?.data) ? vendorRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load payables workspace"));
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

  const filteredPayables = useMemo(() => {
    return payables.filter((row) => {
      if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const needle = search.trim().toLowerCase();
      return [row.referenceNumber, row.vendorName, row.partyName, row.status]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle));
    });
  }, [payables, search, statusFilter]);

  const summary = useMemo(
    () => ({
      totalRows: filteredPayables.length,
      totalOutstanding: filteredPayables.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0),
      overdueRows: filteredPayables.filter((row) => Number(row.overdueDays || 0) > 0).length,
    }),
    [filteredPayables]
  );

  const createBill = async () => {
    setError("");
    setMessage("");
    if (billDraft.dueDate && billDraft.billDate && billDraft.dueDate < billDraft.billDate) {
      setError("Due date cannot be earlier than bill date");
      return;
    }

    try {
      await api.post("/accounts/payables", {
        ...billDraft,
        partyId: billDraft.partyId ? Number(billDraft.partyId) : null,
        vendorId: billDraft.vendorId ? Number(billDraft.vendorId) : null,
        amount: Number(billDraft.amount || 0),
      });
      setMessage("Payable bill created");
      setBillDraft(INITIAL_BILL_DRAFT);
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to create payable bill"));
    }
  };

  const settle = async (payableId) => {
    const draft = settleDrafts[payableId] || {};
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/payables/${payableId}/settle`, {
        amount: Number(draft.amount || 0),
        settlementDate: draft.settlementDate || new Date().toISOString().slice(0, 10),
        referenceNumber: draft.referenceNumber || "",
      });
      setMessage("Payable settled");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to settle payable"));
    }
  };

  const exportPayablesCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "accounts-payables",
      columns: [
        { key: "referenceNumber", header: "Reference" },
        { key: "counterparty", header: "Counterparty" },
        { key: "billDate", header: "Bill Date" },
        { key: "dueDate", header: "Due Date" },
        { key: "amount", header: "Amount" },
        { key: "outstandingAmount", header: "Outstanding" },
        { key: "status", header: "Status" },
      ],
      rows: filteredPayables.map((row) => ({
        referenceNumber: row.referenceNumber || `AP-${row.id}`,
        counterparty: row.vendorName || row.partyName || "-",
        billDate: formatUiDate(row.billDate),
        dueDate: formatUiDate(row.dueDate),
        amount: Number(row.amount || 0).toFixed(2),
        outstandingAmount: Number(row.outstandingAmount || 0).toFixed(2),
        status: row.status || "-",
      })),
    });

    if (!exported) {
      setError("No payable rows available to export");
      return;
    }
    setMessage("Payables CSV exported");
  };

  return (
    <AppShell title="Accounts Payable" subtitle="Supplier/party bills, AP settlement discipline, and export-ready controls">
      <SectionCard title="Create Payable Bill">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Create AP bills with bill-date vs due-date checks before posting.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowCreatePanel((prev) => !prev)}>
            {showCreatePanel ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showCreatePanel ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={billDraft.partyId} onChange={(e) => setBillDraft((p) => ({ ...p, partyId: e.target.value }))}>
              <option value="">Party (optional)</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyName}
                </option>
              ))}
            </select>
            <select style={styles.input} value={billDraft.vendorId} onChange={(e) => setBillDraft((p) => ({ ...p, vendorId: e.target.value }))}>
              <option value="">Vendor (optional)</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName}
                </option>
              ))}
            </select>
            <input
              style={styles.input}
              placeholder="Reference"
              value={billDraft.referenceNumber}
              onChange={(e) => setBillDraft((p) => ({ ...p, referenceNumber: e.target.value }))}
            />
            <input style={styles.input} type="date" value={billDraft.billDate} onChange={(e) => setBillDraft((p) => ({ ...p, billDate: e.target.value }))} />
            <input style={styles.input} type="date" value={billDraft.dueDate} onChange={(e) => setBillDraft((p) => ({ ...p, dueDate: e.target.value }))} />
            <input
              style={styles.input}
              type="number"
              placeholder="Amount"
              value={billDraft.amount}
              onChange={(e) => setBillDraft((p) => ({ ...p, amount: e.target.value }))}
            />
            <button type="button" style={styles.button} onClick={createBill}>
              Create Bill
            </button>
            <button type="button" style={styles.mutedButton} onClick={load}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Open Payables">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Filter and settle outstanding AP items with full status visibility.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowSettlePanel((prev) => !prev)}>
            {showSettlePanel ? "Hide Payables" : "Show Payables"}
          </button>
        </div>

        {showSettlePanel ? (
          <>
            <div style={styles.toolbar}>
              <input
                style={{ ...styles.input, minWidth: "220px" }}
                placeholder="Search reference / vendor / party"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="partial">Partial</option>
                <option value="settled">Settled</option>
              </select>
              <button type="button" style={styles.mutedButton} onClick={exportPayablesCsv}>
                Export CSV
              </button>
            </div>

            <div style={styles.statGrid}>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Visible Items</p>
                <p style={styles.statValue}>{summary.totalRows}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Visible Outstanding</p>
                <p style={styles.statValue}>{formatAmount(summary.totalOutstanding)}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Overdue Items</p>
                <p style={styles.statValue}>{summary.overdueRows}</p>
              </article>
            </div>

            <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Counterparty</th>
                    <th style={styles.th}>Due</th>
                    <th style={styles.th}>Outstanding</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayables.map((payable) => (
                    <tr key={payable.id}>
                      <td style={styles.td}>{payable.referenceNumber || `AP-${payable.id}`}</td>
                      <td style={styles.td}>{payable.vendorName || payable.partyName || "-"}</td>
                      <td style={styles.td}>{formatUiDate(payable.dueDate)}</td>
                      <td style={styles.td}>{formatAmount(payable.outstandingAmount)}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(payable.status)}>{payable.status}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.toolbar}>
                          <input
                            style={{ ...styles.input, minWidth: "90px" }}
                            type="number"
                            placeholder="Amount"
                            value={settleDrafts[payable.id]?.amount || ""}
                            onChange={(e) =>
                              setSettleDrafts((prev) => ({
                                ...prev,
                                [payable.id]: {
                                  ...(prev[payable.id] || {}),
                                  amount: e.target.value,
                                },
                              }))
                            }
                          />
                          <input
                            style={styles.input}
                            type="date"
                            value={settleDrafts[payable.id]?.settlementDate || new Date().toISOString().slice(0, 10)}
                            onChange={(e) =>
                              setSettleDrafts((prev) => ({
                                ...prev,
                                [payable.id]: {
                                  ...(prev[payable.id] || {}),
                                  settlementDate: e.target.value,
                                },
                              }))
                            }
                          />
                          <button type="button" style={styles.mutedButton} onClick={() => settle(payable.id)}>
                            Settle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayables.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={6}>
                        {loading ? "Loading payables..." : "No payables available for current filters."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </SectionCard>
    </AppShell>
  );
}

export default AccountsPayablesPage;
