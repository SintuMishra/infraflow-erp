import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import { useMasters } from "../hooks/useMasters";
import { useAuth } from "../hooks/useAuth";
import { normalizeRole } from "../utils/roles";
import {
  getProcurementItemCategoryOptions,
  normalizeProcurementItemCategoryValue,
} from "../utils/procurement";

const INITIAL_QUOTE = {
  vendorId: "",
  supplierName: "",
  contactPerson: "",
  contactPhone: "",
  quotedUnitRate: "",
  leadTimeDays: "",
  quoteNotes: "",
  isSelected: false,
};

const INITIAL_LINE = {
  itemSource: "master",
  materialId: "",
  customItemName: "",
  customItemUom: "",
  customItemSpec: "",
  itemCategory: "material",
  quantity: "",
  unitRate: "",
  description: "",
  supplierQuotes: [{ ...INITIAL_QUOTE }],
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const initialFormState = {
  requestDate: TODAY_ISO,
  requiredByDate: "",
  vendorId: "",
  requestPurpose: "",
  notes: "",
  lines: [{ ...INITIAL_LINE }],
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function PurchaseRequestsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const { masters } = useMasters();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requestRes, vendorRes] = await Promise.allSettled([
        api.get("/purchase-requests"),
        api.get("/vendors"),
      ]);

      const requestsData =
        requestRes.status === "fulfilled" ? requestRes.value?.data?.data || [] : [];
      const vendorsData =
        vendorRes.status === "fulfilled" ? vendorRes.value?.data?.data || [] : [];

      setRequests(requestsData);
      setVendors(vendorsData);

      const requestError =
        requestRes.status === "rejected"
          ? requestRes.reason?.response?.data?.message || "Failed to load purchase requests"
          : "";
      const vendorError =
        vendorRes.status === "rejected"
          ? vendorRes.reason?.response?.data?.message || "Failed to load vendors"
          : "";

      setError([requestError, vendorError].filter(Boolean).join(" | "));
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Failed to load purchase requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const materialOptions = masters?.materials || [];
  const itemCategoryOptions = useMemo(
    () => getProcurementItemCategoryOptions(masters),
    [masters]
  );
  const currentRole = normalizeRole(currentUser?.role);
  const hasKnownRole = Boolean(currentRole);
  const canSubmitRequest =
    !hasKnownRole ||
    [
      "super_admin",
      "manager",
      "admin",
      "hr",
      "crusher_supervisor",
      "site_engineer",
      "operator",
    ].includes(currentRole);
  const canApproveRequest = ["super_admin", "manager"].includes(currentRole);
  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [Number(vendor.id), vendor.vendorName])),
    [vendors]
  );

  const filteredRows = useMemo(() => {
    return requests.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchesStatus = statusFilter ? item.status === statusFilter : true;
      const matchesSearch =
        query.length === 0
          ? true
          : String(item.requestNumber || "").toLowerCase().includes(query) ||
            String(item.status || "").toLowerCase().includes(query) ||
            String(item.vendorId || "").toLowerCase().includes(query) ||
            String(item.requestedByEmployeeId || "").toLowerCase().includes(query) ||
            String(item.requestPurpose || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  const formTotal = useMemo(() => {
    return form.lines.reduce((acc, line) => {
      const qty = Number(line.quantity || 0);
      const rate = Number(line.unitRate || 0);
      return acc + qty * rate;
    }, 0);
  }, [form.lines]);

  const resetForm = () => {
    setForm(initialFormState);
  };

  const updateLine = (index, key, value) => {
    setForm((prev) => {
      const nextLines = [...prev.lines];
      nextLines[index] = {
        ...nextLines[index],
        [key]: value,
      };
      return {
        ...prev,
        lines: nextLines,
      };
    });
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { ...INITIAL_LINE }],
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
      };
    });
  };

  const normalizeLines = () =>
    form.lines.map((line) => ({
      materialId:
        String(line.itemSource || "master") === "master" && line.materialId
          ? Number(line.materialId)
          : null,
      customItemName:
        String(line.itemSource || "master") === "custom"
          ? String(line.customItemName || "").trim() || null
          : null,
      customItemUom:
        String(line.itemSource || "master") === "custom"
          ? String(line.customItemUom || "").trim() || null
          : null,
      customItemSpec:
        String(line.itemSource || "master") === "custom"
          ? String(line.customItemSpec || "").trim() || null
          : null,
      itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
      quantity: Number(line.quantity),
      unitRate: Number(line.unitRate),
      description: String(line.description || "").trim(),
      supplierQuotes: (line.supplierQuotes || [])
        .filter((quote) => String(quote.supplierName || "").trim() || quote.vendorId)
        .map((quote) => ({
          vendorId: quote.vendorId ? Number(quote.vendorId) : null,
          supplierName: String(quote.supplierName || "").trim() || null,
          contactPerson: String(quote.contactPerson || "").trim() || null,
          contactPhone: String(quote.contactPhone || "").trim() || null,
          quotedUnitRate:
            quote.quotedUnitRate === "" || quote.quotedUnitRate === null
              ? null
              : Number(quote.quotedUnitRate),
          leadTimeDays:
            quote.leadTimeDays === "" || quote.leadTimeDays === null
              ? null
              : Number(quote.leadTimeDays),
          quoteNotes: String(quote.quoteNotes || "").trim() || null,
          isSelected: Boolean(quote.isSelected),
        })),
    }));

  const updateQuote = (lineIndex, quoteIndex, key, value) => {
    setForm((prev) => {
      const nextLines = [...prev.lines];
      const line = { ...nextLines[lineIndex] };
      const quotes = [...(line.supplierQuotes || [])];
      const currentQuote = { ...(quotes[quoteIndex] || INITIAL_QUOTE) };

      if (key === "isSelected" && value === true) {
        line.supplierQuotes = quotes.map((quote, index) => ({
          ...quote,
          isSelected: index === quoteIndex,
        }));
      } else {
        currentQuote[key] = value;
        if (key === "vendorId" && value) {
          const selectedVendor = vendors.find((vendor) => Number(vendor.id) === Number(value));
          if (selectedVendor && !String(currentQuote.supplierName || "").trim()) {
            currentQuote.supplierName = selectedVendor.vendorName;
          }
        }
        quotes[quoteIndex] = currentQuote;
        line.supplierQuotes = quotes;
      }

      nextLines[lineIndex] = line;
      return {
        ...prev,
        lines: nextLines,
      };
    });
  };

  const addQuote = (lineIndex) => {
    setForm((prev) => {
      const nextLines = [...prev.lines];
      nextLines[lineIndex] = {
        ...nextLines[lineIndex],
        supplierQuotes: [...(nextLines[lineIndex].supplierQuotes || []), { ...INITIAL_QUOTE }],
      };
      return {
        ...prev,
        lines: nextLines,
      };
    });
  };

  const removeQuote = (lineIndex, quoteIndex) => {
    setForm((prev) => {
      const nextLines = [...prev.lines];
      const line = nextLines[lineIndex];
      const quotes = [...(line.supplierQuotes || [])];
      if (quotes.length <= 1) {
        return prev;
      }
      quotes.splice(quoteIndex, 1);
      nextLines[lineIndex] = {
        ...line,
        supplierQuotes: quotes,
      };
      return {
        ...prev,
        lines: nextLines,
      };
    });
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!canSubmitRequest) {
      setError(
        `Your role (${currentRole || "unknown"}) is not allowed to create purchase requests.`
      );
      return;
    }

    if (form.requiredByDate && form.requestDate && form.requiredByDate < form.requestDate) {
      setError("Required By Date cannot be earlier than Request Date.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/purchase-requests", {
        requestDate: form.requestDate,
        requiredByDate: form.requiredByDate || null,
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        requestPurpose: String(form.requestPurpose || "").trim() || null,
        notes: form.notes,
        lines: normalizeLines(),
      });

      setSuccess("Purchase request created successfully.");
      resetForm();
      await loadData();
    } catch (submitError) {
      if (Number(submitError?.response?.status || 0) === 401) {
        setError("Session expired or unauthorized. Please login again and retry.");
      } else {
        setError(submitError?.response?.data?.message || "Failed to create purchase request");
      }
    } finally {
      setSaving(false);
    }
  };

  const submitDisabledReason = saving ? "Request is being saved..." : "";

  const updateStatus = async (id, status) => {
    setError("");
    setSuccess("");
    try {
      await api.patch(`/purchase-requests/${id}/status`, { status });
      setSuccess("Status updated.");
      await loadData();
    } catch (statusError) {
      setError(statusError?.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <AppShell
      title="Purchase Requests"
      subtitle="Employee requests for materials, equipment, spare parts, consumables, and services."
    >
      <section style={styles.panel}>
        <div style={styles.filterRow}>
          <input
            style={styles.input}
            placeholder="Search request number, status, vendor, requester"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            style={styles.input}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All status</option>
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
            <option value="approved">approved</option>
            <option value="closed">closed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button type="button" style={styles.secondaryButton} onClick={loadData} disabled={loading}>
            Refresh
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Request No</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.requestNumber || "-"}</td>
                  <td style={styles.td}>{row.requestDate || "-"}</td>
                  <td style={styles.td}>
                    {vendorNameById.get(Number(row.vendorId)) || row.vendorId || "Not assigned"}
                  </td>
                  <td style={styles.td}>{row.status || "-"}</td>
                  <td style={styles.td}>₹{formatCurrency(row.totalAmount)}</td>
                  <td style={styles.td}>
                    <div style={styles.actionRow}>
                      {row.status === "draft" && canSubmitRequest ? (
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => updateStatus(row.id, "submitted")}
                        >
                          Submit
                        </button>
                      ) : null}
                      {row.status === "submitted" && canApproveRequest ? (
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => updateStatus(row.id, "approved")}
                        >
                          Approve
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td style={styles.empty} colSpan={6}>
                    {loading ? "Loading..." : "No purchase requests found"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Create Purchase Request</h3>
        <form onSubmit={submitRequest} style={styles.form}>
          <div style={styles.grid}>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Request Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.requestDate}
                onChange={(event) => setForm((prev) => ({ ...prev, requestDate: event.target.value }))}
                required
              />
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Required By Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.requiredByDate}
                min={form.requestDate || undefined}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, requiredByDate: event.target.value }))
                }
              />
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Preferred Supplier (Optional)</span>
              <select
                style={styles.input}
                value={form.vendorId}
                onChange={(event) => setForm((prev) => ({ ...prev, vendorId: event.target.value }))}
              >
                <option value="">No specific vendor (select later in PO)</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendorName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p style={styles.helperText}>
            Request Date = when request is raised. Required By Date = when site actually needs delivery.
          </p>
          {!vendors.length ? (
            <p style={styles.helperText}>
              Vendor list is empty. You can still create request now and assign vendor later at Purchase Order stage.
            </p>
          ) : null}

          <textarea
            style={{ ...styles.input, minHeight: "72px" }}
            placeholder="Request purpose (why this is needed)"
            value={form.requestPurpose}
            onChange={(event) => setForm((prev) => ({ ...prev, requestPurpose: event.target.value }))}
          />

          <textarea
            style={{ ...styles.input, minHeight: "72px" }}
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />

          {form.lines.map((line, index) => (
            <div key={`line-${index}`} style={styles.lineCard}>
              <div style={styles.lineTopRow}>
                <select
                  style={styles.input}
                  value={line.itemCategory}
                  onChange={(event) => updateLine(index, "itemCategory", event.target.value)}
                  required
                >
                  {itemCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  style={styles.input}
                  value={line.itemSource}
                  onChange={(event) => updateLine(index, "itemSource", event.target.value)}
                  required
                >
                  <option value="master">From Master</option>
                  <option value="custom">New Custom Item</option>
                </select>
                <input
                  style={styles.input}
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, "quantity", event.target.value)}
                  required
                />
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit Rate"
                  value={line.unitRate}
                  onChange={(event) => updateLine(index, "unitRate", event.target.value)}
                  required
                />
                <button type="button" style={styles.secondaryButton} onClick={() => removeLine(index)}>
                  Remove Line
                </button>
              </div>

              {line.itemSource === "master" ? (
                <select
                  style={styles.input}
                  value={line.materialId}
                  onChange={(event) => updateLine(index, "materialId", event.target.value)}
                  required
                >
                  <option value="">Select item (master)</option>
                  {materialOptions.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.materialName} ({material.materialUnit || "unit"})
                    </option>
                  ))}
                </select>
              ) : (
                <div style={styles.customItemGrid}>
                  <input
                    style={styles.input}
                    placeholder="Custom item name"
                    value={line.customItemName}
                    onChange={(event) => updateLine(index, "customItemName", event.target.value)}
                    required
                  />
                  <input
                    style={styles.input}
                    placeholder="Unit (kg, nos, m, litre...)"
                    value={line.customItemUom}
                    onChange={(event) => updateLine(index, "customItemUom", event.target.value)}
                  />
                  <input
                    style={styles.input}
                    placeholder="Specification / grade / brand"
                    value={line.customItemSpec}
                    onChange={(event) => updateLine(index, "customItemSpec", event.target.value)}
                  />
                </div>
              )}

              <input
                style={styles.input}
                placeholder="Line description (site purpose / technical note)"
                value={line.description}
                onChange={(event) => updateLine(index, "description", event.target.value)}
              />

              <div style={styles.quoteSection}>
                <div style={styles.quoteHeader}>
                  <strong>Supplier Quotations</strong>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => addQuote(index)}
                  >
                    Add Quote
                  </button>
                </div>

                {(line.supplierQuotes || []).map((quote, quoteIndex) => (
                  <div key={`line-${index}-quote-${quoteIndex}`} style={styles.quoteGrid}>
                    <select
                      style={styles.input}
                      value={quote.vendorId}
                      onChange={(event) => updateQuote(index, quoteIndex, "vendorId", event.target.value)}
                    >
                      <option value="">Vendor master (optional)</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.vendorName}
                        </option>
                      ))}
                    </select>
                    <input
                      style={styles.input}
                      placeholder="Supplier name (manual)"
                      value={quote.supplierName}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "supplierName", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Contact person"
                      value={quote.contactPerson}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "contactPerson", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Contact phone"
                      value={quote.contactPhone}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "contactPhone", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Quoted unit rate"
                      value={quote.quotedUnitRate}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "quotedUnitRate", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Lead time (days)"
                      value={quote.leadTimeDays}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "leadTimeDays", event.target.value)
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Quote notes"
                      value={quote.quoteNotes}
                      onChange={(event) =>
                        updateQuote(index, quoteIndex, "quoteNotes", event.target.value)
                      }
                    />
                    <label style={styles.selectLabel}>
                      <input
                        type="checkbox"
                        checked={Boolean(quote.isSelected)}
                        onChange={(event) =>
                          updateQuote(index, quoteIndex, "isSelected", event.target.checked)
                        }
                      />
                      Select
                    </label>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => removeQuote(index, quoteIndex)}
                    >
                      Remove Quote
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={styles.actionRow}>
            <button type="button" style={styles.secondaryButton} onClick={addLine}>
              Add Line
            </button>
            <span style={styles.total}>Total: ₹{formatCurrency(formTotal)}</span>
            <button
              type="submit"
              style={{
                ...styles.primaryButton,
                ...(saving ? styles.primaryButtonDisabled : {}),
              }}
              disabled={saving}
              title={submitDisabledReason}
            >
              {saving ? "Saving..." : "Create Request"}
            </button>
          </div>
          {hasKnownRole && !canSubmitRequest ? (
            <p style={styles.helperText}>
              Your role ({currentRole || "unknown"}) is not allowed to create purchase requests.
            </p>
          ) : null}
          {submitDisabledReason ? <p style={styles.helperText}>{submitDisabledReason}</p> : null}
          {error ? <p style={styles.error}>{error}</p> : null}
          {success ? <p style={styles.success}>{success}</p> : null}
        </form>
      </section>
    </AppShell>
  );
}

const styles = {
  panel: {
    background: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: "10px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155",
    letterSpacing: "0.02em",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    background: "#fff",
  },
  lineCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  lineTopRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr auto",
    gap: "8px",
    alignItems: "center",
  },
  customItemGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr 1.2fr",
    gap: "8px",
  },
  quoteSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "8px",
    borderTop: "1px dashed #cbd5e1",
  },
  quoteHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  quoteGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr 0.8fr 1fr auto auto",
    gap: "8px",
    alignItems: "center",
  },
  selectLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    background: "#0f766e",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "10px 12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  actionButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#0f172a",
    padding: "6px 10px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "12px",
    textTransform: "uppercase",
    color: "#64748b",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: "14px",
    verticalAlign: "middle",
  },
  empty: {
    textAlign: "center",
    padding: "16px",
    color: "#64748b",
  },
  error: {
    margin: 0,
    color: "#b91c1c",
    fontWeight: 600,
  },
  success: {
    margin: 0,
    color: "#047857",
    fontWeight: 600,
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  total: {
    fontWeight: 700,
    color: "#0f172a",
    marginLeft: "auto",
  },
  helperText: {
    margin: 0,
    fontSize: "13px",
    color: "#475569",
  },
};

export default PurchaseRequestsPage;
