const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  trialBalanceController,
  ledgerReportController,
  partyLedgerReportController,
  receivableAgeingController,
  payableAgeingController,
  cashBookController,
  bankBookController,
  voucherRegisterController,
} = require("./financial_reports.controller");
const {
  validateDateRangeQuery,
  validateLedgerReportQuery,
  validatePartyLedgerReportQuery,
  validateAsOfDateQuery,
} = require("./financial_reports.validation");

const router = express.Router();

router.get(
  "/trial-balance",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateDateRangeQuery,
  trialBalanceController
);

router.get(
  "/ledger",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateLedgerReportQuery,
  ledgerReportController
);

router.get(
  "/party-ledger",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validatePartyLedgerReportQuery,
  partyLedgerReportController
);

router.get(
  "/receivable-ageing",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateAsOfDateQuery,
  receivableAgeingController
);

router.get(
  "/payable-ageing",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateAsOfDateQuery,
  payableAgeingController
);

router.get(
  "/cash-book",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateDateRangeQuery,
  cashBookController
);

router.get(
  "/bank-book",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateDateRangeQuery,
  bankBookController
);

router.get(
  "/voucher-register",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateDateRangeQuery,
  voucherRegisterController
);

module.exports = router;
