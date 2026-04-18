export const ROLE_GROUPS = {
  admin: ["super_admin", "manager", "hr"],
  ops: ["super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"],
  crusher: ["super_admin", "manager", "hr", "crusher_supervisor"],
  projects: ["super_admin", "manager", "hr", "site_engineer"],
  finance: ["super_admin", "manager", "hr"],
};

const PLATFORM_OWNER_COMPANY_ID = (() => {
  const rawValue = String(import.meta.env.VITE_PLATFORM_OWNER_COMPANY_ID || "").trim();

  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
})();

export const isPlatformOwnerCompanyUser = (user) => {
  if (!user) {
    return false;
  }

  if (PLATFORM_OWNER_COMPANY_ID === null) {
    return false;
  }

  return Number(user.companyId || 0) === PLATFORM_OWNER_COMPANY_ID;
};

export const isOwnerConsoleUser = (user) => {
  if (!user) {
    return false;
  }

  if (user.role !== "super_admin") {
    return false;
  }

  if (PLATFORM_OWNER_COMPANY_ID === null) {
    // Safe fallback for non-production/dev environments where owner company id is not injected.
    return true;
  }

  return isPlatformOwnerCompanyUser(user);
};

export const canAccessOperationalWorkspace = (user) => {
  return !isOwnerConsoleUser(user);
};

export const canAccessOwnerControlPanel = (user) => {
  return isOwnerConsoleUser(user);
};

export const canAccessTenantOnboarding = (user) => {
  return canAccessOwnerControlPanel(user);
};

export const ROUTE_ACCESS = {
  dashboard: [],
  employees: ROLE_GROUPS.admin,
  crusherReports: ROLE_GROUPS.crusher,
  projectReports: ROLE_GROUPS.projects,
  dispatchReports: ROLE_GROUPS.ops,
  vehicles: ROLE_GROUPS.ops,
  changePassword: [],
  masters: ROLE_GROUPS.ops,
  vendors: ROLE_GROUPS.ops,
  transportRates: ROLE_GROUPS.ops,
  partyMaterialRates: ROLE_GROUPS.admin,
  partyOrders: ROLE_GROUPS.admin,
  partyCommercialProfile: ROLE_GROUPS.admin,
  commercialExceptions: ROLE_GROUPS.admin,
  dispatchPrint: ROLE_GROUPS.ops,
  companyProfile: ROLE_GROUPS.admin,
  parties: ROLE_GROUPS.admin,
  auditLogs: ROLE_GROUPS.admin,
  tenantOnboarding: ["super_admin"],
  accountsDashboard: ROLE_GROUPS.finance,
  accountsChartOfAccounts: ROLE_GROUPS.finance,
  accountsLedger: ROLE_GROUPS.finance,
  accountsVoucherEntry: ROLE_GROUPS.finance,
  accountsReceivables: ROLE_GROUPS.finance,
  accountsPayables: ROLE_GROUPS.finance,
  accountsCashBank: ROLE_GROUPS.finance,
  accountsPeriodControls: ROLE_GROUPS.finance,
  accountsPolicyControls: ROLE_GROUPS.finance,
  accountsReports: ROLE_GROUPS.finance,
};

