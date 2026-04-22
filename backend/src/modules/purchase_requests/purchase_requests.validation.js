const allowedStatuses = ["draft", "submitted", "approved", "closed", "cancelled"];
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

const validateSupplierQuotes = (quotes = []) => {
  if (quotes === undefined) {
    return "";
  }

  if (!Array.isArray(quotes)) {
    return "supplierQuotes must be an array when provided";
  }

  for (const quote of quotes) {
    const supplierName = String(quote?.supplierName || "").trim();
    const vendorId = quote?.vendorId;
    const hasVendorId = vendorId !== undefined && vendorId !== null && vendorId !== "";

    if (!supplierName && !hasVendorId) {
      return "each supplier quote must include supplierName or vendorId";
    }

    if (hasVendorId && !isPositiveNumber(vendorId)) {
      return "supplier quote vendorId must be a positive number when provided";
    }

    if (
      quote?.quotedUnitRate !== undefined &&
      quote?.quotedUnitRate !== null &&
      quote?.quotedUnitRate !== "" &&
      !isNonNegativeNumber(quote.quotedUnitRate)
    ) {
      return "supplier quote quotedUnitRate must be 0 or greater when provided";
    }

    if (
      quote?.leadTimeDays !== undefined &&
      quote?.leadTimeDays !== null &&
      quote?.leadTimeDays !== "" &&
      (!Number.isInteger(Number(quote.leadTimeDays)) || Number(quote.leadTimeDays) < 0)
    ) {
      return "supplier quote leadTimeDays must be a non-negative integer when provided";
    }
  }

  return "";
};

const validateLineItems = (lines = []) => {
  if (!Array.isArray(lines) || !lines.length) {
    return "lines must be a non-empty array";
  }

  for (const line of lines) {
    const hasMaterialId = isPositiveNumber(line?.materialId);
    const hasCustomItemName = !isBlank(line?.customItemName);

    if (!hasMaterialId && !hasCustomItemName) {
      return "each line must include materialId or customItemName";
    }
    if (!isPositiveNumber(line.quantity)) {
      return "each line must include quantity greater than 0";
    }
    const categoryResult = validateAndNormalizeItemCategory(line);
    if (!categoryResult.ok) {
      return categoryResult.message;
    }
    if (!isNonNegativeNumber(line.unitRate)) {
      return "each line must include unitRate as 0 or greater";
    }

    const quoteError = validateSupplierQuotes(line.supplierQuotes);
    if (quoteError) {
      return quoteError;
    }
  }

  return "";
};

const validateCreatePurchaseRequestInput = (req, res, next) => {
  const { requestDate, vendorId, lines, requiredByDate, status, requestedByEmployeeId } = req.body;

  if (isBlank(requestDate)) {
    return res.status(400).json({
      success: false,
      message: "requestDate is required",
    });
  }

  if (vendorId !== undefined && vendorId !== null && vendorId !== "" && !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "vendorId must be a positive number when provided",
    });
  }

  if (requiredByDate && isBlank(requiredByDate)) {
    return res.status(400).json({
      success: false,
      message: "requiredByDate must be a valid date string when provided",
    });
  }

  if (status && !allowedStatuses.includes(String(status).trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${allowedStatuses.join(", ")}`,
    });
  }

  if (
    requestedByEmployeeId !== undefined &&
    requestedByEmployeeId !== null &&
    requestedByEmployeeId !== "" &&
    !isPositiveNumber(requestedByEmployeeId)
  ) {
    return res.status(400).json({
      success: false,
      message: "requestedByEmployeeId must be a positive number when provided",
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

const validateUpdatePurchaseRequestInput = (req, res, next) => {
  const { requestDate, vendorId, lines, requestedByEmployeeId } = req.body;

  if (requestDate !== undefined && isBlank(requestDate)) {
    return res.status(400).json({
      success: false,
      message: "requestDate cannot be blank",
    });
  }

  if (vendorId !== undefined && vendorId !== null && vendorId !== "" && !isPositiveNumber(vendorId)) {
    return res.status(400).json({
      success: false,
      message: "vendorId must be a positive number",
    });
  }

  if (
    requestedByEmployeeId !== undefined &&
    requestedByEmployeeId !== null &&
    requestedByEmployeeId !== "" &&
    !isPositiveNumber(requestedByEmployeeId)
  ) {
    return res.status(400).json({
      success: false,
      message: "requestedByEmployeeId must be a positive number when provided",
    });
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

const validatePurchaseRequestStatusPayload = (req, res, next) => {
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
  validateCreatePurchaseRequestInput,
  validateUpdatePurchaseRequestInput,
  validatePurchaseRequestStatusPayload,
};
