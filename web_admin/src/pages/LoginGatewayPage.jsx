import { Link } from "react-router-dom";

function LoginGatewayPage() {
  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <p style={styles.eyebrow}>Construction ERP Access</p>
          <h1 style={styles.title}>Choose Your Portal</h1>
          <p style={styles.subtitle}>
            Use owner access for platform control and client onboarding. Use client access for
            company operations.
          </p>
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <p style={styles.cardEyebrow}>SinSoftware Internal</p>
            <h2 style={styles.cardTitle}>Owner Portal</h2>
            <p style={styles.cardText}>
              For platform owner use only. Includes tenant onboarding and governance controls.
            </p>
            <Link to="/owner-login" style={styles.primaryButton}>
              Open Owner Login
            </Link>
          </section>

          <section style={styles.card}>
            <p style={styles.cardEyebrow}>Client Company</p>
            <h2 style={styles.cardTitle}>Client Portal</h2>
            <p style={styles.cardText}>
              For registered client company users. Enter company code and continue to scoped login.
            </p>
            <Link to="/client-login" style={styles.secondaryButton}>
              Open Client Login
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.14), transparent 24%), radial-gradient(circle at 80% 20%, rgba(192,132,26,0.16), transparent 22%), linear-gradient(135deg, #f6efe4 0%, #efe9de 52%, #e9e3d8 100%)",
  },
  panel: {
    width: "min(980px, 100%)",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  eyebrow: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    fontWeight: "800",
  },
  title: {
    margin: 0,
    fontSize: "36px",
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#475569",
    maxWidth: "760px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
  },
  card: {
    borderRadius: "18px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.8)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  cardEyebrow: {
    margin: 0,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    color: "#334155",
    fontWeight: "700",
  },
  cardTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  cardText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#475569",
    minHeight: "72px",
  },
  primaryButton: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "11px 14px",
    textAlign: "center",
    fontWeight: "700",
    fontSize: "14px",
    color: "#fff",
    background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
  },
  secondaryButton: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "11px 14px",
    textAlign: "center",
    fontWeight: "700",
    fontSize: "14px",
    color: "#0f172a",
    background: "linear-gradient(135deg, #f7d794 0%, #f4c874 100%)",
    border: "1px solid rgba(15,23,42,0.16)",
  },
};

export default LoginGatewayPage;
