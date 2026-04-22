const {
  getPurchaseOrderById,
  insertPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} = require("./purchase_orders.model");
const { normalizeCompanyId } = require("../../utils/companyScope.util");

const buildValidationError = (message, statusCode = 400, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

const normalizeDate = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
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
  const orderedQuantity = Number(line.orderedQuantity || 0);
  const unitRate = Number(line.unitRate || 0);
  const itemCategory = normalizeItemCategory(line.itemCategory);
  return {
    purchaseRequestLineId: line.purchaseRequestLineId
      ? Number(line.purchaseRequestLineId)
      : null,
    materialId: Number(line.materialId || 0),
    itemCategory: itemCategory || "material",
    description: String(line.description || "").trim() || null,
    orderedQuantity,
    unitRate,
    lineAmount: Number((orderedQuantity * unitRate).toFixed(2)),
  };
};

const normalizeLines = (lines = []) => lines.map(normalizeLine);

const computeTotalAmount = (lines = []) =>
  Number(lines.reduce((acc, line) => acc + Number(line.lineAmount || 0), 0).toFixed(2));

const buildPoNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${timestamp}${random}`;
};

const listOrders = async ({ companyId, status }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }
  const normalizedStatus = String(status || "").trim().toLowerCase() || null;
  return listPurchaseOrders({ companyId: scopedCompanyId, status: normalizedStatus });
};

const getOrder = async ({ id, companyId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const orderId = Number(id);
  if (!scopedCompanyId || !Number.isFinite(orderId) || orderId <= 0) {
    throw buildValidationError("Valid companyId and order id are required");
  }

  const row = await getPurchaseOrderById({
    id: orderId,
    companyId: scopedCompanyId,
  });

  if (!row) {
    throw buildValidationError("Purchase order not found", 404, "NOT_FOUND");
  }

  return row;
};

const createOrder = async ({
  companyId,
  purchaseRequestId,
  poDate,
  expectedDeliveryDate,
  vendorId,
  notes,
  status = "draft",
  lines,
  userId,
}) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }

  const normalizedLines = normalizeLines(lines);
  const totalAmount = computeTotalAmount(normalizedLines);
  const orderId = await insertPurchaseOrder({
    companyId: scopedCompanyId,
    poNumber: buildPoNumber(),
    purchaseRequestId: purchaseRequestId ? Number(purchaseRequestId) : null,
    poDate: normalizeDate(poDate),
    expectedDeliveryDate: normalizeDate(expectedDeliveryDate),
    vendorId: Number(vendorId),
    status: String(status || "draft").trim().toLowerCase(),
    notes: String(notes || "").trim(),
    totalAmount,
    lines: normalizedLines,
    userId: Number(userId) || null,
  });

  return getPurchaseOrderById({ id: orderId, companyId: scopedCompanyId });
};

const editOrder = async ({
  id,
  companyId,
  purchaseRequestId,
  poDate,
  expectedDeliveryDate,
  vendorId,
  notes,
  lines,
}) => {
  const current = await getOrder({ id, companyId });
  if (["closed", "cancelled"].includes(String(current.status || "").toLowerCase())) {
    throw buildValidationError(
      "Closed or cancelled purchase orders cannot be edited",
      409,
      "STATUS_LOCKED"
    );
  }

  const hasLineUpdate = Array.isArray(lines);
  const normalizedLines = hasLineUpdate ? normalizeLines(lines) : null;
  const totalAmount = hasLineUpdate
    ? computeTotalAmount(normalizedLines)
    : Number(current.totalAmount || 0);

  const updatedId = await updatePurchaseOrder({
    id: Number(id),
    companyId: normalizeCompanyId(companyId),
    purchaseRequestId:
      purchaseRequestId === undefined
        ? null
        : purchaseRequestId
          ? Number(purchaseRequestId)
          : null,
    poDate: poDate === undefined ? null : normalizeDate(poDate),
    expectedDeliveryDate:
      expectedDeliveryDate === undefined ? null : normalizeDate(expectedDeliveryDate),
    vendorId: vendorId === undefined ? null : Number(vendorId),
    notes: notes === undefined ? null : String(notes || "").trim(),
    totalAmount,
    lines: normalizedLines,
  });

  if (!updatedId) {
    throw buildValidationError("Purchase order not found", 404, "NOT_FOUND");
  }

  return getPurchaseOrderById({
    id: updatedId,
    companyId: normalizeCompanyId(companyId),
  });
};

const changeOrderStatus = async ({ id, companyId, status, userId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const updatedId = await updatePurchaseOrderStatus({
    id: Number(id),
    companyId: scopedCompanyId,
    status: String(status || "").trim().toLowerCase(),
    userId: Number(userId) || null,
  });

  if (!updatedId) {
    throw buildValidationError("Purchase order not found", 404, "NOT_FOUND");
  }

  return getPurchaseOrderById({ id: updatedId, companyId: scopedCompanyId });
};

module.exports = {
  changeOrderStatus,
  createOrder,
  editOrder,
  getOrder,
  listOrders,
};
