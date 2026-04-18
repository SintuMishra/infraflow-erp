const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  validateCreateAccountGroup,
  validateCreateAccount,
  validateCreateLedger,
  validateCreateFinancialYear,
  validateCreateAccountingPeriod,
} = require("./accounts_masters.validation");
const {
  listAccountGroupsController,
  createAccountGroupController,
  listChartOfAccountsController,
  createChartOfAccountController,
  listLedgersController,
  createLedgerController,
  listFinancialYearsController,
  createFinancialYearController,
  createAccountingPeriodController,
  bootstrapFinanceDefaultsController,
  syncPartyVendorLedgersController,
} = require("./accounts_masters.controller");

const router = express.Router();

router.post(
  "/bootstrap-defaults",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  bootstrapFinanceDefaultsController
);

router.post(
  "/sync-party-ledgers",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  syncPartyVendorLedgersController
);

router.get(
  "/account-groups",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listAccountGroupsController
);

router.post(
  "/account-groups",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateAccountGroup,
  createAccountGroupController
);

router.get(
  "/chart-of-accounts",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listChartOfAccountsController
);

router.post(
  "/chart-of-accounts",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateAccount,
  createChartOfAccountController
);

router.get(
  "/ledgers",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listLedgersController
);

router.post(
  "/ledgers",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateLedger,
  createLedgerController
);

router.get(
  "/financial-years",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listFinancialYearsController
);

router.post(
  "/financial-years",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateFinancialYear,
  createFinancialYearController
);

router.post(
  "/accounting-periods",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateAccountingPeriod,
  createAccountingPeriodController
);

module.exports = router;
