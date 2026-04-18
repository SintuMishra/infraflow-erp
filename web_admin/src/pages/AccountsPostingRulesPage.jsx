import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatUiDateTime,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

const INITIAL_DRAFT = {
  ruleCode: "",
  eventName: "",
  sourceModule: "",
  voucherType: "journal",
  debitAccountId: "",
  creditAccountId: "",
  partyRequired: false,
  vendorRequired: false,
  requiresApproval: false,
  autoPostEnabled: false,
  rulePriority: "100",
};

function AccountsPostingRulesPage() {
  const [rules, setRules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [showCreate, setShowCreate] = useState(true);
  const [searchSource, setSearchSource] = useState("");
  const [searchEvent, setSearchEvent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const accountMap = useMemo(
    () =>
      accounts.reduce((acc, row) => {
        acc[String(row.id)] = `${row.accountCode} - ${row.accountName}`;
        return acc;
      }, {}),
    [accounts]
  );

  const filteredRules = useMemo(() => {
    const sourceNeedle = String(searchSource || "").trim().toLowerCase();
    const eventNeedle = String(searchEvent || "").trim().toLowerCase();

    return rules.filter((rule) => {
      const sourceOk = !sourceNeedle || String(rule.sourceModule || "").toLowerCase().includes(sourceNeedle);
      const eventOk = !eventNeedle || String(rule.eventName || "").toLowerCase().includes(eventNeedle);
      return sourceOk && eventOk;
    });
  }, [rules, searchEvent, searchSource]);

  const summary = useMemo(
    () => ({
      total: filteredRules.length,
      active: filteredRules.filter((row) => Boolean(row.isActive)).length,
      requiresApproval: filteredRules.filter((row) => Boolean(row.requiresApproval)).length,
      autoPostEnabled: filteredRules.filter((row) => Boolean(row.autoPostEnabled)).length,
    }),
    [filteredRules]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rulesRes, accountsRes] = await Promise.all([
        api.get("/accounts/posting-rules"),
        api.get("/accounts/masters/chart-of-accounts"),
      ]);

      setRules(Array.isArray(rulesRes.data?.data) ? rulesRes.data.data : []);
      setAccounts(Array.isArray(accountsRes.data?.data) ? accountsRes.data.data : []);
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load finance posting rules"));
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

  const createRule = async () => {
    setError("");
    setMessage("");

    if (!draft.ruleCode.trim() || !draft.eventName.trim() || !draft.sourceModule.trim()) {
      setError("ruleCode, eventName, and sourceModule are required");
      return;
    }

    if (!draft.debitAccountId || !draft.creditAccountId) {
      setError("Select both debit and credit accounts");
      return;
    }

    if (String(draft.debitAccountId) === String(draft.creditAccountId)) {
      setError("Debit and credit accounts must be different");
      return;
    }

    try {
      await api.post("/accounts/posting-rules", {
        ...draft,
        ruleCode: draft.ruleCode.trim(),
        eventName: draft.eventName.trim(),
        sourceModule: draft.sourceModule.trim(),
        debitAccountId: Number(draft.debitAccountId),
        creditAccountId: Number(draft.creditAccountId),
        rulePriority: Number(draft.rulePriority || 100),
      });

      setMessage("Posting rule created");
      setDraft(INITIAL_DRAFT);
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to create posting rule"));
    }
  };

  const toggleRuleStatus = async (ruleId, isActive) => {
    setError("");
    setMessage("");
    try {
      await api.patch(`/accounts/posting-rules/${ruleId}/status`, {
        isActive: !isActive,
      });
      setMessage(isActive ? "Posting rule deactivated" : "Posting rule activated");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to update posting rule status"));
    }
  };

  const exportRulesCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "finance-posting-rules",
      columns: [
        { key: "ruleCode", header: "Rule Code" },
        { key: "sourceModule", header: "Source Module" },
        { key: "eventName", header: "Event" },
        { key: "voucherType", header: "Voucher Type" },
        { key: "debitAccount", header: "Debit Account" },
        { key: "creditAccount", header: "Credit Account" },
        { key: "requiresApproval", header: "Requires Approval" },
        { key: "autoPostEnabled", header: "Auto Post" },
        { key: "isActive", header: "Active" },
        { key: "rulePriority", header: "Priority" },
        { key: "updatedAt", header: "Updated At" },
      ],
      rows: filteredRules.map((row) => ({
        ruleCode: row.ruleCode,
        sourceModule: row.sourceModule,
        eventName: row.eventName,
        voucherType: row.voucherType,
        debitAccount: accountMap[String(row.debitAccountId)] || row.debitAccountId,
        creditAccount: accountMap[String(row.creditAccountId)] || row.creditAccountId,
        requiresApproval: row.requiresApproval ? "true" : "false",
        autoPostEnabled: row.autoPostEnabled ? "true" : "false",
        isActive: row.isActive ? "true" : "false",
        rulePriority: row.rulePriority,
        updatedAt: formatUiDateTime(row.updatedAt),
      })),
    });

    if (!exported) {
      setError("No posting rule rows available to export");
      return;
    }

    setMessage("Posting rules CSV exported");
  };

  return (
    <AppShell title="Finance Posting Rules" subtitle="Source-event rulebook for controlled voucher generation and posting behavior">
      <SectionCard title="Rules Overview">
        <div style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" style={styles.mutedButton} onClick={exportRulesCsv}>
            Export CSV
          </button>
          {message ? <span style={styles.success}>{message}</span> : null}
          {error ? <span style={styles.error}>{error}</span> : null}
        </div>

        <div style={styles.statGrid}>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Visible Rules</p>
            <p style={styles.statValue}>{summary.total}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Active</p>
            <p style={styles.statValue}>{summary.active}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Requires Approval</p>
            <p style={styles.statValue}>{summary.requiresApproval}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Auto Post Enabled</p>
            <p style={styles.statValue}>{summary.autoPostEnabled}</p>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Create Posting Rule">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Define source module + event mapping to debit/credit accounts and posting behavior.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showCreate ? (
          <div style={styles.toolbar}>
            <input
              style={styles.input}
              placeholder="Rule Code"
              value={draft.ruleCode}
              onChange={(e) => setDraft((prev) => ({ ...prev, ruleCode: e.target.value }))}
            />
            <input
              style={styles.input}
              placeholder="Source Module (e.g., dispatch)"
              value={draft.sourceModule}
              onChange={(e) => setDraft((prev) => ({ ...prev, sourceModule: e.target.value }))}
            />
            <input
              style={styles.input}
              placeholder="Event Name (e.g., dispatch_receivable)"
              value={draft.eventName}
              onChange={(e) => setDraft((prev) => ({ ...prev, eventName: e.target.value }))}
            />
            <select
              style={styles.input}
              value={draft.voucherType}
              onChange={(e) => setDraft((prev) => ({ ...prev, voucherType: e.target.value }))}
            >
              <option value="journal">journal</option>
              <option value="payment">payment</option>
              <option value="receipt">receipt</option>
              <option value="contra">contra</option>
              <option value="sales_invoice">sales_invoice</option>
              <option value="purchase_bill">purchase_bill</option>
              <option value="reversal">reversal</option>
            </select>
            <select
              style={styles.input}
              value={draft.debitAccountId}
              onChange={(e) => setDraft((prev) => ({ ...prev, debitAccountId: e.target.value }))}
            >
              <option value="">Debit Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountCode} - {account.accountName}
                </option>
              ))}
            </select>
            <select
              style={styles.input}
              value={draft.creditAccountId}
              onChange={(e) => setDraft((prev) => ({ ...prev, creditAccountId: e.target.value }))}
            >
              <option value="">Credit Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountCode} - {account.accountName}
                </option>
              ))}
            </select>
            <input
              style={styles.input}
              type="number"
              min="1"
              placeholder="Priority"
              value={draft.rulePriority}
              onChange={(e) => setDraft((prev) => ({ ...prev, rulePriority: e.target.value }))}
            />

            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
              <input
                type="checkbox"
                checked={draft.partyRequired}
                onChange={(e) => setDraft((prev) => ({ ...prev, partyRequired: e.target.checked }))}
              />
              Party Required
            </label>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
              <input
                type="checkbox"
                checked={draft.vendorRequired}
                onChange={(e) => setDraft((prev) => ({ ...prev, vendorRequired: e.target.checked }))}
              />
              Vendor Required
            </label>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
              <input
                type="checkbox"
                checked={draft.requiresApproval}
                onChange={(e) => setDraft((prev) => ({ ...prev, requiresApproval: e.target.checked }))}
              />
              Requires Approval
            </label>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
              <input
                type="checkbox"
                checked={draft.autoPostEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, autoPostEnabled: e.target.checked }))}
              />
              Auto Post
            </label>
            <button type="button" style={styles.button} onClick={createRule}>
              Create Rule
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Configured Rules">
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Filter by source module"
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Filter by event name"
            value={searchEvent}
            onChange={(e) => setSearchEvent(e.target.value)}
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rule</th>
                <th style={styles.th}>Source / Event</th>
                <th style={styles.th}>Voucher</th>
                <th style={styles.th}>Debit</th>
                <th style={styles.th}>Credit</th>
                <th style={styles.th}>Controls</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id}>
                  <td style={styles.td}>
                    <div>{rule.ruleCode}</div>
                    <div style={styles.inlineMeta}>Priority {rule.rulePriority}</div>
                  </td>
                  <td style={styles.td}>
                    <div>{rule.sourceModule}</div>
                    <div style={styles.inlineMeta}>{rule.eventName}</div>
                  </td>
                  <td style={styles.td}>{rule.voucherType}</td>
                  <td style={styles.td}>{accountMap[String(rule.debitAccountId)] || rule.debitAccountId}</td>
                  <td style={styles.td}>{accountMap[String(rule.creditAccountId)] || rule.creditAccountId}</td>
                  <td style={styles.td}>
                    {rule.partyRequired ? "party" : "-"}
                    {rule.vendorRequired ? " / vendor" : ""}
                    <div style={styles.inlineMeta}>
                      {rule.requiresApproval ? "approval" : "no-approval"} · {rule.autoPostEnabled ? "auto-post" : "manual-post"}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(rule.isActive ? "active" : "inactive")}>{rule.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={styles.td}>
                    <button type="button" style={styles.mutedButton} onClick={() => toggleRuleStatus(rule.id, rule.isActive)}>
                      {rule.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={8}>
                    {loading ? "Loading posting rules..." : "No posting rules found for the current filters."}
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

export default AccountsPostingRulesPage;
