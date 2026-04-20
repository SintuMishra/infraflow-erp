import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDisplayDate } from "../utils/date";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
const formatNumber = (value, fractionDigits = 3) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));

const sanitizeFilenamePart = (value, fallback = "Dispatch") => {
  const normalized = Array.from(String(value || ""))
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code < 32 || '<>:"/\\|?*'.includes(character)) {
        return " ";
      }

      return character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
};

const numberToWordsBelowThousand = (value) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  if (value < 20) return ones[value];
  if (value < 100) {
    return `${tens[Math.floor(value / 10)]} ${ones[value % 10]}`.trim();
  }

  return `${ones[Math.floor(value / 100)]} Hundred ${numberToWordsBelowThousand(
    value % 100
  )}`.trim();
};

const numberToIndianWords = (value) => {
  const number = Math.floor(Number(value || 0));

  if (number === 0) return "Zero";

  const parts = [];
  const crore = Math.floor(number / 10000000);
  const lakh = Math.floor((number % 10000000) / 100000);
  const thousand = Math.floor((number % 100000) / 1000);
  const hundred = number % 1000;

  if (crore) parts.push(`${numberToWordsBelowThousand(crore)} Crore`);
  if (lakh) parts.push(`${numberToWordsBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${numberToWordsBelowThousand(thousand)} Thousand`);
  if (hundred) parts.push(numberToWordsBelowThousand(hundred));

  return parts.join(" ").trim();
};

