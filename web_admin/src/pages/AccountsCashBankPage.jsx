import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

function AccountsCashBankPage() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showBankForm, setShowBankForm] = useState(true);
  const [showVoucherForm, setShowVoucherForm] = useState(true);
  const [bankDraft, setBankDraft] = useState({
    accountName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    ifscCode: "",
    ledgerId: "",
  });
  const [voucherDraft, setVoucherDraft] = useState({
    voucherType: "receipt",
    voucherDate: new Date().toISOString().slice(0, 10),
    amount: "",
    cashOrBankLedgerId: "",
    counterAccountId: "",
    counterLedgerId: "",
    narration: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [bankRes, ledgerRes, accountRes] = await Promise.all([
        api.get("/accounts/cash-bank/bank-accounts"),
        api.get("/accounts/masters/ledgers"),
        api.get("/accounts/masters/chart-of-accounts"),
      ]);

      setBankAccounts(Array.isArray(bankRes.data?.data) ? bankRes.data.data : []);
      setLedgers(Array.isArray(ledgerRes.data?.data) ? ledgerRes.data.data : []);
      setAccounts(Array.isArray(accountRes.data?.data) ? accountRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load cash/bank workspace"));
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

  const balanceSummary = useMemo(
    () => ({
      totalLinkedBanks: bankAccounts.length,
      activeBanks: bankAccounts.filter((row) => Boolean(row.isActive)).length,
      inactiveBanks: bankAccounts.filter((row) => !row.isActive).length,
    }),
    [bankAccounts]
  );

  const createBankAccount = async () => {
    setError("");
    setMessage("");
    try {
      await api.post("/accounts/cash-bank/bank-accounts", {
        ...bankDraft,
        ledgerId: bankDraft.ledgerId ? Number(bankDraft.ledgerId) : null,
      });
      setMessage("Bank account created");
      setBankDraft({
        accountName: "",
        bankName: "",
        branchName: "",
        accountNumber: "",
        ifscCode: "",
        ledgerId: "",
      });
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to create bank account"));
    }
  };

  const createCashBankVoucher = async () => {
    setError("");
    setMessage("");
    if (Number(voucherDraft.amount || 0) <= 0) {
      setError("Amount must be greater than zero");
      return;
    }

    try {
      await api.post("/accounts/cash-bank/vouchers", {
        ...voucherDraft,
        amount: Number(voucherDraft.amount || 0),
        cashOrBankLedgerId: Number(voucherDraft.cashOrBankLedgerId),
        counterAccountId: Number(voucherDraft.counterAccountId),
        counterLedgerId: Number(voucherDraft.counterLedgerId),
      });
      setMessage("Cash/Bank voucher created and posted");
      setVoucherDraft((prev) => ({
        ...prev,
        amount: "",
        narration: "",
        counterAccountId: "",
        counterLedgerId: "",
      }));
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to create cash/bank voucher"));
    }
  };

  const exportBankAccountsCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "cash-bank-accounts",
      columns: [
        { key: "accountName", header: "Account Name" },
        { key: "bankName", header: "Bank" },
        { key: "branchName", header: "Branch" },
        { key: "accountNumber", header: "Account Number" },
        { key: "ifscCode", header: "IFSC" },
        { key: "ledgerName", header: "Ledger" },
        { key: "status", header: "Status" },
      ],
      rows: bankAccounts.map((row) => ({
        accountName: row.accountName || "-",
        bankName: row.bankName || "-",
        branchName: row.branchName || "-",
        accountNumber: row.accountNumber || "-",
        ifscCode: row.ifscCode || "-",
        ledgerName: row.ledgerName || "-",
        status: row.isActive ? "Active" : "Inactive",
      })),
    });

    if (!exported) {
      setError("No bank accounts available to export");
      return;
    }

    setMessage("Bank accounts CSV exported");
  };

  return (
    <AppShell title="Cash / Bank" subtitle="Bank accounts, receipt/payment vouchers, and controlled cashbook operations">
      <SectionCard title="Bank Accounts">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Create and review bank account masters linked to finance ledgers.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowBankForm((prev) => !prev)}>
            {showBankForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showBankForm ? (
          <div style={styles.toolbar}>
            <input style={styles.input} placeholder="Account Name" value={bankDraft.accountName} onChange={(e) => setBankDraft((p) => ({ ...p, accountName: e.target.value }))} />
            <input style={styles.input} placeholder="Bank Name" value={bankDraft.bankName} onChange={(e) => setBankDraft((p) => ({ ...p, bankName: e.target.value }))} />
            <input style={styles.input} placeholder="Branch" value={bankDraft.branchName} onChange={(e) => setBankDraft((p) => ({ ...p, branchName: e.target.value }))} />
            <input style={styles.input} placeholder="Account Number" value={bankDraft.accountNumber} onChange={(e) => setBankDraft((p) => ({ ...p, accountNumber: e.target.value }))} />
            <input style={styles.input} placeholder="IFSC" value={bankDraft.ifscCode} onChange={(e) => setBankDraft((p) => ({ ...p, ifscCode: e.target.value }))} />
            <select style={styles.input} value={bankDraft.ledgerId} onChange={(e) => setBankDraft((p) => ({ ...p, ledgerId: e.target.value }))}>
              <option value="">Select Ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.ledgerCode} - {ledger.ledgerName}
                </option>
              ))}
            </select>
            <button type="button" style={styles.button} onClick={createBankAccount}>
              Add Bank Account
            </button>
            <button type="button" style={styles.mutedButton} onClick={load}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" style={styles.mutedButton} onClick={exportBankAccountsCsv}>
              Export CSV
            </button>
          </div>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Bank</th>
                <th style={styles.th}>Account No.</th>
                <th style={styles.th}>Ledger</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.accountName}</td>
                  <td style={styles.td}>{row.bankName}</td>
                  <td style={styles.td}>{row.accountNumber}</td>
                  <td style={styles.td}>{row.ledgerName || "-"}</td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(row.isActive ? "active" : "inactive")}>{row.isActive ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {bankAccounts.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={5}>
                    {loading ? "Loading bank accounts..." : "No bank accounts found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Cash/Bank Voucher">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Post finance-controlled receipt/payment/contra entries from a validated form.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowVoucherForm((prev) => !prev)}>
            {showVoucherForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showVoucherForm ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={voucherDraft.voucherType} onChange={(e) => setVoucherDraft((p) => ({ ...p, voucherType: e.target.value }))}>
              <option value="receipt">Receipt</option>
              <option value="payment">Payment</option>
              <option value="contra">Contra</option>
            </select>
            <input style={styles.input} type="date" value={voucherDraft.voucherDate} onChange={(e) => setVoucherDraft((p) => ({ ...p, voucherDate: e.target.value }))} />
            <input style={styles.input} type="number" placeholder="Amount" value={voucherDraft.amount} onChange={(e) => setVoucherDraft((p) => ({ ...p, amount: e.target.value }))} />
            <select style={styles.input} value={voucherDraft.cashOrBankLedgerId} onChange={(e) => setVoucherDraft((p) => ({ ...p, cashOrBankLedgerId: e.target.value }))}>
              <option value="">Cash/Bank Ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.ledgerCode} - {ledger.ledgerName}
                </option>
              ))}
            </select>
            <select style={styles.input} value={voucherDraft.counterAccountId} onChange={(e) => setVoucherDraft((p) => ({ ...p, counterAccountId: e.target.value }))}>
              <option value="">Counter Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountCode} - {account.accountName}
                </option>
              ))}
            </select>
            <select style={styles.input} value={voucherDraft.counterLedgerId} onChange={(e) => setVoucherDraft((p) => ({ ...p, counterLedgerId: e.target.value }))}>
              <option value="">Counter Ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.ledgerCode} - {ledger.ledgerName}
                </option>
              ))}
            </select>
            <input
              style={{ ...styles.input, minWidth: "220px" }}
              placeholder="Narration"
              value={voucherDraft.narration}
              onChange={(e) => setVoucherDraft((p) => ({ ...p, narration: e.target.value }))}
            />
            <button type="button" style={styles.button} onClick={createCashBankVoucher}>
              Post Cash/Bank Voucher
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Quick Balances">
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Linked Banks</p>
            <p style={styles.statValue}>{balanceSummary.totalLinkedBanks}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Active Banks</p>
            <p style={styles.statValue}>{balanceSummary.activeBanks}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Inactive Banks</p>
            <p style={styles.statValue}>{balanceSummary.inactiveBanks}</p>
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}

export default AccountsCashBankPage;
