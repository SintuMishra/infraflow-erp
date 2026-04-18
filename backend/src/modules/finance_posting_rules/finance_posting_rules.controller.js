const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listPostingRules,
  createPostingRule,
  updatePostingRuleStatus,
} = require("./finance_posting_rules.service");

const listPostingRulesController = async (req, res) => {
  try {
    const data = await listPostingRules({
      companyId: req.companyId,
      sourceModule: req.query.sourceModule,
      eventName: req.query.eventName,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load finance posting rules");
  }
};

const createPostingRuleController = async (req, res) => {
  try {
    const data = await createPostingRule({
      companyId: req.companyId,
      ...req.body,
    });

    await recordAuditEvent({
      action: "finance.posting_rule.created",
      actorUserId: req.user?.userId || null,
      targetType: "finance_posting_rule",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        ruleCode: data.ruleCode,
        sourceModule: data.sourceModule,
        eventName: data.eventName,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Finance posting rule created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create finance posting rule");
  }
};

const updatePostingRuleStatusController = async (req, res) => {
  try {
    const data = await updatePostingRuleStatus({
      companyId: req.companyId,
      ruleId: req.params.id,
      isActive: req.body?.isActive,
    });

    await recordAuditEvent({
      action: "finance.posting_rule.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "finance_posting_rule",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        ruleCode: data.ruleCode,
        isActive: data.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: data.isActive
        ? "Finance posting rule activated"
        : "Finance posting rule deactivated",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update finance posting rule");
  }
};

module.exports = {
  listPostingRulesController,
  createPostingRuleController,
  updatePostingRuleStatusController,
};
