import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  canAccessOwnerControlPanel,
  getDefaultWorkspacePath,
} from "../utils/access";

function formatRole(role) {
  if (!role) return "Workspace User";

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function UnauthorizedPage() {
  const { currentUser } = useAuth();
  const isPlatformOwnerUser = canAccessOwnerControlPanel(currentUser);
  const fallbackPath = getDefaultWorkspacePath(currentUser);
  const shouldShowClientLoginHint =
    String(currentUser?.role || "").toLowerCase() === "super_admin" &&
    !isPlatformOwnerUser;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Access Restricted</div>
        <h1 style={styles.title}>You do not have access to this section.</h1>
        <p style={styles.text}>
          Your account permissions do not allow this page.
        </p>

        {shouldShowClientLoginHint ? (
          <p style={styles.hintText}>
            This account is scoped to client operations. Use client login for daily work.
          </p>
        ) : null}

        <div style={styles.userBox}>
          <span style={styles.userLabel}>Current Role</span>
          <strong style={styles.userValue}>
            {formatRole(currentUser?.role)}
          </strong>
        </div>

        <div style={styles.actions}>
          <Link to={fallbackPath} style={styles.primaryButton}>
            Back To Workspace
          </Link>
          {shouldShowClientLoginHint ? (
            <Link to="/client-login" style={styles.secondaryButton}>
              Open Client Login
            </Link>
          ) : null}
          <Link to="/change-password" style={styles.secondaryButton}>
            Account Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.14), transparent 24%), radial-gradient(circle at bottom right, rgba(192,132,26,0.18), transparent 28%), linear-gradient(135deg, #f6efe4 0%, #efe9de 52%, #e9e3d8 100%)",
  },
  card: {
    width: "min(720px, 100%)",
    padding: "36px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.86)",
    border: "1px solid rgba(94, 78, 57, 0.10)",
    boxShadow: "0 28px 80px rgba(43, 34, 22, 0.12)",
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(180, 83, 9, 0.10)",
    color: "#9a3412",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "14px",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "38px",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    color: "#1f2933",
  },
  text: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.8,
    color: "#52606d",
    maxWidth: "620px",
  },
  hintText: {
    margin: "12px 0 0",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "rgba(15,118,110,0.08)",
    border: "1px solid rgba(15,118,110,0.18)",
    color: "#0f766e",
    fontSize: "14px",
    lineHeight: 1.6,
    fontWeight: "600",
  },
  userBox: {
    marginTop: "20px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid rgba(148, 131, 107, 0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  userLabel: {
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    color: "#7b8794",
  },
  userValue: {
    color: "#115e59",
    fontSize: "16px",
  },
  actions: {
    marginTop: "24px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "12px 18px",
    borderRadius: "14px",
    textDecoration: "none",
    background: "linear-gradient(135deg, #1f2933 0%, #334155 100%)",
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    padding: "12px 18px",
    borderRadius: "14px",
    textDecoration: "none",
    background: "#fff",
    color: "#1f2933",
    border: "1px solid rgba(148, 131, 107, 0.16)",
    fontWeight: "700",
  },
};

export default UnauthorizedPage;
