import { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

function AccountsChartOfAccountsPage() {
  const [groups, setGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(true);
  const [showLedgerForm, setShowLedgerForm] = useState(true);

  const [groupDraft, setGroupDraft] = useState({
    groupCode: "",
    groupName: "",
    nature: "asset",
  });

  const [accountDraft, setAccountDraft] = useState({
    accountGroupId: "",
    accountCode: "",
    accountName: "",
    accountType: "ledger",
    normalBalance: "debit",
  });

  const [ledgerDraft, setLedgerDraft] = useState({
    accountId: "",
    ledgerCode: "",
    ledgerName: "",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRes, accountRes, ledgerRes] = await Promise.all([
        api.get("/accounts/masters/account-groups"),
        api.get("/accounts/masters/chart-of-accounts"),
        api.get("/accounts/masters/ledgers"),
      ]);
      setGroups(Array.isArray(groupRes.data?.data) ? groupRes.data.data : []);
      setAccounts(Array.isArray(accountRes.data?.data) ? accountRes.data.data : []);
      setLedgers(Array.isArray(ledgerRes.data?.data) ? ledgerRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load finance masters"));
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

  const callAction = async (work, successText) => {
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(successText);
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Action failed"));
    }
  };

  const exportMasterCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "accounts-masters",
      columns: [
        { key: "rowType", header: "Type" },
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "parent", header: "Group/Account" },
        { key: "status", header: "Status" },
      ],
      rows: [
        ...groups.map((group) => ({
          rowType: "Group",
          code: group.groupCode,
          name: group.groupName,
          parent: group.nature,
          status: group.isActive ? "Active" : "Inactive",
        })),
        ...accounts.map((account) => ({
          rowType: "Account",
          code: account.accountCode,
          name: account.accountName,
          parent: account.accountGroupName,
          status: account.isActive ? "Active" : "Inactive",
        })),
        ...ledgers.map((ledger) => ({
          rowType: "Ledger",
          code: ledger.ledgerCode,
          name: ledger.ledgerName,
          parent: ledger.accountName || "-",
          status: ledger.isActive ? "Active" : "Inactive",
        })),
      ],
    });

    if (!exported) {
      setError("No chart/ledger rows available to export");
      return;
    }

    setMessage("Accounts master CSV exported");
  };

  return (
    <AppShell title="Chart of Accounts" subtitle="Account groups, chart, control ledgers, and company-scoped finance master lifecycle">
      <SectionCard title="Finance Master Setup">
        <div style={styles.toolbar}>
          <button
            type="button"
            style={styles.button}
            onClick={() => callAction(() => api.post("/accounts/masters/bootstrap-defaults"), "Finance defaults initialized")}
          >
            Bootstrap Defaults
          </button>
          <button
            type="button"
            style={styles.mutedButton}
            onClick={() => callAction(() => api.post("/accounts/masters/sync-party-ledgers"), "Party/vendor ledgers synchronized")}
          >
            Sync Party/Vendor Ledgers
          </button>
          <button type="button" style={styles.mutedButton} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" style={styles.mutedButton} onClick={exportMasterCsv}>
            Export CSV
          </button>
        </div>
        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Create Account Group">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Create grouped financial classification structure.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowGroupForm((prev) => !prev)}>
            {showGroupForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showGroupForm ? (
          <div style={styles.toolbar}>
            <input style={styles.input} placeholder="Group Code" value={groupDraft.groupCode} onChange={(e) => setGroupDraft((p) => ({ ...p, groupCode: e.target.value }))} />
            <input style={styles.input} placeholder="Group Name" value={groupDraft.groupName} onChange={(e) => setGroupDraft((p) => ({ ...p, groupName: e.target.value }))} />
            <select style={styles.input} value={groupDraft.nature} onChange={(e) => setGroupDraft((p) => ({ ...p, nature: e.target.value }))}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <button
              type="button"
              style={styles.button}
              onClick={() => callAction(() => api.post("/accounts/masters/account-groups", groupDraft), "Account group created")}
            >
              Save Group
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Create Account">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Map accounts to groups and define accounting nature.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowAccountForm((prev) => !prev)}>
            {showAccountForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showAccountForm ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={accountDraft.accountGroupId} onChange={(e) => setAccountDraft((p) => ({ ...p, accountGroupId: e.target.value }))}>
              <option value="">Select Group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.groupName}
                </option>
              ))}
            </select>
            <input style={styles.input} placeholder="Account Code" value={accountDraft.accountCode} onChange={(e) => setAccountDraft((p) => ({ ...p, accountCode: e.target.value }))} />
            <input style={styles.input} placeholder="Account Name" value={accountDraft.accountName} onChange={(e) => setAccountDraft((p) => ({ ...p, accountName: e.target.value }))} />
            <select style={styles.input} value={accountDraft.accountType} onChange={(e) => setAccountDraft((p) => ({ ...p, accountType: e.target.value }))}>
              <option value="ledger">Ledger</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
            </select>
            <select style={styles.input} value={accountDraft.normalBalance} onChange={(e) => setAccountDraft((p) => ({ ...p, normalBalance: e.target.value }))}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <button
              type="button"
              style={styles.button}
              onClick={() => callAction(() => api.post("/accounts/masters/chart-of-accounts", accountDraft), "Account created")}
            >
              Save Account
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Create Ledger">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Attach ledgers to accounts for posting and reporting paths.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowLedgerForm((prev) => !prev)}>
            {showLedgerForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showLedgerForm ? (
          <div style={styles.toolbar}>
            <select style={styles.input} value={ledgerDraft.accountId} onChange={(e) => setLedgerDraft((p) => ({ ...p, accountId: e.target.value }))}>
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountCode} - {account.accountName}
                </option>
              ))}
            </select>
            <input style={styles.input} placeholder="Ledger Code" value={ledgerDraft.ledgerCode} onChange={(e) => setLedgerDraft((p) => ({ ...p, ledgerCode: e.target.value }))} />
            <input style={styles.input} placeholder="Ledger Name" value={ledgerDraft.ledgerName} onChange={(e) => setLedgerDraft((p) => ({ ...p, ledgerName: e.target.value }))} />
            <button
              type="button"
              style={styles.button}
              onClick={() => callAction(() => api.post("/accounts/masters/ledgers", ledgerDraft), "Ledger created")}
            >
              Save Ledger
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Chart and Ledgers">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Group/Account</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={`grp-${group.id}`}>
                  <td style={styles.td}>Group</td>
                  <td style={styles.td}>{group.groupCode}</td>
                  <td style={styles.td}>{group.groupName}</td>
                  <td style={styles.td}>{group.nature}</td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(group.isActive ? "active" : "inactive")}>{group.isActive ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {accounts.map((account) => (
                <tr key={`acc-${account.id}`}>
                  <td style={styles.td}>Account</td>
                  <td style={styles.td}>{account.accountCode}</td>
                  <td style={styles.td}>{account.accountName}</td>
                  <td style={styles.td}>{account.accountGroupName}</td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(account.isActive ? "active" : "inactive")}>{account.isActive ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {ledgers.map((ledger) => (
                <tr key={`ldg-${ledger.id}`}>
                  <td style={styles.td}>Ledger</td>
                  <td style={styles.td}>{ledger.ledgerCode}</td>
                  <td style={styles.td}>{ledger.ledgerName}</td>
                  <td style={styles.td}>{ledger.accountName || "-"}</td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(ledger.isActive ? "active" : "inactive")}>{ledger.isActive ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {groups.length + accounts.length + ledgers.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={5}>
                    {loading ? "Loading finance masters..." : "No finance masters found yet."}
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

export default AccountsChartOfAccountsPage;
