const { pool } = require("../config/db");
const env = require("../config/env");
const { hasColumn, tableExists } = require("../utils/companyScope.util");

const fail = (message, details = {}) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message,
        details,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
};

const pass = (summary) => {
  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Go-live readiness verified successfully.",
        checks: summary,
      },
      null,
      2
    )
  );
};

const run = async () => {
  if (env.nodeEnv !== "production") {
    fail("NODE_ENV must be production for go-live verification.", {
      nodeEnv: env.nodeEnv,
    });
    return;
  }

  await pool.query("SELECT 1");

  if (env.exposePasswordResetToken) {
    fail("EXPOSE_PASSWORD_RESET_TOKEN must be false for production.");
    return;
  }

  if (env.passwordResetDeliveryMode !== "webhook") {
    fail(
      "PASSWORD_RESET_DELIVERY_MODE must be webhook for production-safe password recovery."
    );
    return;
  }

  if (!Array.isArray(env.passwordResetDeliveryChannels) || !env.passwordResetDeliveryChannels.length) {
    fail("PASSWORD_RESET_DELIVERY_CHANNELS must include at least one channel.");
    return;
  }

  if (!env.passwordResetDeliveryChannels.includes("mobile")) {
    fail("PASSWORD_RESET_DELIVERY_CHANNELS must include mobile for recovery baseline.");
    return;
  }

  if (!env.passwordResetWebhookUrl) {
    fail("PASSWORD_RESET_WEBHOOK_URL must be configured for production.");
    return;
  }

  if (env.corsOrigin === "*") {
    fail("CORS_ORIGIN cannot be * for production.");
    return;
  }

  const companiesExists = await tableExists("companies");

  if (!companiesExists) {
    fail("companies table is missing. Run migrations before go-live.");
    return;
  }

  const companyCountResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM companies"
  );
  const companyCount = Number(companyCountResult.rows[0]?.count || 0);

  if (companyCount <= 0) {
    fail("At least one active company is required before go-live.");
    return;
  }

  const platformOwnerCompanyId = Number(env.platformOwnerCompanyId || 0) || null;

  if (!platformOwnerCompanyId) {
    fail("PLATFORM_OWNER_COMPANY_ID must be configured.");
    return;
  }

  const ownerCompanyResult = await pool.query(
    `
    SELECT id, company_code AS "companyCode", company_name AS "companyName", is_active AS "isActive"
    FROM companies
    WHERE id = $1
    LIMIT 1
    `,
    [platformOwnerCompanyId]
  );

  const ownerCompany = ownerCompanyResult.rows[0];

  if (!ownerCompany) {
    fail("PLATFORM_OWNER_COMPANY_ID does not exist in companies table.", {
      platformOwnerCompanyId,
    });
    return;
  }

  if (!ownerCompany.isActive) {
    fail("Platform owner company is inactive.", {
      platformOwnerCompanyId,
      companyCode: ownerCompany.companyCode,
      companyName: ownerCompany.companyName,
    });
    return;
  }

  const usersHasCompany = await hasColumn("users", "company_id");

  const ownerSuperAdminResult = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE role = 'super_admin'
      AND is_active = TRUE
      ${usersHasCompany ? "AND company_id = $1" : ""}
    `,
    usersHasCompany ? [platformOwnerCompanyId] : []
  );

  const ownerSuperAdminCount = Number(ownerSuperAdminResult.rows[0]?.count || 0);

  if (ownerSuperAdminCount <= 0) {
    fail("No active super_admin found for platform owner company.", {
      platformOwnerCompanyId,
    });
    return;
  }

  if (usersHasCompany) {
    const unscopedSuperAdminResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE role = 'super_admin'
        AND is_active = TRUE
        AND company_id IS NULL
      `
    );

    const unscopedSuperAdminCount = Number(
      unscopedSuperAdminResult.rows[0]?.count || 0
    );

    if (unscopedSuperAdminCount > 0) {
      fail("Active super_admin users must be company-scoped.", {
        unscopedSuperAdminCount,
      });
      return;
    }
  }

  pass({
    nodeEnv: env.nodeEnv,
    exposePasswordResetToken: env.exposePasswordResetToken,
    corsOrigin: env.corsOrigin,
    companyCount,
    platformOwnerCompanyId,
    platformOwnerCompanyCode: ownerCompany.companyCode,
    platformOwnerCompanyName: ownerCompany.companyName,
    ownerSuperAdminCount,
    companyScopedUsersEnabled: usersHasCompany,
    passwordResetDeliveryMode: env.passwordResetDeliveryMode,
    passwordResetDeliveryChannels: env.passwordResetDeliveryChannels,
    passwordResetDeliverySuccessPolicy: env.passwordResetDeliverySuccessPolicy,
    passwordResetWebhookConfigured: Boolean(env.passwordResetWebhookUrl),
  });
};

run()
  .catch((error) => {
    fail("Go-live readiness verification failed unexpectedly.", {
      errorMessage: error?.message || String(error),
    });
  })
  .finally(async () => {
    await pool.end();
  });
