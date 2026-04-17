const allowedStatuses = ["pending", "completed", "cancelled"];
const isProvided = (value) => value !== undefined && value !== null && value !== "";
const parseOptionalNumber = (value) => {
  if (!isProvided(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};
const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateEwbFields = (payload) => {
  const ewbNumber = String(payload.ewbNumber || "").trim();
  const ewbDate = payload.ewbDate;
  const ewbValidUpto = payload.ewbValidUpto;
  const dispatchDate = payload.dispatchDate;
  const invoiceDate = payload.invoiceDate;

  if (ewbNumber && !/^\d{12}$/.test(ewbNumber)) {
    return "E-Way Bill Number must be a 12-digit numeric value";
  }

  if ((ewbDate || ewbValidUpto) && !ewbNumber) {
    return "E-Way Bill Number is required when EWB dates are provided";
  }

  if (ewbNumber && !ewbDate) {
    return "E-Way Bill Date is required when EWB Number is provided";
  }

  if (ewbNumber && !ewbValidUpto) {
    return "E-Way Bill Valid Upto is required when EWB Number is provided";
  }

  if (ewbDate && ewbValidUpto) {
    const issueDate = parseDateValue(ewbDate);
    const validDate = parseDateValue(ewbValidUpto);

    if (!issueDate || !validDate) {
      return "E-Way Bill dates are invalid";
    }

    if (validDate < issueDate) {
      return "E-Way Bill validity cannot be before EWB date";
    }
  }

  if (invoiceDate && parseDateValue(invoiceDate) === null) {
    return "Invoice Date is invalid";
  }

  if (dispatchDate && parseDateValue(dispatchDate) === null) {
    return "Dispatch date is invalid";
  }

  const parsedDispatchDate = parseDateValue(dispatchDate);
  const parsedInvoiceDate = parseDateValue(invoiceDate);
  const parsedEwbDate = parseDateValue(ewbDate);

  if (parsedInvoiceDate && parsedDispatchDate && parsedInvoiceDate > parsedDispatchDate) {
    return "Invoice Date cannot be after dispatch date";
  }

  if (parsedEwbDate && parsedDispatchDate && parsedEwbDate > parsedDispatchDate) {
    return "E-Way Bill Date cannot be after dispatch date";
  }

  if (parsedEwbDate && parsedInvoiceDate && parsedEwbDate < parsedInvoiceDate) {
    return "E-Way Bill Date cannot be before invoice date";
  }

  return "";
};

const validateDispatchReportInput = (req, res, next) => {
  const {
    dispatchDate,
    sourceType,
    plantId,
    materialId,
    vehicleId,
    partyId,
    destinationName,
    quantityTons,
  } = req.body;

  if (
    !dispatchDate ||
    !sourceType ||
    !plantId ||
    !materialId ||
    !vehicleId ||
    !partyId ||
    !destinationName ||
    quantityTons === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "dispatchDate, sourceType, plantId, materialId, vehicleId, partyId, destinationName, and quantityTons are required",
    });
  }

  const parsedQuantityTons = parseOptionalNumber(quantityTons);
  if (!Number.isFinite(parsedQuantityTons) || parsedQuantityTons <= 0) {
    return res.status(400).json({
      success: false,
      message: "quantityTons must be a valid number greater than 0",
    });
  }

  const parsedInvoiceValue = parseOptionalNumber(req.body.invoiceValue);
  if (Number.isNaN(parsedInvoiceValue)) {
    return res.status(400).json({
      success: false,
      message: "invoiceValue must be a valid number",
    });
  }

  if (parsedInvoiceValue !== null && parsedInvoiceValue < 0) {
    return res.status(400).json({
      success: false,
      message: "invoiceValue must be 0 or more",
    });
  }

  const parsedDistanceKm = parseOptionalNumber(req.body.distanceKm);
  if (Number.isNaN(parsedDistanceKm)) {
    return res.status(400).json({
      success: false,
      message: "distanceKm must be a valid number",
    });
  }

  if (parsedDistanceKm !== null && parsedDistanceKm < 0) {
    return res.status(400).json({
      success: false,
      message: "distanceKm must be 0 or more",
    });
  }

  const parsedOtherCharge = parseOptionalNumber(req.body.otherCharge);
  if (Number.isNaN(parsedOtherCharge)) {
    return res.status(400).json({
      success: false,
      message: "otherCharge must be a valid number",
    });
  }

  if (parsedOtherCharge !== null && parsedOtherCharge < 0) {
    return res.status(400).json({
      success: false,
      message: "otherCharge must be 0 or more",
    });
  }

  const ewbValidationMessage = validateEwbFields(req.body);
  if (ewbValidationMessage) {
    return res.status(400).json({
      success: false,
      message: ewbValidationMessage,
    });
  }

  next();
};

const validateDispatchEditInput = (req, res, next) => {
  const {
    dispatchDate,
    sourceType,
    plantId,
    materialId,
    vehicleId,
    partyId,
    destinationName,
    quantityTons,
  } = req.body;

  if (
    !dispatchDate ||
    !sourceType ||
    !plantId ||
    !materialId ||
    !vehicleId ||
    !partyId ||
    !destinationName ||
    quantityTons === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "dispatchDate, sourceType, plantId, materialId, vehicleId, partyId, destinationName, and quantityTons are required",
    });
  }

  const parsedQuantityTons = parseOptionalNumber(quantityTons);
  if (!Number.isFinite(parsedQuantityTons) || parsedQuantityTons <= 0) {
    return res.status(400).json({
      success: false,
      message: "quantityTons must be a valid number greater than 0",
    });
  }

  const parsedInvoiceValue = parseOptionalNumber(req.body.invoiceValue);
  if (Number.isNaN(parsedInvoiceValue)) {
    return res.status(400).json({
      success: false,
      message: "invoiceValue must be a valid number",
    });
  }

  if (parsedInvoiceValue !== null && parsedInvoiceValue < 0) {
    return res.status(400).json({
      success: false,
      message: "invoiceValue must be 0 or more",
    });
  }

  const parsedDistanceKm = parseOptionalNumber(req.body.distanceKm);
  if (Number.isNaN(parsedDistanceKm)) {
    return res.status(400).json({
      success: false,
      message: "distanceKm must be a valid number",
    });
  }

  if (parsedDistanceKm !== null && parsedDistanceKm < 0) {
    return res.status(400).json({
      success: false,
      message: "distanceKm must be 0 or more",
    });
  }

  const parsedOtherCharge = parseOptionalNumber(req.body.otherCharge);
  if (Number.isNaN(parsedOtherCharge)) {
    return res.status(400).json({
      success: false,
      message: "otherCharge must be a valid number",
    });
  }

  if (parsedOtherCharge !== null && parsedOtherCharge < 0) {
    return res.status(400).json({
      success: false,
      message: "otherCharge must be 0 or more",
    });
  }

  const ewbValidationMessage = validateEwbFields(req.body);
  if (ewbValidationMessage) {
    return res.status(400).json({
      success: false,
      message: ewbValidationMessage,
    });
  }

  next();
};

const validateDispatchStatusInput = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid dispatch status",
    });
  }

  next();
};

module.exports = {
  validateDispatchReportInput,
  validateDispatchEditInput,
  validateDispatchStatusInput,
};
