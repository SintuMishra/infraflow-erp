import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { logout } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const MOBILE_BREAKPOINT = 1024;

function AppShell({ title, subtitle, children }) {
  const navigate = useNavigate();
  const { clearAuth, currentUser } = useAuth();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return undefined;
    }
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = isSidebarOpen ? "hidden" : "";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isMobile, isSidebarOpen]);

  const handleLogout = () => {
    logout();
    clearAuth();
    navigate("/login");
  };

  return (
    <div style={styles.page}>
      <Sidebar
        isMobile={isMobile}
        isOpen={isMobile ? isSidebarOpen : true}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isMobile && isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsSidebarOpen(false)}
          style={styles.mobileBackdrop}
        />
      ) : null}

      <main
        style={{
          ...styles.main,
          ...(isMobile ? styles.mainMobile : {}),
        }}
      >
        <div style={styles.mainGlowTop} />
        <div style={styles.mainGlowBottom} />
        <div style={styles.gridTexture} />

        <div
          style={{
            ...styles.inner,
            ...(isMobile ? styles.innerMobile : {}),
          }}
        >
          <Header
            title={title}
            subtitle={subtitle}
            onLogout={handleLogout}
            currentUser={currentUser}
            isMobile={isMobile}
            onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          />
          <div style={styles.content}>{children}</div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.10), transparent 22%), radial-gradient(circle at bottom right, rgba(192,132,26,0.14), transparent 28%), linear-gradient(180deg, #f7f2ea 0%, #ece7de 100%)",
  },
  main: {
    position: "relative",
    flex: 1,
    padding: "30px 34px",
    overflow: "hidden",
  },
  mainMobile: {
    padding: "16px 14px 24px",
  },
  inner: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "22px",
    width: "100%",
    maxWidth: "1600px",
    margin: "0 auto",
  },
  innerMobile: {
    gap: "16px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  gridTexture: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(115,92,59,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(115,92,59,0.04) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    maskImage: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 78%)",
    pointerEvents: "none",
  },
  mainGlowTop: {
    position: "absolute",
    top: "-140px",
    right: "-40px",
    width: "300px",
    height: "300px",
    borderRadius: "999px",
    background: "rgba(15,118,110,0.12)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },
  mainGlowBottom: {
    position: "absolute",
    bottom: "-120px",
    left: "-30px",
    width: "320px",
    height: "320px",
    borderRadius: "999px",
    background: "rgba(192,132,26,0.12)",
    filter: "blur(76px)",
    pointerEvents: "none",
  },
  mobileBackdrop: {
    position: "fixed",
    inset: 0,
    border: "none",
    background: "rgba(15, 23, 42, 0.42)",
    zIndex: 30,
    cursor: "pointer",
  },
};

export default AppShell;
