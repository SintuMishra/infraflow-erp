const {
  getPurchaseRequestById,
  insertPurchaseRequest,
  listPurchaseRequests,
  updatePurchaseRequest,
  updatePurchaseRequestStatus,
} = require("./purchase_requests.model");
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
  const quantity = Number(line.quantity || 0);
  const unitRate = Number(line.unitRate || 0);
  const itemCategory = normalizeItemCategory(line.itemCategory);
  const materialId = Number(line.materialId || 0);
  const supplierQuotes = Array.isArray(line.supplierQuotes)
    ? line.supplierQuotes.map((quote) => ({
        vendorId: quote?.vendorId ? Number(quote.vendorId) : null,
        supplierName: String(quote?.supplierName || "").trim() || null,
        contactPerson: String(quote?.contactPerson || "").trim() || null,
        contactPhone: String(quote?.contactPhone || "").trim() || null,
        quotedUnitRate:
          quote?.quotedUnitRate === undefined ||
          quote?.quotedUnitRate === null ||
          quote?.quotedUnitRate === ""
            ? null
            : Number(quote.quotedUnitRate),
        leadTimeDays:
          quote?.leadTimeDays === undefined ||
          quote?.leadTimeDays === null ||
          quote?.leadTimeDays === ""
            ? null
            : Number(quote.leadTimeDays),
        quoteNotes: String(quote?.quoteNotes || "").trim() || null,
        isSelected: Boolean(quote?.isSelected),
      }))
    : [];

  return {
    materialId: materialId > 0 ? materialId : null,
    itemCategory: itemCategory || "material",
    customItemName: String(line.customItemName || "").trim() || null,
    customItemUom: String(line.customItemUom || "").trim() || null,
    customItemSpec: String(line.customItemSpec || "").trim() || null,
    description: String(line.description || "").trim() || null,
    quantity,
    unitRate,
    lineAmount: Number((quantity * unitRate).toFixed(2)),
    supplierQuotes,
  };
};

const normalizeLines = (lines = []) => lines.map(normalizeLine);

const computeTotalAmount = (lines = []) =>
  Number(lines.reduce((acc, line) => acc + Number(line.lineAmount || 0), 0).toFixed(2));

const deriveVendorIdFromQuotes = (normalizedLines = []) => {
  const allQuotes = normalizedLines.flatMap((line) => line?.supplierQuotes || []);
  const selectedWithVendor = allQuotes.find(
    (quote) => Boolean(quote?.isSelected) && Number(quote?.vendorId || 0) > 0
  );
  if (selectedWithVendor) {
    return Number(selectedWithVendor.vendorId);
  }

  const anyWithVendor = allQuotes.find((quote) => Number(quote?.vendorId || 0) > 0);
  if (anyWithVendor) {
    return Number(anyWithVendor.vendorId);
  }

  return null;
};

const buildRequestNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PR-${timestamp}${random}`;
};

const listRequests = async ({ companyId, status }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    throw buildValidationError("companyId is required", 400, "COMPANY_ID_REQUIRED");
  }
  const normalizedStatus = String(status || "").trim().toLowerCase() || null;
  return listPurchaseRequests({ companyId: scopedCompanyId, status: normalizedStatus });
};

const getRequest = async ({ id, companyId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const requestId = Number(id);
  if (!scopedCompanyId || !Number.isFinite(requestId) || requestId <= 0) {
    throw buildValidationError("Valid companyId and request id are required");
  }

  const row = await getPurchaseRequestById({
    id: requestId,
    companyId: scopedCompanyId,
  });

  if (!row) {
    throw buildValidationError("Purchase request not found", 404, "NOT_FOUND");
  }

  return row;
};

const createRequest = async ({
  companyId,
  requestDate,
  requiredByDate,
  requestedByEmployeeId,
  requestPurpose,
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
  const normalizedVendorId =
    vendorId && Number(vendorId) > 0
      ? Number(vendorId)
      : deriveVendorIdFromQuotes(normalizedLines);

  const requestId = await insertPurchaseRequest({
    companyId: scopedCompanyId,
    requestNumber: buildRequestNumber(),
    requestDate: normalizeDate(requestDate),
    requiredByDate: normalizeDate(requiredByDate),
    requestedByEmployeeId: requestedByEmployeeId ? Number(requestedByEmployeeId) : null,
    requestPurpose: String(requestPurpose || "").trim() || null,
    vendorId: normalizedVendorId,
    status: String(status || "draft").trim().toLowerCase(),
    notes: String(notes || "").trim(),
    totalAmount,
    lines: normalizedLines,
    userId: Number(userId) || null,
  });

  return getPurchaseRequestById({ id: requestId, companyId: scopedCompanyId });
};

const editRequest = async ({
  id,
  companyId,
  requestDate,
  requiredByDate,
  requestedByEmployeeId,
  requestPurpose,
  vendorId,
  notes,
  lines,
}) => {
  const current = await getRequest({ id, companyId });
  if (["closed", "cancelled"].includes(String(current.status || "").toLowerCase())) {
    throw buildValidationError(
      "Closed or cancelled purchase requests cannot be edited",
      409,
      "STATUS_LOCKED"
    );
  }

  const hasLineUpdate = Array.isArray(lines);
  const normalizedLines = hasLineUpdate ? normalizeLines(lines) : null;
  const totalAmount = hasLineUpdate
    ? computeTotalAmount(normalizedLines)
    : Number(current.totalAmount || 0);

  const updatedId = await updatePurchaseRequest({
    id: Number(id),
    companyId: normalizeCompanyId(companyId),
    requestDate: requestDate === undefined ? null : normalizeDate(requestDate),
    requiredByDate: requiredByDate === undefined ? null : normalizeDate(requiredByDate),
    requestedByEmployeeId:
      requestedByEmployeeId === undefined
        ? null
        : requestedByEmployeeId
          ? Number(requestedByEmployeeId)
          : null,
    requestPurpose:
      requestPurpose === undefined ? null : String(requestPurpose || "").trim() || null,
    vendorId:
      vendorId === undefined
        ? null
        : vendorId
          ? Number(vendorId)
          : null,
    notes: notes === undefined ? null : String(notes || "").trim(),
    totalAmount,
    lines: normalizedLines,
  });

  if (!updatedId) {
    throw buildValidationError("Purchase request not found", 404, "NOT_FOUND");
  }

  return getPurchaseRequestById({
    id: updatedId,
    companyId: normalizeCompanyId(companyId),
  });
};

const changeRequestStatus = async ({ id, companyId, status, userId }) => {
  const scopedCompanyId = normalizeCompanyId(companyId);
  const updatedId = await updatePurchaseRequestStatus({
    id: Number(id),
    companyId: scopedCompanyId,
    status: String(status || "").trim().toLowerCase(),
    userId: Number(userId) || null,
  });

  if (!updatedId) {
    throw buildValidationError("Purchase request not found", 404, "NOT_FOUND");
  }

  return getPurchaseRequestById({ id: updatedId, companyId: scopedCompanyId });
};

module.exports = {
  changeRequestStatus,
  createRequest,
  editRequest,
  getRequest,
  listRequests,
};
