export const accountsStyles = {
  toolbar: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "16px",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    minWidth: "140px",
    background: "#ffffff",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.05)",
  },
  button: {
    border: "1px solid #0f766e",
    borderRadius: "12px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#0f172a",
    background: "linear-gradient(135deg, #c7f9f1 0%, #fef3c7 45%, #fee2e2 100%)",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 118, 110, 0.16)",
  },
  mutedButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
    background: "#ffffff",
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    boxShadow: "0 14px 24px rgba(15, 23, 42, 0.05)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "11px",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "11px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "14px",
    background: "linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 12px 20px rgba(15, 23, 42, 0.05)",
  },
  statLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 700,
  },
  statValue: {
    margin: "6px 0 0",
    fontSize: "20px",
    fontWeight: 800,
    color: "#0f172a",
  },
  error: {
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 600,
  },
  success: {
    color: "#065f46",
    fontSize: "13px",
    fontWeight: 600,
  },
  warning: {
    color: "#9a3412",
    fontSize: "13px",
    fontWeight: 600,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    border: "1px solid transparent",
  },
  sectionHeaderRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  helperText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },
};

export const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const getStatusBadgeStyle = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (["posted", "approved", "settled", "active", "ready"].includes(normalized)) {
    return { ...accountsStyles.badge, color: "#065f46", background: "#dcfce7", borderColor: "#86efac" };
  }
  if (["draft", "submitted", "partial", "on_hold", "queued"].includes(normalized)) {
    return { ...accountsStyles.badge, color: "#9a3412", background: "#ffedd5", borderColor: "#fdba74" };
  }
  if (["reversed", "rejected", "cancelled", "closed", "failed"].includes(normalized)) {
    return { ...accountsStyles.badge, color: "#991b1b", background: "#fee2e2", borderColor: "#fca5a5" };
  }
  return { ...accountsStyles.badge, color: "#334155", background: "#e2e8f0", borderColor: "#cbd5e1" };
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const formatUiDate = (value) => {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
};

export const formatUiDateTime = (value) => {
  if (!value) {
    return "-";
  }
  return String(value).replace("T", " ").slice(0, 19);
};

export const resolveApiErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

export const downloadCsvFile = ({ filePrefix, columns, rows }) => {
  const safeColumns = Array.isArray(columns) ? columns.filter((column) => column?.key) : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeColumns.length || !safeRows.length) {
    return false;
  }

  const header = safeColumns.map((column) => csvEscape(column.header || column.key)).join(",");
  const body = safeRows.map((row) =>
    safeColumns
      .map((column) => csvEscape(row[column.key]))
      .join(",")
  );
  const csvText = [header].concat(body).join("\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const datePart = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `${filePrefix || "finance-export"}-${datePart}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};
