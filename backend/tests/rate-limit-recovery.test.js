const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedRateLimiter = async ({ envMock, dbMock, loggerMock }, run) => {
  const middlewarePath = require.resolve("../src/middlewares/rateLimit.middleware");
  const envPath = require.resolve("../src/config/env");
  const dbPath = require.resolve("../src/config/db");
  const loggerPath = require.resolve("../src/utils/logger");

  const originalMiddleware = require.cache[middlewarePath];
  const originalEnv = require.cache[envPath];
  const originalDb = require.cache[dbPath];
  const originalLogger = require.cache[loggerPath];

  require.cache[envPath] = {
    id: envPath,
    filename: envPath,
    loaded: true,
    exports: envMock,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: dbMock,
  };
  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: loggerMock,
  };

  delete require.cache[middlewarePath];

  try {
    const middleware = require(middlewarePath);
    await run(middleware);
  } finally {
    delete require.cache[middlewarePath];

    if (originalMiddleware) {
      require.cache[middlewarePath] = originalMiddleware;
    }

    if (originalEnv) {
      require.cache[envPath] = originalEnv;
    } else {
      delete require.cache[envPath];
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }

    if (originalLogger) {
      require.cache[loggerPath] = originalLogger;
    } else {
      delete require.cache[loggerPath];
    }
  }
};

const createResponse = (onDone) => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    onDone();
    return this;
  },
});

const invokeLimiter = (middleware, req) =>
  new Promise((resolve) => {
    let resolved = false;
    const done = (result) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(result);
    };

    const res = createResponse(() => done({ nextCalled: false, res }));
    middleware(req, res, () => done({ nextCalled: true, res }));
  });

test(
  "rate limiter falls back to memory on postgres failure and recovers back to postgres",
  { concurrency: false },
  async () => {
    let queryCount = 0;
    let failPostgres = true;
    const warnings = [];
    const originalDateNow = Date.now;
    let nowMs = 1_000;

    Date.now = () => nowMs;

    try {
      await withMockedRateLimiter(
        {
          envMock: {
            rateLimitStore: "postgres",
            loginRateLimitWindowMs: 60_000,
            loginRateLimitMaxAttempts: 5,
            passwordResetRateLimitWindowMs: 60_000,
            passwordResetRateLimitMaxAttempts: 5,
            onboardingRateLimitWindowMs: 60_000,
            onboardingRateLimitMaxAttempts: 5,
            authRefreshRateLimitWindowMs: 60_000,
            authRefreshRateLimitMaxAttempts: 5,
          },
          dbMock: {
            pool: {
              query: async () => {
                queryCount += 1;
                if (failPostgres) {
                  throw new Error("postgres temporarily unavailable");
                }

                return {
                  rows: [{ attempts: 1, retryAfterSeconds: 1 }],
                };
              },
            },
          },
          loggerMock: {
            warn: (message) => warnings.push(message),
            error: () => null,
            info: () => null,
            debug: () => null,
          },
        },
        async ({ loginRateLimiter, resetRateLimitStore }) => {
          resetRateLimitStore();

          const req = {
            body: { username: "EMP0001" },
            headers: {},
            ip: "127.0.0.1",
            ips: [],
            socket: {
              remoteAddress: "127.0.0.1",
            },
          };

          const first = await invokeLimiter(loginRateLimiter, req);
          assert.equal(first.nextCalled, true);
          assert.equal(queryCount, 1);
          assert.equal(warnings.length, 1);

          nowMs += 1_000;
          const second = await invokeLimiter(loginRateLimiter, req);
          assert.equal(second.nextCalled, true);
          assert.equal(queryCount, 1, "second request should remain on memory fallback");

          failPostgres = false;
          nowMs += 31_000;
          const third = await invokeLimiter(loginRateLimiter, req);
          assert.equal(third.nextCalled, true);
          assert.equal(queryCount, 2, "third request should probe postgres and recover");
        }
      );
    } finally {
      Date.now = originalDateNow;
    }
  }
);
