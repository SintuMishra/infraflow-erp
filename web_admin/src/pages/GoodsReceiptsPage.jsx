import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import { normalizeProcurementItemCategoryValue } from "../utils/procurement";

const INITIAL_LINE = {
  purchaseOrderLineId: "",
  materialId: "",
  itemCategory: "material",
  receivedQuantity: "",
  acceptedQuantity: "",
  rejectedQuantity: "0",
  unitRate: "",
  remarks: "",
};

const initialFormState = {
  purchaseOrderId: "",
  vendorId: "",
  receiptDate: new Date().toISOString().slice(0, 10),
  notes: "",
  lines: [{ ...INITIAL_LINE }],
};

const formatNumber = (value, decimals = 2) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));

function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [poDetails, setPoDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptRes, orderRes, vendorRes] = await Promise.all([
        api.get("/goods-receipts"),
        api.get("/purchase-orders"),
        api.get("/vendors"),
      ]);
      setReceipts(receiptRes?.data?.data || []);
      setOrders(orderRes?.data?.data || []);
      setVendors(vendorRes?.data?.data || []);
      setError("");
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Failed to load goods receipts workspace");
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
    () => orders.find((row) => Number(row.id) === Number(form.purchaseOrderId)) || null,
    [orders, form.purchaseOrderId]
  );
  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [Number(vendor.id), vendor.vendorName])),
    [vendors]
  );

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return receipts;
    }

    return receipts.filter((row) => {
      return [row.grnNumber, row.poNumber, row.vendorName, row.status]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q));
    });
  }, [receipts, search]);

  const formTotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + Number(line.acceptedQuantity || 0) * Number(line.unitRate || 0), 0),
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

      const pendingLines = (details?.lines || []).filter(
        (line) => Number(line.orderedQuantity || 0) > Number(line.receivedQuantity || 0)
      );

      if (pendingLines.length) {
        setForm((prev) => ({
          ...prev,
          vendorId: String(details.vendorId || prev.vendorId || ""),
          lines: pendingLines.map((line) => {
            const pendingQty = Number(line.orderedQuantity || 0) - Number(line.receivedQuantity || 0);
            return {
              purchaseOrderLineId: String(line.id),
              materialId: String(line.materialId),
              itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
              receivedQuantity: String(Number(pendingQty.toFixed(3))),
              acceptedQuantity: String(Number(pendingQty.toFixed(3))),
              rejectedQuantity: "0",
              unitRate: String(Number(line.unitRate || 0)),
              remarks: "",
            };
          }),
        }));
      }
    } catch (detailsError) {
      setError(detailsError?.response?.data?.message || "Failed to load purchase order lines");
    }
  };

  const submitGoodsReceipt = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (selectedOrder?.poDate && form.receiptDate && form.receiptDate < selectedOrder.poDate) {
      setError("Receipt Date cannot be earlier than PO Date.");
      setSaving(false);
      return;
    }

    try {
      await api.post("/goods-receipts", {
        purchaseOrderId: Number(form.purchaseOrderId),
        vendorId: Number(form.vendorId),
        receiptDate: form.receiptDate,
        notes: form.notes,
        lines: form.lines.map((line) => ({
          purchaseOrderLineId: Number(line.purchaseOrderLineId),
          materialId: Number(line.materialId),
          itemCategory: normalizeProcurementItemCategoryValue(line.itemCategory),
          receivedQuantity: Number(line.receivedQuantity),
          acceptedQuantity: Number(line.acceptedQuantity),
          rejectedQuantity: Number(line.rejectedQuantity || 0),
          unitRate: Number(line.unitRate || 0),
          remarks: String(line.remarks || "").trim(),
        })),
      });

      setSuccess("Goods receipt created successfully.");
      setForm(initialFormState);
      setPoDetails(null);
      await loadData();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to create goods receipt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Goods Receipts (GRN)"
      subtitle="Receive ordered material, update PO received quantities, and close procurement execution accurately."
    >
      <section style={styles.panel}>
        <div style={styles.filterRow}>
          <input
            style={styles.input}
            placeholder="Search GRN / PO / vendor / status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
                <th style={styles.th}>GRN No</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>PO</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.grnNumber || "-"}</td>
                  <td style={styles.td}>{row.receiptDate || "-"}</td>
                  <td style={styles.td}>{row.poNumber || row.purchaseOrderId || "-"}</td>
                  <td style={styles.td}>{row.vendorName || row.vendorId || "-"}</td>
                  <td style={styles.td}>{row.status || "-"}</td>
                </tr>
              ))}
              {!filteredReceipts.length ? (
                <tr>
                  <td style={styles.empty} colSpan={5}>
                    {loading ? "Loading..." : "No goods receipts found"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Create Goods Receipt</h3>
        <form onSubmit={submitGoodsReceipt} style={styles.form}>
          <div style={styles.grid3}>
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
              <span style={styles.fieldLabel}>Receipt Date</span>
              <input
                style={styles.input}
                type="date"
                value={form.receiptDate}
                min={selectedOrder?.poDate || undefined}
                onChange={(event) => setForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
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
          </div>
          <p style={styles.helperText}>
            Receipt Date should match actual gate-entry/physical receiving date.
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
              <input style={styles.input} type="number" min="0.001" step="0.001" placeholder="Received Qty" value={line.receivedQuantity} onChange={(event) => updateLine(index, "receivedQuantity", event.target.value)} required />
              <input style={styles.input} type="number" min="0" step="0.001" placeholder="Accepted Qty" value={line.acceptedQuantity} onChange={(event) => updateLine(index, "acceptedQuantity", event.target.value)} required />
              <input style={styles.input} type="number" min="0" step="0.001" placeholder="Rejected Qty" value={line.rejectedQuantity} onChange={(event) => updateLine(index, "rejectedQuantity", event.target.value)} />
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
            <span style={styles.total}>Accepted Value: ₹{formatNumber(formTotal)}</span>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Create GRN"}
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
    gridTemplateColumns: "1fr auto",
    gap: "10px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  grid3: {
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
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  lineRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr repeat(4, minmax(0, 1fr)) auto",
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

export default GoodsReceiptsPage;
