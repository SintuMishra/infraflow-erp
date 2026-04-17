import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function ProtectedRoute({ children, allowedRoles = [], allowWhen = true }) {
  const location = useLocation();
  const { currentUser, hasRole, isAuthenticated, sessionLoading } = useAuth();

  if (sessionLoading) {
    return <div style={styles.loading}>Checking access...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  const isAllowedByCustomRule =
    typeof allowWhen === "function" ? Boolean(allowWhen(currentUser)) : Boolean(allowWhen);

  if (!isAllowedByCustomRule) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
    color: "#334155",
    fontSize: "16px",
    fontWeight: "600",
  },
};

export default ProtectedRoute;
