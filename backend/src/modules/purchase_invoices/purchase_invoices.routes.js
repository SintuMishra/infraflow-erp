const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  addPurchaseInvoice,
  getAllPurchaseInvoices,
  getPurchaseInvoiceDetails,
  postPurchaseInvoiceController,
} = require("./purchase_invoices.controller");
const { validateCreatePurchaseInvoiceInput } = require("./purchase_invoices.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getAllPurchaseInvoices
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getPurchaseInvoiceDetails
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreatePurchaseInvoiceInput,
  addPurchaseInvoice
);

router.post(
  "/:id/post",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  postPurchaseInvoiceController
);

module.exports = router;
