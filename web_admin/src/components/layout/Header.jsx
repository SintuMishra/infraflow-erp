function formatTodayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  }).format(new Date());
}

function formatRoleLabel(role) {
  if (!role) return "Workspace User";

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCompanyLabel(currentUser) {
  if (currentUser?.company?.companyName) {
    return currentUser.company.companyName;
  }

  if (currentUser?.companyName) {
    return currentUser.companyName;
  }

  if (currentUser?.companyId) {
    return `Company #${currentUser.companyId}`;
  }

  return "Shared Workspace";
}

function Header({
  title,
  subtitle,
  onLogout,
  currentUser,
  isMobile = false,
  onMenuToggle = () => {},
}) {
  return (
    <header style={styles.header}>
      <div style={styles.titleBlock}>
        <div style={styles.headerTopRow}>
          {isMobile ? (
            <button type="button" onClick={onMenuToggle} style={styles.menuButton}>
              Menu
            </button>
          ) : null}
          <div style={styles.badge}>Construction ERP Control Room</div>
        </div>

        <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>{title}</h1>

        <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
          {subtitle}
        </p>
      </div>

      <div style={{ ...styles.metaGrid, ...(isMobile ? styles.metaGridMobile : {}) }}>
        <div
          style={{
            ...styles.dateCard,
            ...(isMobile ? styles.cardMobile : {}),
            ...(isMobile ? styles.gridSpanMobile : styles.gridSpanDate),
          }}
        >
          <p style={styles.dateLabel}>Today</p>
          <p style={styles.dateValue}>{formatTodayLabel()}</p>
        </div>

        {!isMobile ? (
          <div style={{ ...styles.statusCard, ...styles.gridSpanStatus }}>
            <span style={styles.statusDot} />
            <div>
              <p style={styles.statusLabel}>Platform</p>
              <p style={styles.statusValue}>Role-aware and company-scoped</p>
            </div>
          </div>
        ) : null}

        <div
          style={{
            ...styles.scopeCard,
            ...(isMobile ? styles.cardMobile : {}),
            ...(isMobile ? styles.gridSpanMobile : styles.gridSpanScope),
          }}
        >
          <p style={styles.userLabel}>Active Scope</p>
          <p style={styles.userName}>{formatCompanyLabel(currentUser)}</p>
          <p style={styles.scopeMeta}>
            {currentUser?.companyId
              ? `Isolated data view for company ${currentUser.companyId}`
              : "Session is using the current workspace scope"}
          </p>
        </div>

        <div
          style={{
            ...styles.userCard,
            ...(isMobile ? styles.cardMobile : {}),
            ...(isMobile ? styles.gridSpanMobile : styles.gridSpanUser),
          }}
        >
          <p style={styles.userLabel}>Signed In</p>
          <p style={styles.userName}>
            {currentUser?.fullName || currentUser?.username || "ERP User"}
          </p>
          <p style={styles.userRole}>{formatRoleLabel(currentUser?.role)}</p>
        </div>

        <button
          style={{
            ...styles.logoutButton,
            ...(isMobile ? styles.logoutButtonMobile : {}),
            ...(isMobile ? styles.gridSpanMobile : styles.gridSpanLogout),
          }}
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    marginBottom: "8px",
    padding: "4px 2px 2px",
  },

  titleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
  },

  headerTopRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  menuButton: {
    border: "1px solid rgba(15,118,110,0.26)",
    borderRadius: "999px",
    background: "rgba(15,118,110,0.08)",
    color: "#115e59",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    cursor: "pointer",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.62)",
    color: "#115e59",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    border: "1px solid rgba(15,118,110,0.16)",
    boxShadow: "0 10px 28px rgba(148, 131, 107, 0.08)",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.05,
    color: "#1f2933",
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },

  titleMobile: {
    fontSize: "26px",
    lineHeight: 1.15,
  },

  subtitle: {
    margin: 0,
    color: "#5b6776",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "820px",
    whiteSpace: "normal",
    wordBreak: "normal",
    overflowWrap: "break-word",
  },

  subtitleMobile: {
    maxWidth: "100%",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: "12px",
    alignItems: "stretch",
  },

  metaGridMobile: {
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  gridSpanDate: {
    gridColumn: "span 2",
  },

  gridSpanStatus: {
    gridColumn: "span 3",
  },

  gridSpanScope: {
    gridColumn: "span 3",
  },

  gridSpanUser: {
    gridColumn: "span 3",
  },

  gridSpanLogout: {
    gridColumn: "span 1",
  },

  gridSpanMobile: {
    gridColumn: "auto",
  },

  dateCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 34px rgba(43, 34, 22, 0.06)",
    minWidth: 0,
  },

  statusCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 34px rgba(43, 34, 22, 0.06)",
    minWidth: 0,
  },

  scopeCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(248,255,252,0.88)",
    border: "1px solid rgba(15,118,110,0.14)",
    boxShadow: "0 14px 34px rgba(43, 34, 22, 0.06)",
    minWidth: 0,
  },

  userCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 34px rgba(43, 34, 22, 0.06)",
    minWidth: 0,
  },

  cardMobile: {
    width: "100%",
    minWidth: 0,
  },

  dateLabel: {
    margin: 0,
    fontSize: "11px",
    color: "#7b8794",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    fontWeight: "700",
  },

  dateValue: {
    margin: 0,
    fontSize: "14px",
    color: "#1f2933",
    fontWeight: "700",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#0f766e",
    boxShadow: "0 0 0 6px rgba(15,118,110,0.12)",
    flexShrink: 0,
  },

  statusLabel: {
    margin: 0,
    fontSize: "11px",
    color: "#7b8794",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "700",
  },

  statusValue: {
    margin: "2px 0 0",
    fontSize: "13px",
    color: "#1f2933",
    fontWeight: "700",
  },

  userLabel: {
    margin: 0,
    fontSize: "11px",
    color: "#7b8794",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "700",
  },

  userName: {
    margin: 0,
    fontSize: "14px",
    color: "#1f2933",
    fontWeight: "800",
    lineHeight: 1.35,
  },

  userRole: {
    margin: 0,
    fontSize: "12px",
    color: "#115e59",
    fontWeight: "700",
  },

  scopeMeta: {
    margin: 0,
    fontSize: "12px",
    color: "#4b5563",
    fontWeight: "600",
    lineHeight: 1.4,
  },

  logoutButton: {
    width: "100%",
    minHeight: "100%",
    border: "1px solid rgba(31, 41, 51, 0.08)",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #1f2933 0%, #334155 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
    boxShadow: "0 14px 28px rgba(31, 41, 51, 0.14)",
    padding: "12px 16px",
  },

  logoutButtonMobile: {
    width: "100%",
    minHeight: "48px",
  },
};

export default Header;