const express = require("express");
const {
  bootstrapCompanyOwnerController,
  createManagedCompanyBillingInvoiceController,
  listManagedCompanyBillingInvoicesController,
  listManagedCompaniesController,
  permanentlyDeleteManagedCompanyController,
  updateManagedCompanyAccessController,
  updateManagedCompanyBillingController,
  updateManagedCompanyController,
} = require("./onboarding.controller");
const {
  validateBootstrapCompanyInput,
  validateManagedCompanyAccessInput,
  validateManagedCompanyBillingInput,
  validateManagedCompanyBillingInvoiceInput,
  validateManagedCompanyPermanentDeleteInput,
  validateManagedCompanyUpdateInput,
} = require("./onboarding.validation");
const {
  onboardingRateLimiter,
} = require("../../middlewares/rateLimit.middleware");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/companies",
  authenticate,
  authorizeRoles("super_admin"),
  listManagedCompaniesController
);

router.post(
  "/bootstrap-company-owner",
  authenticate,
  authorizeRoles("super_admin"),
  onboardingRateLimiter,
  validateBootstrapCompanyInput,
  bootstrapCompanyOwnerController
);

router.patch(
  "/companies/:companyId",
  authenticate,
  authorizeRoles("super_admin"),
  validateManagedCompanyUpdateInput,
  updateManagedCompanyController
);

router.patch(
  "/companies/:companyId/access",
  authenticate,
  authorizeRoles("super_admin"),
  validateManagedCompanyAccessInput,
  updateManagedCompanyAccessController
);

router.patch(
  "/companies/:companyId/billing",
  authenticate,
  authorizeRoles("super_admin"),
  validateManagedCompanyBillingInput,
  updateManagedCompanyBillingController
);

router.get(
  "/companies/:companyId/invoices",
  authenticate,
  authorizeRoles("super_admin"),
  listManagedCompanyBillingInvoicesController
);

router.post(
  "/companies/:companyId/invoices",
  authenticate,
  authorizeRoles("super_admin"),
  validateManagedCompanyBillingInvoiceInput,
  createManagedCompanyBillingInvoiceController
);

router.delete(
  "/companies/:companyId/permanent",
  authenticate,
  authorizeRoles("super_admin"),
  validateManagedCompanyPermanentDeleteInput,
  permanentlyDeleteManagedCompanyController
);

module.exports = router;
