const express = require("express");
const {
  getAllPurchaseRequests,
  getPurchaseRequestDetails,
  addPurchaseRequest,
  editPurchaseRequestController,
  updatePurchaseRequestStatusController,
} = require("./purchase_requests.controller");
const {
  validateCreatePurchaseRequestInput,
  validateUpdatePurchaseRequestInput,
  validatePurchaseRequestStatusPayload,
} = require("./purchase_requests.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles(
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer",
    "operator"
  ),
  getAllPurchaseRequests
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles(
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer",
    "operator"
  ),
  getPurchaseRequestDetails
);

router.post(
  "/",
  authenticate,
  authorizeRoles(
    "super_admin",
    "manager",
    "hr",
    "crusher_supervisor",
    "site_engineer",
    "operator"
  ),
  validateCreatePurchaseRequestInput,
  addPurchaseRequest
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateUpdatePurchaseRequestInput,
  editPurchaseRequestController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validatePurchaseRequestStatusPayload,
  updatePurchaseRequestStatusController
);

module.exports = router;
