import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, isHostedFrontendMissingApiBaseUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { getDefaultWorkspacePath } from "../utils/access";

function LoginPage({ loginMode = "default" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyCode = "" } = useParams();
  const { updateSession } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyContext, setCompanyContext] = useState(null);
  const [companyContextLoading, setCompanyContextLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 960 : false
  );
  const [showHeroOnMobile, setShowHeroOnMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 960 : true
  );

  const mode = useMemo(() => {
    if (loginMode === "owner" || loginMode === "client") {
      return loginMode;
    }

    if (location.pathname.startsWith("/owner-login")) {
      return "owner";
    }

    if (location.pathname.startsWith("/client-login")) {
      return "client";
    }

    return "default";
  }, [location.pathname, loginMode]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyContext = async () => {
      if (mode !== "client") {
        setCompanyContext(null);
        setCompanyContextLoading(false);
        return;
      }

      const normalizedCompanyCode = String(companyCode || "").trim();

      if (!normalizedCompanyCode) {
        setCompanyContext(null);
        setCompanyContextLoading(false);
        return;
      }

      setCompanyContextLoading(true);
      setError("");

      try {
        const response = await api.get(
          `/auth/login-context/${encodeURIComponent(normalizedCompanyCode)}`
        );
        if (!cancelled) {
          setCompanyContext(response.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setCompanyContext(null);
          setError(
            err?.response?.data?.message ||
              "This company login link is invalid or inactive."
          );
        }
      } finally {
        if (!cancelled) {
          setCompanyContextLoading(false);
        }
      }
    };

    loadCompanyContext();

    return () => {
      cancelled = true;
    };
  }, [companyCode, mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 960);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowHeroOnMobile(true);
      return;
    }

    setShowHeroOnMobile(false);
  }, [isMobile]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedMode = mode === "owner" || mode === "client" ? mode : "";
      const expectedCompanyId =
        mode === "client" ? Number(companyContext?.id || 0) || null : null;

      if (mode === "client" && !expectedCompanyId) {
        setError("Client company context is missing. Use a valid company login link.");
        setLoading(false);
        return;
      }

      const response = await api.post(
        "/auth/login",
        {
          username,
          password,
          loginIntent: normalizedMode || undefined,
          expectedCompanyId,
        },
        {
          headers: expectedCompanyId
            ? {
                "X-Company-Id": String(expectedCompanyId),
              }
            : undefined,
        }
      );

      const token = response.data?.data?.token;
      const refreshToken = response.data?.data?.refreshToken;
      const mustChangePassword = response.data?.data?.mustChangePassword;
      const userPayload = response.data?.data?.user || null;
      const company = response.data?.data?.company || null;
      const user = userPayload
        ? {
            ...userPayload,
            company,
            companyName: company?.companyName || userPayload.companyName,
            branchName: company?.branchName || userPayload.branchName,
          }
        : null;

      if (!token) {
        setError("Login failed");
        setLoading(false);
        return;
      }

      const platformOwnerCompanyId = Number(
        String(import.meta.env.VITE_PLATFORM_OWNER_COMPANY_ID || "").trim()
      );

      if (
        mode === "owner" &&
        user?.role !== "super_admin"
      ) {
        setError("Owner login is only for platform super admin accounts.");
        setLoading(false);
        return;
      }

      if (
        mode === "owner" &&
        (!Number.isInteger(platformOwnerCompanyId) || platformOwnerCompanyId <= 0)
      ) {
        setError(
          "Owner login is unavailable until platform owner company scope is configured."
        );
        setLoading(false);
        return;
      }

      if (
        mode === "owner" &&
        Number.isInteger(platformOwnerCompanyId) &&
        platformOwnerCompanyId > 0 &&
        Number(user?.companyId || 0) !== platformOwnerCompanyId
      ) {
        setError("This account does not belong to platform owner scope.");
        setLoading(false);
        return;
      }

      if (
        mode === "client" &&
        expectedCompanyId &&
        Number(user?.companyId || 0) !== expectedCompanyId
      ) {
        setError("This account does not belong to this client company.");
        setLoading(false);
        return;
      }

      updateSession({ token, refreshToken, user });

      if (mustChangePassword) {
        navigate("/change-password");
      } else if (mode === "owner") {
        navigate("/tenant-onboarding");
      } else {
        navigate(getDefaultWorkspacePath(user));
      }
    } catch (err) {
      const status = err?.response?.status;
      const normalizedMode = mode === "owner" || mode === "client" ? mode : "login";

      if (status === 405 && isHostedFrontendMissingApiBaseUrl()) {
        setError(
          `${normalizedMode === "owner" ? "Owner" : normalizedMode === "client" ? "Client" : "Frontend"} login is pointed at the Vercel site instead of the backend API. Set VITE_API_BASE_URL in Vercel for this environment and redeploy.`
        );
        return;
      }

      setError(
        err?.response?.data?.message ||
          "Login failed. Check backend and credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(isMobile ? styles.containerMobile : {}),
      }}
    >
      <div style={styles.ambientGlowOne} />
      <div style={styles.ambientGlowTwo} />
      <div style={styles.gridTexture} />

      <div
        style={{
          ...styles.panel,
          ...(isMobile ? styles.panelMobile : {}),
        }}
      >
        <form
          style={{
            ...styles.card,
            ...(isMobile ? styles.cardMobile : {}),
          }}
          onSubmit={handleLogin}
        >
          <div style={styles.cardAura} />
          <div style={styles.cardTop}>
            <p style={styles.cardEyebrow}>Secure Sign In</p>
            <h2
              style={{
                ...styles.title,
                ...(isMobile ? styles.titleMobile : {}),
              }}
            >
              {mode === "owner"
                ? "SinSoftware Owner Console"
                : mode === "client"
                ? "Company Operations Login"
                : "Construction ERP"}
            </h2>
            <p
              style={{
                ...styles.subtitle,
                ...(isMobile ? styles.subtitleMobile : {}),
              }}
            >
              {mode === "owner"
                ? "Platform owner access only."
                : mode === "client"
                ? "Sign in to your company workspace."
                : "Sign in with your username, employee code, or mobile number."}
            </p>
          </div>

          {mode === "owner" ? (
            <div style={styles.modeChipOwner}>
              Super admin access only.
            </div>
          ) : null}

          {mode === "client" ? (
            <div style={styles.clientContextCard}>
              {companyContextLoading ? (
                <p style={styles.clientContextText}>Loading company login context...</p>
              ) : companyContext ? (
                <>
                  <p style={styles.clientContextLabel}>Company Login</p>
                  <p style={styles.clientContextValue}>{companyContext.companyName}</p>
                  <p style={styles.clientContextMeta}>
                    Company Code: {companyContext.companyCode}
                  </p>
                </>
              ) : (
                <p style={styles.clientContextText}>
                  Open this page from a valid company code link.
                </p>
              )}
            </div>
          ) : null}

          {error && <p style={styles.error}>{error}</p>}

          <label style={styles.fieldLabel}>
            Username / Employee Code / Mobile
            <input
              type="text"
              placeholder="Enter your login ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              autoComplete="username"
            />
          </label>

          <label style={styles.fieldLabel}>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
            />
          </label>

          <div
            style={{
              ...styles.linkRow,
              ...(isMobile ? styles.linkRowMobile : {}),
            }}
          >
            <Link to="/forgot-password" style={styles.link}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={
              loading ||
              (mode === "client" && (companyContextLoading || !companyContext?.id))
            }
          >
            {loading ? "Signing In..." : "Enter Workspace"}
          </button>

          {isMobile ? (
            <button
              type="button"
              style={styles.mobileInfoToggle}
              onClick={() => setShowHeroOnMobile((open) => !open)}
            >
              {showHeroOnMobile ? "Hide product info" : "View product info"}
            </button>
          ) : null}
        </form>

        {showHeroOnMobile ? (
          <section
            style={{
              ...styles.hero,
              ...(isMobile ? styles.heroMobile : {}),
            }}
          >
            <div style={styles.heroBadge}>
              {mode === "owner"
                ? "Platform Owner Access"
                : mode === "client"
                ? "Client Company Access"
                : "Client Delivery Branch"}
            </div>
            <h1
              style={{
                ...styles.heroTitle,
                ...(isMobile ? styles.heroTitleMobile : {}),
              }}
            >
              Run operations, dispatch, fleet, and commercial workflows in one workspace.
            </h1>
            <p
              style={{
                ...styles.heroText,
                ...(isMobile ? styles.heroTextMobile : {}),
              }}
            >
              Built for fast execution, clean records, and client-ready outputs.
            </p>

            <div
              style={{
                ...styles.heroHighlights,
                ...(isMobile ? styles.heroHighlightsMobile : {}),
              }}
            >
              <div style={styles.heroPoint}>
                <span style={styles.heroPointValue}>Dispatch</span>
                <span style={styles.heroPointLabel}>billing and status</span>
              </div>
              <div style={styles.heroPoint}>
                <span style={styles.heroPointValue}>Fleet</span>
                <span style={styles.heroPointLabel}>availability and tracking</span>
              </div>
              <div style={styles.heroPoint}>
                <span style={styles.heroPointValue}>Commercial</span>
                <span style={styles.heroPointLabel}>rates and contracts</span>
              </div>
            </div>
          </section>
        ) : null}
      </div>
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
      "radial-gradient(circle at top left, rgba(15,118,110,0.12), transparent 24%), radial-gradient(circle at 80% 20%, rgba(192,132,26,0.16), transparent 22%), linear-gradient(135deg, #f6efe4 0%, #efe9de 52%, #e9e3d8 100%)",
    padding: "28px",
    overflow: "hidden",
  },
  containerMobile: {
    padding: "12px",
    alignItems: "stretch",
    minHeight: "100dvh",
    overflowX: "hidden",
    overflowY: "auto",
  },
  ambientGlowOne: {
    position: "absolute",
    top: "-180px",
    left: "-80px",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(15, 118, 110, 0.16)",
    filter: "blur(90px)",
    pointerEvents: "none",
  },
  ambientGlowTwo: {
    position: "absolute",
    right: "-120px",
    bottom: "-180px",
    width: "460px",
    height: "460px",
    borderRadius: "999px",
    background: "rgba(192, 132, 26, 0.18)",
    filter: "blur(100px)",
    pointerEvents: "none",
  },
  gridTexture: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(94, 78, 57, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(94, 78, 57, 0.05) 1px, transparent 1px)",
    backgroundSize: "26px 26px",
    maskImage: "linear-gradient(180deg, rgba(0,0,0,0.26), transparent 80%)",
    pointerEvents: "none",
  },
  panel: {
    position: "relative",
    zIndex: 1,
    width: "min(1120px, 100%)",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(94, 78, 57, 0.10)",
    borderRadius: "30px",
    overflow: "hidden",
    boxShadow: "0 28px 80px rgba(43, 34, 22, 0.14)",
    backdropFilter: "blur(18px)",
  },
  panelMobile: {
    gridTemplateColumns: "1fr",
    borderRadius: "22px",
    width: "100%",
    maxWidth: "100%",
  },
  hero: {
    padding: "54px 48px",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.26), transparent 34%), linear-gradient(180deg, #18332f 0%, #1e293b 42%, #283747 100%)",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    justifyContent: "space-between",
  },
  heroMobile: {
    padding: "22px 18px",
    gap: "12px",
    order: 2,
  },
  heroBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.10)",
    color: "#fcd34d",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  heroTitle: {
    margin: 0,
    fontSize: "42px",
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    maxWidth: "560px",
  },
  heroTitleMobile: {
    fontSize: "30px",
    lineHeight: 1.08,
    maxWidth: "100%",
  },
  heroText: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "rgba(248,250,252,0.78)",
    maxWidth: "520px",
  },
  heroTextMobile: {
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "100%",
  },
  heroHighlights: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    marginTop: "18px",
  },
  heroHighlightsMobile: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    marginTop: "8px",
    gap: "10px",
  },
  heroPoint: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  heroPointValue: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#fef3c7",
  },
  heroPointLabel: {
    fontSize: "12px",
    lineHeight: 1.6,
    color: "rgba(248,250,252,0.72)",
  },
  card: {
    position: "relative",
    background: "rgba(255,255,255,0.90)",
    padding: "46px 40px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardMobile: {
    padding: "24px 18px 22px",
    gap: "14px",
    order: 1,
  },
  cardAura: {
    position: "absolute",
    top: "-60px",
    right: "-50px",
    width: "180px",
    height: "180px",
    borderRadius: "999px",
    background: "rgba(15, 118, 110, 0.10)",
    filter: "blur(36px)",
    pointerEvents: "none",
  },
  cardTop: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "6px",
  },
  cardEyebrow: {
    margin: 0,
    fontSize: "11px",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "#0f766e",
    fontWeight: "800",
  },
  title: {
    margin: 0,
    color: "#1f2933",
    fontSize: "34px",
    letterSpacing: "-0.03em",
  },
  titleMobile: {
    fontSize: "30px",
  },
  subtitle: {
    margin: 0,
    color: "#66788a",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  subtitleMobile: {
    fontSize: "13px",
    lineHeight: 1.6,
  },
  modeChipOwner: {
    position: "relative",
    zIndex: 1,
    borderRadius: "12px",
    border: "1px solid rgba(15, 118, 110, 0.26)",
    background: "rgba(15, 118, 110, 0.08)",
    color: "#0f766e",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: 1.5,
    padding: "10px 12px",
  },
  clientContextCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: "14px",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(15, 23, 42, 0.03)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  clientContextLabel: {
    margin: 0,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    color: "#334155",
    fontWeight: "700",
  },
  clientContextValue: {
    margin: 0,
    fontSize: "16px",
    color: "#0f172a",
    fontWeight: "800",
    letterSpacing: "-0.02em",
  },
  clientContextMeta: {
    margin: 0,
    fontSize: "12px",
    color: "#475569",
  },
  clientContextText: {
    margin: 0,
    fontSize: "13px",
    color: "#475569",
    lineHeight: 1.6,
  },
  fieldLabel: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "700",
  },
  input: {
    padding: "14px 16px",
    fontSize: "14px",
    border: "1px solid rgba(100, 116, 139, 0.22)",
    borderRadius: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.94)",
  },
  linkRow: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-6px",
  },
  linkRowMobile: {
    justifyContent: "flex-start",
    marginTop: "0",
  },
  link: {
    color: "#0f766e",
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
  },
  button: {
    position: "relative",
    zIndex: 1,
    padding: "14px 16px",
    background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
    boxShadow: "0 16px 32px rgba(15, 118, 110, 0.22)",
  },
  mobileInfoToggle: {
    position: "relative",
    zIndex: 1,
    marginTop: "2px",
    padding: "10px 14px",
    border: "1px solid rgba(15,118,110,0.20)",
    borderRadius: "12px",
    background: "rgba(15,118,110,0.08)",
    color: "#0f766e",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
  },
  error: {
    position: "relative",
    zIndex: 1,
    color: "#dc2626",
    background: "rgba(254, 226, 226, 0.86)",
    border: "1px solid rgba(220, 38, 38, 0.16)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    margin: 0,
  },
};

export default LoginPage;
