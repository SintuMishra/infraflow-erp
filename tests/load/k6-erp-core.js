import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:5001/api").replace(/\/+$/, "");
const LOGIN_USERNAME = __ENV.TEST_EMAIL || __ENV.LOGIN_USERNAME || "";
const LOGIN_PASSWORD = __ENV.TEST_PASSWORD || __ENV.LOGIN_PASSWORD || "";
const LOGIN_INTENT = (__ENV.LOGIN_INTENT || "").trim();
const EXPECTED_COMPANY_ID = (__ENV.COMPANY_ID || __ENV.EXPECTED_COMPANY_ID || "").trim();
const VUS = Number(__ENV.VUS || 25);
const DURATION = __ENV.DURATION || "5m";
const REPORT_RANGE_DAYS = Number(__ENV.REPORT_RANGE_DAYS || 30);
const ALLOW_NON_STAGING = String(__ENV.ALLOW_NON_STAGING || "").trim().toLowerCase() === "true";

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<1000"],
    "http_req_duration{type:normal}": ["avg<300", "p(95)<1000"],
    "http_req_duration{type:report}": ["avg<1000", "p(95)<1000"],
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

function dateOnlyOffset(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
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

function buildAuthHeaders(session) {
  return {
    Authorization: `Bearer ${session.token}`,
    "X-Company-Id": String(session.companyId),
  };
}

function taggedGet(session, path, tags) {
  return http.get(`${BASE_URL}${path}`, {
    headers: buildAuthHeaders(session),
    tags,
  });
}

function assertOk(response, label) {
  check(response, {
    [`${label} status is 200`]: (res) => res.status === 200,
  });
}

function pickWeightedFlow() {
  const roll = Math.random();

  if (roll < 0.18) return "dashboard";
  if (roll < 0.36) return "mastersLookup";
  if (roll < 0.56) return "dispatchList";
  if (roll < 0.74) return "dispatchReport";
  if (roll < 0.87) return "crusherReport";
  return "projectReport";
}

export function setup() {
  ensureSafeTarget();

  const headers = { "Content-Type": "application/json" };
  if (EXPECTED_COMPANY_ID) {
    headers["X-Company-Id"] = EXPECTED_COMPANY_ID;
  }

  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(buildLoginPayload()),
    { headers, tags: { name: "auth_login", type: "normal" } }
  );

  check(loginResponse, {
    "setup login status is 200": (res) => res.status === 200,
    "setup login returned token": (res) => Boolean(res.json("data.token")),
  });

  const token = loginResponse.json("data.token");
  const responseCompanyId =
    loginResponse.json("data.user.companyId") ||
    loginResponse.json("data.company.id") ||
    loginResponse.json("data.companyId") ||
    (EXPECTED_COMPANY_ID ? Number(EXPECTED_COMPANY_ID) : null);

  if (!token || !responseCompanyId) {
    throw new Error("Failed to resolve staging auth token/company scope for load test");
  }

  return {
    token,
    companyId: responseCompanyId,
    dateFrom: dateOnlyOffset(REPORT_RANGE_DAYS),
    dateTo: dateOnlyOffset(0),
  };
}

export default function (session) {
  ensureSafeTarget();
  const flow = pickWeightedFlow();

  group(flow, () => {
    if (flow === "dashboard") {
      const response = taggedGet(session, "/dashboard/summary", {
        name: "dashboard_summary",
        type: "normal",
      });
      assertOk(response, "dashboard summary");
      return;
    }

    if (flow === "mastersLookup") {
      const responses = [
        taggedGet(session, "/masters/lookup", { name: "masters_lookup", type: "normal" }),
        taggedGet(session, "/plants/lookup", { name: "plants_lookup", type: "normal" }),
        taggedGet(session, "/vehicles/lookup", { name: "vehicles_lookup", type: "normal" }),
        taggedGet(session, "/parties/lookup", { name: "parties_lookup", type: "normal" }),
      ];
      responses.forEach((response, index) => assertOk(response, `lookup ${index + 1}`));
      return;
    }

    if (flow === "dispatchList") {
      const response = taggedGet(
        session,
        `/dispatch-reports?page=1&limit=25&dateFrom=${session.dateFrom}&dateTo=${session.dateTo}`,
        { name: "dispatch_list", type: "normal" }
      );
      assertOk(response, "dispatch list");
      return;
    }

    if (flow === "dispatchReport") {
      const response = taggedGet(
        session,
        `/dispatch-reports?page=1&limit=25&search=&dateFrom=${session.dateFrom}&dateTo=${session.dateTo}`,
        { name: "dispatch_report", type: "report" }
      );
      assertOk(response, "dispatch report");
      return;
    }

    if (flow === "crusherReport") {
      const response = taggedGet(
        session,
        `/plant-unit-reports?page=1&limit=25&startDate=${session.dateFrom}&endDate=${session.dateTo}`,
        { name: "crusher_report", type: "report" }
      );
      assertOk(response, "crusher report");
      return;
    }

    const response = taggedGet(
      session,
      `/project-reports?page=1&limit=25&startDate=${session.dateFrom}&endDate=${session.dateTo}`,
      { name: "project_report", type: "report" }
    );
    assertOk(response, "project report");
  });

  sleep(1);
}
