const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const normalizeString = (value) => String(value || "").trim();

const parseBoolean = (value, fallback) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
};

const parsePositiveInteger = (value, fallback = null) => {
  const raw = normalizeString(value);
  if (!raw) {
    return fallback;
  }
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
};

const resolveExplicitSmokeCredentials = () => {
  const username = normalizeString(process.env.SMOKE_ADMIN_USERNAME);
  const password = normalizeString(process.env.SMOKE_ADMIN_PASSWORD);
  const companyId = parsePositiveInteger(process.env.SMOKE_ADMIN_COMPANY_ID);

  const provided = [Boolean(username), Boolean(password), Boolean(companyId)];
  const providedCount = provided.filter(Boolean).length;

  if (providedCount === 3) {
    return {
      username,
      password,
      companyId: String(companyId),
      source: "explicit-env",
    };
  }

  if (providedCount > 0) {
    const missing = [];
    if (!username) {
      missing.push("SMOKE_ADMIN_USERNAME");
    }
    if (!password) {
      missing.push("SMOKE_ADMIN_PASSWORD");
    }
    if (!companyId) {
      missing.push("SMOKE_ADMIN_COMPANY_ID");
    }

    const error = new Error(
      `Incomplete smoke admin credentials. Missing: ${missing.join(", ")}`
    );
    error.details = {
      requiredEnv:
        "Set SMOKE_ADMIN_USERNAME, SMOKE_ADMIN_PASSWORD, and SMOKE_ADMIN_COMPANY_ID together.",
    };
    throw error;
  }

  return null;
};

const resolveTargetCompanyId = () =>
  parsePositiveInteger(
    process.env.SMOKE_ADMIN_COMPANY_ID,
    parsePositiveInteger(process.env.PLATFORM_OWNER_COMPANY_ID, 1)
  ) || 1;

const resolveAutoSmokeAdminCredentials = async () => {
  const nodeEnv = normalizeString(process.env.NODE_ENV || "development").toLowerCase();
  const allowAutoPrepare = parseBoolean(
    process.env.SMOKE_AUTO_PREPARE_ADMIN,
    nodeEnv !== "production"
  );
  const allowAutoPrepareInProduction = parseBoolean(
    process.env.SMOKE_ALLOW_AUTO_PREPARE_IN_PRODUCTION,
    false
  );

  if (!allowAutoPrepare) {
    const error = new Error("Missing smoke admin credentials");
    error.details = {
      requiredEnv:
        "Set SMOKE_ADMIN_USERNAME, SMOKE_ADMIN_PASSWORD, and SMOKE_ADMIN_COMPANY_ID.",
    };
    throw error;
  }

  if (nodeEnv === "production" && !allowAutoPrepareInProduction) {
    const error = new Error(
      "Auto-prepare smoke admin is blocked in production mode by default"
    );
    error.details = {
      requiredEnv:
        "Set SMOKE_ALLOW_AUTO_PREPARE_IN_PRODUCTION=true for controlled local smoke runs, or provide explicit SMOKE_ADMIN_* credentials.",
    };
    throw error;
  }

  const { pool } = require("../config/db");
  const bcrypt = require("bcryptjs");

  const companyId = resolveTargetCompanyId();

  const usersScopedResult = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'company_id'
    ) AS "exists"
    `
  );
  const employeesScopedResult = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'company_id'
    ) AS "exists"
    `
  );

  const usersScoped = Boolean(usersScopedResult.rows[0]?.exists);
  const employeesScoped = Boolean(employeesScopedResult.rows[0]?.exists);

  const scopedWhereClause = usersScoped
    ? "AND u.company_id = $1"
    : employeesScoped
    ? "AND e.company_id = $1"
    : "";
  const scopedParams = scopedWhereClause ? [companyId] : [];

  const userResult = await pool.query(
    `
    SELECT
      u.id,
      u.username
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE u.role = 'super_admin'
      AND u.is_active = TRUE
      ${scopedWhereClause}
    ORDER BY u.id ASC
    LIMIT 1
    `,
    scopedParams
  );

  const user = userResult.rows[0] || null;
  if (!user) {
    const error = new Error("No active platform-owner super_admin found for smoke flows");
    error.details = {
      companyId,
      suggestion:
        "Create a platform owner with: npm run bootstrap:owner -- --company-id <id> --full-name <name> --designation <designation>",
    };
    throw error;
  }

  const password =
    normalizeString(process.env.SMOKE_AUTO_ADMIN_PASSWORD) ||
    `SmokeAdmin#${companyId}Aa`;
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    UPDATE users
    SET
      password_hash = $1,
      must_change_password = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [passwordHash, user.id]
  );

  process.env.SMOKE_ADMIN_USERNAME = user.username;
  process.env.SMOKE_ADMIN_PASSWORD = password;
  process.env.SMOKE_ADMIN_COMPANY_ID = String(companyId);

  return {
    username: user.username,
    password,
    companyId: String(companyId),
    source: "auto-prepared-local",
  };
};

const resolveSmokeAdminCredentials = async () => {
  const explicit = resolveExplicitSmokeCredentials();
  if (explicit) {
    return explicit;
  }
  return await resolveAutoSmokeAdminCredentials();
};

module.exports = {
  resolveSmokeAdminCredentials,
};
