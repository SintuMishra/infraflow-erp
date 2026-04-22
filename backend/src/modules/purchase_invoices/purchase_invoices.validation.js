const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

const validateCreatePurchaseInvoiceInput = (req, res, next) => {
  const { purchaseOrderId, vendorId, invoiceDate, dueDate, lines } = req.body || {};

  if (!isPositiveNumber(purchaseOrderId) || !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "purchaseOrderId and vendorId are required",
    });
  }

  if (!ISO_DATE_PATTERN.test(String(invoiceDate || "").trim())) {
    return res.status(400).json({
      success: false,
      message: "invoiceDate must use YYYY-MM-DD format",
    });
  }

  if (!ISO_DATE_PATTERN.test(String(dueDate || "").trim())) {
    return res.status(400).json({
      success: false,
      message: "dueDate must use YYYY-MM-DD format",
    });
  }

  if (String(dueDate || "").trim() < String(invoiceDate || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "dueDate cannot be before invoiceDate",
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
    if (!isPositiveNumber(line.billedQuantity)) {
      return res.status(400).json({
        success: false,
        message: "each line must include billedQuantity greater than 0",
      });
    }
    if (!isNonNegativeNumber(line.unitRate ?? 0)) {
      return res.status(400).json({
        success: false,
        message: "unitRate cannot be negative",
      });
    }
  }

  return next();
};

module.exports = {
  validateCreatePurchaseInvoiceInput,
};
