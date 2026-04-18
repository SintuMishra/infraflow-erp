import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatAmount,
  formatUiDate,
  formatUiDateTime,
  getStatusBadgeStyle,
  resolveApiErrorMessage,
} from "./accountsCommon";

const INITIAL_LINE = {
  accountId: "",
  ledgerId: "",
  debit: "",
  credit: "",
  lineNarration: "",
};

function AccountsVoucherEntryPage() {
  const [vouchers, setVouchers] = useState([]);
  const [workflowInbox, setWorkflowInbox] = useState({
    pendingSubmissions: [],
    approvedForPosting: [],
    rejectedItems: [],
    recentActivity: [],
    backlogSummary: {
      totalPending: 0,
      oldestPendingDays: 0,
      ageingBreachedCount: 0,
    },
  });
  const [accounts, setAccounts] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [voucherType, setVoucherType] = useState("journal");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [autoPost, setAutoPost] = useState(false);
  const [lines, setLines] = useState([INITIAL_LINE, INITIAL_LINE]);
  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [showWorkflow, setShowWorkflow] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [voucherRes, accountRes, ledgerRes, inboxRes] = await Promise.all([
        api.get("/accounts/journal-vouchers", {
          params: {
            limit: 80,
            search: listSearch || undefined,
          },
        }),
        api.get("/accounts/masters/chart-of-accounts"),
        api.get("/accounts/masters/ledgers"),
        api.get("/accounts/general-ledger/workflow/inbox", { params: { limit: 40 } }),
      ]);
      setVouchers(Array.isArray(voucherRes.data?.data) ? voucherRes.data.data : []);
      setAccounts(Array.isArray(accountRes.data?.data) ? accountRes.data.data : []);
      setLedgers(Array.isArray(ledgerRes.data?.data) ? ledgerRes.data.data : []);
      setWorkflowInbox(
        inboxRes.data?.data || {
          pendingSubmissions: [],
          approvedForPosting: [],
          rejectedItems: [],
          recentActivity: [],
          backlogSummary: {
            totalPending: 0,
            oldestPendingDays: 0,
            ageingBreachedCount: 0,
          },
        }
      );
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load voucher workspace"));
    } finally {
      setLoading(false);
    }
  }, [listSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const totals = useMemo(
    () => ({
      debit: lines.reduce((sum, line) => sum + Number(line.debit || 0), 0),
      credit: lines.reduce((sum, line) => sum + Number(line.credit || 0), 0),
    }),
    [lines]
  );

  const filteredVouchers = useMemo(
    () =>
      vouchers.filter((voucher) => {
        if (!listStatus) {
          return true;
        }
        const workflowState = String(voucher.workflowState || "").toLowerCase();
        const postingStatus = String(voucher.status || "").toLowerCase();
        return workflowState === listStatus || postingStatus === listStatus;
      }),
    [listStatus, vouchers]
  );
  const voucherListSummary = useMemo(
    () => ({
      total: filteredVouchers.length,
      draft: filteredVouchers.filter((row) => String(row.workflowState || row.status).toLowerCase() === "draft").length,
      submitted: filteredVouchers.filter((row) => String(row.workflowState || row.status).toLowerCase() === "submitted").length,
      approved: filteredVouchers.filter((row) => String(row.workflowState || row.status).toLowerCase() === "approved").length,
      posted: filteredVouchers.filter((row) => String(row.status || "").toLowerCase() === "posted").length,
    }),
    [filteredVouchers]
  );

  const validateVoucherDraft = () => {
    if (!voucherDate) {
      return "Voucher date is required";
    }

    if (!Array.isArray(lines) || lines.length < 2) {
      return "At least two voucher lines are required";
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (!line.accountId || !line.ledgerId) {
        return `Line ${i + 1} requires account and ledger`;
      }
      if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
        return `Line ${i + 1} must contain either debit or credit`;
      }
    }

    if (Math.abs(totals.debit - totals.credit) > 0.001) {
      return "Voucher is not balanced. Debit must equal credit";
    }

    return "";
  };

  const saveVoucher = async () => {
    setError("");
    setMessage("");
    const validationMessage = validateVoucherDraft();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    try {
      const payload = {
        voucherType,
        voucherDate,
        narration,
        autoPost,
        lines: lines.map((line) => ({
          accountId: Number(line.accountId),
          ledgerId: Number(line.ledgerId),
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          lineNarration: line.lineNarration,
        })),
      };
      await api.post("/accounts/journal-vouchers", payload);
      setMessage("Voucher saved successfully");
      setLines([INITIAL_LINE, INITIAL_LINE]);
      setNarration("");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to save voucher"));
    }
  };

  const submitVoucher = async (voucherId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/journal-vouchers/${voucherId}/submit`);
      setMessage("Voucher submitted for checker approval");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to submit voucher"));
    }
  };

  const approveVoucher = async (voucherId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/journal-vouchers/${voucherId}/approve`, {
        approvalNotes: "Approved from voucher workspace",
      });
      setMessage("Voucher approved successfully");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to approve voucher"));
    }
  };

  const postVoucher = async (voucherId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/journal-vouchers/${voucherId}/post`);
      setMessage("Voucher posted successfully");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to post voucher"));
    }
  };

  const reverseVoucher = async (voucherId) => {
    const reversalDate = new Date().toISOString().slice(0, 10);
    setError("");
    setMessage("");
    try {
      await api.post(`/accounts/journal-vouchers/${voucherId}/reverse`, {
        voucherDate: reversalDate,
        narration: "Reversal from accounts voucher page",
      });
      setMessage("Voucher reversed successfully");
      await load();
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to reverse voucher"));
    }
  };

  const exportVouchersCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "voucher-register-view",
      columns: [
        { key: "voucherNumber", header: "Voucher" },
        { key: "voucherDate", header: "Date" },
        { key: "voucherType", header: "Type" },
        { key: "workflowState", header: "Workflow State" },
        { key: "status", header: "Posting Status" },
        { key: "totalDebit", header: "Total Debit" },
        { key: "totalCredit", header: "Total Credit" },
        { key: "narration", header: "Narration" },
      ],
      rows: filteredVouchers.map((voucher) => ({
        voucherNumber: voucher.voucherNumber,
        voucherDate: formatUiDate(voucher.voucherDate),
        voucherType: voucher.voucherType,
        workflowState: voucher.workflowState || voucher.approvalStatus || "-",
        status: voucher.status,
        totalDebit: Number(voucher.totalDebit || 0).toFixed(2),
        totalCredit: Number(voucher.totalCredit || 0).toFixed(2),
        narration: voucher.narration || "",
      })),
    });

    if (!exported) {
      setError("No voucher rows available to export");
      return;
    }
    setMessage("Voucher CSV exported");
  };

  const exportWorkflowCsv = () => {
    setError("");
    const workflowRows = [
      ...(workflowInbox.pendingSubmissions || []).map((row) => ({ ...row, queue: "Approval" })),
      ...(workflowInbox.approvedForPosting || []).map((row) => ({ ...row, queue: "Posting" })),
      ...(workflowInbox.rejectedItems || []).map((row) => ({ ...row, queue: "Rejected" })),
    ];

    const exported = downloadCsvFile({
      filePrefix: "voucher-workflow-queue",
      columns: [
        { key: "queue", header: "Queue" },
        { key: "voucherNumber", header: "Voucher" },
        { key: "voucherDate", header: "Date" },
        { key: "ageDays", header: "Age Days" },
        { key: "approvalStatus", header: "Approval Status" },
        { key: "status", header: "Status" },
      ],
      rows: workflowRows.map((row) => ({
        queue: row.queue,
        voucherNumber: row.voucherNumber || "-",
        voucherDate: formatUiDate(row.voucherDate),
        ageDays: Number(row.ageDays || 0),
        approvalStatus: row.approvalStatus || "-",
        status: row.status || "-",
      })),
    });

    if (!exported) {
      setError("Workflow queue is empty. Nothing to export");
      return;
    }
    setMessage("Workflow queue CSV exported");
  };

  const exportActivityCsv = () => {
    setError("");
    const exported = downloadCsvFile({
      filePrefix: "finance-activity",
      columns: [
        { key: "createdAt", header: "Time" },
        { key: "action", header: "Action" },
        { key: "entityType", header: "Entity Type" },
        { key: "entityId", header: "Entity ID" },
        { key: "fromState", header: "From" },
        { key: "toState", header: "To" },
        { key: "performedBy", header: "By" },
      ],
      rows: (workflowInbox.recentActivity || []).map((row) => ({
        createdAt: formatUiDateTime(row.createdAt),
        action: row.action || "-",
        entityType: row.entityType || "-",
        entityId: row.entityId || "-",
        fromState: row.fromState || "-",
        toState: row.toState || "-",
        performedBy: row.performedByDisplayName || row.performedByUserId || "-",
      })),
    });

    if (!exported) {
      setError("No finance activity rows available to export");
      return;
    }
    setMessage("Finance activity CSV exported");
  };

  return (
    <AppShell title="Voucher Entry" subtitle="Journal, receipt, payment and contra with strict double-entry workflow controls">
      <SectionCard title="Create Voucher">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Draft, balance-check, and submit vouchers with maker-checker workflow visibility.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showCreateForm ? (
          <>
            <div style={styles.toolbar}>
              <select style={styles.input} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
                <option value="journal">Journal</option>
                <option value="receipt">Receipt</option>
                <option value="payment">Payment</option>
                <option value="contra">Contra</option>
              </select>
              <input style={styles.input} type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
              <input
                style={{ ...styles.input, minWidth: "260px" }}
                placeholder="Narration"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} />
                Auto-post (policy controlled)
              </label>
            </div>

            {lines.map((line, index) => (
              <div key={`line-${index}`} style={styles.toolbar}>
                <select
                  style={styles.input}
                  value={line.accountId}
                  onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, accountId: e.target.value } : item)))}
                >
                  <option value="">Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
                </select>
                <select
                  style={styles.input}
                  value={line.ledgerId}
                  onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, ledgerId: e.target.value } : item)))}
                >
                  <option value="">Ledger</option>
                  {ledgers.map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.ledgerCode} - {ledger.ledgerName}
                    </option>
                  ))}
                </select>
                <input
                  style={styles.input}
                  type="number"
                  placeholder="Debit"
                  value={line.debit}
                  onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, debit: e.target.value } : item)))}
                />
                <input
                  style={styles.input}
                  type="number"
                  placeholder="Credit"
                  value={line.credit}
                  onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, credit: e.target.value } : item)))}
                />
                <input
                  style={{ ...styles.input, minWidth: "200px" }}
                  placeholder="Line Narration"
                  value={line.lineNarration}
                  onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, lineNarration: e.target.value } : item)))}
                />
              </div>
            ))}

            <div style={styles.statGrid}>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Draft Total Debit</p>
                <p style={styles.statValue}>{formatAmount(totals.debit)}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Draft Total Credit</p>
                <p style={styles.statValue}>{formatAmount(totals.credit)}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Difference</p>
                <p style={styles.statValue}>{formatAmount(Math.abs(totals.debit - totals.credit))}</p>
              </article>
            </div>

            <div style={{ ...styles.toolbar, marginTop: "12px" }}>
              <button type="button" style={styles.mutedButton} onClick={() => setLines((prev) => [...prev, INITIAL_LINE])}>
                Add Line
              </button>
              <button type="button" style={styles.button} onClick={saveVoucher}>
                Save Voucher
              </button>
              <button type="button" style={styles.mutedButton} onClick={load}>
                {loading ? "Refreshing..." : "Refresh Workspace"}
              </button>
            </div>
          </>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Recent Vouchers">
        <div style={styles.toolbar}>
          <input
            style={{ ...styles.input, minWidth: "220px" }}
            placeholder="Search voucher number / narration"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
          />
          <select style={styles.input} value={listStatus} onChange={(e) => setListStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
          <button type="button" style={styles.mutedButton} onClick={exportVouchersCsv}>
            Export CSV
          </button>
        </div>
        <div style={{ ...styles.statGrid, marginBottom: "12px" }}>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Visible Vouchers</p>
            <p style={styles.statValue}>{voucherListSummary.total}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Draft</p>
            <p style={styles.statValue}>{voucherListSummary.draft}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Submitted</p>
            <p style={styles.statValue}>{voucherListSummary.submitted}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Approved</p>
            <p style={styles.statValue}>{voucherListSummary.approved}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Posted</p>
            <p style={styles.statValue}>{voucherListSummary.posted}</p>
          </article>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Number</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Debit</th>
                <th style={styles.th}>Credit</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td style={styles.td}>{voucher.voucherNumber}</td>
                  <td style={styles.td}>{formatUiDate(voucher.voucherDate)}</td>
                  <td style={styles.td}>{voucher.voucherType}</td>
                  <td style={styles.td}>
                    <span style={getStatusBadgeStyle(voucher.workflowState || voucher.status)}>
                      {voucher.workflowState || voucher.status}
                    </span>
                  </td>
                  <td style={styles.td}>{formatAmount(voucher.totalDebit)}</td>
                  <td style={styles.td}>{formatAmount(voucher.totalCredit)}</td>
                  <td style={styles.td}>
                    <div style={styles.toolbar}>
                      {voucher.workflowState === "draft" ? (
                        <button type="button" style={styles.mutedButton} onClick={() => submitVoucher(voucher.id)}>
                          Submit
                        </button>
                      ) : null}
                      {voucher.workflowState === "submitted" ? (
                        <button type="button" style={styles.mutedButton} onClick={() => approveVoucher(voucher.id)}>
                          Approve
                        </button>
                      ) : null}
                      {(voucher.workflowState || voucher.status) === "approved" ? (
                        <button type="button" style={styles.mutedButton} onClick={() => postVoucher(voucher.id)}>
                          Post
                        </button>
                      ) : null}
                      {voucher.status === "posted" ? (
                        <button type="button" style={styles.mutedButton} onClick={() => reverseVoucher(voucher.id)}>
                          Reverse
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={7}>
                    {loading ? "Loading voucher records..." : "No voucher records found for current filters."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading && filteredVouchers.length === 0 ? (
          <p style={{ ...styles.emptyState, marginTop: "10px" }}>
            No voucher rows match the current filter set. Clear status/search filters or create a new draft voucher above.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Approval Inbox">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Backlog summary and queues for approval, posting, and rejection follow-up.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowWorkflow((prev) => !prev)}>
            {showWorkflow ? "Hide Queue" : "Show Queue"}
          </button>
        </div>

        {showWorkflow ? (
          <>
            <div style={styles.toolbar}>
              <button type="button" style={styles.mutedButton} onClick={exportWorkflowCsv}>
                Export Queue CSV
              </button>
            </div>

            <div style={styles.statGrid}>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Pending Submissions</p>
                <p style={styles.statValue}>{workflowInbox.pendingSubmissions.length}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Approved Waiting Posting</p>
                <p style={styles.statValue}>{workflowInbox.approvedForPosting.length}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Rejected For Rework</p>
                <p style={styles.statValue}>{workflowInbox.rejectedItems.length}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Oldest Pending (days)</p>
                <p style={styles.statValue}>{Number(workflowInbox.backlogSummary?.oldestPendingDays || 0)}</p>
              </article>
              <article style={styles.statCard}>
                <p style={styles.statLabel}>Ageing Breach (&gt;=3 days)</p>
                <p style={styles.statValue}>{Number(workflowInbox.backlogSummary?.ageingBreachedCount || 0)}</p>
              </article>
            </div>
            <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Queue</th>
                    <th style={styles.th}>Voucher</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Age (days)</th>
                    <th style={styles.th}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...(workflowInbox.pendingSubmissions || []).map((row) => ({ ...row, queue: "Approval" })),
                    ...(workflowInbox.approvedForPosting || []).map((row) => ({ ...row, queue: "Posting" })),
                    ...(workflowInbox.rejectedItems || []).map((row) => ({ ...row, queue: "Rejected" })),
                  ].map((row) => (
                    <tr key={`${row.queue}-${row.id}`}>
                      <td style={styles.td}>{row.queue}</td>
                      <td style={styles.td}>{row.voucherNumber}</td>
                      <td style={styles.td}>{formatUiDate(row.voucherDate)}</td>
                      <td style={styles.td}>{Number(row.ageDays || 0)}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(row.approvalStatus || row.status)}>
                          {row.approvalStatus || row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {((workflowInbox.pendingSubmissions || []).length +
                    (workflowInbox.approvedForPosting || []).length +
                    (workflowInbox.rejectedItems || []).length) === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={5}>
                        Workflow queues are currently clear.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Recent Finance Activity">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Transition history from finance lifecycle logs for audit-ready operator visibility.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowActivity((prev) => !prev)}>
            {showActivity ? "Hide Activity" : "Show Activity"}
          </button>
        </div>

        {showActivity ? (
          <>
            <div style={styles.toolbar}>
              <button type="button" style={styles.mutedButton} onClick={exportActivityCsv}>
                Export Activity CSV
              </button>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Action</th>
                    <th style={styles.th}>Entity</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>By User</th>
                  </tr>
                </thead>
                <tbody>
                  {(workflowInbox.recentActivity || []).map((row) => (
                    <tr key={`activity-${row.id}`}>
                      <td style={styles.td}>{formatUiDateTime(row.createdAt)}</td>
                      <td style={styles.td}>{row.action}</td>
                      <td style={styles.td}>
                        {row.entityType} #{row.entityId}
                      </td>
                      <td style={styles.td}>{row.fromState || "-"}</td>
                      <td style={styles.td}>{row.toState || "-"}</td>
                      <td style={styles.td}>{row.performedByDisplayName || row.performedByUserId || "-"}</td>
                    </tr>
                  ))}
                  {(workflowInbox.recentActivity || []).length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={6}>
                        No workflow activity captured yet.
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

export default AccountsVoucherEntryPage;
