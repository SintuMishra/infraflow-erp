const env = require("../config/env");
const { pool } = require("../config/db");
const logger = require("../utils/logger");

const memoryStore = new Map();
let postgresStoreHealthy = true;
let postgresStoreUnavailableSince = null;
const POSTGRES_RECOVERY_RETRY_MS = 30 * 1000;

const cleanupExpiredMemoryEntries = (now) => {
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
};

const consumeFromMemoryStore = ({ entryKey, now, windowMs, maxAttempts }) => {
  cleanupExpiredMemoryEntries(now);

  const existingEntry = memoryStore.get(entryKey);

  if (!existingEntry || existingEntry.resetAt <= now) {
    memoryStore.set(entryKey, {
      attempts: 1,
      resetAt: now + windowMs,
    });

    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  if (existingEntry.attempts >= maxAttempts) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existingEntry.resetAt - now) / 1000)),
    };
  }

  existingEntry.attempts += 1;
  memoryStore.set(entryKey, existingEntry);

  return {
    blocked: false,
    retryAfterSeconds: 0,
  };
};

const consumeFromPostgresStore = async ({
  entryKey,
  windowMs,
  maxAttempts,
}) => {
  const result = await pool.query(
    `
    INSERT INTO rate_limit_counters (
      rate_key,
      attempts,
      window_started_at,
      expires_at,
      updated_at
    )
    VALUES ($1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2::text || ' milliseconds')::interval, CURRENT_TIMESTAMP)
    ON CONFLICT (rate_key)
    DO UPDATE
    SET
      attempts = CASE
        WHEN rate_limit_counters.expires_at <= CURRENT_TIMESTAMP THEN 1
        ELSE rate_limit_counters.attempts + 1
      END,
      window_started_at = CASE
        WHEN rate_limit_counters.expires_at <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
        ELSE rate_limit_counters.window_started_at
      END,
      expires_at = CASE
        WHEN rate_limit_counters.expires_at <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ($2::text || ' milliseconds')::interval
        ELSE rate_limit_counters.expires_at
      END,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::int AS "retryAfterSeconds"
    `,
    [entryKey, windowMs]
  );

  const entry = result.rows[0] || { attempts: 1, retryAfterSeconds: 1 };
  return {
    blocked: Number(entry.attempts || 0) > maxAttempts,
    retryAfterSeconds: Number(entry.retryAfterSeconds || 1),
  };
};

const consumeRateLimit = async ({
  entryKey,
  windowMs,
  maxAttempts,
}) => {
  if (env.rateLimitStore === "postgres") {
    const now = Date.now();
    const shouldAttemptPostgres =
      postgresStoreHealthy ||
      postgresStoreUnavailableSince === null ||
      now - postgresStoreUnavailableSince >= POSTGRES_RECOVERY_RETRY_MS;

    if (!shouldAttemptPostgres) {
      return consumeFromMemoryStore({
        entryKey,
        now,
        windowMs,
        maxAttempts,
      });
    }

    try {
      const result = await consumeFromPostgresStore({
        entryKey,
        windowMs,
        maxAttempts,
      });

      postgresStoreHealthy = true;
      postgresStoreUnavailableSince = null;
      return result;
    } catch (error) {
      postgresStoreHealthy = false;
      postgresStoreUnavailableSince = Date.now();
      logger.warn("Rate limiter store degraded to memory", {
        message: error?.message || "unknown",
      });
    }
  }

  return consumeFromMemoryStore({
    entryKey,
    now: Date.now(),
    windowMs,
    maxAttempts,
  });
};

const createRateLimiter = ({
  keyPrefix,
  windowMs,
  maxAttempts,
  message,
  buildKey,
}) => {
  return (req, res, next) => {
    const rawKey = buildKey(req);
    const entryKey = `${keyPrefix}:${rawKey}`;

    if (env.rateLimitStore !== "postgres") {
      const result = consumeFromMemoryStore({
        entryKey,
        now: Date.now(),
        windowMs,
        maxAttempts,
      });
      if (result.blocked) {
        res.setHeader("Retry-After", String(Math.max(1, result.retryAfterSeconds || 1)));
        return res.status(429).json({
          success: false,
          message,
        });
      }

      return next();
    }

    return Promise.resolve(
      consumeRateLimit({
        entryKey,
        windowMs,
        maxAttempts,
      })
    )
      .then((result) => {
        if (result.blocked) {
          res.setHeader("Retry-After", String(Math.max(1, result.retryAfterSeconds || 1)));
          return res.status(429).json({
            success: false,
            message,
          });
        }

        return next();
      })
      .catch((error) => {
        logger.error("Rate limiter failed closed", {
          message: error?.message || "unknown",
        });

        return res.status(429).json({
          success: false,
          message,
        });
      });
  };
};

const normalizeIdentifier = (value) =>
  String(value || "").trim().toLowerCase() || "anonymous";

const buildRequestOriginKey = (req) => {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return String(req.ips[0]);
  }

  if (req.ip) {
    return String(req.ip);
  }

  if (req.socket?.remoteAddress) {
    return String(req.socket.remoteAddress);
  }

  return "unknown";
};

const loginRateLimiter = createRateLimiter({
  keyPrefix: "login",
  windowMs: env.loginRateLimitWindowMs,
  maxAttempts: env.loginRateLimitMaxAttempts,
  message: "Too many login attempts. Please wait before trying again.",
  buildKey: (req) =>
    `${buildRequestOriginKey(req)}:${normalizeIdentifier(
      req.body?.username || req.body?.identifier
    )}`,
});

const passwordResetRateLimiter = createRateLimiter({
  keyPrefix: "password-reset",
  windowMs: env.passwordResetRateLimitWindowMs,
  maxAttempts: env.passwordResetRateLimitMaxAttempts,
  message: "Too many password reset attempts. Please wait before trying again.",
  buildKey: (req) =>
    `${buildRequestOriginKey(req)}:${normalizeIdentifier(
      req.body?.identifier || req.body?.username
    )}`,
});

const onboardingRateLimiter = createRateLimiter({
  keyPrefix: "onboarding",
  windowMs: env.onboardingRateLimitWindowMs,
  maxAttempts: env.onboardingRateLimitMaxAttempts,
  message:
    "Too many onboarding attempts. Please wait before trying again.",
  buildKey: (req) =>
    `${buildRequestOriginKey(req)}:${normalizeIdentifier(req.body?.companyName)}`,
});

const authRefreshRateLimiter = createRateLimiter({
  keyPrefix: "auth-refresh",
  windowMs: env.authRefreshRateLimitWindowMs,
  maxAttempts: env.authRefreshRateLimitMaxAttempts,
  message: "Too many session refresh attempts. Please wait before trying again.",
  buildKey: (req) => `${buildRequestOriginKey(req)}`,
});

const resetRateLimitStore = () => {
  memoryStore.clear();
  postgresStoreHealthy = env.rateLimitStore === "postgres";
  postgresStoreUnavailableSince = null;
};

module.exports = {
  loginRateLimiter,
  passwordResetRateLimiter,
  onboardingRateLimiter,
  authRefreshRateLimiter,
  resetRateLimitStore,
};
