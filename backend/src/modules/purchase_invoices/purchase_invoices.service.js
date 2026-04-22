const {
  getInvoiceWithMetrics,
  getPoLineSnapshot,
  getPostedInvoiceQtyByPoLine,
  getPurchaseInvoiceById,
  insertPurchaseInvoice,
  listPurchaseInvoices,
  updateInvoicePosting,
} = require("./purchase_invoices.model");
const { createPayable } = require("../accounts_payable/accounts_payable.service");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const MATCH_RATE_TOLERANCE = 0.01;

const buildValidationError = (message, statusCode = 400, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

const buildInvoiceNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PINV-${timestamp}${random}`;
};

const normalizeItemCategory = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "material";
};

const normalizeLine = (line) => {
  const billedQuantity = Number(line.billedQuantity || 0);
  const unitRate = Number(line.unitRate || 0);
  const itemCategory = normalizeItemCategory(line.itemCategory);
  return {
    purchaseOrderLineId: Number(line.purchaseOrderLineId || 0),
    goodsReceiptLineId: line.goodsReceiptLineId ? Number(line.goodsReceiptLineId) : null,
    materialId: Number(line.materialId || 0),
    itemCategory: itemCategory || "material",
    billedQuantity,
    unitRate,
    lineAmount: Number((billedQuantity * unitRate).toFixed(2)),
    remarks: String(line.remarks || "").trim() || null,
  };
};

const normalizeLines = (lines = []) => {
  if (!Array.isArray(lines) || !lines.length) {
    throw buildValidationError("lines must be a non-empty array");
  }

  return lines.map((line) => {
    const normalized = normalizeLine(line);
    if (!normalized.purchaseOrderLineId || !normalized.materialId) {
      throw buildValidationError("each line must include purchaseOrderLineId and materialId");
    }
    if (!(normalized.billedQuantity > 0)) {
      throw buildValidationError("billedQuantity must be greater than 0 for each line");
    }
    if (normalized.unitRate < 0) {
      throw buildValidationError("unitRate cannot be negative");
    }
    return normalized;
  });
};

const listInvoices = async ({ companyId, status = "", matchStatus = "" }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }

  return listPurchaseInvoices({
    companyId: scopedCompanyId,
    status: String(status || "").trim().toLowerCase() || null,
    matchStatus: String(matchStatus || "").trim().toLowerCase() || null,
  });
};

const getInvoice = async ({ id, companyId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const invoiceId = Number(id || 0);

  if (!scopedCompanyId || !invoiceId) {
    throw buildValidationError("Valid companyId and purchase invoice id are required");
  }

  const row = await getInvoiceWithMetrics({ id: invoiceId, companyId: scopedCompanyId });
  if (!row) {
    throw buildValidationError("Purchase invoice not found", 404, "NOT_FOUND");
  }

  return row;
};

const applyMatching = ({ lines, poLineMap, invoicedQtyByPoLine }) => {
  let hasVariance = false;
  let hasBlocked = false;
  const mismatchNotes = [];

  const matchedLines = lines.map((line) => {
    const poLine = poLineMap.get(Number(line.purchaseOrderLineId));
    if (!poLine) {
      hasBlocked = true;
      mismatchNotes.push(`PO line ${line.purchaseOrderLineId} not found`);
      return {
        ...line,
        matchStatus: "blocked",
        varianceQty: line.billedQuantity,
        varianceRate: line.unitRate,
        varianceAmount: line.lineAmount,
      };
    }

    if (Number(poLine.materialId) !== Number(line.materialId)) {
      hasBlocked = true;
      mismatchNotes.push(`Material mismatch on PO line ${line.purchaseOrderLineId}`);
      return {
        ...line,
        matchStatus: "blocked",
        varianceQty: line.billedQuantity,
        varianceRate: line.unitRate,
        varianceAmount: line.lineAmount,
      };
    }

    const receivedQty = Number(poLine.receivedQuantity || 0);
    const invoicedQty = Number(invoicedQtyByPoLine.get(Number(line.purchaseOrderLineId)) || 0);
    const availableToBill = Math.max(receivedQty - invoicedQty, 0);
    const poRate = Number(poLine.unitRate || 0);

    const qtyVariance = Number((line.billedQuantity - availableToBill).toFixed(3));
    const rateVariance = Number((line.unitRate - poRate).toFixed(2));
    const amountVariance = Number((qtyVariance * line.unitRate).toFixed(2));

    let matchStatus = "matched";

    if (line.billedQuantity > availableToBill + 0.00001) {
      matchStatus = "blocked";
      hasBlocked = true;
      mismatchNotes.push(
        `Billed quantity exceeds GRN-received balance for PO line ${line.purchaseOrderLineId}`
      );
    } else if (Math.abs(rateVariance) > MATCH_RATE_TOLERANCE) {
      matchStatus = "variance";
      hasVariance = true;
      mismatchNotes.push(`Rate variance detected for PO line ${line.purchaseOrderLineId}`);
    }

    return {
      ...line,
      matchStatus,
      varianceQty: qtyVariance,
      varianceRate: rateVariance,
      varianceAmount: amountVariance,
    };
  });

  const totalAmount = Number(
    matchedLines.reduce((acc, line) => acc + Number(line.lineAmount || 0), 0).toFixed(2)
  );

  const matchStatus = hasBlocked ? "blocked" : hasVariance ? "variance" : "matched";

  return {
    lines: matchedLines,
    totalAmount,
    matchStatus,
    mismatchNotes: mismatchNotes.join("; "),
  };
};

const createInvoice = async ({
  companyId,
  purchaseOrderId,
  goodsReceiptId,
  vendorId,
  invoiceDate,
  dueDate,
  notes,
  lines,
  postToPayables = true,
  userId,
}) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }

  const normalizedLines = normalizeLines(lines);
  const normalizedPoId = Number(purchaseOrderId || 0);
  const normalizedVendorId = Number(vendorId || 0);

  if (!normalizedPoId || !normalizedVendorId) {
    throw buildValidationError("purchaseOrderId and vendorId are required");
  }

  const poLineMap = await getPoLineSnapshot({ companyId: scopedCompanyId, purchaseOrderId: normalizedPoId });
  const invoicedQtyByPoLine = await getPostedInvoiceQtyByPoLine({
    companyId: scopedCompanyId,
    purchaseOrderId: normalizedPoId,
  });

  const matchedResult = applyMatching({
    lines: normalizedLines,
    poLineMap,
    invoicedQtyByPoLine,
  });

  const invoiceId = await insertPurchaseInvoice({
    companyId: scopedCompanyId,
    invoiceNumber: buildInvoiceNumber(),
    purchaseOrderId: normalizedPoId,
    goodsReceiptId: goodsReceiptId ? Number(goodsReceiptId) : null,
    vendorId: normalizedVendorId,
    invoiceDate: String(invoiceDate || "").trim(),
    dueDate: String(dueDate || "").trim(),
    status: "draft",
    matchStatus: matchedResult.matchStatus,
    mismatchNotes: matchedResult.mismatchNotes || String(notes || "").trim() || null,
    totalAmount: matchedResult.totalAmount,
    lines: matchedResult.lines,
    userId: Number(userId) || null,
  });

  if (postToPayables !== false && matchedResult.matchStatus !== "blocked") {
    const payablePosting = await createPayable({
      companyId: scopedCompanyId,
      vendorId: normalizedVendorId,
      referenceNumber: `PINV-${invoiceId}`,
      billDate: String(invoiceDate || "").trim(),
      dueDate: String(dueDate || "").trim(),
      amount: matchedResult.totalAmount,
      notes: String(notes || "").trim() || `Purchase invoice #${invoiceId}`,
      userId: Number(userId) || null,
    });

    await updateInvoicePosting({
      id: invoiceId,
      companyId: scopedCompanyId,
      payableId: payablePosting.payable?.id || null,
    });
  }

  return getInvoiceWithMetrics({ id: invoiceId, companyId: scopedCompanyId });
};

