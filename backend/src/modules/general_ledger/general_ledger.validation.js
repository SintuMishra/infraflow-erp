const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const validateCreateVoucherInput = (req, res, next) => {
  const { voucherType, voucherDate, lines } = req.body || {};

  if (!String(voucherType || "").trim()) {
    return sendValidationError(res, "voucherType is required");
  }

  if (!ISO_DATE_PATTERN.test(String(voucherDate || "").trim())) {
    return sendValidationError(res, "voucherDate must use YYYY-MM-DD format");
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    return sendValidationError(res, "At least two voucher lines are required");
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || {};
    if (!Number(line.accountId) || !Number(line.ledgerId)) {
      return sendValidationError(
        res,
        `Line ${index + 1} requires accountId and ledgerId`
      );
    }

    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      return sendValidationError(
        res,
        `Line ${index + 1} must include either debit or credit`
      );
    }
  }

  return next();
};

const validateReverseVoucherInput = (req, res, next) => {
  if (!ISO_DATE_PATTERN.test(String(req.body?.voucherDate || "").trim())) {
    return sendValidationError(res, "voucherDate must use YYYY-MM-DD format");
  }

  return next();
};

module.exports = {
  validateCreateVoucherInput,
  validateReverseVoucherInput,
};
