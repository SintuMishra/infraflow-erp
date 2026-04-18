const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  validateCreateVoucherInput,
  validateReverseVoucherInput,
} = require("./general_ledger.validation");
const {
  listVouchersController,
  getVoucherByIdController,
  createVoucherController,
  postVoucherController,
  reverseVoucherController,
  getLedgerBookController,
} = require("./general_ledger.controller");

const router = express.Router();

router.get(
  "/vouchers",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listVouchersController
);

router.get(
  "/vouchers/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getVoucherByIdController
);

router.post(
  "/vouchers",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateVoucherInput,
  createVoucherController
);

router.post(
  "/vouchers/:id/post",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  postVoucherController
);

router.post(
  "/vouchers/:id/reverse",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateReverseVoucherInput,
  reverseVoucherController
);

router.get(
  "/ledger/:ledgerId",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getLedgerBookController
);

module.exports = router;
