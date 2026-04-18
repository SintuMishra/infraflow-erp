import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { api } from "../services/api";
import {
  accountsStyles as styles,
  downloadCsvFile,
  formatUiDateTime,
  resolveApiErrorMessage,
} from "./accountsCommon";

const DEFAULT_POLICY = {
  allowSubmitterSelfApproval: false,
  allowMakerSelfApproval: false,
  allowApproverSelfPosting: false,
  allowMakerSelfPosting: false,
  lastUpdateNotes: "",
  updatedAt: null,
  updatedByUserId: null,
  updatedByDisplayName: null,
};

function AccountsFinancePolicyPage() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSettings, setShowSettings] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/accounts/general-ledger/policies");
      setPolicy({
        ...DEFAULT_POLICY,
        ...(response.data?.data || {}),
      });
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to load finance policy controls"));
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

  const dangerCount = useMemo(
    () =>
      [
        policy.allowSubmitterSelfApproval,
        policy.allowMakerSelfApproval,
        policy.allowApproverSelfPosting,
        policy.allowMakerSelfPosting,
      ].filter(Boolean).length,
    [policy]
  );

  const save = async () => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await api.patch("/accounts/general-ledger/policies", {
        allowSubmitterSelfApproval: Boolean(policy.allowSubmitterSelfApproval),
        allowMakerSelfApproval: Boolean(policy.allowMakerSelfApproval),
        allowApproverSelfPosting: Boolean(policy.allowApproverSelfPosting),
        allowMakerSelfPosting: Boolean(policy.allowMakerSelfPosting),
        lastUpdateNotes: String(policy.lastUpdateNotes || "").trim(),
      });

      setPolicy({
        ...DEFAULT_POLICY,
        ...(response.data?.data || {}),
      });
      setMessage("Finance policy controls updated");
    } catch (err) {
      setError(resolveApiErrorMessage(err, "Failed to update finance policy controls"));
    } finally {
      setSaving(false);
    }
  };

  const toggleControl = (field) => {
    setPolicy((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const exportPolicyCsv = () => {
    const exported = downloadCsvFile({
      filePrefix: "finance-policy-controls",
      columns: [
        { key: "control", header: "Control" },
        { key: "enabled", header: "Enabled" },
        { key: "updatedBy", header: "Updated By" },
        { key: "updatedAt", header: "Updated At" },
        { key: "notes", header: "Notes" },
      ],
      rows: [
        {
          control: "allowSubmitterSelfApproval",
          enabled: policy.allowSubmitterSelfApproval ? "true" : "false",
          updatedBy: policy.updatedByDisplayName || policy.updatedByUserId || "-",
          updatedAt: formatUiDateTime(policy.updatedAt),
          notes: policy.lastUpdateNotes || "",
        },
        {
          control: "allowMakerSelfApproval",
          enabled: policy.allowMakerSelfApproval ? "true" : "false",
          updatedBy: policy.updatedByDisplayName || policy.updatedByUserId || "-",
          updatedAt: formatUiDateTime(policy.updatedAt),
          notes: policy.lastUpdateNotes || "",
        },
        {
          control: "allowApproverSelfPosting",
          enabled: policy.allowApproverSelfPosting ? "true" : "false",
          updatedBy: policy.updatedByDisplayName || policy.updatedByUserId || "-",
          updatedAt: formatUiDateTime(policy.updatedAt),
          notes: policy.lastUpdateNotes || "",
        },
        {
          control: "allowMakerSelfPosting",
          enabled: policy.allowMakerSelfPosting ? "true" : "false",
          updatedBy: policy.updatedByDisplayName || policy.updatedByUserId || "-",
          updatedAt: formatUiDateTime(policy.updatedAt),
          notes: policy.lastUpdateNotes || "",
        },
      ],
    });

    if (!exported) {
      setError("Policy export failed");
      return;
    }

    setMessage("Policy controls CSV exported");
  };

  return (
    <AppShell title="Finance Policy Controls" subtitle="Maker-checker governance, same-user exceptions, and control-plane safety">
      <SectionCard title="Control Posture">
        <div style={styles.toolbar}>
          <button type="button" style={styles.mutedButton} onClick={exportPolicyCsv}>
            Export CSV
          </button>
          <button type="button" style={styles.mutedButton} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div style={styles.statGrid}>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>High-Risk Overrides Enabled</p>
            <p style={styles.statValue}>{dangerCount}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Last Updated By</p>
            <p style={styles.statValue}>{policy.updatedByDisplayName || policy.updatedByUserId || "-"}</p>
          </article>
          <article style={styles.statCard}>
            <p style={styles.statLabel}>Last Updated At</p>
            <p style={styles.statValue}>{formatUiDateTime(policy.updatedAt)}</p>
          </article>
        </div>
        {dangerCount > 0 ? (
          <p style={styles.error}>
            Warning: one or more same-user maker-checker exceptions are enabled. Keep this only for controlled emergency windows.
          </p>
        ) : (
          <p style={styles.success}>All maker-checker segregation controls are in strict mode.</p>
        )}
      </SectionCard>

      <SectionCard title="Policy Settings">
        <div style={styles.sectionHeaderRow}>
          <p style={styles.helperText}>Settings are live controls and are audited by the backend policy-change events.</p>
          <button type="button" style={styles.mutedButton} onClick={() => setShowSettings((prev) => !prev)}>
            {showSettings ? "Hide Settings" : "Show Settings"}
          </button>
        </div>

        {showSettings ? (
          <>
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={Boolean(policy.allowSubmitterSelfApproval)} onChange={() => toggleControl("allowSubmitterSelfApproval")} />
                Allow submitter to approve the same voucher
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={Boolean(policy.allowMakerSelfApproval)} onChange={() => toggleControl("allowMakerSelfApproval")} />
                Allow maker to approve own voucher
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={Boolean(policy.allowApproverSelfPosting)} onChange={() => toggleControl("allowApproverSelfPosting")} />
                Allow approver to post same voucher
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={Boolean(policy.allowMakerSelfPosting)} onChange={() => toggleControl("allowMakerSelfPosting")} />
                Allow maker to post own voucher
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <textarea
                style={{ ...styles.input, minHeight: "90px", width: "100%" }}
                placeholder="Governance note (why this policy profile is required)"
                value={policy.lastUpdateNotes || ""}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    lastUpdateNotes: e.target.value,
                  }))
                }
              />
            </div>

            <div style={{ ...styles.toolbar, marginTop: "12px" }}>
              <button type="button" style={styles.button} onClick={save} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Policy"}
              </button>
            </div>
          </>
        ) : null}

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>
    </AppShell>
  );
}

export default AccountsFinancePolicyPage;
