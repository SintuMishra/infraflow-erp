const { pool } = require("../../config/db");

const normalizeCompanyId = (value) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const requireCompanyId = (companyId) => {
  const normalized = normalizeCompanyId(companyId);
  if (!normalized) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const listPostingRules = async ({ companyId, sourceModule = "", eventName = "" }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const where = ["company_id = $1"];

  if (sourceModule) {
    values.push(String(sourceModule).trim());
    where.push(`source_module = $${values.length}`);
  }

  if (eventName) {
    values.push(String(eventName).trim());
    where.push(`event_name = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      id,
      rule_code AS "ruleCode",
      event_name AS "eventName",
      source_module AS "sourceModule",
      voucher_type AS "voucherType",
      debit_account_id AS "debitAccountId",
      credit_account_id AS "creditAccountId",
      party_required AS "partyRequired",
      vendor_required AS "vendorRequired",
      requires_approval AS "requiresApproval",
      auto_post_enabled AS "autoPostEnabled",
      is_active AS "isActive",
      rule_priority AS "rulePriority",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM finance_posting_rules
    WHERE ${where.join(" AND ")}
    ORDER BY rule_priority ASC, id ASC
    `,
    values
  );

  return result.rows;
};

const createPostingRule = async ({
  companyId,
  ruleCode,
  eventName,
  sourceModule,
  voucherType,
  debitAccountId,
  creditAccountId,
  partyRequired = false,
  vendorRequired = false,
  requiresApproval = false,
  autoPostEnabled = false,
  isActive = true,
  rulePriority = 100,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedRuleCode = String(ruleCode || "").trim();
  const normalizedEventName = String(eventName || "").trim();
  const normalizedSource = String(sourceModule || "").trim();

  if (!normalizedRuleCode || !normalizedEventName || !normalizedSource) {
    const error = new Error("ruleCode, eventName, and sourceModule are required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO finance_posting_rules (
      company_id,
      rule_code,
      event_name,
      source_module,
      voucher_type,
      debit_account_id,
      credit_account_id,
      party_required,
      vendor_required,
      requires_approval,
      auto_post_enabled,
      is_active,
      rule_priority
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING
      id,
      rule_code AS "ruleCode",
      event_name AS "eventName",
      source_module AS "sourceModule",
      voucher_type AS "voucherType",
      debit_account_id AS "debitAccountId",
      credit_account_id AS "creditAccountId",
      party_required AS "partyRequired",
      vendor_required AS "vendorRequired",
      requires_approval AS "requiresApproval",
      auto_post_enabled AS "autoPostEnabled",
      is_active AS "isActive",
      rule_priority AS "rulePriority",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      normalizedCompanyId,
      normalizedRuleCode,
      normalizedEventName,
      normalizedSource,
      String(voucherType || "journal").trim().toLowerCase(),
      Number(debitAccountId || 0),
      Number(creditAccountId || 0),
      Boolean(partyRequired),
      Boolean(vendorRequired),
      Boolean(requiresApproval),
      Boolean(autoPostEnabled),
      Boolean(isActive),
      Number(rulePriority || 100),
    ]
  );

  return result.rows[0] || null;
};

const updatePostingRuleStatus = async ({ companyId, ruleId, isActive }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedRuleId = Number(ruleId || 0) || null;
  if (!normalizedRuleId) {
    const error = new Error("Valid ruleId is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE finance_posting_rules
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND company_id = $3
    RETURNING
      id,
      rule_code AS "ruleCode",
      event_name AS "eventName",
      source_module AS "sourceModule",
      voucher_type AS "voucherType",
      debit_account_id AS "debitAccountId",
      credit_account_id AS "creditAccountId",
      party_required AS "partyRequired",
      vendor_required AS "vendorRequired",
      requires_approval AS "requiresApproval",
      auto_post_enabled AS "autoPostEnabled",
      is_active AS "isActive",
      rule_priority AS "rulePriority",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [Boolean(isActive), normalizedRuleId, normalizedCompanyId]
  );

  const row = result.rows[0] || null;
  if (!row) {
    const error = new Error("Posting rule not found");
    error.statusCode = 404;
    throw error;
  }

  return row;
};

module.exports = {
  listPostingRules,
  createPostingRule,
  updatePostingRuleStatus,
};
