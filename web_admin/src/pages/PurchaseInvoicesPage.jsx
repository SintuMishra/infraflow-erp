import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import { normalizeProcurementItemCategoryValue } from "../utils/procurement";

const INITIAL_LINE = {
  purchaseOrderLineId: "",
  materialId: "",
  itemCategory: "material",
  billedQuantity: "",
  unitRate: "",
  remarks: "",
};

const initialFormState = {
  purchaseOrderId: "",
  goodsReceiptId: "",
  vendorId: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  notes: "",
  postToPayables: true,
  lines: [{ ...INITIAL_LINE }],
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [poDetails, setPoDetails] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [form, setForm] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceRes, orderRes, receiptRes, vendorRes] = await Promise.all([
        api.get("/purchase-invoices"),
        api.get("/purchase-orders"),
        api.get("/goods-receipts"),
        api.get("/vendors"),
      ]);
      setInvoices(invoiceRes?.data?.data || []);
      setOrders(orderRes?.data?.data || []);
      setReceipts(receiptRes?.data?.data || []);
      setVendors(vendorRes?.data?.data || []);
      setError("");
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Failed to load purchase invoices workspace");
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

  const selectedOrder = useMemo(
    () => orders.find((item) => Number(item.id) === Number(form.purchaseOrderId)) || null,
    [orders, form.purchaseOrderId]
  );
  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [Number(vendor.id), vendor.vendorName])),
    [vendors]
  );

  const receiptOptions = useMemo(() => {
    if (!form.purchaseOrderId) {
      return receipts;
    }
    return receipts.filter((row) => Number(row.purchaseOrderId) === Number(form.purchaseOrderId));
  }, [receipts, form.purchaseOrderId]);

  const filteredRows = useMemo(() => {
    return invoices.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchOk = matchFilter ? item.matchStatus === matchFilter : true;
      const searchOk =
        !query ||
        [item.invoiceNumber, item.poNumber, item.vendorName, item.matchStatus, item.status]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(query));

      return matchOk && searchOk;
    });
  }, [invoices, matchFilter, search]);

  const formTotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + Number(line.billedQuantity || 0) * Number(line.unitRate || 0), 0),
    [form.lines]
  );

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

  const loadPoDetails = async (purchaseOrderId) => {
    if (!purchaseOrderId) {
      setPoDetails(null);
      return;
    }

    try {
      const response = await api.get(`/purchase-orders/${purchaseOrderId}`);
      const details = response?.data?.data || null;
      setPoDetails(details);

      setForm((prev) => ({
        ...prev,
        vendorId: String(details?.vendorId || prev.vendorId || ""),
        lines:
          (details?.lines || []).map((line) => ({
            purchaseOrderLineId: String(line.id),
            materialId: String(line.materialId),
            itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
            billedQuantity: String(Number(line.receivedQuantity || 0)),
            unitRate: String(Number(line.unitRate || 0)),
            remarks: "",
          })) || [{ ...INITIAL_LINE }],
      }));
    } catch (detailsError) {
      setError(detailsError?.response?.data?.message || "Failed to load PO details");
    }
  };

  const submitInvoice = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.dueDate && form.invoiceDate && form.dueDate < form.invoiceDate) {
      setError("Payment Due Date cannot be earlier than Invoice Date.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/purchase-invoices", {
        purchaseOrderId: Number(form.purchaseOrderId),
        goodsReceiptId: form.goodsReceiptId ? Number(form.goodsReceiptId) : null,
        vendorId: Number(form.vendorId),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        notes: form.notes,
        postToPayables: Boolean(form.postToPayables),
        lines: form.lines.map((line) => ({
          purchaseOrderLineId: Number(line.purchaseOrderLineId),
          materialId: Number(line.materialId),
          itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
          billedQuantity: Number(line.billedQuantity),
          unitRate: Number(line.unitRate || 0),
          remarks: String(line.remarks || "").trim(),
        })),
      });

      setSuccess("Purchase invoice created successfully.");
      setForm(initialFormState);
      setPoDetails(null);
      await loadData();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to create purchase invoice");
    } finally {
      setSaving(false);
    }
  };

  const postInvoice = async (invoiceId) => {
    setError("");
    setSuccess("");

    try {
      await api.post(`/purchase-invoices/${invoiceId}/post`);
      setSuccess("Invoice posted to Accounts Payable.");
      await loadData();
    } catch (postError) {
      setError(postError?.response?.data?.message || "Failed to post invoice");
    }
  };

  return (
    <AppShell
      title="Purchase Invoices"
      subtitle="Run PO-GRN-Invoice matching and link approved invoices into Accounts Payable posting flow."
    >
      <section style={styles.panel}>
        <div style={styles.filterRow}>
          <input
            style={styles.input}
            placeholder="Search invoice/PO/vendor/status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select style={styles.input} value={matchFilter} onChange={(event) => setMatchFilter(event.target.value)}>
            <option value="">All match status</option>
            <option value="matched">matched</option>
            <option value="variance">variance</option>
            <option value="blocked">blocked</option>
            <option value="pending">pending</option>
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
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>PO</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Match</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Payable</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.invoiceNumber || row.id}</td>
                  <td style={styles.td}>{row.poNumber || row.purchaseOrderId || "-"}</td>
                  <td style={styles.td}>{row.vendorName || row.vendorId || "-"}</td>
                  <td style={styles.td}>{row.matchStatus || "-"}</td>
                  <td style={styles.td}>{row.status || "-"}</td>
                  <td style={styles.td}>{row.payableId || "-"}</td>
                  <td style={styles.td}>₹{formatCurrency(row.totalAmount)}</td>
                  <td style={styles.td}>
                    {!row.payableId && row.matchStatus !== "blocked" ? (
                      <button type="button" style={styles.actionButton} onClick={() => postInvoice(row.id)}>
                        Post to AP
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td style={styles.empty} colSpan={8}>
                    {loading ? "Loading..." : "No purchase invoices found"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Create Purchase Invoice</h3>
        <form onSubmit={submitInvoice} style={styles.form}>
          <div style={styles.grid4}>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Purchase Order</span>
              <select
                style={styles.input}
                value={form.purchaseOrderId}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, purchaseOrderId: value }));
                  loadPoDetails(value);
                }}
                required
              >
                <option value="">Select purchase order</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} ({order.status})
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Linked GRN (Optional)</span>
              <select
                style={styles.input}
                value={form.goodsReceiptId}
                onChange={(event) => setForm((prev) => ({ ...prev, goodsReceiptId: event.target.value }))}
              >
                <option value="">Link GRN (optional)</option>
                {receiptOptions.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.grnNumber}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Invoice Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.invoiceDate}
                onChange={(event) => setForm((prev) => ({ ...prev, invoiceDate: event.target.value }))}
                required
              />
            </label>
            <label style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>Payment Due Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.dueDate}
                min={form.invoiceDate || undefined}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                required
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
                <option value="">Vendor</option>
                {selectedOrder ? (
                  <option value={selectedOrder.vendorId}>
                    {vendorNameById.get(Number(selectedOrder.vendorId)) ||
                      `Vendor #${selectedOrder.vendorId}`}
                  </option>
                ) : null}
                {vendors
                  .filter((vendor) => Number(vendor.id) !== Number(selectedOrder?.vendorId || 0))
                  .map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName}
                    </option>
                  ))}
              </select>
            </label>

            <label style={{ ...styles.checkLabel, ...styles.fieldGroup }}>
              <span style={styles.fieldLabel}>Posting Mode</span>
              <span style={styles.checkInline}>
                <input
                  type="checkbox"
                  checked={form.postToPayables}
                  onChange={(event) => setForm((prev) => ({ ...prev, postToPayables: event.target.checked }))}
                />
                Auto-post to AP
              </span>
            </label>
          </div>
          <p style={styles.helperText}>
            Invoice Date is supplier bill date. Due Date is payment commitment date.
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
                value={line.purchaseOrderLineId}
                onChange={(event) => {
                  const selectedLineId = event.target.value;
                  const poLine = (poDetails?.lines || []).find((item) => Number(item.id) === Number(selectedLineId));
                  updateLine(index, "purchaseOrderLineId", selectedLineId);
                  if (poLine) {
                    updateLine(index, "materialId", String(poLine.materialId));
                    updateLine(index, "unitRate", String(Number(poLine.unitRate || 0)));
                  }
                }}
                required
              >
                <option value="">PO line</option>
                {(poDetails?.lines || []).map((lineItem) => (
                  <option key={lineItem.id} value={lineItem.id}>
                    Line {lineItem.lineNumber} | Material {lineItem.materialId}
                  </option>
                ))}
              </select>
              <input style={styles.input} placeholder="Material Id" value={line.materialId} onChange={(event) => updateLine(index, "materialId", event.target.value)} required />
              <input style={styles.input} type="number" min="0.001" step="0.001" placeholder="Billed Qty" value={line.billedQuantity} onChange={(event) => updateLine(index, "billedQuantity", event.target.value)} required />
              <input style={styles.input} type="number" min="0" step="0.01" placeholder="Unit Rate" value={line.unitRate} onChange={(event) => updateLine(index, "unitRate", event.target.value)} required />
              <button type="button" style={styles.secondaryButton} onClick={() => removeLine(index)}>
                Remove
              </button>
            </div>
          ))}

          <div style={styles.actionRow}>
            <button type="button" style={styles.secondaryButton} onClick={addLine}>
              Add Line
            </button>
            <span style={styles.total}>Invoice Total: ₹{formatCurrency(formTotal)}</span>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Create Invoice"}
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
  grid4: {
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
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  checkLabel: {
    display: "flex",
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 600,
  },
  checkInline: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  lineRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto",
    gap: "8px",
    alignItems: "center",
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
    fontSize: "12px",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    color: "#64748b",
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    color: "#1e293b",
  },
  empty: {
    padding: "18px",
    textAlign: "center",
    color: "#64748b",
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  total: {
    marginLeft: "auto",
    fontWeight: 700,
    color: "#0f172a",
  },
  actionButton: {
    borderRadius: "8px",
    border: "1px solid #0369a1",
    background: "#e0f2fe",
    color: "#075985",
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 600,
  },
  primaryButton: {
    borderRadius: "10px",
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
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
  helperText: {
    margin: 0,
    fontSize: "13px",
    color: "#475569",
  },
};

export default PurchaseInvoicesPage;
