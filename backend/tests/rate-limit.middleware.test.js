const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const {
  loginRateLimiter,
  onboardingRateLimiter,
  passwordResetRateLimiter,
  resetRateLimitStore,
} = require("../src/middlewares/rateLimit.middleware");
const env = require("../src/config/env");

const createResponse = () => ({
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
    return this;
  },
});

test("loginRateLimiter blocks repeated requests for the same identifier and origin", () => {
  resetRateLimitStore();

  const req = {
    body: { username: "EMP0001" },
    headers: {},
    ip: "127.0.0.1",
  };

  for (let attempt = 0; attempt < env.loginRateLimitMaxAttempts; attempt += 1) {
    const res = createResponse();
    let nextCalled = false;

    loginRateLimiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  }

  const blockedResponse = createResponse();
  let nextCalled = false;

  loginRateLimiter(req, blockedResponse, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(
    blockedResponse.body.message,
    "Too many login attempts. Please wait before trying again."
  );
  assert.ok(Number(blockedResponse.headers["Retry-After"]) >= 1);
});

test("passwordResetRateLimiter keeps separate keys for different identifiers", () => {
  resetRateLimitStore();

  const blockedIdentifier = "EMP0002";

  for (
    let attempt = 0;
    attempt < env.passwordResetRateLimitMaxAttempts;
    attempt += 1
  ) {
    const res = createResponse();
    let nextCalled = false;

    passwordResetRateLimiter(
      {
        body: { identifier: blockedIdentifier },
        headers: {},
        ip: "127.0.0.1",
      },
      res,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(nextCalled, true);
  }

  const blockedResponse = createResponse();
  let blockedNextCalled = false;

  passwordResetRateLimiter(
    {
      body: { identifier: blockedIdentifier },
      headers: {},
      ip: "127.0.0.1",
    },
    blockedResponse,
    () => {
      blockedNextCalled = true;
    }
  );

  assert.equal(blockedNextCalled, false);
  assert.equal(blockedResponse.statusCode, 429);

  const otherResponse = createResponse();
  let otherNextCalled = false;

  passwordResetRateLimiter(
    {
      body: { identifier: "EMP0099" },
      headers: {},
      ip: "127.0.0.1",
    },
    otherResponse,
    () => {
      otherNextCalled = true;
    }
  );

  assert.equal(otherNextCalled, true);
});

test("onboardingRateLimiter throttles repeated onboarding attempts for the same company and origin", () => {
  resetRateLimitStore();

  const req = {
    body: { companyName: "Apex Build Infra" },
    headers: {},
    ip: "127.0.0.1",
  };

  for (
    let attempt = 0;
    attempt < env.onboardingRateLimitMaxAttempts;
    attempt += 1
  ) {
    const res = createResponse();
    let nextCalled = false;

    onboardingRateLimiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  }

  const blockedResponse = createResponse();
  let blockedNextCalled = false;

  onboardingRateLimiter(req, blockedResponse, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(
    blockedResponse.body.message,
    "Too many onboarding attempts. Please wait before trying again."
  );
  assert.ok(Number(blockedResponse.headers["Retry-After"]) >= 1);
});
