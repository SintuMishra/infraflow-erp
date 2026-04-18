const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  listPostingRulesController,
  createPostingRuleController,
  updatePostingRuleStatusController,
} = require("./finance_posting_rules.controller");
const {
  validateCreatePostingRulePayload,
  validatePostingRuleStatusPayload,
} = require("./finance_posting_rules.validation");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager", "hr"),
  listPostingRulesController
);

router.post(
  "/",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validateCreatePostingRulePayload,
  createPostingRuleController
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("super_admin", "manager"),
  validatePostingRuleStatusPayload,
  updatePostingRuleStatusController
);

module.exports = router;