const postInvoiceToPayables = async ({ id, companyId, userId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const invoiceId = Number(id || 0);
  if (!scopedCompanyId || !invoiceId) {
    throw buildValidationError("Valid companyId and purchase invoice id are required");
  }

  const invoice = await getPurchaseInvoiceById({ id: invoiceId, companyId: scopedCompanyId });
  if (!invoice) {
    throw buildValidationError("Purchase invoice not found", 404, "NOT_FOUND");
  }

  if (invoice.payableId) {
    return getInvoiceWithMetrics({ id: invoiceId, companyId: scopedCompanyId });
  }

  if (String(invoice.matchStatus || "").toLowerCase() === "blocked") {
    throw buildValidationError("Blocked invoice cannot be posted to payable", 409, "MATCH_BLOCKED");
  }

  const payablePosting = await createPayable({
    companyId: scopedCompanyId,
    vendorId: invoice.vendorId,
    referenceNumber: invoice.invoiceNumber,
    billDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    amount: Number(invoice.totalAmount || 0),
    notes: invoice.mismatchNotes || `Purchase invoice #${invoice.id}`,
    userId: Number(userId) || null,
  });

  await updateInvoicePosting({
    id: invoiceId,
    companyId: scopedCompanyId,
    payableId: payablePosting.payable?.id || null,
  });

  return getInvoiceWithMetrics({ id: invoiceId, companyId: scopedCompanyId });
};

module.exports = {
  createInvoice,
  getInvoice,
  listInvoices,
  postInvoiceToPayables,
};
