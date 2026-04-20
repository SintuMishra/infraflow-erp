import axios from "axios";
import {
  clearSession,
  getCurrentCompanyId,
  getRefreshToken,
  getToken,
  isTokenExpired,
  setSession,
} from "../utils/auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const AUTH_REFRESH_PATH = "/auth/refresh";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

let refreshPromise = null;
let redirectingToLogin = false;

const buildAuthHeaders = () => {
  const headers = {};
  const token = getToken();
  const companyId = getCurrentCompanyId();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (companyId) {
    headers["X-Company-Id"] = String(companyId);
  }

  return headers;
};

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent("erp:session-expired"));
};

const forceLoginRedirect = () => {
  if (typeof window === "undefined" || redirectingToLogin) {
    return;
  }

  const path = window.location.pathname || "";
  const isPublicAuthPath =
    path === "/login" ||
    path === "/owner-login" ||
    path.startsWith("/client-login") ||
    path === "/forgot-password";

  if (isPublicAuthPath) {
    return;
  }

  redirectingToLogin = true;
  window.location.replace("/login?reason=session-expired");
};

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("REFRESH_TOKEN_MISSING");
  }

  const response = await axios.post(
    `${apiBaseUrl}${AUTH_REFRESH_PATH}`,
    { refreshToken },
    {
      headers: buildAuthHeaders(),
      timeout: 15000,
    }
  );

  const data = response?.data?.data || null;
  if (!data?.token || !data?.refreshToken) {
    throw new Error("REFRESH_TOKEN_INVALID_RESPONSE");
  }

  setSession({
    token: data.token,
    refreshToken: data.refreshToken,
    user: data.user || null,
  });

  return data.token;
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && isTokenExpired(token)) {
    clearSession();
    dispatchSessionExpired();
    forceLoginRedirect();
    return Promise.reject(new axios.Cancel("SESSION_EXPIRED"));
  }

  const headers = config.headers || {};
  const authHeaders = buildAuthHeaders();

  config.headers = {
    ...headers,
    ...authHeaders,
  };

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};
    const normalizedUrl = String(originalRequest?.url || "");
    const isRefreshRequest = normalizedUrl.includes(AUTH_REFRESH_PATH);

    if (status === 401 && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const nextAccessToken = await refreshPromise;
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${nextAccessToken}`,
        };

        return api(originalRequest);
      } catch {
        clearSession();
        dispatchSessionExpired();
        forceLoginRedirect();
      }
    }

    const isSafeGet = String(originalRequest?.method || "").toLowerCase() === "get";
    const retriedNetworkFailure = Boolean(originalRequest?._networkRetry);
    const isTransientFailure = !status || status >= 500;

    if (isSafeGet && isTransientFailure && !retriedNetworkFailure) {
      originalRequest._networkRetry = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);