const formatAmountInWords = (value) => {
  const numericValue = Number(value || 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const rupees = Math.floor(safeValue);
  const paise = Math.round((safeValue - rupees) * 100);

  if (paise > 0) {
    return `${numberToIndianWords(rupees)} Rupees and ${numberToIndianWords(
      paise
    )} Paise Only`;
  }

  return `${numberToIndianWords(rupees)} Rupees Only`;
};

const buildBuyerAddress = (record) => {
  const parts = [
    record?.partyAddressLine1,
    record?.partyAddressLine2,
    record?.partyCity,
    record?.partyStateName,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "-";
};

const buildDocumentReference = ({ data, company, billing }) => {
  const parts = [
    `DOC:DC-${data?.id ?? "-"}`,
    `INV:${data?.invoiceNumber || "-"}`,
    `DATE:${data?.invoiceDate || data?.dispatchDate || "-"}`,
    `SUPPLIER_GST:${company?.gstin || "-"}`,
    `BUYER_GST:${data?.partyGstin || "-"}`,
    `AMOUNT:${Number(billing?.totalWithGst || 0).toFixed(2)}`,
    `EWB:${data?.ewbNumber || "-"}`,
  ];

  return parts.join(" | ");
};

const getEwbStatus = (record) => {
  if (!record?.ewbNumber) {
    return {
      label: "Not Generated",
      tone: "pending",
    };
  }

  if (!record?.ewbValidUpto) {
    return {
      label: "Generated",
      tone: "ok",
    };
  }

  const validUpto = new Date(`${record.ewbValidUpto}T23:59:59`);
  const now = new Date();

  if (!Number.isNaN(validUpto.getTime()) && validUpto < now) {
    return {
      label: "Expired",
      tone: "danger",
    };
  }

  return {
    label: "Active",
    tone: "ok",
  };
};

function DispatchPrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError("");

      try {
        const [dispatchRes, companyRes] = await Promise.all([
          api.get(`/dispatch-reports/${id}`),
          api.get("/company-profile"),
        ]);

        setData(dispatchRes.data?.data || null);
        setCompany(companyRes.data?.data || null);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load dispatch print document"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id]);

  useEffect(() => {
    const previousTitle = document.title;

    if (!data) {
      return () => {
        document.title = previousTitle;
      };
    }

    const partyName = sanitizeFilenamePart(data.partyName, "Party");
    const invoiceNumber = sanitizeFilenamePart(data.invoiceNumber, `DC-${data.id || "Dispatch"}`);
    document.title = `${partyName} - ${invoiceNumber} - Dispatch Billing Document`;

    return () => {
      document.title = previousTitle;
    };
  }, [data]);

  const billing = useMemo(() => {
    if (!data) return null;

    const componentSubtotal = Number(
      Number(
        Number(data.materialAmount || 0) +
          Number(data.transportCost || 0) +
          Number(data.royaltyAmount || 0) +
          Number(data.loadingCharge || 0) +
          Number(data.otherCharge || 0)
      ).toFixed(2)
    );
    const materialAmount = Number(data.materialAmount || 0);
    const transportCost = Number(data.transportCost || 0);
    const royaltyAmount = Number(data.royaltyAmount || 0);
    const loadingCharge = Number(data.loadingCharge || 0);
    const otherCharge = Number(data.otherCharge || 0);
    const taxableValue = Number(
      data.totalInvoiceValue ?? data.invoiceValue ?? 0
    );
    const gstRate = Number(data.gstRate || 0);
    const cgst = Number(data.cgst || 0);
    const sgst = Number(data.sgst || 0);
    const igst = Number(data.igst || 0);
    const totalWithGst = Number(data.totalWithGst || taxableValue);
    const gstTotal = cgst + sgst + igst;
    const amountInWords = formatAmountInWords(totalWithGst);
    const taxMode = igst > 0 ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)";
    const invoiceAdjustment = Number((taxableValue - componentSubtotal).toFixed(2));
    const royaltyMode = String(data.royaltyMode || "none").trim();
    const quantityTons = Number(data.quantityTons || 0);
    let royaltyBasisLabel = "No royalty applied";

    if (royaltyMode === "per_ton") {
      royaltyBasisLabel = `${formatNumber(quantityTons)} tons x ${formatCurrency(
        data.royaltyValue || 0
      )} per ton`;
    } else if (royaltyMode === "per_brass") {
      const royaltyValuePerBrass = Number(data.royaltyValue || 0);
      const brassQuantity =
        royaltyValuePerBrass > 0
          ? Number((royaltyAmount / royaltyValuePerBrass).toFixed(4))
          : 0;

      royaltyBasisLabel = `${formatNumber(quantityTons)} tons ~ ${formatNumber(
        brassQuantity,
        4
      )} brass x ${formatCurrency(royaltyValuePerBrass)} per brass`;
    } else if (royaltyMode === "fixed") {
      royaltyBasisLabel = `Fixed royalty ${formatCurrency(data.royaltyValue || 0)}`;
    }

    return {
      componentSubtotal,
      materialAmount,
      transportCost,
      royaltyAmount,
      loadingCharge,
      otherCharge,
      invoiceAdjustment,
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      gstTotal,
      totalWithGst,
      amountInWords,
      taxMode,
      royaltyBasisLabel,
    };
  }, [data]);

  const ewbStatus = useMemo(() => getEwbStatus(data), [data]);
  const documentReference = useMemo(
    () => buildDocumentReference({ data, company, billing }),
    [billing, company, data]
  );
  const hasMissingHsnSac = !String(data?.hsnSacCode || "").trim();
  const documentHighlights = useMemo(() => {
    if (!data || !billing) return [];

    return [
      {
        label: "Taxable Value",
        value: formatCurrency(billing.taxableValue),
        tone: "neutral",
      },
      {
        label: "Total GST",
        value: formatCurrency(billing.gstTotal),
        tone: "neutral",
      },
      {
        label: "Grand Total",
        value: formatCurrency(billing.totalWithGst),
        tone: "strong",
      },
      {
        label: "Tax Mode",
        value: billing.igst > 0 ? "Inter-state" : "Intra-state",
        tone: "accent",
      },
      {
        label: "Dispatch Qty",
        value: `${data.quantityTons ?? 0} Tons`,
        tone: "neutral",
      },
    ];
  }, [billing, data]);

  if (loading) {
    return <div style={styles.loading}>Loading document...</div>;
  }

  if (error) {
    return <div style={styles.loading}>{error}</div>;
  }

  if (!data || !company) {
    return <div style={styles.loading}>Dispatch print data not available.</div>;
  }

  return (
    <div style={styles.page}>
      <style>{printStyles}</style>

      <div style={styles.toolbar} className="no-print">
        <div style={styles.toolbarMeta}>
          <div style={styles.toolbarTitle}>Dispatch Billing Document</div>
          <div style={styles.toolbarHint}>
            Optimized for A4 print and Save as PDF workflows
          </div>
        </div>

        <div style={styles.toolbarActions}>
          <button style={styles.toolbarButton} onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button
            style={styles.secondaryToolbarButton}
            onClick={() => window.history.back()}
          >
            Back
          </button>
        </div>
      </div>

      <div style={styles.document}>
        <div style={styles.documentAccent} />

        <div style={styles.topHeader}>
          <div style={styles.companyHeaderBlock}>
            <div style={styles.companyHeaderDetails}>
              <div style={styles.docTag}>Tax Invoice / Delivery Challan</div>
              <h1 style={styles.companyName}>{company.companyName || "-"}</h1>
              <p style={styles.companyLine}>{company.branchName || "-"}</p>
              <p style={styles.companyLine}>{company.addressLine1 || "-"}</p>
              <p style={styles.companyLine}>{company.addressLine2 || "-"}</p>
              <p style={styles.companyLine}>
                GSTIN: {company.gstin || "-"} | State: {company.stateName || "-"} (
                {company.stateCode || "-"})
              </p>
              <p style={styles.companyLine}>
                Mobile: {company.mobile || "-"} | Email: {company.email || "-"}
              </p>
            </div>
            {String(company.logoUrl || "").trim() ? (
              <div style={styles.companyLogoCard}>
                <img
                  src={company.logoUrl}
                  alt="Company logo"
                  style={styles.companyLogoImage}
                />
              </div>
            ) : null}
          </div>

          <div style={styles.docMetaCard}>
            <div style={styles.complianceBadgeRow}>
              <span
                style={{
                  ...styles.complianceBadge,
                  ...(ewbStatus.tone === "ok"
                    ? styles.complianceBadgeOk
                    : ewbStatus.tone === "danger"
                    ? styles.complianceBadgeDanger
                    : styles.complianceBadgePending),
                }}
              >
                EWB {ewbStatus.label}
              </span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Document No</span>
              <span style={styles.metaValue}>DC-{data.id}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Dispatch Date</span>
              <span style={styles.metaValue}>
                {formatDisplayDate(data.dispatchDate)}
              </span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Invoice No</span>
              <span style={styles.metaValue}>{data.invoiceNumber || "-"}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Invoice Date</span>
              <span style={styles.metaValue}>
                {formatDisplayDate(data.invoiceDate)}
              </span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>EWB No</span>
              <span style={styles.metaValue}>{data.ewbNumber || "-"}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>EWB Valid Upto</span>
              <span style={styles.metaValue}>
                {formatDisplayDate(data.ewbValidUpto)}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.spotlightGrid}>
          {documentHighlights.map((item) => (
            <div
              key={item.label}
              style={{
                ...styles.spotlightCard,
                ...(item.tone === "strong"
                  ? styles.spotlightCardStrong
                  : item.tone === "accent"
                  ? styles.spotlightCardAccent
                  : null),
              }}
            >
              <span
                style={{
                  ...styles.spotlightLabel,
                  ...(item.tone === "strong" ? styles.spotlightLabelStrong : null),
                }}
              >
                {item.label}
              </span>
              <strong
                style={{
                  ...styles.spotlightValue,
                  ...(item.tone === "strong" ? styles.spotlightValueStrong : null),
                }}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>

        <div style={styles.documentNotice}>
          <div style={styles.documentNoticeTitle}>Document Use & Reference</div>
          <p style={styles.documentNoticeText}>
            This print-ready copy is generated from the dispatch ledger and is
            intended for invoice reference, transport coordination, and movement
            compliance support.
          </p>
          <p style={styles.documentNoticeText}>
            Commercial values, GST breakup, and E-Way fields shown below follow
            the system-recorded dispatch transaction for this consignment.
          </p>
        </div>

        {hasMissingHsnSac && (
          <div style={styles.complianceWarning}>
            <div style={styles.complianceWarningTitle}>HSN / SAC configuration is missing</div>
            <p style={styles.complianceWarningText}>
              This invoice print is using dispatch and GST values correctly, but the material master
              still does not have an HSN / SAC code. Update the material in Masters before using
              this as a finalized tax-facing document.
            </p>
          </div>
        )}

        <div style={styles.twoColGrid}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Supplier Details</div>
            <div style={styles.detailRow}>
              <strong>Supplier:</strong> {company.companyName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Address:</strong> {company.addressLine1 || "-"},{" "}
              {company.addressLine2 || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>GSTIN:</strong> {company.gstin || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>State:</strong> {company.stateName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>PAN:</strong> {company.pan || "-"}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>Buyer / Consignee Details</div>
            <div style={styles.detailRow}>
              <strong>Party Name:</strong> {data.partyName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Address:</strong> {buildBuyerAddress(data)}
            </div>
            <div style={styles.detailRow}>
              <strong>Buyer GSTIN:</strong> {data.partyGstin || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Place of Supply:</strong> {data.partyStateName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>State Code:</strong> {data.partyStateCode || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Destination:</strong> {data.destinationName || "-"}
            </div>
          </div>
        </div>

        <div style={styles.twoColGrid}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Dispatch & Vehicle Details</div>
            <div style={styles.detailRow}>
              <strong>Plant / Unit:</strong> {data.plantName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Source Type:</strong> {data.sourceType || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Vehicle No:</strong>{" "}
              {data.linkedVehicleNumber || data.vehicleNumber || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Vehicle Type:</strong> {data.vehicleType || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Driver:</strong> {data.assignedDriver || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Transport Vendor:</strong> {data.transportVendorName || "-"}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>E-Way & Compliance Details</div>
            <div style={styles.detailRow}>
              <strong>EWB Number:</strong> {data.ewbNumber || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>EWB Date:</strong> {formatDisplayDate(data.ewbDate)}
            </div>
            <div style={styles.detailRow}>
              <strong>EWB Valid Upto:</strong>{" "}
              {formatDisplayDate(data.ewbValidUpto)}
            </div>
            <div style={styles.detailRow}>
              <strong>Distance (KM):</strong> {data.distanceKm ?? "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Vehicle for Movement:</strong>{" "}
              {data.linkedVehicleNumber || data.vehicleNumber || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Transporter:</strong> {data.transportVendorName || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Status:</strong> {data.status || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Tax Mode:</strong> {billing.taxMode}
            </div>
          </div>
        </div>

        <div style={styles.referenceCard}>
          <div style={styles.referenceHeader}>
            <div>
              <div style={styles.referenceEyebrow}>Digital Reference</div>
              <strong style={styles.referenceTitle}>
                Internal verification string for invoice lookup
              </strong>
            </div>
            <div style={styles.referenceMeta}>
              HSN/SAC: {data.hsnSacCode || "Not configured"}
            </div>
          </div>
          <div style={styles.referenceValue}>{documentReference}</div>
          <div style={styles.referenceHint}>
            A formal QR or barcode should be introduced only after approved e-invoice, IRN, or
            internal scan workflows are defined. This keeps the printed document genuine and avoids
            showing a misleading compliance code.
          </div>
        </div>

        <div style={styles.ewayCard}>
          <div style={styles.ewayHeader}>
            <div>
              <div style={styles.ewayEyebrow}>Movement Compliance Snapshot</div>
              <h3 style={styles.ewayTitle}>E-Way Bill Reference</h3>
            </div>
            <div
              style={{
                ...styles.ewayStatusPill,
                ...(ewbStatus.tone === "ok"
                  ? styles.ewayStatusOk
                  : ewbStatus.tone === "danger"
                  ? styles.ewayStatusDanger
                  : styles.ewayStatusPending),
              }}
            >
              {ewbStatus.label}
            </div>
          </div>

          <div style={styles.ewayGrid}>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>EWB Number</span>
              <strong style={styles.ewayValue}>
                {data.ewbNumber || "-"}
              </strong>
            </div>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>Generated On</span>
              <strong style={styles.ewayValue}>
                {formatDisplayDate(data.ewbDate)}
              </strong>
            </div>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>Valid Until</span>
              <strong style={styles.ewayValue}>
                {formatDisplayDate(data.ewbValidUpto)}
              </strong>
            </div>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>Distance Declared</span>
              <strong style={styles.ewayValue}>
                {data.distanceKm ?? "-"} KM
              </strong>
            </div>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>Vehicle Number</span>
              <strong style={styles.ewayValue}>
                {data.linkedVehicleNumber || data.vehicleNumber || "-"}
              </strong>
            </div>
            <div style={styles.ewayItem}>
              <span style={styles.ewayLabel}>Consignee GSTIN</span>
              <strong style={styles.ewayValue}>{data.partyGstin || "-"}</strong>
            </div>
          </div>
        </div>

        <div style={styles.tableBlock}>
          <div style={styles.blockTitle}>Item Details</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Material Description</th>
                <th style={styles.th}>Material Code</th>
                <th style={styles.th}>HSN/SAC</th>
                <th style={styles.th}>Qty (Tons)</th>
                <th style={styles.th}>Rate / Ton</th>
                <th style={styles.th}>Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}>1</td>
                <td style={styles.td}>
                  {data.materialName || data.materialType || "-"}
                </td>
                <td style={styles.td}>{data.materialCode || "-"}</td>
                <td style={styles.td}>{data.hsnSacCode || "Not configured"}</td>
                <td style={styles.td}>{data.quantityTons ?? "-"}</td>
                <td style={styles.td}>
                  {formatCurrency(data.materialRatePerTon || 0)}
                </td>
                <td style={styles.td}>
                  {formatCurrency(billing?.materialAmount || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={styles.amountGrid}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Billing Notes</div>
            <div style={styles.detailRow}>
              <strong>Remarks:</strong> {data.remarks || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Billing Notes:</strong> {data.billingNotes || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Royalty Mode:</strong> {data.royaltyMode || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Royalty Basis:</strong> {billing?.royaltyBasisLabel || "-"}
            </div>
            <div style={styles.detailRow}>
              <strong>Transport Rate Type:</strong>{" "}
              {data.transportRateType || "-"}
            </div>
          </div>

          <div style={styles.amountCard}>
            <div style={styles.amountSectionTitle}>Amount Summary</div>

            <div style={styles.amountRow}>
              <span>Material Amount</span>
              <strong>{formatCurrency(billing?.materialAmount || 0)}</strong>
            </div>
            <div style={styles.amountRow}>
              <span>Transport Cost</span>
              <strong>{formatCurrency(billing?.transportCost || 0)}</strong>
            </div>
            <div style={styles.amountRow}>
              <span>Royalty</span>
              <strong>{formatCurrency(billing?.royaltyAmount || 0)}</strong>
            </div>
            <div style={styles.amountRow}>
              <span>Loading Charge</span>
              <strong>{formatCurrency(billing?.loadingCharge || 0)}</strong>
            </div>
            <div style={styles.amountRow}>
              <span>Other Charge</span>
              <strong>{formatCurrency(billing?.otherCharge || 0)}</strong>
            </div>
            {Math.abs(billing?.invoiceAdjustment || 0) >= 0.01 ? (
              <div style={styles.amountRow}>
                <span>Manual Taxable Value Override</span>
                <strong>{formatCurrency(billing?.invoiceAdjustment || 0)}</strong>
              </div>
            ) : null}
            <div style={styles.amountRowStrong}>
              <span>Taxable Value</span>
              <strong>{formatCurrency(billing?.taxableValue || 0)}</strong>
            </div>

            <table style={styles.taxTable}>
              <tbody>
                <tr>
                  <td style={styles.taxLabel}>GST Rate</td>
                  <td style={styles.taxValue}>{billing?.gstRate || 0}%</td>
                </tr>
                <tr>
                  <td style={styles.taxLabel}>CGST</td>
                  <td style={styles.taxValue}>
                    {formatCurrency(billing?.cgst || 0)}
                  </td>
                </tr>
                <tr>
                  <td style={styles.taxLabel}>SGST</td>
                  <td style={styles.taxValue}>
                    {formatCurrency(billing?.sgst || 0)}
                  </td>
                </tr>
                <tr>
                  <td style={styles.taxLabel}>IGST</td>
                  <td style={styles.taxValue}>
                    {formatCurrency(billing?.igst || 0)}
                  </td>
                </tr>
                <tr style={styles.taxSummaryRow}>
                  <td style={styles.taxLabel}>Total GST</td>
                  <td style={styles.taxValue}>
                    {formatCurrency(billing?.gstTotal || 0)}
                  </td>
                </tr>
                <tr style={styles.taxSummaryRow}>
                  <td style={styles.taxLabel}>Total (With GST)</td>
                  <td style={styles.taxValue}>
                    {formatCurrency(billing?.totalWithGst || 0)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={styles.totalRow}>
              <span>Grand Total Payable</span>
              <strong>{formatCurrency(billing?.totalWithGst || 0)}</strong>
            </div>

            <div style={styles.amountWordsCard}>
              <span style={styles.amountWordsLabel}>Amount In Words</span>
              <strong style={styles.amountWordsValue}>
                {billing?.amountInWords || "Zero Rupees Only"}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.footerGrid}>
          <div style={styles.footerBox}>
            <div style={styles.footerTitle}>Declaration</div>
            <p style={styles.footerText}>
              We declare that this invoice / challan shows the actual details of
              goods described and that all particulars shown are true and
              correct to the best of our knowledge and belief.
            </p>
            <p style={styles.footerText}>
              This document may be used for dispatch, invoice reference, and
              E-Way movement support as applicable to the transaction.
            </p>
          </div>

          <div style={styles.footerBoxRight}>
            <div style={styles.footerTitle}>For {company.companyName || "-"}</div>
            <div style={styles.signatureSpace} />
            <div style={styles.footerText}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 10mm;
    }

    body {
      background: white !important;
    }

    .no-print {
      display: none !important;
    }

    * {
      box-shadow: none !important;
    }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 22%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    padding: "24px",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    color: "#334155",
  },
  toolbar: {
    maxWidth: "980px",
    margin: "0 auto 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "14px 18px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148,163,184,0.2)",
    boxShadow: "0 18px 42px rgba(15,23,42,0.08)",
    backdropFilter: "blur(18px)",
  },
  toolbarMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  toolbarTitle: {
    fontSize: "15px",
    fontWeight: "800",
    color: "#0f172a",
  },
  toolbarHint: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600",
  },
  toolbarActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  toolbarButton: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(15,23,42,0.16)",
  },
  secondaryToolbarButton: {
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: "700",
    cursor: "pointer",
  },
  document: {
    position: "relative",
    maxWidth: "980px",
    margin: "0 auto",
    background: "#fff",
    borderRadius: "24px",
    padding: "30px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
    border: "1px solid #dbe3f0",
    overflow: "hidden",
  },
  documentAccent: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at top right, rgba(14,165,233,0.08), transparent 20%), radial-gradient(circle at bottom left, rgba(249,115,22,0.08), transparent 20%)",
  },
  topHeader: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1.8fr 1fr",
    gap: "18px",
    marginBottom: "18px",
    paddingBottom: "18px",
    borderBottom: "2px solid #e5e7eb",
  },
  companyHeaderBlock: {
    display: "flex",
    gap: "14px",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  companyHeaderDetails: {
    minWidth: 0,
    flex: 1,
  },
  spotlightGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  spotlightCard: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    borderRadius: "18px",
    padding: "16px",
    border: "1px solid #dbe3f0",
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
  },
  spotlightCardStrong: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    border: "1px solid #0f172a",
  },
  spotlightCardAccent: {
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
  },
  spotlightLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    color: "#64748b",
  },
  spotlightValue: {
    fontSize: "18px",
    lineHeight: 1.3,
    color: "#0f172a",
  },
  spotlightLabelStrong: {
    color: "rgba(226,232,240,0.78)",
  },
  spotlightValueStrong: {
    color: "#ffffff",
  },
  documentNotice: {
    position: "relative",
    zIndex: 1,
    marginBottom: "16px",
    padding: "16px 18px",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    background:
      "linear-gradient(135deg, rgba(248,250,252,0.96) 0%, rgba(239,246,255,0.96) 100%)",
  },
  documentNoticeTitle: {
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "#0f172a",
    marginBottom: "8px",
  },
  documentNoticeText: {
    margin: "0 0 6px",
    fontSize: "13px",
    color: "#475569",
    lineHeight: 1.6,
  },
  complianceWarning: {
    marginBottom: "16px",
    padding: "16px 18px",
    borderRadius: "18px",
    border: "1px solid #fcd34d",
    background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
  },
  complianceWarningTitle: {
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "#92400e",
    marginBottom: "8px",
  },
  complianceWarningText: {
    margin: 0,
    fontSize: "13px",
    color: "#78350f",
    lineHeight: 1.6,
  },
  docTag: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "800",
    marginBottom: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  companyName: {
    margin: 0,
    fontSize: "30px",
    fontWeight: "800",
    color: "#0f172a",
  },
  companyLine: {
    margin: "4px 0",
    fontSize: "14px",
    color: "#475569",
  },
  companyLogoCard: {
    width: "164px",
    height: "82px",
    border: "1px solid #dbe3f0",
    borderRadius: "12px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px",
    flexShrink: 0,
  },
  companyLogoImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "block",
  },
  docMetaCard: {
    border: "1px solid #dbe3f0",
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
  },
  complianceBadgeRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "12px",
  },
  complianceBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
  },
  complianceBadgeOk: {
    background: "#dcfce7",
    color: "#166534",
  },
  complianceBadgeDanger: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  complianceBadgePending: {
    background: "#fef3c7",
    color: "#92400e",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "10px",
    fontSize: "14px",
  },
  metaLabel: {
    color: "#64748b",
    fontWeight: "700",
  },
  metaValue: {
    color: "#0f172a",
    fontWeight: "700",
    textAlign: "right",
  },
  twoColGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  referenceCard: {
    marginBottom: "16px",
    padding: "18px",
    borderRadius: "18px",
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
  },
  referenceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "12px",
  },
  referenceEyebrow: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "#1d4ed8",
    marginBottom: "4px",
  },
  referenceTitle: {
    color: "#0f172a",
    fontSize: "15px",
  },
  referenceMeta: {
    color: "#1e3a8a",
    fontSize: "12px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },
  referenceValue: {
    marginBottom: "10px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px dashed #93c5fd",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "11px",
    lineHeight: 1.7,
    wordBreak: "break-word",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  referenceHint: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },
  panelTitle: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailRow: {
    marginBottom: "8px",
    fontSize: "14px",
    color: "#334155",
    lineHeight: 1.6,
  },
  tableBlock: {
    marginTop: "8px",
    marginBottom: "16px",
  },
  ewayCard: {
    marginBottom: "16px",
    borderRadius: "20px",
    padding: "18px",
    border: "1px solid #dbe3f0",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.02) 0%, rgba(37,99,235,0.05) 100%)",
  },
  ewayHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  ewayEyebrow: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: "4px",
  },
  ewayTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#0f172a",
  },
  ewayStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "98px",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
  },
  ewayStatusOk: {
    background: "#dcfce7",
    color: "#166534",
  },
  ewayStatusDanger: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  ewayStatusPending: {
    background: "#fef3c7",
    color: "#92400e",
  },
  ewayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  ewayItem: {
    borderRadius: "14px",
    padding: "12px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  ewayLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: "6px",
  },
  ewayValue: {
    fontSize: "14px",
    color: "#0f172a",
  },
  blockTitle: {
    fontSize: "15px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #e5e7eb",
  },
  th: {
    border: "1px solid #e5e7eb",
    padding: "10px",
    background: "#f8fafc",
    fontSize: "13px",
    textAlign: "left",
    color: "#334155",
    fontWeight: "800",
  },
  td: {
    border: "1px solid #e5e7eb",
    padding: "10px",
    fontSize: "13px",
    color: "#111827",
    verticalAlign: "top",
  },
  amountGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "16px",
    marginBottom: "18px",
  },
  amountCard: {
    border: "1px solid #dbe3f0",
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
  },
  amountSectionTitle: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  amountRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "10px",
    fontSize: "14px",
    color: "#334155",
  },
  amountRowStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid #cbd5e1",
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: "800",
  },
  taxTable: {
    width: "100%",
    marginTop: "12px",
    marginBottom: "12px",
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #e2e8f0",
    borderCollapse: "collapse",
  },
  taxLabel: {
    padding: "10px 0",
    color: "#334155",
    fontSize: "14px",
  },
  taxValue: {
    padding: "10px 0",
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: "700",
    textAlign: "right",
  },
  taxSummaryRow: {
    fontWeight: "800",
    borderTop: "1px solid #cbd5e1",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "2px solid #cbd5e1",
    fontSize: "16px",
    color: "#0f172a",
    fontWeight: "800",
  },
  amountWordsCard: {
    marginTop: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    border: "1px solid #bfdbfe",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  amountWordsLabel: {
    color: "#475569",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  amountWordsValue: {
    color: "#0f172a",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.6fr",
    gap: "16px",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "2px solid #e5e7eb",
  },
  footerBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
  },
  footerBoxRight: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    textAlign: "center",
  },
  footerTitle: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "10px",
  },
  footerText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  signatureSpace: {
    height: "80px",
  },
};

export default DispatchPrintPage;