export const SIDEBAR_MENU_GROUPS = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        hint: "Overview and analytics",
        workspace: "client",
      },
    ],
  },
  {
    label: "Owner Control",
    items: [
      {
        label: "Tenant Onboarding",
        path: "/tenant-onboarding",
        hint: "Onboard, bill, suspend and reactivate clients",
        allowedRoles: ROUTE_ACCESS.tenantOnboarding,
        requiresPlatformOwnerCompany: true,
        workspace: "owner",
      },
      {
        label: "Audit Logs",
        path: "/audit-logs",
        hint: "Owner governance and access traceability",
        allowedRoles: ["super_admin"],
        requiresPlatformOwnerCompany: true,
        workspace: "owner",
      },
    ],
  },
  {
    label: "Logistics",
    items: [
      {
        label: "Plants & Units Reports",
        path: "/plant-unit-reports",
        hint: "Daily operational reporting",
        allowedRoles: ROUTE_ACCESS.crusherReports,
        workspace: "client",
      },
      {
        label: "Project Reports",
        path: "/project-reports",
        hint: "Site execution tracking",
        allowedRoles: ROUTE_ACCESS.projectReports,
        workspace: "client",
      },
      {
        label: "Dispatch Reports",
        path: "/dispatch-reports",
        hint: "Dispatch and billing execution",
        allowedRoles: ROUTE_ACCESS.dispatchReports,
        workspace: "client",
      },
      {
        label: "Vehicles",
        path: "/vehicles",
        hint: "Fleet, equipment, and linkage",
        allowedRoles: ROUTE_ACCESS.vehicles,
        workspace: "client",
      },
      {
        label: "Vendors",
        path: "/vendors",
        hint: "Transporters and suppliers",
        allowedRoles: ROUTE_ACCESS.vendors,
        workspace: "client",
      },
      {
        label: "Transport Rates",
        path: "/transport-rates",
        hint: "Plant-wise logistics costing",
        allowedRoles: ROUTE_ACCESS.transportRates,
        workspace: "client",
      },
    ],
  },
  {
    label: "Commercial",
    items: [
      {
        label: "Parties",
        path: "/parties",
        hint: "Customers and buyers",
        allowedRoles: ROUTE_ACCESS.parties,
        workspace: "client",
      },
      {
        label: "Party Material Rates",
        path: "/party-material-rates",
        hint: "Material pricing contracts",
        allowedRoles: ROUTE_ACCESS.partyMaterialRates,
        workspace: "client",
      },
      {
        label: "Party Orders",
        path: "/party-orders",
        hint: "Order book and pending loads",
        allowedRoles: ROUTE_ACCESS.partyOrders,
        workspace: "client",
      },
      {
        label: "Commercial Exceptions",
        path: "/commercial-exceptions",
        hint: "Overdue, unlinked, and closure gaps",
        allowedRoles: ROUTE_ACCESS.commercialExceptions,
        workspace: "client",
      },
    ],
  },
  {
    label: "Accounts",
    items: [
      {
        label: "Accounts Dashboard",
        path: "/accounts/dashboard",
        hint: "Finance KPI and controls",
        allowedRoles: ROUTE_ACCESS.accountsDashboard,
        workspace: "client",
      },
      {
        label: "Chart of Accounts",
        path: "/accounts/chart-of-accounts",
        hint: "Account groups, chart and ledgers",
        allowedRoles: ROUTE_ACCESS.accountsChartOfAccounts,
        workspace: "client",
      },
      {
        label: "Ledger",
        path: "/accounts/ledger",
        hint: "Ledger drill and books",
        allowedRoles: ROUTE_ACCESS.accountsLedger,
        workspace: "client",
      },
      {
        label: "Voucher Entry",
        path: "/accounts/vouchers",
        hint: "Journal, payment, receipt, contra",
        allowedRoles: ROUTE_ACCESS.accountsVoucherEntry,
        workspace: "client",
      },
      {
        label: "Receivables",
        path: "/accounts/receivables",
        hint: "Dispatch-linked AR and settlements",
        allowedRoles: ROUTE_ACCESS.accountsReceivables,
        workspace: "client",
      },
      {
        label: "Payables",
        path: "/accounts/payables",
        hint: "Bills, AP and settlements",
        allowedRoles: ROUTE_ACCESS.accountsPayables,
        workspace: "client",
      },
      {
        label: "Cash/Bank",
        path: "/accounts/cash-bank",
        hint: "Bank accounts and cash movement",
        allowedRoles: ROUTE_ACCESS.accountsCashBank,
        workspace: "client",
      },
      {
        label: "Policy Controls",
        path: "/accounts/policy-controls",
        hint: "Maker-checker control settings",
        allowedRoles: ROUTE_ACCESS.accountsPolicyControls,
        workspace: "client",
      },
      {
        label: "Period Controls",
        path: "/accounts/period-controls",
        hint: "Close/reopen periods with evidence",
        allowedRoles: ROUTE_ACCESS.accountsPeriodControls,
        workspace: "client",
      },
      {
        label: "Finance Reports",
        path: "/accounts/reports",
        hint: "Trial balance, ageing and books",
        allowedRoles: ROUTE_ACCESS.accountsReports,
        workspace: "client",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Employees",
        path: "/employees",
        hint: "People and login access",
        allowedRoles: ROUTE_ACCESS.employees,
        workspace: "client",
      },
      {
        label: "Masters",
        path: "/masters",
        hint: "Core business configuration",
        allowedRoles: ROUTE_ACCESS.masters,
        workspace: "client",
      },
      {
        label: "Company Profile",
        path: "/company-profile",
        hint: "Invoice and legal identity",
        allowedRoles: ROUTE_ACCESS.companyProfile,
        workspace: "client",
      },
    ],
  },
];
