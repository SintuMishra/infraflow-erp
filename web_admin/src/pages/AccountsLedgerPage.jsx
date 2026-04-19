import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatAmount,
  formatUiDate,
  resolveApiErrorMessage,
} from "./accountsCommon";

function AccountsLedgerPage() {
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ledgerRows, setLedgerRows] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const loadLedgers = async () => {
      setError("");
      try {
        const response = await api.get("/accounts/masters/ledgers");
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setLedgers(rows);
        if (rows[0]?.id) {
          setSelectedLedgerId(String(rows[0].id));
        }
      } catch (err) {
        setError(resolveApiErrorMessage(err, "Failed to load ledgers"));
      }
    };

    const timer = setTimeout(() => {
      loadLedgers();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const selectedLedger = useMemo(
    () => ledgers.find((ledger) => String(ledger.id) === String(selectedLedgerId)) || null,
    [ledgers, selectedLedgerId]
  );

  const loadLedgerBook = async () => {
    if (!selectedLedgerId) {
      setError("Select a ledger before running this report");
      return;
    }
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setError("dateTo cannot be earlier than dateFrom");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.get(`/accounts/general-ledger/ledger/${selectedLedgerId}`, {
        params: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      setLedgerRows(Array.isArray(response.data?.data?.lines) ? response.data.data.lines : []);
      setOpeningBalance(Number(response.data?.data?.openingBalance || 0));
      setMessage("Ledger loaded successfully");
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load ledger report"));
      setLedgerRows([]);
      setOpeningBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const exportLedgerCsv = () => {
    setError("");
    setMessage("");
    const exported = downloadCsvFile({
      filePrefix: selectedLedger?.ledgerCode ? `ledger-${selectedLedger.ledgerCode}` : "ledger-report",
      columns: [
        { key: "voucherDate", header: "Date" },
        { key: "voucherNumber", header: "Voucher" },
        { key: "voucherType", header: "Type" },
        { key: "accountCode", header: "Account Code" },
        { key: "accountName", header: "Account Name" },
        { key: "lineNarration", header: "Narration" },
        { key: "debit", header: "Debit" },
        { key: "credit", header: "Credit" },
        { key: "runningBalance", header: "Running Balance" },
      ],
      rows: ledgerRows.map((row) => ({
        voucherDate: formatUiDate(row.voucherDate),
        voucherNumber: row.voucherNumber || "-",
        voucherType: row.voucherType || "-",
        accountCode: row.accountCode || "-",
        accountName: row.accountName || "-",
        lineNarration: row.lineNarration || "",
        debit: Number(row.debit || 0).toFixed(2),
        credit: Number(row.credit || 0).toFixed(2),
        runningBalance: Number(row.runningBalance || 0).toFixed(2),
      })),
    });

    if (!exported) {
      setError("Load ledger rows before exporting CSV");
      return;
    }

    setMessage("Ledger CSV exported");
  };

  return (
    <AppShell title="Ledger" subtitle="Ledger drill-down with opening and running balances">
      <SectionCard title="Ledger Filters">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Filter by ledger and date range.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
        {showFilters ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={selectedLedgerId} onChange={(e) => setSelectedLedgerId(e.target.value)}>
              <option value="">Select Ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.ledgerCode} - {ledger.ledgerName}
                </option>
              ))}
            </select>
            <input style={styles.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input style={styles.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <button type="button" style={styles.button} onClick={loadLedgerBook}>
              {loading ? "Loading..." : "Load Ledger"}
            </button>
            <button type="button" style={styles.mutedButton} onClick={exportLedgerCsv}>
              Export CSV
            </button>
          </div>
        ) : null}

        <div style={styles.statGrid}>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Ledger</p>
            <p style={styles.statValue}>{selectedLedger?.ledgerName || "-"}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Opening Balance</p>
            <p style={styles.statValue}>{formatAmount(openingBalance)}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Transactions Loaded</p>
            <p style={styles.statValue}>{ledgerRows.length}</p>
          </article>
        </div>

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Ledger Transactions">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Voucher</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Narration</th>
                <th style={styles.th}>Debit</th>
                <th style={styles.th}>Credit</th>
                <th style={styles.th}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.map((row) => (
                <tr key={`${row.voucherId}-${row.lineNumber}`}>
                  <td style={styles.td}>{formatUiDate(row.voucherDate)}</td>
                  <td style={styles.td}>{row.voucherNumber || "-"}</td>
                  <td style={styles.td}>{row.voucherType || "-"}</td>
                  <td style={styles.td}>{row.lineNarration || "-"}</td>
                  <td style={styles.td}>{formatAmount(row.debit)}</td>
                  <td style={styles.td}>{formatAmount(row.credit)}</td>
                  <td style={styles.td}>{formatAmount(row.runningBalance)}</td>
                </tr>
              ))}
              {ledgerRows.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={7}>
                    {loading ? "Loading ledger rows..." : "No ledger rows loaded. Use filters and click Load Ledger."}
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

export default AccountsLedgerPage;
