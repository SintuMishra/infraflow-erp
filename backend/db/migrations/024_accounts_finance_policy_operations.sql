-- Phase-5 rollout hardening:
-- Operational policy metadata for maker-checker governance

ALTER TABLE finance_policy_controls
  ADD COLUMN IF NOT EXISTS last_update_notes TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_finance_policy_controls_updated_by_user'
  ) THEN
    ALTER TABLE finance_policy_controls
      ADD CONSTRAINT fk_finance_policy_controls_updated_by_user
      FOREIGN KEY (updated_by_user_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_finance_policy_controls_notes_len'
  ) THEN
    ALTER TABLE finance_policy_controls
      DROP CONSTRAINT chk_finance_policy_controls_notes_len;
  END IF;
END $$;

ALTER TABLE finance_policy_controls
  ADD CONSTRAINT chk_finance_policy_controls_notes_len
  CHECK (last_update_notes IS NULL OR LENGTH(last_update_notes) <= 400);

CREATE INDEX IF NOT EXISTS idx_finance_policy_controls_company_updated
  ON finance_policy_controls (company_id, updated_at DESC);
