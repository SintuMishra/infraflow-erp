import { Link, useLocation } from "react-router-dom";
import {
  SIDEBAR_MENU_GROUPS,
  canAccessTenantOnboarding,
  canAccessOwnerControlPanel,
  canAccessOperationalWorkspace,
} from "../../utils/access";
import { useAuth } from "../../hooks/useAuth";

function Sidebar({ isMobile = false, isOpen = true, onClose = () => {} }) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const currentRole = currentUser?.role || "";
  const isOwnerControlUser = canAccessOwnerControlPanel(currentUser);

  const visibleMenuGroups = SIDEBAR_MENU_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (item.workspace !== "owner" || isOwnerControlUser) &&
          (item.workspace !== "client" || canAccessOperationalWorkspace(currentUser)) &&
          (!item.allowedRoles?.length || item.allowedRoles.includes(currentRole)) &&
          (!item.requiresPlatformOwnerCompany ||
            canAccessTenantOnboarding(currentUser))
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      style={{
        ...styles.sidebar,
        ...(isMobile ? styles.sidebarMobile : {}),
        ...(isMobile && isOpen ? styles.sidebarMobileOpen : {}),
      }}
    >
      <div style={styles.sidebarOverlay} />
      <div style={styles.brandPanel}>
        <div style={styles.brandIcon}>CE</div>
        <div>
          <div style={styles.logo}>Construction ERP</div>
          <p style={styles.logoSubtext}>
            {isOwnerControlUser
              ? "Owner governance console for client onboarding, access control, and audit discipline."
              : "Operational command layer for production, dispatch, fleet and commercial control."}
          </p>
        </div>

        {isMobile ? (
          <button
            type="button"
            style={styles.mobileCloseButton}
            onClick={onClose}
            aria-label="Close menu"
          >
            Close
          </button>
        ) : null}
      </div>

      <nav style={styles.nav}>
        {visibleMenuGroups.map((group) => (
          <div key={group.label} style={styles.groupBlock}>
            <div style={styles.sectionLabel}>{group.label}</div>

            {group.items.map((item) => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={isMobile ? onClose : undefined}
                  style={{
                    ...styles.link,
                    ...(active ? styles.activeLink : {}),
                  }}
                >
                  <div style={styles.linkContent}>
                    <span style={styles.linkLabel}>{item.label}</span>
                    <span
                      style={{
                        ...styles.linkHint,
                        ...(active ? styles.activeLinkHint : {}),
                      }}
                    >
                      {item.hint}
                    </span>
                  </div>

                  {active ? <span style={styles.activeIndicator} /> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={styles.sidebarFooter}>
        <div style={styles.footerCard}>
          <span style={styles.footerRole}>
            {currentRole ? currentRole.replace(/_/g, " ") : "workspace user"}
          </span>
          <span style={styles.footerTag}>Delivery Standard</span>
          <p style={styles.footerText}>
            {isOwnerControlUser
              ? "Control client lifecycle safely: onboarding, billing discipline, suspension/re-activation, and audit readiness."
              : "Keep master data disciplined, dispatch financially accurate, and print outputs client-ready at all times."}
          </p>
        </div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    position: "relative",
    width: "290px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.20), transparent 24%), linear-gradient(180deg, #17212b 0%, #1e293b 55%, #273341 100%)",
    color: "#fff",
    padding: "24px 18px 20px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "14px 0 40px rgba(17, 24, 39, 0.18)",
    overflowY: "auto",
  },
  sidebarMobile: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    minHeight: "100dvh",
    width: "min(88vw, 320px)",
    zIndex: 40,
    transform: "translateX(-104%)",
    transition: "transform 0.22s ease",
  },
  sidebarMobileOpen: {
    transform: "translateX(0)",
  },
  sidebarOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 22%, transparent 76%, rgba(255,255,255,0.04))",
    pointerEvents: "none",
  },
  brandPanel: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "12px 10px 18px",
    marginBottom: "18px",
  },
  mobileCloseButton: {
    marginLeft: "auto",
    marginTop: "2px",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    flexShrink: 0,
  },
  brandIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "18px",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #0f766e 0%, #c0841a 100%)",
    color: "#fff",
    fontWeight: "800",
    fontSize: "15px",
    letterSpacing: "0.5px",
    boxShadow: "0 16px 30px rgba(15, 118, 110, 0.26)",
    flexShrink: 0,
  },
  logo: {
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "-0.02em",
    color: "#ffffff",
  },
  logoSubtext: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "rgba(255,255,255,0.64)",
    lineHeight: 1.5,
    maxWidth: "190px",
  },
  sectionLabel: {
    padding: "0 10px",
    marginBottom: "10px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "rgba(255,255,255,0.42)",
    fontWeight: "800",
  },
  nav: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  groupBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  link: {
    color: "#dbe4f0",
    textDecoration: "none",
    padding: "14px 14px",
    borderRadius: "18px",
    fontSize: "15px",
    transition: "all 0.22s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid transparent",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(8px)",
  },
  activeLink: {
    background: "linear-gradient(135deg, rgba(15,118,110,0.28) 0%, rgba(192,132,26,0.22) 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 30px rgba(15, 23, 42, 0.16)",
  },
  linkContent: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  linkLabel: {
    fontWeight: "700",
    letterSpacing: "-0.01em",
  },
  linkHint: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.48)",
  },
  activeLinkHint: {
    color: "rgba(255,255,255,0.72)",
  },
  activeIndicator: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#fbbf24",
    boxShadow: "0 0 0 6px rgba(251,191,36,0.14)",
    flexShrink: 0,
  },
  sidebarFooter: {
    marginTop: "auto",
    paddingTop: "18px",
    position: "relative",
    zIndex: 1,
  },
  footerCard: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
  },
  footerRole: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "rgba(252,211,77,0.12)",
    color: "#fde68a",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  footerTag: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    color: "#fcd34d",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  footerText: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.76)",
  },
};

export default Sidebar;
