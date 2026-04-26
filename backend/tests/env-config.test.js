const test = require("node:test");
const assert = require("node:assert/strict");

const envModulePath = require.resolve("../src/config/env");

test("env config reads required variables", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "unit-test-secret";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";

  delete require.cache[envModulePath];
  const env = require("../src/config/env");

  assert.equal(env.jwtSecret, "unit-test-secret");
  assert.equal(env.dbHost, "localhost");
  assert.equal(env.dbName, "construction_erp_db");
  assert.equal(env.loginRateLimitMaxAttempts, 5);
  assert.equal(env.passwordResetTokenTtlMinutes, 15);

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config rejects malformed numeric variables", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "unit-test-secret";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.PORT = "not-a-number";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /PORT must be an integer/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks password reset token exposure in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://erp.sinsoftware.com";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "true";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /EXPOSE_PASSWORD_RESET_TOKEN must be false in production/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks wildcard CORS in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "*";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /CORS_ORIGIN cannot be \* in production/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks localhost CORS origin in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /CORS_ORIGIN cannot point to localhost or 127\.0\.0\.1 in production/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks weak JWT secret in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "short";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://erp.sinsoftware.com";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /JWT_SECRET must be a strong non-placeholder secret/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks weak onboarding bootstrap secret when provided in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://erp.sinsoftware.com";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";
  process.env.ONBOARDING_BOOTSTRAP_SECRET = "replace_with_secret";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /ONBOARDING_BOOTSTRAP_SECRET must be a strong non-placeholder secret/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config blocks token_response password reset delivery in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://erp.sinsoftware.com";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";
  process.env.PASSWORD_RESET_DELIVERY_MODE = "token_response";

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /PASSWORD_RESET_DELIVERY_MODE cannot be token_response in production/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});

test("env config requires password reset webhook url for webhook delivery in production", async () => {
  const originalEnv = { ...process.env };

  process.env.JWT_SECRET = "prod_jwt_secret_value_0123456789ABCDEF";
  process.env.DB_HOST = "localhost";
  process.env.DB_NAME = "construction_erp_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASSWORD = "postgres";
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://erp.sinsoftware.com";
  process.env.EXPOSE_PASSWORD_RESET_TOKEN = "false";
  process.env.PASSWORD_RESET_DELIVERY_MODE = "webhook";
  delete process.env.PASSWORD_RESET_WEBHOOK_URL;

  delete require.cache[envModulePath];

  assert.throws(
    () => require("../src/config/env"),
    /PASSWORD_RESET_WEBHOOK_URL is required when PASSWORD_RESET_DELIVERY_MODE=webhook in production/
  );

  process.env = originalEnv;
  delete require.cache[envModulePath];
});
