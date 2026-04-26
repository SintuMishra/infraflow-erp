import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDisplayDate, toDateOnlyValue } from "../utils/date";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BASIS_LABELS = {
  per_unit: "Per Unit",
  per_ton: "Per Ton",
  per_trip: "Per Trip",
  per_day: "Per Day",
  per_km: "Per KM",
  fixed: "Fixed",
};

const QUANTITY_SOURCE_LABELS = {
  weighbridge: "Weighbridge",
  manual_weight: "Manual Weight",
  manual_volume: "Manual Volume",
  vehicle_capacity: "Vehicle Capacity",
  trip_estimate: "Trip Estimate",
};

const formatCurrency = (value) => `₹${currencyFormatter.format(Number(value || 0))}`;
const formatCurrencyValue = (value) =>
  currencyFormatter.format(Number(value || 0));
const formatNumber = (value, fractionDigits = 3) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));

const formatStatusLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";

  return normalized
    .split(/[_\s/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

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

const normalizeLogoUrl = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return "";

  if (
    candidate.startsWith("data:image/") ||
    candidate.startsWith("http://") ||
    candidate.startsWith("https://")
  ) {
    return candidate;
  }

  return "";
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

const safeText = (value, fallback = "Not available") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const displayValue = (value, fallback = "-") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const formatUnitName = (unit, fallback = "Unit") => {
  if (!unit) return fallback;
  return safeText(unit.unitCode || unit.unitName || fallback, fallback);
};

const getBasisLabel = (basis, fallback = "Not specified") =>
  BASIS_LABELS[String(basis || "").trim()] || fallback;

const getQuantitySourceLabel = (source) =>
  QUANTITY_SOURCE_LABELS[String(source || "").trim()] || "Legacy Weight Entry";

const buildBuyerAddress = (record) => {
  const parts = [
    record?.partyAddressLine1,
    record?.partyAddressLine2,
    record?.partyCity,
    record?.partyStateName,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "Buyer address not available";
};

const buildSupplierAddress = (company) => {
  const parts = [
    company?.branchName,
    company?.addressLine1,
    company?.addressLine2,
    company?.city,
    company?.stateName,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "Supplier address not available";
};

const parseDateOnly = (value) => {
  const normalized = toDateOnlyValue(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDocumentState = (record) => {
  const invoiceNumber = String(record?.invoiceNumber || "").trim();
  const dispatchStatus = String(record?.status || "").trim().toLowerCase();
  const hasInvoiceNumber = Boolean(invoiceNumber);
  const dispatchDate = parseDateOnly(record?.dispatchDate);
  const ewbValidUpto = parseDateOnly(record?.ewbValidUpto);
  const currentDate = parseDateOnly(new Date());
  const comparisonDate =
    dispatchDate && currentDate
      ? dispatchDate > currentDate
        ? dispatchDate
        : currentDate
      : dispatchDate || currentDate;
  const isEwbExpired =
    Boolean(record?.ewbNumber) &&
    ewbValidUpto &&
    comparisonDate &&
    ewbValidUpto < comparisonDate;

  let title = hasInvoiceNumber ? "Tax Invoice" : "Delivery Challan / Dispatch Summary";
  let statusLabel = hasInvoiceNumber ? "Valid Tax Invoice" : "Delivery Challan";
  let statusTone = "ok";

  if (dispatchStatus === "cancelled") {
    statusLabel = "Cancelled";
    statusTone = "danger";
  } else if (!hasInvoiceNumber && dispatchStatus === "pending") {
    statusLabel = "Draft Invoice";
    statusTone = "warn";
  } else if (isEwbExpired) {
    statusLabel = "EWB Expired";
    statusTone = "danger";
  }

  return {
    title,
    statusLabel,
    statusTone,
    hasInvoiceNumber,
    isEwbExpired,
  };
};

const getSystemVerificationReference = (record) => {
  const invoiceNumber = safeText(record?.invoiceNumber, "NO-INVOICE");
  const dispatchDate = safeText(record?.dispatchDate, "NO-DATE");
  return `DSP-${record?.id || "NA"}-${dispatchDate}-${invoiceNumber}`;
};

const buildChargeRows = (record, billing) => [
  {
    label: "Material Amount",
    basis: safeText(
      getBasisLabel(record?.billingBasisSnapshot, "Saved Material Basis"),
      "Saved Material Basis"
    ),
    amount: Number(billing?.materialAmount || 0),
  },
  {
    label: "Royalty",
    basis: billing?.royaltyBasisLabel || "-",
    amount: Number(billing?.royaltyAmount || 0),
  },
  {
    label: "Loading Charge",
    basis: billing?.loadingBasisLabel || "-",
    amount: Number(billing?.loadingCharge || 0),
  },
  {
    label: "Transport",
    basis: billing?.transportBasisLabel || "-",
    amount: Number(billing?.transportCost || 0),
  },
  {
    label: "Other Charges",
    basis:
      Number(billing?.otherCharge || 0) > 0
        ? "Additional charges"
        : "-",
    amount: Number(billing?.otherCharge || 0),
  },
];

function DispatchPrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [company, setCompany] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError("");

      try {
        const [dispatchRes, companyRes, unitsRes] = await Promise.allSettled([
          api.get(`/dispatch-reports/${id}`),
          api.get("/company-profile"),
          api.get("/masters/units"),
        ]);

        if (
          dispatchRes.status !== "fulfilled" ||
          companyRes.status !== "fulfilled"
        ) {
          throw (
            dispatchRes.status === "rejected"
              ? dispatchRes.reason
              : companyRes.reason
          );
        }

        setData(dispatchRes.value.data?.data || null);
        setCompany(companyRes.value.data?.data || null);
        setUnits(
          unitsRes.status === "fulfilled"
            ? unitsRes.value.data?.data || []
            : []
        );
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load dispatch billing document"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id]);

  const unitMap = useMemo(() => {
    const map = new Map();
    units.forEach((unit) => {
      map.set(String(unit.id), unit);
    });
    return map;
  }, [units]);

  useEffect(() => {
    const previousTitle = document.title;

    if (!data) {
      return () => {
        document.title = previousTitle;
      };
    }

    const partyName = sanitizeFilenamePart(data.partyName, "Party");
    const documentNumber = sanitizeFilenamePart(
      data.invoiceNumber,
      `DC-${data.id || "Dispatch"}`
    );
    document.title = `${partyName} - ${documentNumber} - Dispatch Invoice`;

    return () => {
      document.title = previousTitle;
    };
  }, [data]);

  const billing = useMemo(() => {
    if (!data) return null;

    const materialAmount = Number(data.materialAmount || 0);
    const transportCost = Number(data.transportCost || 0);
    const royaltyAmount = Number(data.royaltyAmount || 0);
    const loadingCharge = Number(data.loadingCharge || 0);
    const otherCharge = Number(data.otherCharge || 0);
    const componentSubtotal = Number(
      (materialAmount + transportCost + royaltyAmount + loadingCharge + otherCharge).toFixed(2)
    );
    const taxableValue = Number(data.totalInvoiceValue ?? data.invoiceValue ?? 0);
    const gstRate = Number(data.gstRate || 0);
    const cgst = Number(data.cgst || 0);
    const sgst = Number(data.sgst || 0);
    const igst = Number(data.igst || 0);
    const gstTotal = Number((cgst + sgst + igst).toFixed(2));
    const totalWithGst = Number(data.totalWithGst || taxableValue);
    const invoiceAdjustment = Number((taxableValue - componentSubtotal).toFixed(2));
    const taxMode =
      igst > 0 ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)";
    const quantityTons = Number(data.quantityTons || 0);
    const royaltyMode = String(data.royaltyMode || "none").trim();
    const loadingChargeBasis = String(data.loadingChargeBasis || "fixed").trim();
    const loadingChargeRate = Number(
      (data.loadingChargeRate ?? data.loadingCharge) || 0
    );

    let royaltyBasisLabel = "-";
    if (royaltyMode === "per_ton") {
      royaltyBasisLabel = `${formatNumber(quantityTons)} Tons x ${formatCurrency(
        data.royaltyValue || 0
      )} per Ton`;
    } else if (royaltyMode === "per_brass") {
      const tonsPerBrass = Number(data.royaltyTonsPerBrass || 0);
      const brassQuantity =
        tonsPerBrass > 0
          ? Number((quantityTons / tonsPerBrass).toFixed(4))
          : 0;
      royaltyBasisLabel = `${formatNumber(quantityTons)} Tons ~ ${formatNumber(
        brassQuantity,
        4
      )} Brass x ${formatCurrency(data.royaltyValue || 0)} per Brass`;
    } else if (royaltyMode === "fixed") {
      royaltyBasisLabel = `Fixed ${formatCurrency(data.royaltyValue || 0)}`;
    }

    let loadingBasisLabel = "-";
    if (loadingChargeBasis === "per_ton") {
      loadingBasisLabel = `${formatNumber(quantityTons)} Tons x ${formatCurrency(
        loadingChargeRate
      )} per Ton`;
    } else if (loadingChargeBasis === "per_brass") {
      const tonsPerBrass = Number(data.royaltyTonsPerBrass || 0);
      const brassQuantity =
        tonsPerBrass > 0
          ? Number((quantityTons / tonsPerBrass).toFixed(4))
          : 0;
      loadingBasisLabel = `${formatNumber(quantityTons)} Tons ~ ${formatNumber(
        brassQuantity,
        4
      )} Brass x ${formatCurrency(loadingChargeRate)} per Brass`;
    } else if (loadingChargeBasis === "per_trip") {
      loadingBasisLabel = `${formatCurrency(loadingChargeRate)} per Trip`;
    } else if (loadingChargeBasis === "fixed") {
      loadingBasisLabel = `Fixed ${formatCurrency(loadingChargeRate)}`;
    }

    const transportBasisLabel = data.transportBasisSnapshot
      ? `${getBasisLabel(data.transportBasisSnapshot)}${
          data.transportRateValue !== null && data.transportRateValue !== undefined
            ? ` @ ₹${formatCurrencyValue(data.transportRateValue)}`
            : ""
        }`
      : "-";

    return {
      materialAmount,
      transportCost,
      royaltyAmount,
      loadingCharge,
      otherCharge,
      componentSubtotal,
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      gstTotal,
      totalWithGst,
      amountInWords: formatAmountInWords(totalWithGst),
      taxMode,
      invoiceAdjustment,
      royaltyBasisLabel,
      loadingBasisLabel,
      transportBasisLabel,
    };
  }, [data]);

  const printableLogoUrl = useMemo(
    () => normalizeLogoUrl(company?.logoUrl),
    [company?.logoUrl]
  );

  const documentState = useMemo(() => getDocumentState(data), [data]);

  const quantityDetails = useMemo(() => {
    if (!data) return null;

    const enteredUnit =
      unitMap.get(String(data.enteredUnitId || "")) || null;
    const billingUnit =
      unitMap.get(String(data.billingUnitIdSnapshot || "")) || null;
    const transportUnit =
      unitMap.get(String(data.transportUnitIdSnapshot || "")) || null;

    const normalizedQuantity = Number(data.quantityTons || 0);
    const hasEnteredQuantity =
      data.enteredQuantity !== null &&
      data.enteredQuantity !== undefined &&
      data.enteredQuantity !== "";
    const enteredQuantityValue = hasEnteredQuantity
      ? Number(data.enteredQuantity)
      : normalizedQuantity;
    const enteredUnitLabel = hasEnteredQuantity
      ? formatUnitName(
          enteredUnit,
          String(data.quantitySource || "").trim() === "manual_volume" ? "Unit" : "Tons"
        )
      : "Tons";
    const quantitySourceLabel = hasEnteredQuantity
      ? getQuantitySourceLabel(data.quantitySource)
      : "Legacy Weight Entry";
    const billingQuantity =
      data.billedQuantitySnapshot !== null &&
      data.billedQuantitySnapshot !== undefined
        ? Number(data.billedQuantitySnapshot)
        : normalizedQuantity;
    const billingUnitLabel =
      formatUnitName(
        billingUnit,
        data.billingBasisSnapshot === "per_ton"
          ? "Tons"
          : data.materialRateUnitLabel || "Unit"
      );
    const billingBasisLabel = getBasisLabel(
      data.billingBasisSnapshot,
      "-"
    );
    const transportBasisLabel = data.transportBasisSnapshot
      ? getBasisLabel(data.transportBasisSnapshot)
      : "-";
    const transportQuantityLabel =
      data.transportQuantitySnapshot !== null &&
      data.transportQuantitySnapshot !== undefined
        ? `${formatNumber(data.transportQuantitySnapshot, 4)} ${formatUnitName(
            transportUnit,
            data.transportBasisSnapshot === "per_km"
              ? "KM"
              : data.transportBasisSnapshot === "per_ton"
                ? "Tons"
                : data.transportBasisSnapshot === "per_trip"
                  ? "Trip"
                  : "Unit"
          )}`
        : "-";

    let conversionMessage = safeText(
      data.conversionNotesSnapshot,
      hasEnteredQuantity && String(data.quantitySource || "").trim() === "manual_volume"
        ? `Quantity converted as per material conversion master: ${formatNumber(
            enteredQuantityValue,
            4
          )} ${enteredUnitLabel} = ${formatNumber(normalizedQuantity, 3)} Tons`
        : "-"
    );

    if (!hasEnteredQuantity) {
      conversionMessage = "Legacy dispatch entry used weight directly without unit conversion.";
    }

    return {
      enteredQuantityLabel: `${formatNumber(enteredQuantityValue, 4)} ${enteredUnitLabel}`,
      quantitySourceLabel,
      normalizedQuantityLabel: `${formatNumber(normalizedQuantity, 3)} Tons`,
      billingQuantityLabel: `${formatNumber(billingQuantity, 4)} ${billingUnitLabel}`,
      billingBasisLabel,
      transportBasisLabel,
      transportQuantityLabel,
      billedRateLabel:
        data.billedRateSnapshot !== null && data.billedRateSnapshot !== undefined
          ? `${formatCurrencyValue(data.billedRateSnapshot)} / ${billingUnitLabel}`
          : "-",
      conversionMessage,
    };
  }, [data, unitMap]);

  const chargeRows = useMemo(
    () => buildChargeRows(data, billing),
    [billing, data]
  );

  const itemRow = useMemo(() => {
    if (!data || !billing || !quantityDetails) return null;

    return {
      material: safeText(data.materialName || data.materialType, "Material not available"),
      materialCode: displayValue(data.materialCode),
      hsnSac: displayValue(data.hsnSacCode),
      qty: formatNumber(data.quantityTons || 0, 3),
      uom: "Tons",
      billingQty: formatNumber(data.billedQuantitySnapshot ?? data.quantityTons ?? 0, 4),
      billingUnit:
        quantityDetails.billingQuantityLabel.split(" ").slice(1).join(" ") || "Unit",
      rate: quantityDetails.billedRateLabel,
      taxableValue: formatCurrencyValue(billing.taxableValue),
      gstRate: `${formatNumber(billing.gstRate, 2)}%`,
      cgst: billing.cgst > 0 ? formatCurrencyValue(billing.cgst) : "-",
      sgst: billing.sgst > 0 ? formatCurrencyValue(billing.sgst) : "-",
      igst: billing.igst > 0 ? formatCurrencyValue(billing.igst) : "-",
      lineTotal: formatCurrencyValue(billing.totalWithGst),
    };
  }, [billing, data, quantityDetails]);

  if (loading) {
    return <div style={styles.loading}>Loading dispatch billing document...</div>;
  }

  if (error) {
    return <div style={styles.loading}>{error}</div>;
  }

  if (!data || !company || !billing || !quantityDetails || !itemRow) {
    return <div style={styles.loading}>Dispatch print data not available.</div>;
  }

  return (
    <div style={styles.page} className="print-page">
      <style>{printStyles}</style>

      <div style={styles.toolbar} className="no-print">
        <div style={styles.toolbarMeta}>
          <div style={styles.toolbarTitle}>Dispatch Billing Document</div>
          <div style={styles.toolbarHint}>Professional A4 invoice / challan layout</div>
        </div>

        <div style={styles.toolbarActions}>
          <button type="button" style={styles.toolbarButton} onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button
            type="button"
            style={styles.secondaryToolbarButton}
            onClick={() => window.history.back()}
          >
            Back
          </button>
        </div>
      </div>

      <div style={styles.document} className="print-document">
        <div style={styles.topBand} className="print-top-band">
          <div style={styles.topBandPrimary}>
            <div style={styles.documentTypeLabel}>{documentState.title}</div>
            <h1 style={styles.documentTitle}>
              {company.companyName || "Supplier Name Not Available"}
            </h1>
            <div style={styles.headerMetaLine}>{buildSupplierAddress(company)}</div>
            <div style={styles.headerMetaLine}>
              GSTIN: {displayValue(company.gstin)} | PAN: {displayValue(company.pan)} |
              {" "}State: {displayValue(company.stateName)}
            </div>
          </div>

          <div style={styles.topBandSummary}>
            {printableLogoUrl ? (
              <div style={styles.logoCard}>
                <img src={printableLogoUrl} alt="Company logo" style={styles.logoImage} />
              </div>
            ) : null}

            <div style={styles.summaryBox}>
              <div style={styles.summaryBoxHeader}>
                <span style={styles.summaryBoxTitle}>Invoice Summary</span>
                <span style={styles.summaryBoxCurrency}>Amount (₹)</span>
              </div>
              <div style={styles.summaryBoxRow}>
                <span>Taxable Value</span>
                <strong>{formatCurrencyValue(billing.taxableValue)}</strong>
              </div>
              <div style={styles.summaryBoxRow}>
                <span>Total GST</span>
                <strong>{formatCurrencyValue(billing.gstTotal)}</strong>
              </div>
              <div style={styles.summaryBoxTotal}>
                <span>Grand Total</span>
                <strong>{formatCurrencyValue(billing.totalWithGst)}</strong>
              </div>
              <div
                style={{
                  ...styles.statusPill,
                  ...(documentState.statusTone === "ok"
                    ? styles.statusPillOk
                    : documentState.statusTone === "danger"
                      ? styles.statusPillDanger
                      : styles.statusPillWarn),
                }}
              >
                {documentState.statusLabel}
              </div>
            </div>
          </div>
        </div>

        {documentState.isEwbExpired ? (
          <div style={styles.criticalBanner}>
            EWB EXPIRED - NOT VALID FOR MOVEMENT
          </div>
        ) : null}

        {documentState.statusLabel === "Cancelled" ? (
          <div style={styles.warningBanner}>
            Cancelled document. Retain only for audit and reconciliation reference.
          </div>
        ) : null}

        {!documentState.hasInvoiceNumber ? (
          <div style={styles.warningBanner}>
            Invoice number not available. This document is shown as Delivery Challan /
            Dispatch Summary and should not be treated as a final tax invoice.
          </div>
        ) : null}

        <div style={styles.headerGrid} className="print-section print-two-col-grid">
          <section style={styles.card}>
            <div style={styles.sectionTitle}>Supplier</div>
            <div style={styles.detailLine}>
              <strong>Supplier:</strong> {safeText(company.companyName, "Supplier name not available")}
            </div>
            <div style={styles.detailLine}>
              <strong>Address:</strong> {buildSupplierAddress(company)}
            </div>
            <div style={styles.detailLine}>
              <strong>GSTIN:</strong> {displayValue(company.gstin)}
            </div>
            <div style={styles.detailLine}>
              <strong>PAN:</strong> {displayValue(company.pan)}
            </div>
            <div style={styles.detailLine}>
              <strong>Contact:</strong> {displayValue(company.mobile)} | {displayValue(company.email)}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Buyer / Consignee</div>
            <div style={styles.detailLine}>
              <strong>Buyer:</strong> {safeText(data.partyName, "Party not available")}
            </div>
            <div style={styles.detailLine}>
              <strong>Address:</strong> {buildBuyerAddress(data)}
            </div>
            <div style={styles.detailLine}>
              <strong>GSTIN:</strong> {displayValue(data.partyGstin)}
            </div>
            <div style={styles.detailLine}>
              <strong>Place of Supply:</strong> {displayValue(data.partyStateName)}
            </div>
            <div style={styles.detailLine}>
              <strong>Destination:</strong> {displayValue(data.destinationName)}
            </div>
          </section>
        </div>

        <div style={styles.headerGrid} className="print-section print-two-col-grid">
          <section style={styles.card}>
            <div style={styles.sectionTitle}>Invoice / Challan Details</div>
            <div style={styles.detailLine}>
              <strong>Document No:</strong> DC-{data.id || "NA"}
            </div>
            <div style={styles.detailLine}>
              <strong>Invoice No:</strong> {displayValue(data.invoiceNumber, "Not generated")}
            </div>
            <div style={styles.detailLine}>
              <strong>Invoice Date:</strong> {displayValue(formatDisplayDate(data.invoiceDate))}
            </div>
            <div style={styles.detailLine}>
              <strong>Dispatch Date:</strong> {displayValue(formatDisplayDate(data.dispatchDate))}
            </div>
            <div style={styles.detailLine}>
              <strong>Dispatch Status:</strong> {displayValue(formatStatusLabel(data.status))}
            </div>
            <div style={styles.detailLine}>
              <strong>System Verification Reference:</strong> {getSystemVerificationReference(data)}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Dispatch / E-Way Details</div>
            <div style={styles.detailLine}>
              <strong>Plant / Unit:</strong> {displayValue(data.plantName)}
            </div>
            <div style={styles.detailLine}>
              <strong>Source Type:</strong> {displayValue(data.sourceType)}
            </div>
            <div style={styles.detailLine}>
              <strong>Vehicle No:</strong> {displayValue(data.linkedVehicleNumber || data.vehicleNumber)}
            </div>
            <div style={styles.detailLine}>
              <strong>Vehicle Type:</strong> {displayValue(data.vehicleType)}
            </div>
            <div style={styles.detailLine}>
              <strong>Transport Vendor:</strong> {displayValue(data.transportVendorName, "Not linked")}
            </div>
            <div style={styles.detailLine}>
              <strong>EWB No:</strong> {displayValue(data.ewbNumber, "Not generated")}
            </div>
            <div style={styles.detailLine}>
              <strong>EWB Valid Upto:</strong> {displayValue(formatDisplayDate(data.ewbValidUpto))}
            </div>
          </section>
        </div>

        <section style={styles.tableSection} className="print-section">
          <div style={styles.sectionTitle}>Item Details</div>
          <div style={styles.tableWrap} className="print-table-wrap">
            <table style={styles.table} className="print-item-table">
              <colgroup>
                <col style={{ width: "4.5%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "9.5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.th}>Sr</th>
                  <th style={styles.th}>Material</th>
                  <th style={styles.th}>Code</th>
                  <th style={styles.th}>HSN/SAC</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Qty</th>
                  <th style={styles.th}>UOM</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Billing Qty</th>
                  <th style={styles.th}>Billing Unit</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Rate (₹)</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Taxable (₹)</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>GST %</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>CGST (₹)</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>SGST (₹)</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>IGST (₹)</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Line Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>1</td>
                  <td style={styles.td}>{itemRow.material}</td>
                  <td style={styles.td}>{itemRow.materialCode}</td>
                  <td style={styles.td}>{itemRow.hsnSac}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.qty}</td>
                  <td style={styles.td}>{itemRow.uom}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.billingQty}</td>
                  <td style={styles.td}>{itemRow.billingUnit}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.rate}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.taxableValue}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.gstRate}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.cgst}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.sgst}</td>
                  <td style={{ ...styles.td, ...styles.tdNumeric }}>{itemRow.igst}</td>
                  <td style={{ ...styles.td, ...styles.tdNumericStrong }}>{itemRow.lineTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div style={styles.summaryGrid} className="print-section print-summary-grid">
          <section style={styles.card}>
            <div style={styles.sectionTitle}>Additional Charges</div>
            <table style={styles.chargeTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Charge Head</th>
                  <th style={styles.th}>Basis</th>
                  <th style={{ ...styles.th, ...styles.thNumeric }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {chargeRows.map((row) => (
                  <tr key={row.label}>
                    <td style={styles.td}>{row.label}</td>
                    <td style={styles.td}>{row.basis}</td>
                    <td style={{ ...styles.td, ...styles.tdNumeric }}>
                      {formatCurrencyValue(row.amount)}
                    </td>
                  </tr>
                ))}
                {Math.abs(billing.invoiceAdjustment) >= 0.01 ? (
                  <tr>
                    <td style={styles.td}>Manual Taxable Value Override</td>
                    <td style={styles.td}>Saved taxable invoice adjustment</td>
                    <td style={{ ...styles.td, ...styles.tdNumeric }}>
                      {formatCurrencyValue(billing.invoiceAdjustment)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>GST Summary</div>
            <div style={styles.amountRow}>
              <span>Taxable Value</span>
              <strong>₹ {formatCurrencyValue(billing.taxableValue)}</strong>
            </div>
            <div style={styles.amountRow}>
              <span>GST Rate</span>
              <strong>{formatNumber(billing.gstRate, 2)}%</strong>
            </div>
            {billing.igst > 0 ? (
              <div style={styles.amountRow}>
                <span>IGST</span>
                <strong>₹ {formatCurrencyValue(billing.igst)}</strong>
              </div>
            ) : (
              <>
                <div style={styles.amountRow}>
                  <span>CGST</span>
                  <strong>₹ {formatCurrencyValue(billing.cgst)}</strong>
                </div>
                <div style={styles.amountRow}>
                  <span>SGST</span>
                  <strong>₹ {formatCurrencyValue(billing.sgst)}</strong>
                </div>
              </>
            )}
            <div style={styles.amountRowStrong}>
              <span>Total GST</span>
              <strong>₹ {formatCurrencyValue(billing.gstTotal)}</strong>
            </div>
            <div style={styles.totalRow}>
              <span>Grand Total</span>
              <strong>₹ {formatCurrencyValue(billing.totalWithGst)}</strong>
            </div>
          </section>
        </div>

        <div style={styles.headerGrid} className="print-section print-two-col-grid">
          <section style={styles.card}>
            <div style={styles.sectionTitle}>Quantity & Billing Basis</div>
            <div style={styles.detailLine}>
              <strong>Entered Quantity:</strong> {quantityDetails.enteredQuantityLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Quantity Source:</strong> {quantityDetails.quantitySourceLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Normalized Quantity:</strong> {quantityDetails.normalizedQuantityLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Billing Quantity:</strong> {quantityDetails.billingQuantityLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Billing Basis:</strong> {quantityDetails.billingBasisLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Billed Rate:</strong> {quantityDetails.billedRateLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Transport Basis:</strong> {quantityDetails.transportBasisLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Transport Quantity:</strong> {quantityDetails.transportQuantityLabel}
            </div>
            <div style={styles.detailLine}>
              <strong>Transport Rate:</strong>{" "}
              {data.transportRateValue !== null && data.transportRateValue !== undefined
                ? `₹${formatCurrencyValue(data.transportRateValue)}`
                : "-"}
            </div>
            <div style={styles.compactNote}>{quantityDetails.conversionMessage}</div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Declaration</div>
            <div style={styles.detailLine}>
              <strong>Amount in Words:</strong> {billing.amountInWords}
            </div>
            <div style={styles.detailLine}>
              Certified that the particulars stated above are true and correct and
              represent the dispatch and invoice details recorded for this consignment.
            </div>
          </section>
        </div>

        <div style={styles.signatureGrid} className="print-section print-footer-grid print-signature-grid">
          <div style={styles.signatureCard}>
            <div style={styles.signatureTitle}>Prepared By</div>
            <div style={styles.signatureMeta}>Dispatch</div>
            <div style={styles.signatureSpace} />
          </div>
          <div style={styles.signatureCard}>
            <div style={styles.signatureTitle}>Checked By</div>
            <div style={styles.signatureMeta}>Accounts / Commercial</div>
            <div style={styles.signatureSpace} />
          </div>
          <div style={styles.signatureCard}>
            <div style={styles.signatureTitle}>Authorized Signatory</div>
            <div style={styles.signatureMeta}>For {safeText(company.companyName, "Company")}</div>
            <div style={styles.signatureSpace} />
          </div>
        </div>
      </div>
    </div>
  );
}

const printStyles = `
  @media (max-width: 980px) {
    .print-page {
      padding: 8px !important;
    }

    .print-document {
      padding: 14px !important;
      border-radius: 6px !important;
    }

    .print-top-band,
    .print-two-col-grid,
    .print-summary-grid,
    .print-signature-grid {
      grid-template-columns: 1fr !important;
      flex-direction: column !important;
    }

    .print-top-band {
      align-items: stretch !important;
    }

    .print-item-table {
      min-width: 860px !important;
    }
  }

  @media print {
    @page {
      size: A4;
      margin: 7mm;
    }

    html,
    body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      color: #000000 !important;
    }

    .no-print {
      display: none !important;
    }

    .print-page {
      min-height: auto !important;
      background: #ffffff !important;
      padding: 0 !important;
    }

    .print-document {
      max-width: none !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
      overflow: visible !important;
      gap: 4px !important;
    }

    .print-top-band {
      align-items: flex-start !important;
      gap: 8px !important;
      margin-bottom: 2px !important;
      padding-bottom: 6px !important;
    }

    .print-two-col-grid,
    .print-summary-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 5px !important;
      margin-bottom: 0 !important;
    }

    .print-signature-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 5px !important;
      margin-top: 5px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .print-section,
    .print-section table,
    .print-section tr,
    .print-summary-grid > *,
    .print-two-col-grid > *,
    .print-signature-grid {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .print-table-wrap {
      overflow: visible !important;
    }

    .print-item-table {
      width: 100% !important;
      min-width: 0 !important;
      table-layout: fixed !important;
    }

    .print-item-table th,
    .print-item-table td {
      font-size: 9.25px !important;
      line-height: 1.18 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      vertical-align: top !important;
    }

    .print-item-table td:nth-child(2),
    .print-item-table td:nth-child(3),
    .print-item-table td:nth-child(4),
    .print-item-table td:nth-child(8) {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      overflow-wrap: break-word !important;
      word-break: normal !important;
    }

    th,
    td {
      padding: 3px 4px !important;
    }

    * {
      box-shadow: none !important;
    }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f5f5",
    padding: "24px",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    color: "#444444",
  },
  toolbar: {
    maxWidth: "1120px",
    margin: "0 auto 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "14px 18px",
    borderRadius: "8px",
    background: "#ffffff",
    border: "1px solid #d0d0d0",
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
  },
  toolbarMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  toolbarTitle: {
    fontSize: "15px",
    fontWeight: "800",
    color: "#000000",
  },
  toolbarHint: {
    fontSize: "12px",
    color: "#777777",
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
    borderRadius: "8px",
    background: "#000000",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },
  secondaryToolbarButton: {
    padding: "12px 16px",
    border: "1px solid #cfcfcf",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#000000",
    fontWeight: "700",
    cursor: "pointer",
  },
  document: {
    maxWidth: "1120px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "6px",
    padding: "16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    border: "1px solid #d6d6d6",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  topBand: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "2px",
    paddingBottom: "5px",
    borderBottom: "1px solid #bdbdbd",
  },
  topBandPrimary: {
    minWidth: 0,
    flex: 1,
  },
  topBandSummary: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px",
    minWidth: 0,
  },
  documentTypeLabel: {
    display: "inline-flex",
    padding: "2px 0",
    color: "#444444",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: "3px",
  },
  documentTitle: {
    margin: 0,
    color: "#000000",
    fontSize: "15px",
    fontWeight: "800",
    lineHeight: 1.2,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  headerMetaLine: {
    marginTop: "2px",
    color: "#444444",
    fontSize: "10px",
    lineHeight: 1.3,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "24px",
    padding: "4px 8px",
    borderRadius: "0",
    fontSize: "9px",
    fontWeight: "800",
    border: "1px solid currentColor",
    textTransform: "uppercase",
  },
  statusPillOk: {
    background: "#ffffff",
    color: "#000000",
  },
  statusPillWarn: {
    background: "#ffffff",
    color: "#444444",
  },
  statusPillDanger: {
    background: "#ffffff",
    color: "#991b1b",
  },
  logoCard: {
    width: "120px",
    minHeight: "52px",
    border: "1px solid #d9d9d9",
    borderRadius: "0",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px",
  },
  logoImage: {
    maxWidth: "100%",
    maxHeight: "40px",
    objectFit: "contain",
    display: "block",
  },
  summaryBox: {
    minWidth: "220px",
    border: "1px solid #000000",
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  summaryBoxHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    paddingBottom: "2px",
    borderBottom: "1px solid #bdbdbd",
  },
  summaryBoxTitle: {
    fontSize: "10px",
    fontWeight: "800",
    color: "#000000",
    textTransform: "uppercase",
  },
  summaryBoxCurrency: {
    fontSize: "9px",
    fontWeight: "700",
    color: "#777777",
  },
  summaryBoxRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    color: "#444444",
    fontSize: "9.5px",
    lineHeight: 1.3,
  },
  summaryBoxTotal: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    paddingTop: "4px",
    borderTop: "1px solid #000000",
    color: "#000000",
    fontSize: "14px",
    fontWeight: "900",
    marginTop: "2px",
  },
  criticalBanner: {
    marginBottom: "2px",
    padding: "5px 10px",
    background: "#c62828",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "10px",
    textTransform: "uppercase",
    textAlign: "center",
  },
  warningBanner: {
    marginBottom: "2px",
    padding: "6px 9px",
    background: "#ffffff",
    border: "1px solid #777777",
    color: "#444444",
    fontSize: "9.5px",
    lineHeight: 1.3,
    fontWeight: "700",
  },
  headerGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "5px",
    marginBottom: "0",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "5px",
    marginBottom: "0",
  },
  card: {
    border: "1px solid #cfcfcf",
    borderRadius: "0",
    padding: "6px 8px",
    background: "#ffffff",
    minWidth: 0,
  },
  sectionTitle: {
    marginBottom: "4px",
    color: "#000000",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    borderBottom: "1px solid #d5d5d5",
    paddingBottom: "2px",
  },
  detailLine: {
    marginBottom: "3px",
    color: "#444444",
    fontSize: "10px",
    lineHeight: 1.32,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  compactNote: {
    marginTop: "3px",
    color: "#777777",
    fontSize: "9.5px",
    lineHeight: 1.28,
  },
  tableSection: {
    marginBottom: "0",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #cfcfcf",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "880px",
    tableLayout: "fixed",
  },
  th: {
    borderBottom: "1px solid #cfcfcf",
    padding: "4px 4px",
    background: "#ffffff",
    color: "#000000",
    fontSize: "9.5px",
    fontWeight: "800",
    textAlign: "left",
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  thNumeric: {
    textAlign: "right",
  },
  td: {
    borderBottom: "1px solid #e4e4e4",
    padding: "4px 4px",
    color: "#444444",
    fontSize: "9.5px",
    verticalAlign: "top",
    lineHeight: 1.2,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  tdNumeric: {
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  tdNumericStrong: {
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#000000",
    fontWeight: "800",
  },
  chargeTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  amountRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "4px",
    color: "#444444",
    fontSize: "9.75px",
    alignItems: "flex-start",
  },
  amountRowStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "4px",
    paddingTop: "4px",
    borderTop: "1px solid #cfcfcf",
    color: "#000000",
    fontSize: "9.75px",
    fontWeight: "800",
    alignItems: "flex-start",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "6px",
    paddingTop: "6px",
    borderTop: "2px solid #000000",
    color: "#000000",
    fontSize: "14px",
    fontWeight: "900",
    alignItems: "flex-start",
  },
  signatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "5px",
    marginTop: "auto",
    paddingTop: "5px",
    borderTop: "1px solid #bdbdbd",
    alignItems: "stretch",
  },
  signatureCard: {
    border: "1px solid #cfcfcf",
    borderRadius: "0",
    padding: "6px",
    textAlign: "center",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  signatureTitle: {
    color: "#000000",
    fontSize: "10px",
    fontWeight: "800",
    marginBottom: "3px",
    textTransform: "uppercase",
  },
  signatureMeta: {
    color: "#777777",
    fontSize: "9.5px",
    fontWeight: "700",
  },
  signatureSpace: {
    height: "42px",
  },
};

export default DispatchPrintPage;
