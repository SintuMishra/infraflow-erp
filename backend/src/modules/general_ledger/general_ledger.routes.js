const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  validateCreateVoucherInput,
  validateReverseVoucherInput,
  validateApproveVoucherInput,
  validateRejectVoucherInput,
  validateWorkflowInboxQuery,
  validateTransitionHistoryQuery,
  validateFinancePolicyPayload,
} = require("./general_ledger.validation");
const {
  listVouchersController,
  getVoucherWorkflowInboxController,
  getFinancePolicySettingsController,
  updateFinancePolicySettingsController,
  listFinanceTransitionHistoryController,
  getVoucherByIdController,
  createVoucherController,
  submitVoucherController,
  approveVoucherController,
  rejectVoucherController,
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
  "/workflow/inbox",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateWorkflowInboxQuery,
  getVoucherWorkflowInboxController
);

router.get(
  "/policies",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getFinancePolicySettingsController
);

router.patch(
  "/policies",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateFinancePolicyPayload,
  updateFinancePolicySettingsController
);

router.get(
  "/workflow/history",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  validateTransitionHistoryQuery,
  listFinanceTransitionHistoryController
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
  "/vouchers/:id/submit",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  submitVoucherController
);

router.post(
  "/vouchers/:id/approve",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateApproveVoucherInput,
  approveVoucherController
);

router.post(
  "/vouchers/:id/reject",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateRejectVoucherInput,
  rejectVoucherController
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
