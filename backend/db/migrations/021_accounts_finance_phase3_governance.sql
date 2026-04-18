-- Phase-3 governance hardening:
-- 1) Maker-checker approval states for vouchers
-- 2) Accounting period close/reopen evidence columns
-- 3) Trigger-stack cleanup to avoid overlapping posted-voucher guards

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vouchers_approval_status_check'
  ) THEN
    ALTER TABLE vouchers
      DROP CONSTRAINT vouchers_approval_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_vouchers_approval_status'
  ) THEN
    ALTER TABLE vouchers
      DROP CONSTRAINT chk_vouchers_approval_status;
  END IF;
END $$;

ALTER TABLE vouchers
  ALTER COLUMN approval_status SET DEFAULT 'draft';

ALTER TABLE vouchers
  ADD CONSTRAINT chk_vouchers_approval_status
  CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'));

UPDATE vouchers
SET approval_status = CASE
  WHEN status = 'posted' THEN 'approved'
  WHEN status = 'reversed' THEN 'approved'
  WHEN status = 'cancelled' THEN 'approved'
  WHEN status = 'draft' AND approval_status = 'approved' THEN 'submitted'
  WHEN status = 'draft' AND approval_status = 'pending' THEN 'submitted'
  WHEN status = 'draft' AND approval_status = 'rejected' THEN 'rejected'
  ELSE 'draft'
END
WHERE approval_status NOT IN ('draft', 'submitted', 'approved', 'rejected')
   OR approval_status = 'pending'
   OR (status = 'draft' AND approval_status = 'approved');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_vouchers_posting_requires_approved'
  ) THEN
    ALTER TABLE vouchers
      DROP CONSTRAINT chk_vouchers_posting_requires_approved;
  END IF;
END $$;

ALTER TABLE vouchers
  ADD CONSTRAINT chk_vouchers_posting_requires_approved
  CHECK (
    CASE
      WHEN status IN ('posted', 'reversed', 'cancelled')
        THEN approval_status = 'approved'
      ELSE TRUE
    END
  );

ALTER TABLE accounting_periods
  ADD COLUMN IF NOT EXISTS closed_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reopened_by_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS status_notes TEXT NULL;

-- Cleanup overlap: old trigger from migration 019 is superseded by phase-2 trigger.
DROP TRIGGER IF EXISTS trg_prevent_posted_voucher_update ON vouchers;
DROP FUNCTION IF EXISTS prevent_posted_voucher_update();
