import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  canAccessOwnerControlPanel,
  getDefaultWorkspacePath,
} from "../../utils/access";

function PublicRoute({ children }) {
  const location = useLocation();
  const { currentUser, isAuthenticated, sessionLoading } = useAuth();

  if (sessionLoading) {
    return <div style={styles.loading}>Checking session...</div>;
  }

  if (isAuthenticated) {
    const isOwnerConsoleUser = canAccessOwnerControlPanel(currentUser);
    const isOwnerRoute = location.pathname.startsWith("/owner-login");
    const targetPath = currentUser?.mustChangePassword
      ? "/change-password"
      : getDefaultWorkspacePath(currentUser);

    // If a company-scoped user somehow opens owner-login while already signed in,
    // keep them inside client workspace instead of owner routes.
    if (isOwnerRoute && !isOwnerConsoleUser && !currentUser?.mustChangePassword) {
      return <Navigate to={getDefaultWorkspacePath(currentUser)} replace />;
    }

    return (
      <Navigate to={targetPath} replace />
    );
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

export default PublicRoute;
