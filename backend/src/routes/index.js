const express = require("express");
const authRoutes = require("../modules/auth");
const employeesRoutes = require("../modules/employees");
const crusherRoutes = require("../modules/crusher");
const projectsRoutes = require("../modules/projects");
const dispatchRoutes = require("../modules/dispatch");
const dashboardRoutes = require("../modules/dashboard");
const vehiclesRoutes = require("../modules/vehicles");
const mastersRoutes = require("../modules/masters");
const vendorsRoutes = require("../modules/vendors");
const plantsRoutes = require("../modules/plants");
const transportRatesRoutes = require("../modules/transport_rates");
const partyMaterialRates = require("../modules/party_material_rates");
const companyProfileRoutes = require("../modules/company_profile");
const partiesRoutes = require("../modules/parties");
const auditLogsRoutes = require("../modules/audit_logs");
const partyOrdersRoutes = require("../modules/party_orders");
const onboardingRoutes = require("../modules/onboarding");
const accountsMastersRoutes = require("../modules/accounts_masters");
const generalLedgerRoutes = require("../modules/general_ledger");
const journalVouchersRoutes = require("../modules/journal_vouchers");
const accountsReceivableRoutes = require("../modules/accounts_receivable");
const accountsPayableRoutes = require("../modules/accounts_payable");
const cashBankRoutes = require("../modules/cash_bank");
const financePostingRulesRoutes = require("../modules/finance_posting_rules");
const financialReportsRoutes = require("../modules/financial_reports");
const boulderReportsRoutes = require("../modules/boulder_reports");
const purchaseRequestsRoutes = require("../modules/purchase_requests");
const purchaseOrdersRoutes = require("../modules/purchase_orders");
const goodsReceiptsRoutes = require("../modules/goods_receipts");
const purchaseInvoicesRoutes = require("../modules/purchase_invoices");
const { checkDbHealth } = require("../config/db");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  authorizeAnyCompanyModules,
  authorizeCompanyModules,
} = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/health", async (req, res, next) => {
  try {
    const db = await checkDbHealth();

    res.json({
      success: true,
      message: "API health is good",
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: db.ok ? "ok" : "degraded",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ready", async (req, res, next) => {
  try {
    await checkDbHealth();

    res.json({
      success: true,
      message: "API is ready to serve requests",
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    error.statusCode = 503;
    next(error);
  }
});

router.use("/auth", authRoutes);
router.use("/employees", employeesRoutes);
router.use(
  "/crusher-reports",
  authenticate,
  authorizeCompanyModules("operations"),
  crusherRoutes
);
router.use(
  "/plant-unit-reports",
  authenticate,
  authorizeCompanyModules("operations"),
  crusherRoutes
);
router.use(
  "/project-reports",
  authenticate,
  authorizeCompanyModules("operations"),
  projectsRoutes
);
router.use(
  "/dispatch-reports",
  authenticate,
  authorizeCompanyModules("operations"),
  dispatchRoutes
);
router.use(
  "/dashboard",
  authenticate,
  authorizeAnyCompanyModules("operations", "commercial"),
  dashboardRoutes
);
router.use(
  "/vehicles",
  authenticate,
  authorizeCompanyModules("operations"),
  vehiclesRoutes
);
router.use(
  "/masters",
  authenticate,
  authorizeCompanyModules("operations"),
  mastersRoutes
);
router.use(
  "/vendors",
  authenticate,
  authorizeAnyCompanyModules("operations", "procurement"),
  vendorsRoutes
);
router.use(
  "/plants",
  authenticate,
  authorizeAnyCompanyModules("operations", "commercial", "procurement"),
  plantsRoutes
);
router.use(
  "/transport-rates",
  authenticate,
  authorizeCompanyModules("operations"),
  transportRatesRoutes
);
router.use(
  "/party-material-rates",
  authenticate,
  authorizeCompanyModules("commercial"),
  partyMaterialRates
);
router.use("/company-profile", companyProfileRoutes);
router.use(
  "/parties",
  authenticate,
  authorizeCompanyModules("commercial"),
  partiesRoutes
);
router.use(
  "/party-orders",
  authenticate,
  authorizeCompanyModules("commercial"),
  partyOrdersRoutes
);
router.use("/audit-logs", auditLogsRoutes);
router.use("/onboarding", onboardingRoutes);
router.use(
  "/accounts/masters",
  authenticate,
  authorizeCompanyModules("accounts"),
  accountsMastersRoutes
);
router.use(
  "/accounts/general-ledger",
  authenticate,
  authorizeCompanyModules("accounts"),
  generalLedgerRoutes
);
router.use(
  "/accounts/journal-vouchers",
  authenticate,
  authorizeCompanyModules("accounts"),
  journalVouchersRoutes
);
router.use(
  "/accounts/receivables",
  authenticate,
  authorizeCompanyModules("accounts"),
  accountsReceivableRoutes
);
router.use(
  "/accounts/payables",
  authenticate,
  authorizeCompanyModules("accounts"),
  accountsPayableRoutes
);
router.use(
  "/accounts/cash-bank",
  authenticate,
  authorizeCompanyModules("accounts"),
  cashBankRoutes
);
router.use(
  "/accounts/posting-rules",
  authenticate,
  authorizeCompanyModules("accounts"),
  financePostingRulesRoutes
);
router.use(
  "/accounts/reports",
  authenticate,
  authorizeCompanyModules("accounts"),
  financialReportsRoutes
);
router.use(
  "/boulder-reports",
  authenticate,
  authorizeCompanyModules("operations"),
  boulderReportsRoutes
);
router.use(
  "/purchase-requests",
  authenticate,
  authorizeCompanyModules("procurement"),
  purchaseRequestsRoutes
);
router.use(
  "/purchase-orders",
  authenticate,
  authorizeCompanyModules("procurement"),
  purchaseOrdersRoutes
);
router.use(
  "/goods-receipts",
  authenticate,
  authorizeCompanyModules("procurement"),
  goodsReceiptsRoutes
);
router.use(
  "/purchase-invoices",
  authenticate,
  authorizeCompanyModules("procurement"),
  purchaseInvoicesRoutes
);

module.exports = router;
