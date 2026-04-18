-- Phase-5.1 blocker fix:
-- Ensure maker-checker trigger stays strict even when company policy row is absent.

CREATE OR REPLACE FUNCTION enforce_voucher_maker_checker_policy()
RETURNS trigger AS $$
DECLARE
  policy_submitter_self_approval BOOLEAN := FALSE;
  policy_maker_self_approval BOOLEAN := FALSE;
  policy_approver_self_posting BOOLEAN := FALSE;
  policy_maker_self_posting BOOLEAN := FALSE;
BEGIN
  SELECT
    COALESCE(fpc.allow_submitter_self_approval, FALSE),
    COALESCE(fpc.allow_maker_self_approval, FALSE),
    COALESCE(fpc.allow_approver_self_posting, FALSE),
    COALESCE(fpc.allow_maker_self_posting, FALSE)
  INTO
    policy_submitter_self_approval,
    policy_maker_self_approval,
    policy_approver_self_posting,
    policy_maker_self_posting
  FROM finance_policy_controls fpc
  WHERE fpc.company_id = NEW.company_id;

  policy_submitter_self_approval := COALESCE(policy_submitter_self_approval, FALSE);
  policy_maker_self_approval := COALESCE(policy_maker_self_approval, FALSE);
  policy_approver_self_posting := COALESCE(policy_approver_self_posting, FALSE);
  policy_maker_self_posting := COALESCE(policy_maker_self_posting, FALSE);

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
