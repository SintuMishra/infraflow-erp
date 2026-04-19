import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("");
  const [deliveryChannels, setDeliveryChannels] = useState([]);
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setError("");
    setRequestMessage("");
    setResetMessage("");
    setRequesting(true);

    try {
      const response = await api.post("/auth/forgot-password", {
        identifier,
        mobileNumber,
      });

      const issuedOtp = response.data?.data?.resetOtp || "";
      const mode = response.data?.data?.deliveryMode || "";
      const channels = Array.isArray(response.data?.data?.deliveryChannels)
        ? response.data.data.deliveryChannels
        : [];
      setDeliveryMode(mode);
      setDeliveryChannels(channels);

      if (issuedOtp) {
        setResetOtp(issuedOtp);
        setRequestMessage(
          "Reset OTP generated for this environment. Use it below to set a new password."
        );
      } else if (mode === "webhook") {
        const isDualChannel =
          channels.includes("mobile") && channels.includes("email");
        setRequestMessage(
          isDualChannel
            ? "If details matched, a 6-digit reset OTP was sent to your registered mobile number and email."
            : "If details matched, a 6-digit reset OTP was sent to your registered mobile number."
        );
      } else {
        setRequestMessage(
          "If the account details matched, a reset request was created. Contact your admin if you do not receive reset instructions."
        );
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to start password reset");
    } finally {
      setRequesting(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setResetMessage("");
    setResetting(true);

    try {
      await api.post("/auth/reset-password", {
        resetOtp,
        newPassword,
      });

      setResetMessage("Password reset successfully. Redirecting to login...");
      setNewPassword("");
      window.setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <section style={styles.intro}>
          <p style={styles.eyebrow}>Password Recovery</p>
          <h1 style={styles.title}>Reset your password</h1>
          <p style={styles.description}>
            Verify your account, receive OTP, and set a new password.
          </p>
          <Link to="/login" style={styles.backLink}>
            Back to login
          </Link>
        </section>

        <section style={styles.forms}>
          <form style={styles.card} onSubmit={handleRequestReset}>
            <h2 style={styles.cardTitle}>1. Request reset</h2>
            {error && <p style={styles.error}>{error}</p>}
            {requestMessage && <p style={styles.success}>{requestMessage}</p>}

            <label style={styles.label}>
              Username / Employee Code / Mobile
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                style={styles.input}
                placeholder="Enter your login ID"
              />
            </label>

            <label style={styles.label}>
              Registered Mobile Number
              <input
                type="text"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                style={styles.input}
                placeholder="Enter the mobile number on file"
              />
            </label>

            {deliveryMode && (
              <p style={styles.helperText}>
                Active delivery mode: <strong>{deliveryMode}</strong>
              </p>
            )}
            {deliveryChannels.length > 0 && (
              <p style={styles.helperText}>
                Active channels: <strong>{deliveryChannels.join(", ")}</strong>
              </p>
            )}

            <button type="submit" style={styles.button} disabled={requesting}>
              {requesting ? "Requesting..." : "Create Reset Request"}
            </button>
          </form>

          <form style={styles.card} onSubmit={handleResetPassword}>
            <h2 style={styles.cardTitle}>2. Set new password</h2>
            {resetMessage && <p style={styles.success}>{resetMessage}</p>}

            <label style={styles.label}>
              6-digit OTP
              <input
                type="text"
                value={resetOtp}
                onChange={(event) => setResetOtp(event.target.value)}
                style={styles.input}
                placeholder="Enter OTP"
              />
            </label>

            <label style={styles.label}>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={styles.input}
                placeholder="Enter a new password"
                autoComplete="new-password"
              />
            </label>

            <button type="submit" style={styles.button} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px",
    background:
      "linear-gradient(145deg, #f5efe6 0%, #ece8df 52%, #e3eced 100%)",
  },
  panel: {
    width: "min(1120px, 100%)",
    display: "grid",
    gridTemplateColumns: "0.95fr 1.05fr",
    gap: "22px",
    padding: "24px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(148, 163, 184, 0.24)",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
  },
  intro: {
    padding: "28px",
    borderRadius: "24px",
    background:
      "linear-gradient(180deg, rgba(15,118,110,0.10), rgba(255,255,255,0.70))",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#0f766e",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.05,
    color: "#0f172a",
  },
  description: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#334155",
  },
  backLink: {
    width: "fit-content",
    color: "#0f766e",
    fontWeight: "700",
    textDecoration: "none",
  },
  forms: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "18px",
  },
  card: {
    padding: "24px",
    borderRadius: "24px",
    background: "#ffffff",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#0f172a",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "700",
  },
  input: {
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    marginTop: "4px",
    border: "none",
    borderRadius: "14px",
    padding: "13px 16px",
    background: "linear-gradient(135deg, #0f766e, #155e75)",
    color: "#ffffff",
    fontWeight: "800",
    cursor: "pointer",
  },
  helperText: {
    margin: 0,
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  error: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontWeight: "600",
    lineHeight: 1.6,
  },
  success: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: "600",
    lineHeight: 1.6,
  },
};

export default ForgotPasswordPage;
