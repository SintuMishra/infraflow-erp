const env = require("../../config/env");
const { sendControllerError } = require("../../utils/http.util");
const {
  adminResetPassword,
  getAuthenticatedUserProfile,
  getAuthModuleInfo,
  getCompanyLoginContext,
  createUserAccount,
  initiatePasswordReset,
  loginUser,
  logoutAuthSession,
  refreshAuthSession,
  changePassword,
  resetForgottenPassword,
  updateAuthenticatedUserProfile,
} = require("./auth.service");

const getAuthStatus = async (req, res) => {
  try {
    const data = await getAuthModuleInfo();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load auth status");
  }
};

const registerUser = async (req, res) => {
  try {
    const newUser = await createUserAccount({
      ...req.body,
      companyId: req.companyId || req.body.companyId || null,
      actorUserId: req.user?.userId || null,
      actorRole: req.user?.role || "",
    });

    return res.status(201).json({
      success: true,
      message: "Login account created successfully",
      data: newUser,
    });
  } catch (error) {
    if (error.message === "EMPLOYEE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (error.message === "EMPLOYEE_NOT_ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Only active employees can get login accounts",
      });
    }

    if (error.message === "USER_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "Login account already exists for this employee",
      });
    }

    if (error.message === "ROLE_ASSIGNMENT_NOT_ALLOWED") {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to assign this login role. Super admin is a protected owner role and higher admin roles cannot be created through the normal staff registration flow.",
      });
    }

    return sendControllerError(req, res, error, "Failed to create user account");
  }
};

const login = async (req, res) => {
  try {
    const loginIntent = String(req.body?.loginIntent || "").trim().toLowerCase();
    const expectedCompanyId =
      req.body?.expectedCompanyId ||
      req.headers["x-company-id"] ||
      null;

    const data = await loginUser({
      identifier: req.body.username || req.body.identifier,
      password: req.body.password,
      companyId: req.companyId || req.headers["x-company-id"] || null,
      loginIntent,
      expectedCompanyId,
      requestedByIp: req.ip || req.socket?.remoteAddress || null,
      requestedByUserAgent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data,
    });
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    if (error.message === "USER_INACTIVE") {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    if (error.message === "COMPANY_ACCESS_DISABLED") {
      return res.status(403).json({
        success: false,
        message:
          "This company workspace is currently suspended. Contact SinSoftware support to restore access.",
      });
    }

    if (error.message === "OWNER_LOGIN_ONLY_SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only platform-owner super admin accounts can use owner login.",
      });
    }

    if (error.message === "OWNER_LOGIN_SCOPE_MISMATCH") {
      return res.status(403).json({
        success: false,
        message:
          "Owner login is restricted to the configured platform owner company scope.",
      });
    }

    if (error.message === "CLIENT_LOGIN_COMPANY_MISMATCH") {
      return res.status(403).json({
        success: false,
        message:
          "This user does not belong to the selected client company login scope.",
      });
    }

    if (error.message === "CLIENT_LOGIN_OWNER_SCOPE_BLOCKED") {
      return res.status(403).json({
        success: false,
        message:
          "Platform-owner accounts cannot use the client company login flow.",
      });
    }

    return sendControllerError(req, res, error, "Login failed");
  }
};

const getCompanyLoginContextController = async (req, res) => {
  try {
    const data = await getCompanyLoginContext({
      companyCode: req.params.companyCode,
    });

    return res.status(200).json({
      success: true,
      message: "Company login context loaded",
      data,
    });
  } catch (error) {
    if (error.message === "COMPANY_LOGIN_CONTEXT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message:
          "Company login context was not found for this company code",
      });
    }

    return sendControllerError(
      req,
      res,
      error,
      "Failed to load company login context"
    );
  }
};

