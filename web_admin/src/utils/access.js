export const ROLE_GROUPS = {
  admin: ["super_admin", "manager", "admin", "hr"],
  ops: ["super_admin", "manager", "admin", "hr", "crusher_supervisor", "site_engineer"],
  crusher: ["super_admin", "manager", "admin", "hr", "crusher_supervisor"],
  projects: ["super_admin", "manager", "admin", "hr", "site_engineer"],
  finance: ["super_admin", "manager", "admin", "hr"],
};

export const COMPANY_MODULE_KEYS = Object.freeze([
  "operations",
  "commercial",
  "procurement",
  "accounts",
]);

export const DEFAULT_ENABLED_MODULES = Object.freeze([...COMPANY_MODULE_KEYS]);

export const COMPANY_MODULE_PRESETS = Object.freeze({
  full_erp: DEFAULT_ENABLED_MODULES,
  procurement_accounts: ["procurement", "accounts"],
  procurement_only: ["procurement"],
  accounts_only: ["accounts"],
});

export const COMPANY_MODULE_OPTIONS = Object.freeze([
  {
    key: "operations",
    label: "Operations",
    description: "Dispatch, crusher, project, boulder, vehicles, vendors, and transport rates.",
  },
  {
    key: "commercial",
    label: "Commercial",
    description: "Parties, rates, orders, and commercial exception workflows.",
  },
  {
    key: "procurement",
    label: "Procurement",
    description: "Purchase requests, purchase orders, GRN, and purchase invoices.",
  },
  {
    key: "accounts",
    label: "Accounts",
    description: "Ledger, vouchers, receivables, payables, cash-bank, and finance reports.",
  },
]);

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
    return false;
  }

  return isPlatformOwnerCompanyUser(user);
};

export const canAccessOperationalWorkspace = (user) => {
  return Boolean(user);
};

export const hasAnyEnabledModule = (user, moduleKeys = []) => {
  if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) {
    return true;
  }

  return moduleKeys.some((moduleKey) => hasEnabledModule(user, moduleKey));
};

export const normalizeEnabledModules = (value) => {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.enabledModules)
    ? value.enabledModules
    : Array.isArray(value?.company?.enabledModules)
    ? value.company.enabledModules
    : [];

  const normalized = source
    .map((moduleKey) => String(moduleKey || "").trim().toLowerCase())
    .filter((moduleKey, index, array) =>
      COMPANY_MODULE_KEYS.includes(moduleKey) && array.indexOf(moduleKey) === index
    );

  return normalized.length > 0 ? normalized : [...DEFAULT_ENABLED_MODULES];
};

export const hasEnabledModule = (user, moduleKey) => {
  if (!moduleKey) {
    return true;
  }

  if (canAccessOwnerControlPanel(user)) {
    return true;
  }

  return normalizeEnabledModules(user).includes(String(moduleKey).trim().toLowerCase());
};

export const getDefaultWorkspacePath = (user) => {
  if (canAccessOwnerControlPanel(user)) {
    return "/tenant-onboarding";
  }

  if (hasEnabledModule(user, "operations") || hasEnabledModule(user, "commercial")) {
    return "/dashboard";
  }

  if (hasEnabledModule(user, "procurement")) {
    return "/purchase-requests";
  }

  if (hasEnabledModule(user, "accounts")) {
    return "/accounts/dashboard";
  }

  return "/dashboard";
};

export const canAccessOwnerControlPanel = (user) => {
  return isOwnerConsoleUser(user);
};

export const canAccessTenantOnboarding = (user) => {
  return canAccessOwnerControlPanel(user);
};

export const canAccessAuditLogsWorkspace = (user) => {
  return canAccessOwnerControlPanel(user) || canAccessOperationalWorkspace(user);
};

export const canAccessDashboardWorkspace = (user) =>
  hasAnyEnabledModule(user, ["operations", "commercial"]);

export const canAccessVendorsWorkspace = (user) =>
  hasAnyEnabledModule(user, ["operations", "procurement"]);

export const canAccessPlantsWorkspace = (user) =>
  hasAnyEnabledModule(user, ["operations", "commercial", "procurement"]);

