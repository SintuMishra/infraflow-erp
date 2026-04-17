import { useState } from "react";
import { useNavigate } from "react-router-dom";

const normalizeCompanyCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

function ClientLoginCompanyCodePage() {
  const navigate = useNavigate();
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeCompanyCode(companyCode);

    if (!normalized) {
      setError("Enter your registered company code.");
      return;
    }

    setError("");
    navigate(`/client-login/${encodeURIComponent(normalized)}`);
  };

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <p style={styles.eyebrow}>Client Company Login</p>
        <h1 style={styles.title}>Enter Company Code</h1>
        <p style={styles.subtitle}>
          Use the company code provided during handover to open your company-specific login.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}

        <label style={styles.label}>
          Company Code
          <input
            type="text"
            value={companyCode}
            onChange={(event) => setCompanyCode(event.target.value)}
            placeholder="Example: ACME_ROCK"
            style={styles.input}
            autoComplete="off"
          />
        </label>

        <button type="submit" style={styles.button}>
          Continue
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.14), transparent 25%), linear-gradient(135deg, #f6efe4 0%, #efe9de 52%, #e9e3d8 100%)",
  },
  card: {
    width: "min(520px, 100%)",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: "20px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "11px",
    color: "#0f766e",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  title: { margin: 0, fontSize: "30px", color: "#0f172a" },
  subtitle: { margin: 0, fontSize: "14px", lineHeight: 1.7, color: "#475569" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    fontSize: "13px",
    fontWeight: "700",
    color: "#334155",
  },
  input: {
    border: "1px solid rgba(100, 116, 139, 0.24)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    background: "#fff",
  },
  button: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    color: "#fff",
    background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
    fontWeight: "700",
    cursor: "pointer",
  },
  error: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(220,38,38,0.24)",
    background: "rgba(254,226,226,0.66)",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: "700",
  },
};

export default ClientLoginCompanyCodePage;
