import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import { useMasters } from "../hooks/useMasters";
import {
  getProcurementItemCategoryOptions,
  normalizeProcurementItemCategoryValue,
} from "../utils/procurement";

const INITIAL_LINE = {
  materialId: "",
  itemCategory: "material",
  orderedQuantity: "",
  unitRate: "",
  description: "",
  purchaseRequestLineId: "",
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const initialFormState = {
  poDate: TODAY_ISO,
  expectedDeliveryDate: "",
  vendorId: "",
  purchaseRequestId: "",
  notes: "",
  lines: [{ ...INITIAL_LINE }],
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
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
      const [orderRes, vendorRes, requestRes] = await Promise.allSettled([
        api.get("/purchase-orders"),
        api.get("/vendors"),
        api.get("/purchase-requests"),
      ]);

      const ordersData =
        orderRes.status === "fulfilled" ? orderRes.value?.data?.data || [] : [];
      const vendorsData =
        vendorRes.status === "fulfilled" ? vendorRes.value?.data?.data || [] : [];
      const purchaseRequestsData =
        requestRes.status === "fulfilled" ? requestRes.value?.data?.data || [] : [];

      setOrders(ordersData);
      setVendors(vendorsData);
      setPurchaseRequests(purchaseRequestsData);

      const orderError =
        orderRes.status === "rejected"
          ? orderRes.reason?.response?.data?.message || "Failed to load purchase orders"
          : "";
      const vendorError =
        vendorRes.status === "rejected"
          ? vendorRes.reason?.response?.data?.message || "Failed to load vendors"
          : "";
      const requestError =
        requestRes.status === "rejected"
          ? requestRes.reason?.response?.data?.message || "Failed to load purchase requests"
          : "";

      setError([orderError, vendorError, requestError].filter(Boolean).join(" | "));
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Failed to load purchase orders");
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
  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [Number(vendor.id), vendor.vendorName])),
    [vendors]
  );

  const filteredRows = useMemo(() => {
    return orders.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchesStatus = statusFilter ? item.status === statusFilter : true;
      const matchesSearch =
        query.length === 0
          ? true
          : String(item.poNumber || "").toLowerCase().includes(query) ||
            String(item.status || "").toLowerCase().includes(query) ||
            String(item.vendorId || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const formTotal = useMemo(() => {
    return form.lines.reduce((acc, line) => {
      const qty = Number(line.orderedQuantity || 0);
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
      materialId: Number(line.materialId),
      itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
      orderedQuantity: Number(line.orderedQuantity),
      unitRate: Number(line.unitRate),
      description: String(line.description || "").trim(),
      purchaseRequestLineId: line.purchaseRequestLineId
        ? Number(line.purchaseRequestLineId)
        : null,
    }));

  const loadPurchaseRequestDetails = async (purchaseRequestId) => {
    if (!purchaseRequestId) {
      return;
    }

    try {
      const response = await api.get(`/purchase-requests/${purchaseRequestId}`);
      const request = response?.data?.data || null;
      if (!request) {
        return;
      }

      const requestLines = Array.isArray(request.lines) ? request.lines : [];
      if (!requestLines.length) {
        return;
      }

      const mappedMasterLines = requestLines.filter((line) => Number(line.materialId) > 0);
      const skippedCustomLines = requestLines.length - mappedMasterLines.length;

      setForm((prev) => ({
        ...prev,
        vendorId: request.vendorId ? String(request.vendorId) : prev.vendorId,
        lines: mappedMasterLines.map((line) => ({
          materialId: String(line.materialId || ""),
          itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
          orderedQuantity: String(Number(line.quantity || 0)),
          unitRate: String(Number(line.unitRate || 0)),
          description: String(line.description || ""),
          purchaseRequestLineId: String(line.id || ""),
        })),
      }));

      if (skippedCustomLines > 0) {
        setError(
          `${skippedCustomLines} custom PR line(s) need master item creation before PO. Create item in Masters and update PR.`
        );
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load purchase request details");
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.expectedDeliveryDate && form.poDate && form.expectedDeliveryDate < form.poDate) {
      setError("Expected Delivery Date cannot be earlier than PO Date.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/purchase-orders", {
        poDate: form.poDate,
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        vendorId: Number(form.vendorId),
        purchaseRequestId: form.purchaseRequestId ? Number(form.purchaseRequestId) : null,
        notes: form.notes,
        lines: normalizeLines(),
      });

      setSuccess("Purchase order created successfully.");
      resetForm();
      await loadData();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    setError("");
    setSuccess("");
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status });
      setSuccess("Status updated.");
      await loadData();
    } catch (statusError) {
      setError(statusError?.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <AppShell
      title="Purchase Orders"
      subtitle="Approve vendor orders and track procurement execution status."
    >
      <section style={styles.panel}>
        <div style={styles.filterRow}>
          <input
            style={styles.input}
            placeholder="Search PO number, status, vendor id"
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
            <option value="partially_received">partially_received</option>
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
                <th style={styles.th}>PO No</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>PR Link</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.poNumber || "-"}</td>
                  <td style={styles.td}>{row.poDate || "-"}</td>
                  <td style={styles.td}>
                    {vendorNameById.get(Number(row.vendorId)) || row.vendorId || "-"}
                  </td>
                  <td style={styles.td}>{row.purchaseRequestId || "-"}</td>
                  <td style={styles.td}>{row.status || "-"}</td>
                  <td style={styles.td}>₹{formatCurrency(row.totalAmount)}</td>
                  <td style={styles.td}>
                    <div style={styles.actionRow}>
                      {row.status === "draft" ? (
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => updateStatus(row.id, "submitted")}
                        >
                          Submit
                        </button>
                      ) : null}
                      {row.status === "submitted" ? (
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
                  <td style={styles.empty} colSpan={7}>
                    {loading ? "Loading..." : "No purchase orders found"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Create Purchase Order</h3>
        <form onSubmit={submitOrder} style={styles.form}>
          <div style={styles.grid}>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>PO Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.poDate}
                onChange={(event) => setForm((prev) => ({ ...prev, poDate: event.target.value }))}
                required
              />
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Expected Delivery Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.expectedDeliveryDate}
                min={form.poDate || undefined}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expectedDeliveryDate: event.target.value }))
                }
              />
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Supplier</span>
              <select
                style={styles.input}
                value={form.vendorId}
                onChange={(event) => setForm((prev) => ({ ...prev, vendorId: event.target.value }))}
                required
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendorName}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Linked Purchase Request (Optional)</span>
              <select
                style={styles.input}
                value={form.purchaseRequestId}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, purchaseRequestId: value }));
                  loadPurchaseRequestDetails(value);
                }}
              >
                <option value="">Link purchase request (optional)</option>
                {purchaseRequests
                  .filter((request) =>
                    ["approved", "submitted"].includes(String(request.status || "").toLowerCase())
                  )
                  .map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.requestNumber} ({request.status})
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p style={styles.helperText}>
            PO Date is order issue date. Expected Delivery Date is supplier commitment date.
          </p>

          <textarea
            style={{ ...styles.input, minHeight: "72px" }}
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />

          {form.lines.map((line, index) => (
            <div key={`line-${index}`} style={styles.lineRow}>
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
                value={line.materialId}
                onChange={(event) => updateLine(index, "materialId", event.target.value)}
                required
              >
                <option value="">Select item</option>
                {materialOptions.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.materialName} ({material.materialUnit || "unit"})
                  </option>
                ))}
              </select>
              <input
                style={styles.input}
                type="number"
                min="0.001"
                step="0.001"
                placeholder="Ordered Qty"
                value={line.orderedQuantity}
                onChange={(event) => updateLine(index, "orderedQuantity", event.target.value)}
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
              <input
                style={styles.input}
                placeholder="Description"
                value={line.description}
                onChange={(event) => updateLine(index, "description", event.target.value)}
              />
              <button type="button" style={styles.secondaryButton} onClick={() => removeLine(index)}>
                Remove
              </button>
            </div>
          ))}

          <div style={styles.actionRow}>
            <button type="button" style={styles.secondaryButton} onClick={addLine}>
              Add Line
            </button>
            <span style={styles.total}>Total: ₹{formatCurrency(formTotal)}</span>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Create Order"}
            </button>
          </div>
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
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
  lineRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr 0.8fr 0.8fr 1.4fr auto",
    gap: "8px",
    alignItems: "center",
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

export default PurchaseOrdersPage;
