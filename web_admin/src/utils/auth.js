const TOKEN_KEY = "erp_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";
const USER_KEY = "erp_user";

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
  return localStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);

  let storedUser = null;
  if (raw) {
    try {
      storedUser = JSON.parse(raw);
    } catch {
      localStorage.removeItem(USER_KEY);
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
    role: decoded.role || "",
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
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => {
  return Boolean(getToken());
};

export const hasRole = (allowedRoles = []) => {
  if (!allowedRoles.length) return true;

  const user = getStoredUser();
  return Boolean(user?.role && allowedRoles.includes(user.role));
};

export const logout = () => {
  clearSession();
};
