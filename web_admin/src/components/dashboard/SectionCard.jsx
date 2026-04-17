function SectionCard({ title, children }) {
  return (
    <section style={styles.card}>
      {title ? <h3 style={styles.title}>{title}</h3> : null}
      <div style={styles.content}>{children}</div>
    </section>
  );
}

const styles = {
  card: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    borderRadius: "24px",
    padding: "24px",
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow:
      "0 18px 40px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)",
    backdropFilter: "blur(10px)",
  },
  title: {
    margin: "0 0 18px",
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
    letterSpacing: "-0.02em",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
};

export default SectionCard;