import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { getDefaultWorkspacePath } from "../utils/access";

function ChangePasswordPage() {
  const navigate = useNavigate();
  const { updateSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const token = response.data?.data?.token;
      const refreshToken = response.data?.data?.refreshToken;
      const existingUser = JSON.parse(localStorage.getItem("erp_user") || "null");
      const userPayload = response.data?.data?.user || null;
      const user = userPayload
        ? {
            ...(existingUser || {}),
            ...userPayload,
          }
        : null;

      if (token) {
        updateSession({ token, refreshToken, user });
      }

      setSuccess("Password changed successfully. Redirecting...");
      setTimeout(() => {
        navigate(getDefaultWorkspacePath(user));
      }, 1200);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to change password"
      );
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.ambientGlowOne} />
      <div style={styles.ambientGlowTwo} />
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.cardAccent} />
        <h2 style={styles.title}>Change Password</h2>
        <p style={styles.subtitle}>
          You must change your temporary password before continuing.
        </p>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <input
          type="password"
          placeholder="Current Temporary Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={styles.input}
        />

        <button type="submit" style={styles.button}>
          Change Password
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.14), transparent 22%), radial-gradient(circle at bottom right, rgba(192,132,26,0.16), transparent 24%), linear-gradient(135deg, #f1ece2 0%, #f8fafc 100%)",
    padding: "20px",
    overflow: "hidden",
  },
  ambientGlowOne: {
    position: "absolute",
    top: "-120px",
    left: "-80px",
    width: "280px",
    height: "280px",
    borderRadius: "999px",
    background: "rgba(15,118,110,0.15)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  ambientGlowTwo: {
    position: "absolute",
    right: "-90px",
    bottom: "-100px",
    width: "320px",
    height: "320px",
    borderRadius: "999px",
    background: "rgba(192,132,26,0.18)",
    filter: "blur(90px)",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    background: "rgba(255,255,255,0.9)",
    padding: "40px",
    borderRadius: "18px",
    width: "360px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.10)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: "-36px",
    right: "-28px",
    width: "130px",
    height: "130px",
    borderRadius: "999px",
    background: "rgba(15,118,110,0.10)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
  },
  subtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: "14px",
  },
  input: {
    padding: "12px 14px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    outline: "none",
  },
  button: {
    padding: "12px 14px",
    background: "#111827",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    fontSize: "14px",
    margin: 0,
  },
  success: {
    color: "#059669",
    fontSize: "14px",
    margin: 0,
  },
};

export default ChangePasswordPage;
