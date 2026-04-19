import { Component } from "react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected application error",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AppErrorBoundary caught an error", {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.page}>
          <div style={styles.card}>
            <p style={styles.eyebrow}>Workspace Recovery</p>
            <h1 style={styles.title}>This screen hit an unexpected error.</h1>
            <p style={styles.text}>
              Refresh the workspace to continue. If this repeats, share the request details with support.
            </p>
            <p style={styles.errorText}>{this.state.errorMessage}</p>
            <button type="button" style={styles.button} onClick={this.handleReload}>
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.12), transparent 24%), linear-gradient(135deg, #f7f2ea 0%, #ece7de 100%)",
  },
  card: {
    width: "min(560px, 100%)",
    padding: "32px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,118,110,0.12)",
    boxShadow: "0 24px 60px rgba(43, 34, 22, 0.12)",
  },
  eyebrow: {
    margin: "0 0 10px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    color: "#0f766e",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.1,
    color: "#1f2933",
  },
  text: {
    margin: "14px 0 0",
    color: "#52606d",
    lineHeight: 1.7,
    fontSize: "14px",
  },
  errorText: {
    margin: "16px 0 0",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: "13px",
    fontWeight: "700",
  },
  button: {
    marginTop: "18px",
    padding: "12px 16px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #1f2933 0%, #334155 100%)",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },
};

export default AppErrorBoundary;
