import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:5001/api").replace(/\/+$/, "");
const LOGIN_USERNAME = __ENV.TEST_EMAIL || __ENV.LOGIN_USERNAME || "";
const LOGIN_PASSWORD = __ENV.TEST_PASSWORD || __ENV.LOGIN_PASSWORD || "";
const LOGIN_INTENT = (__ENV.LOGIN_INTENT || "").trim();
const EXPECTED_COMPANY_ID = (__ENV.COMPANY_ID || __ENV.EXPECTED_COMPANY_ID || "").trim();
const ALLOW_NON_STAGING = String(__ENV.ALLOW_NON_STAGING || "").trim().toLowerCase() === "true";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    checks: ["rate>0.99"],
  },
};

function ensureSafeTarget() {
  const normalizedUrl = BASE_URL.toLowerCase();
  const looksLocal =
    normalizedUrl.includes("localhost") || normalizedUrl.includes("127.0.0.1");
  const looksStaging =
    normalizedUrl.includes("staging") ||
    normalizedUrl.includes("preview") ||
    normalizedUrl.includes("dev");

  if (!looksLocal && !looksStaging && !ALLOW_NON_STAGING) {
    throw new Error(
      "Refusing to run against a non-staging URL. Set ALLOW_NON_STAGING=true only if you intentionally want this."
    );
  }
}

function buildLoginPayload() {
  const payload = {
    username: LOGIN_USERNAME,
    password: LOGIN_PASSWORD,
  };

  if (LOGIN_INTENT) {
    payload.loginIntent = LOGIN_INTENT;
  }

  if (EXPECTED_COMPANY_ID) {
    payload.expectedCompanyId = Number(EXPECTED_COMPANY_ID);
  }

  return payload;
}

export default function () {
  ensureSafeTarget();

  const headers = { "Content-Type": "application/json" };

  if (EXPECTED_COMPANY_ID) {
    headers["X-Company-Id"] = EXPECTED_COMPANY_ID;
  }

  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(buildLoginPayload()),
    { headers }
  );

  check(response, {
    "login status is 200": (res) => res.status === 200,
    "login returned token": (res) => Boolean(res.json("data.token")),
    "login returned refresh token": (res) => Boolean(res.json("data.refreshToken")),
  });

  sleep(1);
}
