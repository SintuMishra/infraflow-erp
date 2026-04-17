import { AuthProvider } from "../context/AuthContext";
import { AppRouter } from "./router";
import AppErrorBoundary from "../components/common/AppErrorBoundary";

function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </AuthProvider>
  );
}

export default App;