export const ROUTE_ACCESS = {
  dashboard: [],
  employees: ROLE_GROUPS.admin,
  crusherReports: ROLE_GROUPS.crusher,
  projectReports: ROLE_GROUPS.projects,
  dispatchReports: ROLE_GROUPS.ops,
  boulderReports: ROLE_GROUPS.ops,
  vehicles: ROLE_GROUPS.ops,
  equipment: ROLE_GROUPS.ops,
  changePassword: [],
  masters: ROLE_GROUPS.ops,
  vendors: ROLE_GROUPS.ops,
  transportRates: ROLE_GROUPS.ops,
  partyMaterialRates: ROLE_GROUPS.admin,
  partyOrders: ROLE_GROUPS.admin,
  purchaseRequests: [
    "super_admin",
    "manager",
    "admin",
    "hr",
    "crusher_supervisor",
    "site_engineer",
    "operator",
  ],
  purchaseOrders: ROLE_GROUPS.finance,
  goodsReceipts: ROLE_GROUPS.finance,
  purchaseInvoices: ROLE_GROUPS.finance,
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
  accountsPostingRules: ROLE_GROUPS.finance,
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
        requiredAnyModules: ["operations", "commercial"],
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
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Project Reports",
        path: "/project-reports",
        hint: "Site execution tracking",
        allowedRoles: ROUTE_ACCESS.projectReports,
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Dispatch Reports",
        path: "/dispatch-reports",
        hint: "Dispatch and billing execution",
        allowedRoles: ROUTE_ACCESS.dispatchReports,
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Boulder Reports",
        path: "/boulder-reports",
        hint: "Mine-to-crusher raw boulder flow",
        allowedRoles: ROUTE_ACCESS.boulderReports,
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Vehicles",
        path: "/vehicles",
        hint: "Fleet, transporters, and dispatch linkage",
        allowedRoles: ROUTE_ACCESS.vehicles,
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Equipment",
        path: "/equipment",
        hint: "Machinery register and meter logs",
        allowedRoles: ROUTE_ACCESS.equipment,
        requiredModule: "operations",
        workspace: "client",
      },
      {
        label: "Vendors",
        path: "/vendors",
        hint: "Transporters and suppliers",
        allowedRoles: ROUTE_ACCESS.vendors,
        requiredAnyModules: ["operations", "procurement"],
        workspace: "client",
      },
      {
        label: "Transport Rates",
        path: "/transport-rates",
        hint: "Plant-wise logistics costing",
        allowedRoles: ROUTE_ACCESS.transportRates,
        requiredModule: "operations",
        workspace: "client",
      },
    ],
  },
  {
    label: "Procurement",
    items: [
      {
        label: "Purchase Requests",
        path: "/purchase-requests",
        hint: "Material demand planning and approvals",
        allowedRoles: ROUTE_ACCESS.purchaseRequests,
        requiredModule: "procurement",
        workspace: "client",
      },
      {
        label: "Purchase Orders",
        path: "/purchase-orders",
        hint: "Vendor order placement and control",
        allowedRoles: ROUTE_ACCESS.purchaseOrders,
        requiredModule: "procurement",
        workspace: "client",
      },
      {
        label: "Goods Receipts",
        path: "/goods-receipts",
        hint: "GRN entry and PO quantity updates",
        allowedRoles: ROUTE_ACCESS.goodsReceipts,
        requiredModule: "procurement",
        workspace: "client",
      },
      {
        label: "Purchase Invoices",
        path: "/purchase-invoices",
        hint: "3-way matching and payable linkage",
        allowedRoles: ROUTE_ACCESS.purchaseInvoices,
        requiredModule: "procurement",
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
        requiredModule: "commercial",
        workspace: "client",
      },
      {
        label: "Party Material Rates",
        path: "/party-material-rates",
        hint: "Material pricing contracts",
        allowedRoles: ROUTE_ACCESS.partyMaterialRates,
        requiredModule: "commercial",
        workspace: "client",
      },
      {
        label: "Party Orders",
        path: "/party-orders",
        hint: "Order book and pending loads",
        allowedRoles: ROUTE_ACCESS.partyOrders,
        requiredModule: "commercial",
        workspace: "client",
      },
      {
        label: "Commercial Exceptions",
        path: "/commercial-exceptions",
        hint: "Overdue, unlinked, and closure gaps",
        allowedRoles: ROUTE_ACCESS.commercialExceptions,
        requiredModule: "commercial",
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
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Chart of Accounts",
        path: "/accounts/chart-of-accounts",
        hint: "Account groups, chart and ledgers",
        allowedRoles: ROUTE_ACCESS.accountsChartOfAccounts,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Ledger",
        path: "/accounts/ledger",
        hint: "Ledger drill and books",
        allowedRoles: ROUTE_ACCESS.accountsLedger,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Voucher Entry",
        path: "/accounts/vouchers",
        hint: "Journal, payment, receipt, contra",
        allowedRoles: ROUTE_ACCESS.accountsVoucherEntry,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Receivables",
        path: "/accounts/receivables",
        hint: "Dispatch-linked AR and settlements",
        allowedRoles: ROUTE_ACCESS.accountsReceivables,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Payables",
        path: "/accounts/payables",
        hint: "Bills, AP and settlements",
        allowedRoles: ROUTE_ACCESS.accountsPayables,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Cash/Bank",
        path: "/accounts/cash-bank",
        hint: "Bank accounts and cash movement",
        allowedRoles: ROUTE_ACCESS.accountsCashBank,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Posting Rules",
        path: "/accounts/posting-rules",
        hint: "Source-event posting configuration",
        allowedRoles: ROUTE_ACCESS.accountsPostingRules,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Policy Controls",
        path: "/accounts/policy-controls",
        hint: "Maker-checker control settings",
        allowedRoles: ROUTE_ACCESS.accountsPolicyControls,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Period Controls",
        path: "/accounts/period-controls",
        hint: "Close/reopen periods with evidence",
        allowedRoles: ROUTE_ACCESS.accountsPeriodControls,
        requiredModule: "accounts",
        workspace: "client",
      },
      {
        label: "Finance Reports",
        path: "/accounts/reports",
        hint: "Trial balance, ageing and books",
        allowedRoles: ROUTE_ACCESS.accountsReports,
        requiredModule: "accounts",
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
      {
        label: "Audit Logs",
        path: "/audit-logs",
        hint: "Company activity and access traceability",
        allowedRoles: ROUTE_ACCESS.auditLogs,
        workspace: "client",
      },
    ],
  },
];
