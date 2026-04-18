-- Phase-2 hardening for finance integrity and scalability.

CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_company_dispatch
  ON receivables (company_id, dispatch_report_id)
  WHERE dispatch_report_id IS NOT NULL;

DROP INDEX IF EXISTS uq_settlements_company_voucher;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_company_default
  ON bank_accounts (company_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_vouchers_company_period_status
  ON vouchers (company_id, accounting_period_id, status, voucher_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_company_account
  ON voucher_lines (company_id, account_id, voucher_id);

CREATE INDEX IF NOT EXISTS idx_settlements_company_source_date
  ON settlements (company_id, source_document_type, source_document_id, settlement_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_receivables_company_status_due
  ON receivables (company_id, status, due_date, id);

CREATE INDEX IF NOT EXISTS idx_receivables_company_outstanding
  ON receivables (company_id, outstanding_amount, id)
  WHERE outstanding_amount > 0;

CREATE INDEX IF NOT EXISTS idx_payables_company_status_due
  ON payables (company_id, status, due_date, id);

CREATE INDEX IF NOT EXISTS idx_payables_company_outstanding
  ON payables (company_id, outstanding_amount, id)
  WHERE outstanding_amount > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_finance_source_links_source_text'
  ) THEN
    ALTER TABLE finance_source_links
      ADD CONSTRAINT chk_finance_source_links_source_text
      CHECK (
        BTRIM(source_module) <> ''
        AND BTRIM(source_event) <> ''
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_vouchers_id_company'
  ) THEN
    ALTER TABLE vouchers
      ADD CONSTRAINT uq_vouchers_id_company
      UNIQUE (id, company_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_chart_of_accounts_id_company'
  ) THEN
    ALTER TABLE chart_of_accounts
      ADD CONSTRAINT uq_chart_of_accounts_id_company
      UNIQUE (id, company_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_ledgers_id_company'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT uq_ledgers_id_company
      UNIQUE (id, company_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_voucher_lines_voucher_company'
  ) THEN
    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_voucher_company
      FOREIGN KEY (voucher_id, company_id)
      REFERENCES vouchers(id, company_id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_voucher_lines_account_company'
  ) THEN
    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_account_company
      FOREIGN KEY (account_id, company_id)
      REFERENCES chart_of_accounts(id, company_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_voucher_lines_ledger_company'
  ) THEN
    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_ledger_company
      FOREIGN KEY (ledger_id, company_id)
      REFERENCES ledgers(id, company_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ledgers_account_company'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_account_company
      FOREIGN KEY (account_id, company_id)
      REFERENCES chart_of_accounts(id, company_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_receivables_voucher_company'
  ) THEN
    ALTER TABLE receivables
      ADD CONSTRAINT fk_receivables_voucher_company
      FOREIGN KEY (voucher_id, company_id)
      REFERENCES vouchers(id, company_id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payables_voucher_company'
  ) THEN
    ALTER TABLE payables
      ADD CONSTRAINT fk_payables_voucher_company
      FOREIGN KEY (voucher_id, company_id)
      REFERENCES vouchers(id, company_id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_settlements_voucher_company'
  ) THEN
    ALTER TABLE settlements
      ADD CONSTRAINT fk_settlements_voucher_company
      FOREIGN KEY (voucher_id, company_id)
      REFERENCES vouchers(id, company_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_settlement_source_integrity()
RETURNS trigger AS $$
DECLARE
  receivable_row RECORD;
  payable_row RECORD;
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Settlement amount must be greater than 0';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.company_id <> NEW.company_id
      OR OLD.source_document_type <> NEW.source_document_type
      OR OLD.source_document_id <> NEW.source_document_id THEN
      RAISE EXCEPTION 'Settlement source reference is immutable after creation';
    END IF;
  END IF;

  IF NEW.source_document_type = 'receivable' THEN
    SELECT id, outstanding_amount, status
      INTO receivable_row
    FROM receivables
    WHERE id = NEW.source_document_id
      AND company_id = NEW.company_id
    FOR UPDATE;

    IF receivable_row.id IS NULL THEN
      RAISE EXCEPTION 'Invalid receivable source for settlement';
    END IF;

    IF receivable_row.status NOT IN ('open', 'partial') THEN
      RAISE EXCEPTION 'Receivable is not open/partial for settlement';
    END IF;

    IF NEW.amount > receivable_row.outstanding_amount THEN
      RAISE EXCEPTION 'Settlement exceeds receivable outstanding amount';
    END IF;
  ELSIF NEW.source_document_type = 'payable' THEN
    SELECT id, outstanding_amount, status
      INTO payable_row
    FROM payables
    WHERE id = NEW.source_document_id
      AND company_id = NEW.company_id
    FOR UPDATE;

    IF payable_row.id IS NULL THEN
      RAISE EXCEPTION 'Invalid payable source for settlement';
    END IF;

    IF payable_row.status NOT IN ('open', 'partial') THEN
      RAISE EXCEPTION 'Payable is not open/partial for settlement';
    END IF;

    IF NEW.amount > payable_row.outstanding_amount THEN
      RAISE EXCEPTION 'Settlement exceeds payable outstanding amount';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported source_document_type for settlement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_settlement_source_integrity ON settlements;
CREATE TRIGGER trg_validate_settlement_source_integrity
BEFORE INSERT OR UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION validate_settlement_source_integrity();

CREATE OR REPLACE FUNCTION validate_voucher_posting_integrity()
RETURNS trigger AS $$
DECLARE
  line_count INT;
  debit_total NUMERIC;
  credit_total NUMERIC;
BEGIN
  IF NEW.status = 'posted' AND OLD.status <> 'posted' THEN
    SELECT
      COUNT(*)::int,
      COALESCE(SUM(debit), 0)::numeric,
      COALESCE(SUM(credit), 0)::numeric
    INTO line_count, debit_total, credit_total
    FROM voucher_lines
    WHERE voucher_id = NEW.id;

    IF line_count < 2 THEN
      RAISE EXCEPTION 'Voucher cannot be posted without at least two lines';
    END IF;

    IF ABS(debit_total - credit_total) >= 0.01 THEN
      RAISE EXCEPTION 'Voucher cannot be posted with unbalanced debit/credit totals';
    END IF;

    IF NEW.total_debit <> debit_total OR NEW.total_credit <> credit_total THEN
      RAISE EXCEPTION 'Voucher totals do not match voucher lines';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_voucher_posting_integrity ON vouchers;
CREATE TRIGGER trg_validate_voucher_posting_integrity
BEFORE UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION validate_voucher_posting_integrity();

CREATE OR REPLACE FUNCTION protect_posted_voucher_mutations()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'posted' THEN
    IF (
      NEW.voucher_number IS DISTINCT FROM OLD.voucher_number OR
      NEW.voucher_type IS DISTINCT FROM OLD.voucher_type OR
      NEW.voucher_date IS DISTINCT FROM OLD.voucher_date OR
      NEW.accounting_period_id IS DISTINCT FROM OLD.accounting_period_id OR
      NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
      NEW.narration IS DISTINCT FROM OLD.narration OR
      NEW.total_debit IS DISTINCT FROM OLD.total_debit OR
      NEW.total_credit IS DISTINCT FROM OLD.total_credit OR
      NEW.source_module IS DISTINCT FROM OLD.source_module OR
      NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
    ) THEN
      RAISE EXCEPTION 'Posted voucher core fields cannot be modified';
    END IF;
  ELSIF NEW.status IN ('reversed', 'cancelled') THEN
    IF (
      NEW.voucher_number IS DISTINCT FROM OLD.voucher_number OR
      NEW.voucher_type IS DISTINCT FROM OLD.voucher_type OR
      NEW.voucher_date IS DISTINCT FROM OLD.voucher_date OR
      NEW.accounting_period_id IS DISTINCT FROM OLD.accounting_period_id OR
      NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
      NEW.total_debit IS DISTINCT FROM OLD.total_debit OR
      NEW.total_credit IS DISTINCT FROM OLD.total_credit OR
      NEW.source_module IS DISTINCT FROM OLD.source_module OR
      NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
    ) THEN
      RAISE EXCEPTION 'Only status transition is allowed for posted vouchers';
    END IF;
  ELSE
    RAISE EXCEPTION 'Posted vouchers can only move to reversed/cancelled status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_posted_voucher_mutations ON vouchers;
CREATE TRIGGER trg_protect_posted_voucher_mutations
BEFORE UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION protect_posted_voucher_mutations();

CREATE OR REPLACE FUNCTION prevent_posted_voucher_line_change()
RETURNS trigger AS $$
DECLARE
  voucher_status VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO voucher_status FROM vouchers WHERE id = OLD.voucher_id;
  ELSE
    SELECT status INTO voucher_status FROM vouchers WHERE id = NEW.voucher_id;
  END IF;

  IF voucher_status = 'posted' THEN
    RAISE EXCEPTION 'Posted voucher lines are immutable. Use reversal entry.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_posted_voucher_line_change ON voucher_lines;
CREATE TRIGGER trg_prevent_posted_voucher_line_change
BEFORE INSERT OR UPDATE OR DELETE ON voucher_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_voucher_line_change();
