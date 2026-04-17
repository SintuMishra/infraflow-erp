const { pool } = require("../config/db");
const { tableExists, hasColumn } = require("./companyScope.util");
const logger = require("./logger");

const recordAuditEvent = async ({
  action,
  actorUserId = null,
  targetType = null,
  targetId = null,
  companyId = null,
  details = null,
}) => {
  try {
    const auditTableExists = await tableExists("audit_logs");

    if (!auditTableExists) {
      return;
    }

    const hasCompanyId = await hasColumn("audit_logs", "company_id");

    await pool.query(
      `
      INSERT INTO audit_logs (
        action,
        actor_user_id,
        target_type,
        target_id,
        details
        ${hasCompanyId ? ", company_id" : ""}
      )
      VALUES ($1, $2, $3, $4, $5${hasCompanyId ? ", $6" : ""})
      `,
      [
        action,
        actorUserId,
        targetType,
        targetId,
        details ? JSON.stringify(details) : null,
        ...(hasCompanyId ? [companyId || null] : []),
      ]
    );
  } catch (error) {
    logger.warn("Failed to record audit event", {
      action,
      message: error.message,
    });
  }
};

module.exports = {
  recordAuditEvent,
};
