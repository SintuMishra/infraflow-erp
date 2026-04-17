CREATE TABLE IF NOT EXISTS company_billing_invoices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  period_start_date DATE,
  period_end_date DATE,
  due_date DATE,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
  plan_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  billing_status VARCHAR(24) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(24) NOT NULL DEFAULT 'monthly',
  custom_cycle_label VARCHAR(80),
  custom_cycle_days INTEGER,
  subscription_plan VARCHAR(120),
  payment_reference VARCHAR(120),
  payment_terms TEXT,
  notes TEXT,
  generated_by_user_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_billing_invoices_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT chk_company_billing_invoices_currency
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_company_billing_invoices_amounts
    CHECK (
      plan_amount >= 0 AND
      outstanding_amount >= 0 AND
      total_amount >= 0
    ),
  CONSTRAINT chk_company_billing_invoices_dates
    CHECK (
      period_end_date IS NULL OR
      period_start_date IS NULL OR
      period_end_date >= period_start_date
    ),
  CONSTRAINT chk_company_billing_invoices_custom_days
    CHECK (custom_cycle_days IS NULL OR custom_cycle_days BETWEEN 1 AND 365)
);

CREATE INDEX IF NOT EXISTS idx_company_billing_invoices_company_date
  ON company_billing_invoices (company_id, invoice_date DESC, id DESC);

