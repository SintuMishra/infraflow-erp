const express = require("express");
const {
  getCompanyProfileController,
  saveCompanyProfileController,
} = require("./company_profile.controller");
const { validateCompanyProfilePayload } = require("./company_profile.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr", "crusher_supervisor", "site_engineer"),
  getCompanyProfileController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCompanyProfilePayload,
  saveCompanyProfileController
);

module.exports = router;
