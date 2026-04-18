const express = require("express");
const {
  getAuthStatus,
  getCompanyLoginContextController,
  logoutSessionController,
  registerUser,
  refreshSessionController,
  login,
  changePasswordController,
  getAuthenticatedProfileController,
  forgotPasswordController,
  resetPasswordController,
  adminResetPasswordController,
  updateAuthenticatedProfileController,
} = require("./auth.controller");
const {
  validateLoginInput,
  validateCreateUserInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateAdminResetPasswordInput,
  validateRefreshSessionInput,
  validateLogoutSessionInput,
  validateUpdateSelfProfileInput,
} = require("./auth.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  loginRateLimiter,
  passwordResetRateLimiter,
  authRefreshRateLimiter,
} = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

router.get("/status", getAuthStatus);
router.get("/login-context/:companyCode", getCompanyLoginContextController);
router.post(
  "/register",
  authenticate,
  authorizeRoles("super_admin", "hr", "manager"),
  validateCreateUserInput,
  registerUser
);
router.post("/login", loginRateLimiter, validateLoginInput, login);
router.post(
  "/refresh",
  authRefreshRateLimiter,
  validateRefreshSessionInput,
  refreshSessionController
);
router.post(
  "/logout",
  authenticate,
  validateLogoutSessionInput,
  logoutSessionController
);
router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validateForgotPasswordInput,
  forgotPasswordController
);
router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validateResetPasswordInput,
  resetPasswordController
);

router.post(
  "/change-password",
  authenticate,
  validateChangePasswordInput,
  changePasswordController
);
router.post(
  "/admin-reset-password",
  authenticate,
  authorizeRoles("super_admin", "hr", "manager"),
  validateAdminResetPasswordInput,
  adminResetPasswordController
);

router.get("/me", authenticate, getAuthenticatedProfileController);
router.patch(
  "/me/profile",
  authenticate,
  validateUpdateSelfProfileInput,
  updateAuthenticatedProfileController
);

module.exports = router;
