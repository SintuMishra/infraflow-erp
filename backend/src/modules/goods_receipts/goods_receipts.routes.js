const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  addGoodsReceipt,
  getAllGoodsReceipts,
  getGoodsReceiptDetails,
} = require("./goods_receipts.controller");
const { validateCreateGoodsReceiptInput } = require("./goods_receipts.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getAllGoodsReceipts
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  getGoodsReceiptDetails
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreateGoodsReceiptInput,
  addGoodsReceipt
);

module.exports = router;
