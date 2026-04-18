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

const router = express.Router();

router.get(
  "/trial-balance",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  trialBalanceController
);

router.get(
  "/ledger",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  ledgerReportController
);

router.get(
  "/party-ledger",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  partyLedgerReportController
);

router.get(
  "/receivable-ageing",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  receivableAgeingController
);

router.get(
  "/payable-ageing",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  payableAgeingController
);

router.get(
  "/cash-book",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  cashBookController
);

router.get(
  "/bank-book",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  bankBookController
);

router.get(
  "/voucher-register",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  voucherRegisterController
);

module.exports = router;
