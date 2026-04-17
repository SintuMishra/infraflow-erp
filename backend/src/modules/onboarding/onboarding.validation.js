const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10,15}$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const STATE_CODE_PATTERN = /^\d{1,2}$/;
const PINCODE_PATTERN = /^\d{6}$/;

const validateBootstrapCompanyInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const {
    companyName,
    ownerFullName,
    ownerDesignation,
    ownerMobileNumber,
    ownerJoiningDate,
    companyProfile,
  } = payload;
  const normalizedOwnerMobile = String(ownerMobileNumber || "").trim();
  const normalizedCompanyMobile = String(companyProfile?.mobile || "").trim();
  const normalizedStateCode = String(companyProfile?.stateCode || "").trim();
  const normalizedPincode = String(companyProfile?.pincode || "").trim();
  const normalizedGstin = String(companyProfile?.gstin || "")
    .trim()
    .toUpperCase();
  const normalizedPan = String(companyProfile?.pan || "")
    .trim()
    .toUpperCase();

  if (!String(companyName || "").trim() || !String(ownerFullName || "").trim() || !String(ownerDesignation || "").trim()) {
    return res.status(400).json({
      success: false,
      message:
        "companyName, ownerFullName, and ownerDesignation are required",
    });
  }

  if (normalizedOwnerMobile && !MOBILE_PATTERN.test(normalizedOwnerMobile)) {
    return res.status(400).json({
      success: false,
      message: "ownerMobileNumber must contain 10-15 digits",
    });
  }

  if (
    ownerJoiningDate &&
    !ISO_DATE_ONLY_PATTERN.test(String(ownerJoiningDate).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "ownerJoiningDate must use YYYY-MM-DD format",
    });
  }

  if (
    companyProfile?.email &&
    !EMAIL_PATTERN.test(String(companyProfile.email).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.email must be a valid email address",
    });
  }

  if (normalizedCompanyMobile && !MOBILE_PATTERN.test(normalizedCompanyMobile)) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.mobile must contain 10-15 digits",
    });
  }

  if (normalizedStateCode && !STATE_CODE_PATTERN.test(normalizedStateCode)) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.stateCode must be 1-2 digits",
    });
  }

  if (normalizedPincode && !PINCODE_PATTERN.test(normalizedPincode)) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.pincode must be 6 digits",
    });
  }

  if (normalizedGstin && !GSTIN_PATTERN.test(normalizedGstin)) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.gstin must be a valid GSTIN",
    });
  }

  if (normalizedPan && !PAN_PATTERN.test(normalizedPan)) {
    return res.status(400).json({
      success: false,
      message: "companyProfile.pan must be a valid PAN",
    });
  }

  next();
};

const validateManagedCompanyUpdateInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const companyName = String(payload.companyName || "").trim();
  const branchName = String(payload.branchName || "").trim();
  const companyEmail = String(payload.companyEmail || "").trim();
  const companyMobile = String(payload.companyMobile || "").trim();
  const companyId = Number(req.params?.companyId || 0) || null;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Valid companyId is required",
    });
  }

  if (!companyName) {
    return res.status(400).json({
      success: false,
      message: "companyName is required",
    });
  }

  if (branchName.length > 120) {
    return res.status(400).json({
      success: false,
      message: "branchName must be 120 characters or fewer",
    });
  }

  if (companyEmail && !EMAIL_PATTERN.test(companyEmail)) {
    return res.status(400).json({
      success: false,
      message: "companyEmail must be a valid email address",
    });
  }

  if (companyMobile && !MOBILE_PATTERN.test(companyMobile)) {
    return res.status(400).json({
      success: false,
      message: "companyMobile must contain 10-15 digits",
    });
  }

  next();
};

const validateManagedCompanyAccessInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const reason = String(payload.reason || "").trim();
  const companyId = Number(req.params?.companyId || 0) || null;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Valid companyId is required",
    });
  }

  if (typeof payload.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be true or false",
    });
  }

  if (!payload.isActive && !reason) {
    return res.status(400).json({
      success: false,
      message: "reason is required when suspending a client company",
    });
  }

  if (reason.length > 500) {
    return res.status(400).json({
      success: false,
      message: "reason must be 500 characters or fewer",
    });
  }

  next();
};

const ALLOWED_BILLING_STATUSES = new Set([
  "trial",
  "active",
  "overdue",
  "grace",
  "on_hold",
  "suspended",
  "closed",
]);

const ALLOWED_BILLING_CYCLES = new Set([
  "weekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "custom",
]);

const validateManagedCompanyBillingInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const companyId = Number(req.params?.companyId || 0) || null;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Valid companyId is required",
    });
  }

  const billingStatus = String(payload.billingStatus || "active")
    .trim()
    .toLowerCase();
  const billingCycle = String(payload.billingCycle || "monthly")
    .trim()
    .toLowerCase();
  const currencyCode = String(payload.currencyCode || "INR")
    .trim()
    .toUpperCase();
  const nextDueDate = String(payload.nextDueDate || "").trim();
  const graceUntilDate = String(payload.graceUntilDate || "").trim();
  const lastPaymentDate = String(payload.lastPaymentDate || "").trim();
  const customCycleLabel = String(payload.customCycleLabel || "").trim();
  const customCycleDays = payload.customCycleDays;
  const planAmount = payload.planAmount;
  const outstandingAmount = payload.outstandingAmount;

  if (!ALLOWED_BILLING_STATUSES.has(billingStatus)) {
    return res.status(400).json({
      success: false,
      message: "billingStatus is invalid",
    });
  }

  if (!ALLOWED_BILLING_CYCLES.has(billingCycle)) {
    return res.status(400).json({
      success: false,
      message: "billingCycle is invalid",
    });
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return res.status(400).json({
      success: false,
      message: "currencyCode must be a 3-letter ISO code",
    });
  }

  if (
    customCycleDays !== undefined &&
    customCycleDays !== null &&
    String(customCycleDays).trim() !== "" &&
    (!Number.isInteger(Number(customCycleDays)) ||
      Number(customCycleDays) < 1 ||
      Number(customCycleDays) > 365)
  ) {
    return res.status(400).json({
      success: false,
      message: "customCycleDays must be an integer between 1 and 365",
    });
  }

  if (customCycleLabel.length > 80) {
    return res.status(400).json({
      success: false,
      message: "customCycleLabel must be 80 characters or fewer",
    });
  }

  if (
    billingCycle === "custom" &&
    !customCycleLabel &&
    !(
      customCycleDays !== undefined &&
      customCycleDays !== null &&
      String(customCycleDays).trim() !== ""
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "customCycleLabel or customCycleDays is required when billingCycle is custom",
    });
  }

  if (
    nextDueDate &&
    !ISO_DATE_ONLY_PATTERN.test(nextDueDate)
  ) {
    return res.status(400).json({
      success: false,
      message: "nextDueDate must use YYYY-MM-DD format",
    });
  }

  if (
    graceUntilDate &&
    !ISO_DATE_ONLY_PATTERN.test(graceUntilDate)
  ) {
    return res.status(400).json({
      success: false,
      message: "graceUntilDate must use YYYY-MM-DD format",
    });
  }

  if (
    lastPaymentDate &&
    !ISO_DATE_ONLY_PATTERN.test(lastPaymentDate)
  ) {
    return res.status(400).json({
      success: false,
      message: "lastPaymentDate must use YYYY-MM-DD format",
    });
  }

  if (
    planAmount !== undefined &&
    planAmount !== null &&
    String(planAmount).trim() !== "" &&
    !Number.isFinite(Number(planAmount))
  ) {
    return res.status(400).json({
      success: false,
      message: "planAmount must be numeric",
    });
  }

  if (
    outstandingAmount !== undefined &&
    outstandingAmount !== null &&
    String(outstandingAmount).trim() !== "" &&
    !Number.isFinite(Number(outstandingAmount))
  ) {
    return res.status(400).json({
      success: false,
      message: "outstandingAmount must be numeric",
    });
  }

  next();
};

const validateManagedCompanyPermanentDeleteInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const companyId = Number(req.params?.companyId || 0) || null;
  const reason = String(payload.reason || "").trim();

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Valid companyId is required",
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: "reason is required for permanent client deletion",
    });
  }

  next();
};

const validateManagedCompanyBillingInvoiceInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const companyId = Number(req.params?.companyId || 0) || null;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Valid companyId is required",
    });
  }

  const invoiceDate = String(payload.invoiceDate || "").trim();
  const periodStartDate = String(payload.periodStartDate || "").trim();
  const periodEndDate = String(payload.periodEndDate || "").trim();
  const dueDate = String(payload.dueDate || "").trim();
  const currencyCode = String(payload.currencyCode || "").trim().toUpperCase();
  const planAmount = payload.planAmount;
  const outstandingAmount = payload.outstandingAmount;

  if (invoiceDate && !ISO_DATE_ONLY_PATTERN.test(invoiceDate)) {
    return res.status(400).json({
      success: false,
      message: "invoiceDate must use YYYY-MM-DD format",
    });
  }

  if (periodStartDate && !ISO_DATE_ONLY_PATTERN.test(periodStartDate)) {
    return res.status(400).json({
      success: false,
      message: "periodStartDate must use YYYY-MM-DD format",
    });
  }

  if (periodEndDate && !ISO_DATE_ONLY_PATTERN.test(periodEndDate)) {
    return res.status(400).json({
      success: false,
      message: "periodEndDate must use YYYY-MM-DD format",
    });
  }

  if (dueDate && !ISO_DATE_ONLY_PATTERN.test(dueDate)) {
    return res.status(400).json({
      success: false,
      message: "dueDate must use YYYY-MM-DD format",
    });
  }

  if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
    return res.status(400).json({
      success: false,
      message: "currencyCode must be a 3-letter ISO code",
    });
  }

  if (
    planAmount !== undefined &&
    planAmount !== null &&
    String(planAmount).trim() !== "" &&
    !Number.isFinite(Number(planAmount))
  ) {
    return res.status(400).json({
      success: false,
      message: "planAmount must be numeric",
    });
  }

  if (
    outstandingAmount !== undefined &&
    outstandingAmount !== null &&
    String(outstandingAmount).trim() !== "" &&
    !Number.isFinite(Number(outstandingAmount))
  ) {
    return res.status(400).json({
      success: false,
      message: "outstandingAmount must be numeric",
    });
  }

  next();
};

module.exports = {
  validateBootstrapCompanyInput,
  validateManagedCompanyAccessInput,
  validateManagedCompanyBillingInput,
  validateManagedCompanyBillingInvoiceInput,
  validateManagedCompanyPermanentDeleteInput,
  validateManagedCompanyUpdateInput,
  ISO_DATE_ONLY_PATTERN,
  EMAIL_PATTERN,
  MOBILE_PATTERN,
  GSTIN_PATTERN,
  PAN_PATTERN,
  STATE_CODE_PATTERN,
  PINCODE_PATTERN,
};
