const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  listBankAccountsController,
  createBankAccountController,
  updateBankAccountStatusController,
  createCashBankVoucherController,
} = require("./cash_bank.controller");
const {
  validateCreateBankAccountPayload,
  validateBankAccountStatusPayload,
  validateCreateCashBankVoucherPayload,
} = require("./cash_bank.validation");

const router = express.Router();

router.get(
  "/bank-accounts",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listBankAccountsController
);

router.post(
  "/bank-accounts",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreateBankAccountPayload,
  createBankAccountController
);

router.patch(
  "/bank-accounts/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateBankAccountStatusPayload,
  updateBankAccountStatusController
);

router.post(
  "/vouchers",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateCreateCashBankVoucherPayload,
  createCashBankVoucherController
);

module.exports = router;
