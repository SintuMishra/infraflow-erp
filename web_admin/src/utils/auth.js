const TOKEN_KEY = "erp_token";
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

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);

  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }

  const decoded = parseJwtPayload(getToken());

  if (!decoded) {
    return null;
  }

  return {
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

export const setSession = ({ token, user }) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
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
