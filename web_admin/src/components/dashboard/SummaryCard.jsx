function SummaryCard({ title, value, accent }) {
  return (
    <div
      style={{
        ...styles.card,
        borderTop: `4px solid ${accent}`,
      }}
    >
      <p style={styles.title}>{title}</p>
      <h2 style={styles.value}>{value}</h2>
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 10px 30px rgba(17, 24, 39, 0.08)",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    color: "#6b7280",
    fontSize: "14px",
    marginBottom: "10px",
  },
  value: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    fontWeight: "700",
  },
};

export default SummaryCard;