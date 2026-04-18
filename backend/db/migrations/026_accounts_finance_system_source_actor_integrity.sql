-- Phase-5.2 blocker fix:
-- Keep strict actor evidence for manual vouchers while allowing source-linked
-- system-generated vouchers to be approved without maker/checker actor fields.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
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
        (
          submitted_by_user_id IS NOT NULL
          AND submitted_at IS NOT NULL
          AND approved_by_user_id IS NOT NULL
          AND approved_at IS NOT NULL
        )
        OR (
          source_module IS NOT NULL
          AND source_record_id IS NOT NULL
        )
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
