const env = require("../config/env");

const rateLimitStore = new Map();

const cleanupExpiredEntries = (now) => {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const createRateLimiter = ({
  keyPrefix,
  windowMs,
  maxAttempts,
  message,
  buildKey,
}) => {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const rawKey = buildKey(req);
    const entryKey = `${keyPrefix}:${rawKey}`;
    const existingEntry = rateLimitStore.get(entryKey);

    if (!existingEntry || existingEntry.resetAt <= now) {
      rateLimitStore.set(entryKey, {
        attempts: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    if (existingEntry.attempts >= maxAttempts) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existingEntry.resetAt - now) / 1000)
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        success: false,
        message,
      });
    }

    existingEntry.attempts += 1;
    rateLimitStore.set(entryKey, existingEntry);
    return next();
  };
};

const normalizeIdentifier = (value) =>
  String(value || "").trim().toLowerCase() || "anonymous";

const buildRequestOriginKey = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const remoteAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || "").split(",")[0].trim() || req.ip || req.socket?.remoteAddress || "unknown";

  return remoteAddress;
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

const resetRateLimitStore = () => {
  rateLimitStore.clear();
};

module.exports = {
  loginRateLimiter,
  passwordResetRateLimiter,
  onboardingRateLimiter,
  resetRateLimitStore,
};
