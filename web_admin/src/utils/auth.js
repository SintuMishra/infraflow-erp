import { normalizeRole } from "./roles";

const TOKEN_KEY = "erp_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";
const USER_KEY = "erp_user";
const AUTH_STORAGE_KEYS = [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY];

const getBrowserStorage = (type) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return type === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

const getAuthStorage = () => {
  const sessionStorageRef = getBrowserStorage("session");
  const legacyLocalStorage = getBrowserStorage("local");

  if (!sessionStorageRef) {
    return legacyLocalStorage;
  }

  if (legacyLocalStorage) {
    AUTH_STORAGE_KEYS.forEach((key) => {
      const legacyValue = legacyLocalStorage.getItem(key);

      if (legacyValue !== null && sessionStorageRef.getItem(key) === null) {
        sessionStorageRef.setItem(key, legacyValue);
      }

      legacyLocalStorage.removeItem(key);
    });
  }

  return sessionStorageRef;
};

const parseJwtPayload = (token) => {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token, skewSeconds = 20) => {
  const payload = parseJwtPayload(token);
  const exp = Number(payload?.exp || 0);

  if (!exp) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + Math.max(0, Number(skewSeconds) || 0);
};

export const getToken = () => {
  return getAuthStorage()?.getItem(TOKEN_KEY) || null;
};

export const getRefreshToken = () => {
  return getAuthStorage()?.getItem(REFRESH_TOKEN_KEY) || null;
};

export const getStoredUser = () => {
  const storage = getAuthStorage();
  const raw = storage?.getItem(USER_KEY) || null;

  let storedUser = null;
  if (raw) {
    try {
      storedUser = JSON.parse(raw);
    } catch {
      storage?.removeItem(USER_KEY);
    }
  }

  const decoded = parseJwtPayload(getToken());

  if (!decoded) {
    return storedUser;
  }

  return {
    ...(storedUser || {}),
    id: decoded.userId || null,
    employeeId: decoded.employeeId || null,
    username: decoded.username || "",
    role: normalizeRole(decoded.role || storedUser?.role || ""),
    companyId: decoded.companyId || null,
    mustChangePassword: Boolean(decoded.mustChangePassword),
  };
};

export const getCurrentCompanyId = () => {
  const user = getStoredUser();
  const numeric = Number(user?.companyId);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

export const setSession = ({ token, refreshToken, user }) => {
  const storage = getAuthStorage();
  if (!storage) {
    return;
  }

  if (token) {
    storage.setItem(TOKEN_KEY, token);
  }

  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (user) {
    storage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearSession = () => {
  const sessionStorageRef = getBrowserStorage("session");
  const legacyLocalStorage = getBrowserStorage("local");

  AUTH_STORAGE_KEYS.forEach((key) => {
    sessionStorageRef?.removeItem(key);
    legacyLocalStorage?.removeItem(key);
  });
};

export const isAuthenticated = () => {
  return Boolean(getToken());
};

export const hasRole = (allowedRoles = []) => {
  if (!allowedRoles.length) return true;

  const user = getStoredUser();
  const userRole = normalizeRole(user?.role);
  if (userRole === "super_admin") {
    return true;
  }
  const normalizedAllowed = allowedRoles.map((role) => normalizeRole(role));
  return Boolean(userRole && normalizedAllowed.includes(userRole));
};

export const logout = () => {
  clearSession();
};
