const allowedStatuses = [
  "draft",
  "submitted",
  "approved",
  "partially_received",
  "closed",
  "cancelled",
];
const ITEM_CATEGORY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

const isBlank = (value) => String(value || "").trim() === "";
const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const normalizeItemCategory = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const validateAndNormalizeItemCategory = (line) => {
  const raw = line?.itemCategory;
  const rawText = String(raw === undefined || raw === null ? "" : raw).trim();
  const normalized = normalizeItemCategory(rawText || "material");

  if (rawText && (!normalized || !ITEM_CATEGORY_PATTERN.test(normalized))) {
    return {
      ok: false,
      message:
        "itemCategory must be 2-50 chars and use letters, numbers, spaces, hyphens, or underscores",
    };
  }

  line.itemCategory = normalized || "material";
  return { ok: true };
};

const validateLineItems = (lines = []) => {
  if (!Array.isArray(lines) || !lines.length) {
    return "lines must be a non-empty array";
  }

  for (const line of lines) {
    if (!line || !isPositiveNumber(line.materialId)) {
      return "each line must include materialId as a positive number";
    }
    const categoryResult = validateAndNormalizeItemCategory(line);
    if (!categoryResult.ok) {
      return categoryResult.message;
    }
    if (!isPositiveNumber(line.orderedQuantity)) {
      return "each line must include orderedQuantity greater than 0";
    }
    if (!isNonNegativeNumber(line.unitRate)) {
      return "each line must include unitRate as 0 or greater";
    }
  }

  return "";
};

const validateCreatePurchaseOrderInput = (req, res, next) => {
  const { poDate, vendorId, lines, status, purchaseRequestId } = req.body;

  if (isBlank(poDate) || !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "poDate and vendorId are required",
    });
  }

  if (purchaseRequestId !== undefined && purchaseRequestId !== null && purchaseRequestId !== "") {
    if (!isPositiveNumber(purchaseRequestId)) {
      return res.status(400).json({
        success: false,
        message: "purchaseRequestId must be a positive number when provided",
      });
    }
  }

  if (status && !allowedStatuses.includes(String(status).trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${allowedStatuses.join(", ")}`,
    });
  }

  const linesError = validateLineItems(lines);
  if (linesError) {
    return res.status(400).json({
      success: false,
      message: linesError,
    });
  }

  return next();
};

const validateUpdatePurchaseOrderInput = (req, res, next) => {
  const { poDate, vendorId, lines, purchaseRequestId } = req.body;

  if (poDate !== undefined && isBlank(poDate)) {
    return res.status(400).json({
      success: false,
      message: "poDate cannot be blank",
    });
  }

  if (vendorId !== undefined && !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "vendorId must be a positive number",
    });
  }

  if (purchaseRequestId !== undefined && purchaseRequestId !== null && purchaseRequestId !== "") {
    if (!isPositiveNumber(purchaseRequestId)) {
      return res.status(400).json({
        success: false,
        message: "purchaseRequestId must be a positive number when provided",
      });
    }
  }

  if (lines !== undefined) {
    const linesError = validateLineItems(lines);
    if (linesError) {
      return res.status(400).json({
        success: false,
        message: linesError,
      });
    }
  }

  return next();
};

const validatePurchaseOrderStatusPayload = (req, res, next) => {
  const status = String(req.body.status || "").trim().toLowerCase();
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${allowedStatuses.join(", ")}`,
    });
  }

  return next();
};

module.exports = {
  validateCreatePurchaseOrderInput,
  validateUpdatePurchaseOrderInput,
  validatePurchaseOrderStatusPayload,
};
