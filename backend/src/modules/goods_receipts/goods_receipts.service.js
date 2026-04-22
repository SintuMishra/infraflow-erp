const {
  getGoodsReceiptById,
  insertGoodsReceipt,
  listGoodsReceipts,
} = require("./goods_receipts.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const buildValidationError = (message, statusCode = 400, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

const buildGrnNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GRN-${timestamp}${random}`;
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
  const receivedQuantity = Number(line.receivedQuantity || 0);
  const acceptedQuantity = Number(line.acceptedQuantity || 0);
  const rejectedQuantity = Number(line.rejectedQuantity || 0);
  const unitRate = Number(line.unitRate || 0);
  const itemCategory = normalizeItemCategory(line.itemCategory);
  return {
    purchaseOrderLineId: Number(line.purchaseOrderLineId || 0),
    materialId: Number(line.materialId || 0),
    itemCategory: itemCategory || "material",
    receivedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    unitRate,
    lineAmount: Number((acceptedQuantity * unitRate).toFixed(2)),
    remarks: String(line.remarks || "").trim() || null,
  };
};

const normalizeLines = (lines = []) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw buildValidationError("lines must be a non-empty array");
  }

  return lines.map((line) => {
    const normalized = normalizeLine(line);
    if (!normalized.purchaseOrderLineId || !normalized.materialId) {
      throw buildValidationError("each line must include purchaseOrderLineId and materialId");
    }
    if (!(normalized.receivedQuantity > 0)) {
      throw buildValidationError("receivedQuantity must be greater than 0 for each line");
    }
    if (normalized.acceptedQuantity < 0 || normalized.rejectedQuantity < 0) {
      throw buildValidationError("acceptedQuantity/rejectedQuantity cannot be negative");
    }
    if (normalized.acceptedQuantity + normalized.rejectedQuantity > normalized.receivedQuantity + 0.00001) {
      throw buildValidationError("accepted + rejected quantity cannot exceed received quantity");
    }
    return normalized;
  });
};

const listReceipts = async ({ companyId, status = "" }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }

  const normalizedStatus = String(status || "").trim().toLowerCase() || null;
  return listGoodsReceipts({ companyId: scopedCompanyId, status: normalizedStatus });
};

const getReceipt = async ({ id, companyId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const receiptId = Number(id || 0);
  if (!scopedCompanyId || !receiptId) {
    throw buildValidationError("Valid companyId and goods receipt id are required");
  }

  const row = await getGoodsReceiptById({ id: receiptId, companyId: scopedCompanyId });
  if (!row) {
    throw buildValidationError("Goods receipt not found", 404, "NOT_FOUND");
  }

  return row;
};

const createReceipt = async ({
  companyId,
  purchaseOrderId,
  vendorId,
  receiptDate,
  notes,
  lines,
  userId,
}) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }

  const normalizedLines = normalizeLines(lines);
  const receiptId = await insertGoodsReceipt({
    companyId: scopedCompanyId,
    grnNumber: buildGrnNumber(),
    purchaseOrderId: Number(purchaseOrderId || 0),
    vendorId: Number(vendorId || 0),
    receiptDate: String(receiptDate || "").trim(),
    notes: String(notes || "").trim(),
    lines: normalizedLines,
    userId: Number(userId) || null,
  });

  return getGoodsReceiptById({ id: receiptId, companyId: scopedCompanyId });
};

module.exports = {
  createReceipt,
  getReceipt,
  listReceipts,
};
