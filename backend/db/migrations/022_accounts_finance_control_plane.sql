-- Phase-4 enterprise control plane hardening
-- 1) DB actor model for finance lifecycle
-- 2) Immutable finance transition history

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS submitted_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reversed_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL;

UPDATE vouchers
SET submitted_by_user_id = COALESCE(submitted_by_user_id, created_by_user_id)
WHERE approval_status IN ('submitted', 'approved', 'rejected')
  AND submitted_by_user_id IS NULL;

UPDATE vouchers
SET submitted_at = COALESCE(submitted_at, updated_at, created_at)
WHERE approval_status IN ('submitted', 'approved', 'rejected')
  AND submitted_at IS NULL;

UPDATE vouchers
SET approved_by_user_id = COALESCE(approved_by_user_id, posted_by_user_id, updated_by_user_id, created_by_user_id)
WHERE approval_status = 'approved'
  AND approved_by_user_id IS NULL;

UPDATE vouchers
SET approved_at = COALESCE(approved_at, posted_at, updated_at, created_at)
WHERE approval_status = 'approved'
  AND approved_at IS NULL;

UPDATE vouchers
SET rejected_by_user_id = COALESCE(rejected_by_user_id, updated_by_user_id, created_by_user_id)
WHERE approval_status = 'rejected'
  AND rejected_by_user_id IS NULL;

UPDATE vouchers
SET rejected_at = COALESCE(rejected_at, updated_at, created_at)
WHERE approval_status = 'rejected'
  AND rejected_at IS NULL;

UPDATE vouchers
SET reversed_by_user_id = COALESCE(reversed_by_user_id, updated_by_user_id, created_by_user_id)
WHERE status = 'reversed'
  AND reversed_by_user_id IS NULL;

UPDATE vouchers
SET reversed_at = COALESCE(reversed_at, updated_at, created_at)
WHERE status = 'reversed'
  AND reversed_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_vouchers_phase4_actor_integrity'
  ) THEN
    ALTER TABLE vouchers
      DROP CONSTRAINT chk_vouchers_phase4_actor_integrity;
  END IF;
END $$;

ALTER TABLE vouchers
  ADD CONSTRAINT chk_vouchers_phase4_actor_integrity
  CHECK (
    (
      approval_status <> 'submitted'
      OR (submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL)
    )
    AND (
      approval_status <> 'approved'
      OR (
        submitted_by_user_id IS NOT NULL
        AND submitted_at IS NOT NULL
        AND approved_by_user_id IS NOT NULL
        AND approved_at IS NOT NULL
      )
    )
    AND (
      approval_status <> 'rejected'
      OR (
        submitted_by_user_id IS NOT NULL
        AND submitted_at IS NOT NULL
        AND rejected_by_user_id IS NOT NULL
        AND rejected_at IS NOT NULL
      )
    )
    AND (
      status <> 'posted'
      OR posted_by_user_id IS NOT NULL
    )
    AND (
      status <> 'reversed'
      OR reversed_by_user_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_vouchers_company_workflow
  ON vouchers (company_id, status, approval_status, voucher_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS finance_transition_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(30) NOT NULL,
  from_state VARCHAR(30) NULL,
  to_state VARCHAR(30) NOT NULL,
  performed_by_user_id BIGINT NOT NULL,
  remarks TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_finance_transition_logs_entity_type CHECK (
    entity_type IN ('voucher', 'accounting_period')
  ),
  CONSTRAINT chk_finance_transition_logs_action CHECK (
    action IN ('create', 'submit', 'approve', 'post', 'reject', 'reverse', 'close_period', 'reopen_period')
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_transition_logs_company_entity
  ON finance_transition_logs (company_id, entity_type, entity_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_finance_transition_logs_company_action
  ON finance_transition_logs (company_id, action, id DESC);

CREATE INDEX IF NOT EXISTS idx_finance_transition_logs_company_time
  ON finance_transition_logs (company_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION prevent_finance_transition_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'finance_transition_logs is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_finance_transition_log_update ON finance_transition_logs;
CREATE TRIGGER trg_prevent_finance_transition_log_update
BEFORE UPDATE OR DELETE ON finance_transition_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_finance_transition_log_mutation();
