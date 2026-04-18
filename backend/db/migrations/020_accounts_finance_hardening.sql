-- Phase-2 hardening for finance integrity and scalability.

CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_company_dispatch
  ON receivables (company_id, dispatch_report_id)
  WHERE dispatch_report_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_company_voucher
  ON settlements (company_id, voucher_id)
  WHERE voucher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_company_default
  ON bank_accounts (company_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_vouchers_company_period_status
  ON vouchers (company_id, accounting_period_id, status, voucher_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_company_account
  ON voucher_lines (company_id, account_id, voucher_id);

CREATE INDEX IF NOT EXISTS idx_settlements_company_source_date
  ON settlements (company_id, source_document_type, source_document_id, settlement_date DESC, id DESC);

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

CREATE OR REPLACE FUNCTION validate_settlement_source_integrity()
RETURNS trigger AS $$
DECLARE
  receivable_row RECORD;
  payable_row RECORD;
BEGIN
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
BEFORE INSERT ON settlements
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
