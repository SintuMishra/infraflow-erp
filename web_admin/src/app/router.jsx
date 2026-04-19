import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import PublicRoute from "../components/auth/PublicRoute";
import {
  ROUTE_ACCESS,
  canAccessAuditLogsWorkspace,
  canAccessOperationalWorkspace,
  canAccessTenantOnboarding,
} from "../utils/access";

const LoginPage = lazy(() => import("../pages/LoginPage"));
const LoginGatewayPage = lazy(() => import("../pages/LoginGatewayPage"));
const ClientLoginCompanyCodePage = lazy(
  () => import("../pages/ClientLoginCompanyCodePage")
);
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const EmployeesPage = lazy(() => import("../pages/EmployeesPage"));
const CrusherReportsPage = lazy(() => import("../pages/CrusherReportsPage"));
const ProjectReportsPage = lazy(() => import("../pages/ProjectReportsPage"));
const DispatchReportsPage = lazy(() => import("../pages/DispatchReportsPage"));
const VehiclesPage = lazy(() => import("../pages/VehiclesPage"));
const ChangePasswordPage = lazy(() => import("../pages/ChangePasswordPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const VendorsPage = lazy(() => import("../pages/VendorsPage"));
const TransportRatesPage = lazy(() => import("../pages/TransportRatesPage"));
const PartyMaterialRatesPage = lazy(() => import("../pages/PartyMaterialRatesPage"));
const PartyOrdersPage = lazy(() => import("../pages/PartyOrdersPage"));
const CommercialExceptionsPage = lazy(
  () => import("../pages/CommercialExceptionsPage")
);
const PartyCommercialProfilePage = lazy(
  () => import("../pages/PartyCommercialProfilePage")
);
const DispatchPrintPage = lazy(() => import("../pages/DispatchPrintPage"));
const CompanyProfilePage = lazy(() => import("../pages/CompanyProfilePage"));
const TenantOnboardingPage = lazy(() => import("../pages/TenantOnboardingPage"));
const PartiesPage = lazy(() => import("../pages/PartiesPage"));
const AuditLogsPage = lazy(() => import("../pages/AuditLogsPage"));
const UnauthorizedPage = lazy(() => import("../pages/UnauthorizedPage"));
const AccountsDashboardPage = lazy(() => import("../pages/AccountsDashboardPage"));
const AccountsChartOfAccountsPage = lazy(
  () => import("../pages/AccountsChartOfAccountsPage")
);
const AccountsLedgerPage = lazy(() => import("../pages/AccountsLedgerPage"));
const AccountsVoucherEntryPage = lazy(() => import("../pages/AccountsVoucherEntryPage"));
const AccountsReceivablesPage = lazy(() => import("../pages/AccountsReceivablesPage"));
const AccountsPayablesPage = lazy(() => import("../pages/AccountsPayablesPage"));
const AccountsCashBankPage = lazy(() => import("../pages/AccountsCashBankPage"));
const AccountsReportsPage = lazy(() => import("../pages/AccountsReportsPage"));
const AccountsPeriodsControlPage = lazy(() => import("../pages/AccountsPeriodsControlPage"));
const AccountsFinancePolicyPage = lazy(() => import("../pages/AccountsFinancePolicyPage"));
const AccountsPostingRulesPage = lazy(() => import("../pages/AccountsPostingRulesPage"));

export function AppRouter() {
  return (
    <Suspense fallback={<div style={styles.loading}>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginGatewayPage />
            </PublicRoute>
          }
        />

        <Route
          path="/owner-login"
          element={
            <PublicRoute>
              <LoginPage loginMode="owner" />
            </PublicRoute>
          }
        />

        <Route
          path="/client-login"
          element={
            <PublicRoute>
              <ClientLoginCompanyCodePage />
            </PublicRoute>
          }
        />

        <Route
          path="/client-login/:companyCode"
          element={
            <PublicRoute>
              <LoginPage loginMode="client" />
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.dashboard}
              allowWhen={canAccessOperationalWorkspace}
            >
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.employees}
              allowWhen={canAccessOperationalWorkspace}
            >
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/crusher-reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.crusherReports}
              allowWhen={canAccessOperationalWorkspace}
            >
              <Navigate to="/plant-unit-reports" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plant-unit-reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.crusherReports}
              allowWhen={canAccessOperationalWorkspace}
            >
              <CrusherReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/project-reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.projectReports}
              allowWhen={canAccessOperationalWorkspace}
            >
              <ProjectReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dispatch-reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.dispatchReports}
              allowWhen={canAccessOperationalWorkspace}
            >
              <DispatchReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vehicles"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.vehicles}
              allowWhen={canAccessOperationalWorkspace}
            >
              <VehiclesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute allowedRoles={ROUTE_ACCESS.changePassword}>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/masters"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.masters}
              allowWhen={canAccessOperationalWorkspace}
            >
              <MastersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendors"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.vendors}
              allowWhen={canAccessOperationalWorkspace}
            >
              <VendorsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/transport-rates"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.transportRates}
              allowWhen={canAccessOperationalWorkspace}
            >
              <TransportRatesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/party-material-rates"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.partyMaterialRates}
              allowWhen={canAccessOperationalWorkspace}
            >
              <PartyMaterialRatesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/party-orders"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.partyOrders}
              allowWhen={canAccessOperationalWorkspace}
            >
              <PartyOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commercial-exceptions"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.commercialExceptions}
              allowWhen={canAccessOperationalWorkspace}
            >
              <CommercialExceptionsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/parties/:partyId/commercial"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.partyCommercialProfile}
              allowWhen={canAccessOperationalWorkspace}
            >
              <PartyCommercialProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dispatch-print/:id"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.dispatchPrint}
              allowWhen={canAccessOperationalWorkspace}
            >
              <DispatchPrintPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/company-profile"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.companyProfile}
              allowWhen={canAccessOperationalWorkspace}
            >
              <CompanyProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tenant-onboarding"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.tenantOnboarding}
              allowWhen={canAccessTenantOnboarding}
            >
              <TenantOnboardingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/parties"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.parties}
              allowWhen={canAccessOperationalWorkspace}
            >
              <PartiesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.auditLogs}
              allowWhen={canAccessAuditLogsWorkspace}
            >
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsDashboard}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/chart-of-accounts"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsChartOfAccounts}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsChartOfAccountsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/ledger"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsLedger}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsLedgerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/vouchers"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsVoucherEntry}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsVoucherEntryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/receivables"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsReceivables}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsReceivablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/payables"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsPayables}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsPayablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/cash-bank"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsCashBank}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsCashBankPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/posting-rules"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsPostingRules}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsPostingRulesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/policy-controls"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsPolicyControls}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsFinancePolicyPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/period-controls"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsPeriodControls}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsPeriodsControlPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.accountsReports}
              allowWhen={canAccessOperationalWorkspace}
            >
              <AccountsReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/unauthorized"
          element={
            <ProtectedRoute>
              <UnauthorizedPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
    color: "#334155",
    fontSize: "16px",
    fontWeight: "600",
  },
};
