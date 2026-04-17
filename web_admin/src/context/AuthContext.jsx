import { createContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import {
  clearSession,
  getStoredUser,
  getToken,
  hasRole as hasRoleInSession,
  setSession,
} from "../utils/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [sessionLoading, setSessionLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = getToken();

      if (!token) {
        setSessionLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const apiUser = response.data?.data || null;
        const mergedUser = {
          ...getStoredUser(),
          ...apiUser,
        };

        setSession({ token, user: mergedUser });

        if (!cancelled) {
          setCurrentUser(mergedUser);
        }
      } catch {
        clearSession();

        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      sessionLoading,
      isAuthenticated: Boolean(getToken()),
      hasRole: (allowedRoles = []) => hasRoleInSession(allowedRoles),
      updateSession: ({ token, user }) => {
        const mergedUser = user
          ? {
              ...(getStoredUser() || {}),
              ...user,
            }
          : getStoredUser();

        setSession({ token, user: mergedUser });
        setCurrentUser(mergedUser);
      },
      clearAuth: () => {
        clearSession();
        setCurrentUser(null);
      },
    }),
    [currentUser, sessionLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
