const STRONG_PASSWORD_MESSAGE =
  "New password must be at least 8 characters and include uppercase, lowercase, number, and special character";
const ASSIGNABLE_LOGIN_ROLES = [
  "hr",
  "manager",
  "crusher_supervisor",
  "site_engineer",
  "operator",
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10,15}$/;

const isStrongPassword = (value) => {
  const password = String(value || "");

  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const validateLoginInput = (req, res, next) => {
  const identifier = req.body.username || req.body.identifier;
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: "username/employee code/mobile and password are required",
    });
  }

  next();
};

const validateCreateUserInput = (req, res, next) => {
  const { employeeId, role } = req.body;

  if (!employeeId || !role) {
    return res.status(400).json({
      success: false,
      message: "employeeId and role are required",
    });
  }

  if (!ASSIGNABLE_LOGIN_ROLES.includes(String(role).trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message:
        "role must be one of hr, manager, crusher_supervisor, site_engineer, or operator",
    });
  }

  next();
};

const validateChangePasswordInput = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "currentPassword and newPassword are required",
    });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: STRONG_PASSWORD_MESSAGE,
    });
  }

  next();
};

const validateForgotPasswordInput = (req, res, next) => {
  const identifier = req.body.username || req.body.identifier;
  const { mobileNumber } = req.body;

  if (!identifier || !mobileNumber) {
    return res.status(400).json({
      success: false,
      message: "identifier and mobileNumber are required",
    });
  }

  const normalizedMobile = String(mobileNumber).replace(/\D/g, "");

  if (normalizedMobile.length < 10) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber must contain at least 10 digits",
    });
  }

  next();
};

const validateResetPasswordInput = (req, res, next) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "resetToken and newPassword are required",
    });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: STRONG_PASSWORD_MESSAGE,
    });
  }

  next();
};

const validateAdminResetPasswordInput = (req, res, next) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: "employeeId is required",
    });
  }

  next();
};

const validateUpdateSelfProfileInput = (req, res, next) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const fullName = String(payload.fullName || "").trim();
  const mobileNumber = String(payload.mobileNumber || "").trim();
  const email = String(payload.email || "").trim();
  const emergencyContactNumber = String(payload.emergencyContactNumber || "").trim();
  const department = String(payload.department || "").trim();
  const designation = String(payload.designation || "").trim();

  if (!fullName) {
    return res.status(400).json({
      success: false,
      message: "fullName is required",
    });
  }

  if (mobileNumber && !MOBILE_PATTERN.test(mobileNumber)) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber must contain 10-15 digits",
    });
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      message: "email must be a valid email address",
    });
  }

  if (emergencyContactNumber && !MOBILE_PATTERN.test(emergencyContactNumber)) {
    return res.status(400).json({
      success: false,
      message: "emergencyContactNumber must contain 10-15 digits",
    });
  }

  if (!department) {
    return res.status(400).json({
      success: false,
      message: "department is required",
    });
  }

  if (!designation) {
    return res.status(400).json({
      success: false,
      message: "designation is required",
    });
  }

  next();
};

module.exports = {
  ASSIGNABLE_LOGIN_ROLES,
  STRONG_PASSWORD_MESSAGE,
  validateLoginInput,
  validateCreateUserInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateAdminResetPasswordInput,
  validateUpdateSelfProfileInput,
};
