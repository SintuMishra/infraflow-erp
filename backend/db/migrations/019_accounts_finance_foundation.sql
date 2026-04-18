CREATE TABLE IF NOT EXISTS account_groups (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_code VARCHAR(50) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  nature VARCHAR(20) NOT NULL CHECK (nature IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_group_id BIGINT NULL REFERENCES account_groups(id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, group_code),
  UNIQUE (company_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_account_groups_company ON account_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_parent ON account_groups(parent_group_id);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_group_id BIGINT NOT NULL REFERENCES account_groups(id) ON DELETE RESTRICT,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_type VARCHAR(30) NOT NULL CHECK (
    account_type IN ('control', 'ledger', 'cash', 'bank', 'customer', 'supplier', 'tax', 'adjustment')
  ),
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  allow_direct_posting BOOLEAN NOT NULL DEFAULT TRUE,
  is_party_control BOOLEAN NOT NULL DEFAULT FALSE,
  is_bank_control BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, account_code),
  UNIQUE (company_id, account_name)
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_company ON chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_group ON chart_of_accounts(account_group_id);

CREATE TABLE IF NOT EXISTS ledgers (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  ledger_code VARCHAR(60) NOT NULL,
  ledger_name VARCHAR(180) NOT NULL,
  party_id BIGINT NULL,
  vendor_id BIGINT NULL,
  plant_id BIGINT NULL,
  project_id BIGINT NULL,
  vehicle_id BIGINT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
  opening_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_system_generated BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ledgers_opening_non_negative CHECK (opening_debit >= 0 AND opening_credit >= 0),
  CONSTRAINT chk_ledgers_single_counterparty CHECK (
    (CASE WHEN party_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN vendor_id IS NULL THEN 0 ELSE 1 END) <= 1
  ),
  UNIQUE (company_id, ledger_code),
  UNIQUE (company_id, ledger_name)
);

CREATE INDEX IF NOT EXISTS idx_ledgers_company ON ledgers(company_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_account ON ledgers(account_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_party ON ledgers(company_id, party_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_vendor ON ledgers(company_id, vendor_id);

CREATE TABLE IF NOT EXISTS financial_years (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fy_code VARCHAR(20) NOT NULL,
  fy_name VARCHAR(60) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_financial_years_dates CHECK (end_date >= start_date),
  UNIQUE (company_id, fy_code),
  UNIQUE (company_id, fy_name)
);

CREATE INDEX IF NOT EXISTS idx_financial_years_company ON financial_years(company_id);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  financial_year_id BIGINT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  period_code VARCHAR(20) NOT NULL,
  period_name VARCHAR(60) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'soft_closed', 'closed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_accounting_periods_dates CHECK (period_end >= period_start),
  UNIQUE (company_id, financial_year_id, period_code),
  UNIQUE (company_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_company ON accounting_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_fy ON accounting_periods(financial_year_id);

CREATE TABLE IF NOT EXISTS vouchers (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_number VARCHAR(80) NOT NULL,
  voucher_type VARCHAR(30) NOT NULL CHECK (
    voucher_type IN ('journal', 'payment', 'receipt', 'contra', 'sales_invoice', 'purchase_bill', 'reversal')
  ),
  voucher_date DATE NOT NULL,
  accounting_period_id BIGINT NULL REFERENCES accounting_periods(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed', 'cancelled')),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  narration TEXT NULL,
  total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_module VARCHAR(60) NULL,
  source_record_id BIGINT NULL,
  posted_by_user_id BIGINT NULL,
  posted_at TIMESTAMP NULL,
  reversed_from_voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  reversal_of_voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  created_by_user_id BIGINT NULL,
  updated_by_user_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vouchers_totals_non_negative CHECK (total_debit >= 0 AND total_credit >= 0),
  UNIQUE (company_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_company ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(company_id, voucher_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_source ON vouchers(company_id, source_module, source_record_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(company_id, status, voucher_type);

CREATE TABLE IF NOT EXISTS voucher_lines (
  id BIGSERIAL PRIMARY KEY,
  voucher_id BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id BIGINT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  ledger_id BIGINT NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
  party_id BIGINT NULL,
  vendor_id BIGINT NULL,
  plant_id BIGINT NULL,
  project_id BIGINT NULL,
  vehicle_id BIGINT NULL,
  line_narration TEXT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_module VARCHAR(60) NULL,
  source_record_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_voucher_lines_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT chk_voucher_lines_single_side CHECK (
    (CASE WHEN debit > 0 THEN 1 ELSE 0 END) + (CASE WHEN credit > 0 THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT chk_voucher_lines_single_counterparty CHECK (
    (CASE WHEN party_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN vendor_id IS NULL THEN 0 ELSE 1 END) <= 1
  ),
  UNIQUE (voucher_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_voucher ON voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_ledger ON voucher_lines(company_id, ledger_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_party ON voucher_lines(company_id, party_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_vendor ON voucher_lines(company_id, vendor_id);

CREATE TABLE IF NOT EXISTS receivables (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_id BIGINT NOT NULL,
  dispatch_report_id BIGINT NULL,
  invoice_number VARCHAR(80) NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  outstanding_amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'settled', 'written_off')),
  notes TEXT NULL,
  created_by_user_id BIGINT NULL,
  updated_by_user_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_receivables_amounts CHECK (amount >= 0 AND outstanding_amount >= 0 AND outstanding_amount <= amount)
);

CREATE INDEX IF NOT EXISTS idx_receivables_company ON receivables(company_id);
CREATE INDEX IF NOT EXISTS idx_receivables_party ON receivables(company_id, party_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_status ON receivables(company_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_receivables_dispatch ON receivables(company_id, dispatch_report_id);

CREATE TABLE IF NOT EXISTS payables (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_id BIGINT NULL,
  vendor_id BIGINT NULL,
  reference_number VARCHAR(80) NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  outstanding_amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'settled', 'disputed')),
  notes TEXT NULL,
  created_by_user_id BIGINT NULL,
  updated_by_user_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_payables_amounts CHECK (amount >= 0 AND outstanding_amount >= 0 AND outstanding_amount <= amount),
  CONSTRAINT chk_payables_counterparty CHECK (
    (CASE WHEN party_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN vendor_id IS NULL THEN 0 ELSE 1 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_payables_company ON payables(company_id);
CREATE INDEX IF NOT EXISTS idx_payables_party ON payables(company_id, party_id);
CREATE INDEX IF NOT EXISTS idx_payables_vendor ON payables(company_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_payables_due_status ON payables(company_id, due_date, status);

CREATE TABLE IF NOT EXISTS settlements (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  settlement_type VARCHAR(20) NOT NULL CHECK (settlement_type IN ('receipt', 'payment')),
  settlement_date DATE NOT NULL,
  source_document_type VARCHAR(20) NOT NULL CHECK (source_document_type IN ('receivable', 'payable')),
  source_document_id BIGINT NOT NULL,
  voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference_number VARCHAR(80) NULL,
  notes TEXT NULL,
  created_by_user_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlements_company ON settlements(company_id);
CREATE INDEX IF NOT EXISTS idx_settlements_source ON settlements(company_id, source_document_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_settlements_date ON settlements(company_id, settlement_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_name VARCHAR(140) NOT NULL,
  bank_name VARCHAR(140) NOT NULL,
  branch_name VARCHAR(140) NULL,
  account_number VARCHAR(64) NOT NULL,
  ifsc_code VARCHAR(20) NULL,
  ledger_id BIGINT NULL REFERENCES ledgers(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);

CREATE TABLE IF NOT EXISTS finance_posting_rules (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(80) NOT NULL,
  event_name VARCHAR(80) NOT NULL,
  source_module VARCHAR(80) NOT NULL,
  voucher_type VARCHAR(30) NOT NULL CHECK (
    voucher_type IN ('journal', 'payment', 'receipt', 'contra', 'sales_invoice', 'purchase_bill', 'reversal')
  ),
  debit_account_id BIGINT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  credit_account_id BIGINT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  party_required BOOLEAN NOT NULL DEFAULT FALSE,
  vendor_required BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  auto_post_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, rule_code),
  UNIQUE (company_id, source_module, event_name, rule_priority)
);

CREATE INDEX IF NOT EXISTS idx_finance_posting_rules_company ON finance_posting_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_posting_rules_lookup ON finance_posting_rules(company_id, source_module, event_name, is_active);

CREATE TABLE IF NOT EXISTS finance_source_links (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_module VARCHAR(80) NOT NULL,
  source_record_id BIGINT NOT NULL,
  source_event VARCHAR(80) NOT NULL,
  posting_rule_code VARCHAR(80) NULL,
  voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
  posting_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    posting_status IN ('pending', 'posted', 'reversed', 'skipped', 'failed')
  ),
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, source_module, source_record_id, source_event)
);

CREATE INDEX IF NOT EXISTS idx_finance_source_links_company ON finance_source_links(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_source_links_voucher ON finance_source_links(voucher_id);

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS finance_status VARCHAR(20) NOT NULL DEFAULT 'not_ready';

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS can_post_to_finance BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS finance_posting_state VARCHAR(20) NOT NULL DEFAULT 'none';

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS finance_source_link_id BIGINT NULL REFERENCES finance_source_links(id) ON DELETE SET NULL;

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS finance_last_voucher_id BIGINT NULL REFERENCES vouchers(id) ON DELETE SET NULL;

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS finance_notes TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dispatch_reports_finance_status'
  ) THEN
    ALTER TABLE dispatch_reports
      ADD CONSTRAINT chk_dispatch_reports_finance_status
      CHECK (finance_status IN ('not_ready', 'ready', 'posted', 'partially_settled', 'settled', 'on_hold'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dispatch_reports_finance_posting_state'
  ) THEN
    ALTER TABLE dispatch_reports
      ADD CONSTRAINT chk_dispatch_reports_finance_posting_state
      CHECK (finance_posting_state IN ('none', 'queued', 'posted', 'reversed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_finance_status
  ON dispatch_reports(company_id, finance_status, can_post_to_finance);

CREATE OR REPLACE FUNCTION prevent_posted_voucher_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'posted' AND (
    NEW.status = OLD.status
    OR NEW.status NOT IN ('reversed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Posted vouchers are immutable. Use reversal entry.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_posted_voucher_update ON vouchers;
CREATE TRIGGER trg_prevent_posted_voucher_update
BEFORE UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_voucher_update();

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
BEFORE UPDATE OR DELETE ON voucher_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_voucher_line_change();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'party_master'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_party_master
      FOREIGN KEY (party_id) REFERENCES party_master(id)
      ON DELETE SET NULL;

    ALTER TABLE receivables
      ADD CONSTRAINT fk_receivables_party_master
      FOREIGN KEY (party_id) REFERENCES party_master(id)
      ON DELETE RESTRICT;

    ALTER TABLE payables
      ADD CONSTRAINT fk_payables_party_master
      FOREIGN KEY (party_id) REFERENCES party_master(id)
      ON DELETE RESTRICT;

    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_party_master
      FOREIGN KEY (party_id) REFERENCES party_master(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_master'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_vendor_master
      FOREIGN KEY (vendor_id) REFERENCES vendor_master(id)
      ON DELETE SET NULL;

    ALTER TABLE payables
      ADD CONSTRAINT fk_payables_vendor_master
      FOREIGN KEY (vendor_id) REFERENCES vendor_master(id)
      ON DELETE RESTRICT;

    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_vendor_master
      FOREIGN KEY (vendor_id) REFERENCES vendor_master(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dispatch_reports'
  ) THEN
    ALTER TABLE receivables
      ADD CONSTRAINT fk_receivables_dispatch_reports
      FOREIGN KEY (dispatch_report_id) REFERENCES dispatch_reports(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'plant_master'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_plant_master
      FOREIGN KEY (plant_id) REFERENCES plant_master(id)
      ON DELETE SET NULL;

    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_plant_master
      FOREIGN KEY (plant_id) REFERENCES plant_master(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_daily_reports'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_project_reports
      FOREIGN KEY (project_id) REFERENCES project_daily_reports(id)
      ON DELETE SET NULL;

    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_project_reports
      FOREIGN KEY (project_id) REFERENCES project_daily_reports(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) THEN
    ALTER TABLE ledgers
      ADD CONSTRAINT fk_ledgers_vehicles
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      ON DELETE SET NULL;

    ALTER TABLE voucher_lines
      ADD CONSTRAINT fk_voucher_lines_vehicles
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
