import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import PublicRoute from "../components/auth/PublicRoute";
import {
  ROUTE_ACCESS,
  canAccessAuditLogsWorkspace,
  canAccessDashboardWorkspace,
  canAccessOperationalWorkspace,
  canAccessTenantOnboarding,
  canAccessVendorsWorkspace,
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
const BoulderReportsPage = lazy(() => import("../pages/BoulderReportsPage"));
const VehiclesPage = lazy(() => import("../pages/VehiclesPage"));
const ChangePasswordPage = lazy(() => import("../pages/ChangePasswordPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const VendorsPage = lazy(() => import("../pages/VendorsPage"));
const TransportRatesPage = lazy(() => import("../pages/TransportRatesPage"));
const PartyMaterialRatesPage = lazy(() => import("../pages/PartyMaterialRatesPage"));
const PartyOrdersPage = lazy(() => import("../pages/PartyOrdersPage"));
const PurchaseRequestsPage = lazy(() => import("../pages/PurchaseRequestsPage"));
const PurchaseOrdersPage = lazy(() => import("../pages/PurchaseOrdersPage"));
const GoodsReceiptsPage = lazy(() => import("../pages/GoodsReceiptsPage"));
const PurchaseInvoicesPage = lazy(() => import("../pages/PurchaseInvoicesPage"));
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
              allowWhen={canAccessDashboardWorkspace}
              requiredAnyModules={["operations", "commercial"]}
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
              requiredModule="operations"
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
              requiredModule="operations"
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
              requiredModule="operations"
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
              requiredModule="operations"
            >
              <DispatchReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/boulder-reports"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.boulderReports}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="operations"
            >
              <BoulderReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vehicles"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.vehicles}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="operations"
            >
              <VehiclesPage workspaceMode="fleet" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipment"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.equipment}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="operations"
            >
              <VehiclesPage workspaceMode="equipment" />
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
              requiredModule="operations"
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
              allowWhen={canAccessVendorsWorkspace}
              requiredAnyModules={["operations", "procurement"]}
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
              requiredModule="operations"
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
              requiredModule="commercial"
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
              requiredModule="commercial"
            >
              <PartyOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase-requests"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.purchaseRequests}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="procurement"
            >
              <PurchaseRequestsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase-orders"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.purchaseOrders}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="procurement"
            >
              <PurchaseOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/goods-receipts"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.goodsReceipts}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="procurement"
            >
              <GoodsReceiptsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase-invoices"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.purchaseInvoices}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="procurement"
            >
              <PurchaseInvoicesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commercial-exceptions"
          element={
            <ProtectedRoute
              allowedRoles={ROUTE_ACCESS.commercialExceptions}
              allowWhen={canAccessOperationalWorkspace}
              requiredModule="commercial"
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
              requiredModule="commercial"
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
              requiredModule="operations"
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
              requiredModule="commercial"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
              requiredModule="accounts"
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
