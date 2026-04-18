const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  listJournalVouchersController,
  createJournalVoucherController,
  postJournalVoucherController,
  reverseJournalVoucherController,
} = require("./journal_vouchers.controller");
const {
  validateCreateJournalVoucherInput,
  validateReverseJournalVoucherInput,
} = require("./journal_vouchers.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listJournalVouchersController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateJournalVoucherInput,
  createJournalVoucherController
);

router.post(
  "/:id/post",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  postJournalVoucherController
);

router.post(
  "/:id/reverse",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateReverseJournalVoucherInput,
  reverseJournalVoucherController
);

module.exports = router;
