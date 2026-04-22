const { normalizeRole } = require("../utils/role.util");

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

module.exports = {
  authorizeRoles,
};