const changePasswordController = async (req, res) => {
  try {
    const updatedUser = await changePassword({
      userId: req.user.userId,
      companyId: req.companyId || req.user.companyId || null,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      requestedByIp: req.ip || req.socket?.remoteAddress || null,
      requestedByUserAgent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: updatedUser,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (error.message === "INVALID_CURRENT_PASSWORD") {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    return sendControllerError(req, res, error, "Failed to change password");
  }
};

const forgotPasswordController = async (req, res) => {
  try {
    const result = await initiatePasswordReset({
      identifier: req.body.username || req.body.identifier,
      mobileNumber: req.body.mobileNumber,
      companyId: req.headers["x-company-id"] || null,
      requestedByIp: req.ip || req.socket?.remoteAddress || null,
      requestedByUserAgent: req.headers["user-agent"] || null,
      exposeToken: env.exposePasswordResetToken,
    });

    return res.status(200).json({
      success: true,
      message:
        "If the account details match, a password reset instruction has been created.",
      data: {
        resetOtp: result.resetOtp || null,
        deliveryMode: result.deliveryMode || "unknown",
        deliveryChannels: result.deliveryChannels || [],
        deliveryPolicy: result.deliveryPolicy || "any",
        channelStatuses: result.channelStatuses || {},
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to start password reset");
  }
};

const resetPasswordController = async (req, res) => {
  try {
    await resetForgottenPassword({
      resetOtp: req.body.resetOtp || req.body.resetToken,
      newPassword: req.body.newPassword,
      companyId: req.headers["x-company-id"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    if (error.message === "INVALID_RESET_TOKEN") {
      return res.status(400).json({
        success: false,
        message: "Reset OTP is invalid or expired",
      });
    }

    return sendControllerError(req, res, error, "Failed to reset password");
  }
};

const adminResetPasswordController = async (req, res) => {
  try {
    const data = await adminResetPassword({
      employeeId: req.body.employeeId,
      actorUserId: req.user.userId,
      companyId: req.companyId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Temporary password reset successfully",
      data,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Login account not found for this employee",
      });
    }

    return sendControllerError(req, res, error, "Failed to reset password");
  }
};

const getAuthenticatedProfileController = async (req, res) => {
  try {
    const data = await getAuthenticatedUserProfile({
      userId: req.user?.userId,
      companyId: req.companyId || req.user?.companyId || null,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Authenticated user was not found",
      });
    }

    return sendControllerError(req, res, error, "Failed to load authenticated profile");
  }
};

const updateAuthenticatedProfileController = async (req, res) => {
  try {
    const data = await updateAuthenticatedUserProfile({
      userId: req.user?.userId,
      companyId: req.companyId || req.user?.companyId || null,
      fullName: req.body?.fullName,
      mobileNumber: req.body?.mobileNumber,
      email: req.body?.email,
      emergencyContactNumber: req.body?.emergencyContactNumber,
      address: req.body?.address,
      department: req.body?.department,
      designation: req.body?.designation,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Authenticated user was not found",
      });
    }

    return sendControllerError(req, res, error, "Failed to update authenticated profile");
  }
};

const refreshSessionController = async (req, res) => {
  try {
    const data = await refreshAuthSession({
      refreshToken: req.body.refreshToken,
      companyId: req.headers["x-company-id"] || null,
      requestedByIp: req.ip || req.socket?.remoteAddress || null,
      requestedByUserAgent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data,
    });
  } catch (error) {
    if (error.message === "INVALID_REFRESH_TOKEN") {
      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or expired",
      });
    }
    return sendControllerError(req, res, error, "Failed to refresh session");
  }
};

const logoutSessionController = async (req, res) => {
  try {
    await logoutAuthSession({
      refreshToken: req.body.refreshToken,
      companyId: req.companyId || req.headers["x-company-id"] || null,
      actorUserId: req.user?.userId || null,
    });
    return res.status(200).json({
      success: true,
      message: "Session logged out successfully",
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to logout session");
  }
};

module.exports = {
  getAuthenticatedProfileController,
  getAuthStatus,
  getCompanyLoginContextController,
  registerUser,
  login,
  logoutSessionController,
  refreshSessionController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
  adminResetPasswordController,
  updateAuthenticatedProfileController,
};
