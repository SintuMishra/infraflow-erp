const dotenv = require("dotenv");

dotenv.config();

const requireEnv = (key, fallback) => {
  const value = process.env[key];

  if (value !== undefined && value !== null && String(value).trim() !== "") {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${key}`);
};

const parseIntegerEnv = (key, fallback, { min = null, max = null } = {}) => {
  const rawValue =
    process.env[key] !== undefined && process.env[key] !== null && String(process.env[key]).trim() !== ""
      ? process.env[key]
      : fallback;

  const numericValue = Number(rawValue);

  if (!Number.isInteger(numericValue)) {
    throw new Error(`Environment variable ${key} must be an integer`);
  }

  if (min !== null && numericValue < min) {
    throw new Error(`Environment variable ${key} must be at least ${min}`);
  }

  if (max !== null && numericValue > max) {
    throw new Error(`Environment variable ${key} must be at most ${max}`);
  }

  return numericValue;
};

const parseOptionalIntegerEnv = (key, { min = null, max = null } = {}) => {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return null;
  }

  const numericValue = Number(rawValue);

  if (!Number.isInteger(numericValue)) {
    throw new Error(`Environment variable ${key} must be an integer`);
  }

  if (min !== null && numericValue < min) {
    throw new Error(`Environment variable ${key} must be at least ${min}`);
  }

  if (max !== null && numericValue > max) {
    throw new Error(`Environment variable ${key} must be at most ${max}`);
  }

  return numericValue;
};

const parseBooleanEnv = (key, fallback) => {
  const rawValue =
    process.env[key] !== undefined && process.env[key] !== null && String(process.env[key]).trim() !== ""
      ? process.env[key]
      : fallback;

  const normalizedValue = String(rawValue).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`Environment variable ${key} must be true or false`);
};

const parseEnumEnv = (key, fallback, allowedValues = []) => {
  const rawValue =
    process.env[key] !== undefined && process.env[key] !== null && String(process.env[key]).trim() !== ""
      ? process.env[key]
      : fallback;

  const normalizedValue = String(rawValue || "").trim().toLowerCase();
  if (!allowedValues.includes(normalizedValue)) {
    throw new Error(
      `Environment variable ${key} must be one of: ${allowedValues.join(", ")}`
    );
  }

  return normalizedValue;
};

const parseCsvEnumEnv = (key, fallback, allowedValues = []) => {
  const rawValue =
    process.env[key] !== undefined && process.env[key] !== null && String(process.env[key]).trim() !== ""
      ? process.env[key]
      : fallback;

  const values = String(rawValue || "")
    .split(",")
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!values.length) {
    throw new Error(
      `Environment variable ${key} must contain at least one value from: ${allowedValues.join(", ")}`
    );
  }

  const invalidValue = values.find((value) => !allowedValues.includes(value));

  if (invalidValue) {
    throw new Error(
      `Environment variable ${key} contains unsupported value: ${invalidValue}`
    );
  }

  return Array.from(new Set(values));
};

const looksLikePlaceholderSecret = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("replace_with") ||
    normalized.includes("change_this") ||
    normalized === "secret" ||
    normalized === "test-secret" ||
    normalized === "unit-test-secret"
  );
};

const env = {
  port: parseIntegerEnv("PORT", 5000, { min: 1, max: 65535 }),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  enforceCompanyScope: parseBooleanEnv("ENFORCE_COMPANY_SCOPE", "true"),
  loginRateLimitWindowMs: parseIntegerEnv(
    "LOGIN_RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
    { min: 1 }
  ),
  loginRateLimitMaxAttempts: parseIntegerEnv(
    "LOGIN_RATE_LIMIT_MAX_ATTEMPTS",
    5,
    { min: 1 }
  ),
  passwordResetRateLimitWindowMs: parseIntegerEnv(
    "PASSWORD_RESET_RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
    { min: 1 }
  ),
  passwordResetRateLimitMaxAttempts: parseIntegerEnv(
    "PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS",
    5,
    { min: 1 }
  ),
  onboardingRateLimitWindowMs: parseIntegerEnv(
    "ONBOARDING_RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
    { min: 1 }
  ),
  onboardingRateLimitMaxAttempts: parseIntegerEnv(
    "ONBOARDING_RATE_LIMIT_MAX_ATTEMPTS",
    10,
    { min: 1 }
  ),
  authRefreshRateLimitWindowMs: parseIntegerEnv(
    "AUTH_REFRESH_RATE_LIMIT_WINDOW_MS",
    5 * 60 * 1000,
    { min: 1 }
  ),
  authRefreshRateLimitMaxAttempts: parseIntegerEnv(
    "AUTH_REFRESH_RATE_LIMIT_MAX_ATTEMPTS",
    20,
    { min: 1 }
  ),
  accessTokenTtlMinutes: parseIntegerEnv("ACCESS_TOKEN_TTL_MINUTES", 30, {
    min: 5,
    max: 24 * 60,
  }),
  refreshTokenTtlDays: parseIntegerEnv("REFRESH_TOKEN_TTL_DAYS", 14, {
    min: 1,
    max: 90,
  }),
  rateLimitStore: parseEnumEnv(
    "RATE_LIMIT_STORE",
    process.env.NODE_ENV === "production" ? "postgres" : "memory",
    ["memory", "postgres"]
  ),
  passwordResetTokenTtlMinutes: parseIntegerEnv(
    "PASSWORD_RESET_TOKEN_TTL_MINUTES",
    15,
    { min: 1 }
  ),
  trustProxyHops: parseIntegerEnv(
    "TRUST_PROXY_HOPS",
    process.env.NODE_ENV === "production" ? 1 : 0,
    { min: 0, max: 10 }
  ),
  exposePasswordResetToken: parseBooleanEnv(
    "EXPOSE_PASSWORD_RESET_TOKEN",
    process.env.NODE_ENV === "production" ? "false" : "true"
  ),
  passwordResetDeliveryMode: parseEnumEnv(
    "PASSWORD_RESET_DELIVERY_MODE",
    process.env.NODE_ENV === "production" ? "webhook" : "token_response",
    ["token_response", "webhook", "disabled"]
  ),
  passwordResetDeliveryChannels: parseCsvEnumEnv(
    "PASSWORD_RESET_DELIVERY_CHANNELS",
    process.env.NODE_ENV === "production" ? "mobile,email" : "mobile",
    ["mobile", "email"]
  ),
  passwordResetDeliverySuccessPolicy: parseEnumEnv(
    "PASSWORD_RESET_DELIVERY_SUCCESS_POLICY",
    "any",
    ["any", "all"]
  ),
  passwordResetWebhookUrl: String(process.env.PASSWORD_RESET_WEBHOOK_URL || "").trim(),
  passwordResetPublicResetBaseUrl: String(
    process.env.PASSWORD_RESET_PUBLIC_RESET_BASE_URL || ""
  ).trim(),
  passwordResetWebhookTimeoutMs: parseIntegerEnv(
    "PASSWORD_RESET_WEBHOOK_TIMEOUT_MS",
    5000,
    { min: 500, max: 30000 }
  ),
  onboardingBootstrapSecret: process.env.ONBOARDING_BOOTSTRAP_SECRET || "",
  platformOwnerCompanyId: parseOptionalIntegerEnv("PLATFORM_OWNER_COMPANY_ID", {
    min: 1,
  }),
  jwtSecret: requireEnv("JWT_SECRET"),
  dbHost: requireEnv("DB_HOST"),
  dbPort: parseIntegerEnv("DB_PORT", 5432, { min: 1, max: 65535 }),
  dbName: requireEnv("DB_NAME"),
  dbUser: requireEnv("DB_USER"),
  dbPassword: requireEnv("DB_PASSWORD"),
  dbSsl: parseBooleanEnv("DB_SSL", process.env.NODE_ENV === "production" ? "true" : "false"),
  dbSslRejectUnauthorized: parseBooleanEnv(
    "DB_SSL_REJECT_UNAUTHORIZED",
    process.env.NODE_ENV === "production" ? "false" : "true"
  ),
  dbPoolMax: parseIntegerEnv("DB_POOL_MAX", 20, { min: 1, max: 200 }),
  dbPoolMin: parseIntegerEnv("DB_POOL_MIN", 2, { min: 0, max: 100 }),
  dbPoolIdleTimeoutMs: parseIntegerEnv("DB_POOL_IDLE_TIMEOUT_MS", 30000, { min: 1000 }),
  dbPoolConnectionTimeoutMs: parseIntegerEnv("DB_POOL_CONNECTION_TIMEOUT_MS", 5000, { min: 500 }),
};

if (env.dbPoolMin > env.dbPoolMax) {
  throw new Error("DB_POOL_MIN cannot be greater than DB_POOL_MAX");
}

if (env.nodeEnv === "production" && env.exposePasswordResetToken) {
  throw new Error(
    "EXPOSE_PASSWORD_RESET_TOKEN must be false in production"
  );
}

if (env.nodeEnv === "production") {
  if (env.corsOrigin === "*") {
    throw new Error("CORS_ORIGIN cannot be * in production");
  }

  const normalizedCorsOrigin = String(env.corsOrigin || "").toLowerCase();
  if (
    normalizedCorsOrigin.includes("localhost") ||
    normalizedCorsOrigin.includes("127.0.0.1")
  ) {
    throw new Error(
      "CORS_ORIGIN cannot point to localhost or 127.0.0.1 in production"
    );
  }

  if (looksLikePlaceholderSecret(env.jwtSecret) || env.jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be a strong non-placeholder secret with minimum length 32 in production"
    );
  }

  const onboardingSecret = String(env.onboardingBootstrapSecret || "").trim();

  if (onboardingSecret) {
    if (
      looksLikePlaceholderSecret(onboardingSecret) ||
      onboardingSecret.length < 24
    ) {
      throw new Error(
        "ONBOARDING_BOOTSTRAP_SECRET must be a strong non-placeholder secret with minimum length 24 in production"
      );
    }
  }
}

module.exports = env;
