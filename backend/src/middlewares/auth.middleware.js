const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { normalizeCompanyId } = require("../utils/companyScope.util");
const authModel = require("../modules/auth/auth.model");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(token, env.jwtSecret);
    const tokenCompanyId = normalizeCompanyId(decoded.companyId);
    const headerCompanyId = normalizeCompanyId(req.headers["x-company-id"]);

    if (
      tokenCompanyId !== null &&
      headerCompanyId !== null &&
      tokenCompanyId !== headerCompanyId
    ) {
      return res.status(403).json({
        success: false,
        message: "Company scope mismatch for this session",
      });
    }

    req.user = decoded;
    req.companyId = tokenCompanyId || headerCompanyId || null;

    if (req.companyId !== null) {
      const companyAccess = await authModel.findCompanyAccessById(req.companyId);

      if (companyAccess && !companyAccess.isActive) {
        return res.status(403).json({
          success: false,
          code: "COMPANY_ACCESS_DISABLED",
          message:
            "Your company workspace access is currently suspended. Please contact SinSoftware support.",
        });
      }
    }

    const mustChangePassword = Boolean(decoded.mustChangePassword);
    const allowedDuringPasswordReset = ["/api/auth/change-password", "/api/auth/me"];

    if (
      mustChangePassword &&
      !allowedDuringPasswordReset.some((path) => req.originalUrl?.startsWith(path))
    ) {
      return res.status(403).json({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Password change is required before using the workspace",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = {
  authenticate,
};
