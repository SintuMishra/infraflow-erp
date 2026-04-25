const { normalizeRole } = require("../utils/role.util");
const env = require("../config/env");
const {
  hasCompanyModule,
} = require("../utils/companyModules.util");

const PLATFORM_OWNER_COMPANY_ID =
  Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
    ? env.platformOwnerCompanyId
    : null;

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication is required",
      });
    }

    const actorRole = normalizeRole(req.user.role);
    if (actorRole === "super_admin") {
      return next();
    }

    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));

    if (!normalizedAllowedRoles.includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
};

const authorizeCompanyModules = (...requiredModules) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication is required",
      });
    }

    const normalizedRequiredModules = requiredModules
      .map((moduleKey) => String(moduleKey || "").trim().toLowerCase())
      .filter(Boolean);

    if (normalizedRequiredModules.length === 0 || req.companyId === null) {
      return next();
    }

    if (
      PLATFORM_OWNER_COMPANY_ID !== null &&
      Number(req.companyId || 0) === PLATFORM_OWNER_COMPANY_ID &&
      normalizeRole(req.user.role) === "super_admin"
    ) {
      return next();
    }

    const enabledModules = req.companyAccess?.enabledModules || [];
    const hasAllRequiredModules = normalizedRequiredModules.every((moduleKey) =>
      hasCompanyModule(enabledModules, moduleKey)
    );

    if (!hasAllRequiredModules) {
      return res.status(403).json({
        success: false,
        code: "COMPANY_MODULE_DISABLED",
        message:
          "This ERP section is not enabled for your company plan. Contact SinSoftware support to activate it.",
      });
    }

    next();
  };
};

const authorizeAnyCompanyModules = (...candidateModules) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication is required",
      });
    }

    const normalizedCandidateModules = candidateModules
      .map((moduleKey) => String(moduleKey || "").trim().toLowerCase())
      .filter(Boolean);

    if (normalizedCandidateModules.length === 0 || req.companyId === null) {
      return next();
    }

    if (
      PLATFORM_OWNER_COMPANY_ID !== null &&
      Number(req.companyId || 0) === PLATFORM_OWNER_COMPANY_ID &&
      normalizeRole(req.user.role) === "super_admin"
    ) {
      return next();
    }

    const enabledModules = req.companyAccess?.enabledModules || [];
    const hasAtLeastOneEnabledModule = normalizedCandidateModules.some((moduleKey) =>
      hasCompanyModule(enabledModules, moduleKey)
    );

    if (!hasAtLeastOneEnabledModule) {
      return res.status(403).json({
        success: false,
        code: "COMPANY_MODULE_DISABLED",
        message:
          "This ERP section is not enabled for your company plan. Contact SinSoftware support to activate it.",
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
  authorizeAnyCompanyModules,
  authorizeCompanyModules,
};
