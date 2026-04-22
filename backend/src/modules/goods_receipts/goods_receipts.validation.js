const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const ITEM_CATEGORY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
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

const validateCreateGoodsReceiptInput = (req, res, next) => {
  const { purchaseOrderId, vendorId, receiptDate, lines } = req.body || {};

  if (!isPositiveNumber(purchaseOrderId) || !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "purchaseOrderId and vendorId are required",
    });
  }

  if (!String(receiptDate || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "receiptDate is required",
    });
  }

  if (!Array.isArray(lines) || !lines.length) {
    return res.status(400).json({
      success: false,
      message: "lines must be a non-empty array",
    });
  }

  for (const line of lines) {
    if (!isPositiveNumber(line.purchaseOrderLineId) || !isPositiveNumber(line.materialId)) {
      return res.status(400).json({
        success: false,
        message: "each line must include purchaseOrderLineId and materialId",
      });
    }
    const categoryResult = validateAndNormalizeItemCategory(line);
    if (!categoryResult.ok) {
      return res.status(400).json({
        success: false,
        message: categoryResult.message,
      });
    }
    if (!isPositiveNumber(line.receivedQuantity)) {
      return res.status(400).json({
        success: false,
        message: "each line must include receivedQuantity greater than 0",
      });
    }
    if (!isNonNegativeNumber(line.acceptedQuantity ?? 0) || !isNonNegativeNumber(line.rejectedQuantity ?? 0)) {
      return res.status(400).json({
        success: false,
        message: "acceptedQuantity and rejectedQuantity cannot be negative",
      });
    }
    if (Number(line.acceptedQuantity ?? 0) + Number(line.rejectedQuantity ?? 0) > Number(line.receivedQuantity) + 0.00001) {
      return res.status(400).json({
        success: false,
        message: "acceptedQuantity + rejectedQuantity cannot exceed receivedQuantity",
      });
    }
  }

  return next();
};

module.exports = {
  validateCreateGoodsReceiptInput,
};
