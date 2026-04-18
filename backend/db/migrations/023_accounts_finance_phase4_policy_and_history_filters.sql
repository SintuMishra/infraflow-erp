-- Phase-4.2 control-plane hardening:
-- 1) Durable, DB-backed maker-checker policy controls
-- 2) Transition-history action vocabulary expansion (close/reopen aliases)
-- 3) DB trigger guardrails for maker-checker segregation checks

CREATE TABLE IF NOT EXISTS finance_policy_controls (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  allow_submitter_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
  allow_maker_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
  allow_approver_self_posting BOOLEAN NOT NULL DEFAULT FALSE,
  allow_maker_self_posting BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id BIGINT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO finance_policy_controls (company_id)
SELECT c.id
FROM companies c
ON CONFLICT (company_id) DO NOTHING;

-- Preserve legacy data compatibility for companies that historically used same-user transitions.
UPDATE finance_policy_controls fpc
SET allow_submitter_self_approval = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM vouchers v
  WHERE v.company_id = fpc.company_id
    AND v.approval_status = 'approved'
    AND v.submitted_by_user_id IS NOT NULL
    AND v.approved_by_user_id IS NOT NULL
    AND v.submitted_by_user_id = v.approved_by_user_id
);

UPDATE finance_policy_controls fpc
SET allow_maker_self_approval = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM vouchers v
  WHERE v.company_id = fpc.company_id
    AND v.approval_status = 'approved'
    AND v.created_by_user_id IS NOT NULL
    AND v.approved_by_user_id IS NOT NULL
    AND v.created_by_user_id = v.approved_by_user_id
);

UPDATE finance_policy_controls fpc
SET allow_approver_self_posting = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM vouchers v
  WHERE v.company_id = fpc.company_id
    AND v.status = 'posted'
    AND v.approved_by_user_id IS NOT NULL
    AND v.posted_by_user_id IS NOT NULL
    AND v.approved_by_user_id = v.posted_by_user_id
);

UPDATE finance_policy_controls fpc
SET allow_maker_self_posting = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM vouchers v
  WHERE v.company_id = fpc.company_id
    AND v.status = 'posted'
    AND v.created_by_user_id IS NOT NULL
    AND v.posted_by_user_id IS NOT NULL
    AND v.created_by_user_id = v.posted_by_user_id
);

CREATE OR REPLACE FUNCTION enforce_voucher_maker_checker_policy()
RETURNS trigger AS $$
DECLARE
  policy_submitter_self_approval BOOLEAN := FALSE;
  policy_maker_self_approval BOOLEAN := FALSE;
  policy_approver_self_posting BOOLEAN := FALSE;
  policy_maker_self_posting BOOLEAN := FALSE;
BEGIN
  SELECT
    fpc.allow_submitter_self_approval,
    fpc.allow_maker_self_approval,
    fpc.allow_approver_self_posting,
    fpc.allow_maker_self_posting
  INTO
    policy_submitter_self_approval,
    policy_maker_self_approval,
    policy_approver_self_posting,
    policy_maker_self_posting
  FROM finance_policy_controls fpc
  WHERE fpc.company_id = NEW.company_id;

  IF NEW.approval_status = 'approved' THEN
    IF
      NEW.submitted_by_user_id IS NOT NULL
      AND NEW.approved_by_user_id IS NOT NULL
      AND NEW.submitted_by_user_id = NEW.approved_by_user_id
      AND NOT policy_submitter_self_approval
    THEN
      RAISE EXCEPTION 'Submitter cannot approve same voucher for company %', NEW.company_id;
    END IF;

    IF
      NEW.created_by_user_id IS NOT NULL
      AND NEW.approved_by_user_id IS NOT NULL
      AND NEW.created_by_user_id = NEW.approved_by_user_id
      AND NOT policy_maker_self_approval
    THEN
      RAISE EXCEPTION 'Maker cannot approve own voucher for company %', NEW.company_id;
    END IF;
  END IF;

  IF NEW.status = 'posted' THEN
    IF
      NEW.approved_by_user_id IS NOT NULL
      AND NEW.posted_by_user_id IS NOT NULL
      AND NEW.approved_by_user_id = NEW.posted_by_user_id
      AND NOT policy_approver_self_posting
    THEN
      RAISE EXCEPTION 'Approver cannot post same voucher for company %', NEW.company_id;
    END IF;

    IF
      NEW.created_by_user_id IS NOT NULL
      AND NEW.posted_by_user_id IS NOT NULL
      AND NEW.created_by_user_id = NEW.posted_by_user_id
      AND NOT policy_maker_self_posting
    THEN
      RAISE EXCEPTION 'Maker cannot post own voucher for company %', NEW.company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_voucher_maker_checker_policy ON vouchers;
CREATE TRIGGER trg_enforce_voucher_maker_checker_policy
BEFORE INSERT OR UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION enforce_voucher_maker_checker_policy();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_finance_transition_logs_action'
  ) THEN
    ALTER TABLE finance_transition_logs
      DROP CONSTRAINT chk_finance_transition_logs_action;
  END IF;
END $$;

ALTER TABLE finance_transition_logs
  ADD CONSTRAINT chk_finance_transition_logs_action
  CHECK (
    action IN (
      'create', 'submit', 'approve', 'post', 'reject', 'reverse',
      'close', 'reopen', 'close_period', 'reopen_period'
    )
  );

CREATE INDEX IF NOT EXISTS idx_finance_policy_controls_updated
  ON finance_policy_controls (updated_at DESC, company_id);
