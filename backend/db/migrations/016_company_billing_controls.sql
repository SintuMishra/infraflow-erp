CREATE TABLE IF NOT EXISTS company_billing_controls (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL UNIQUE,
  billing_status VARCHAR(24) NOT NULL DEFAULT 'active',
  subscription_plan VARCHAR(120),
  billing_cycle VARCHAR(24) NOT NULL DEFAULT 'monthly',
  plan_amount NUMERIC(12, 2),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
  outstanding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  next_due_date DATE,
  grace_until_date DATE,
  last_payment_date DATE,
  payment_reference VARCHAR(120),
  payment_terms TEXT,
  internal_notes TEXT,
  updated_by_user_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_billing_controls_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT chk_company_billing_status
    CHECK (billing_status IN ('trial', 'active', 'overdue', 'grace', 'on_hold', 'suspended', 'closed')),
  CONSTRAINT chk_company_billing_cycle
    CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom')),
  CONSTRAINT chk_company_billing_plan_amount
    CHECK (plan_amount IS NULL OR plan_amount >= 0),
  CONSTRAINT chk_company_billing_outstanding_amount
    CHECK (outstanding_amount >= 0),
  CONSTRAINT chk_company_billing_currency
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_company_billing_grace_window
    CHECK (grace_until_date IS NULL OR next_due_date IS NULL OR grace_until_date >= next_due_date)
);

CREATE INDEX IF NOT EXISTS idx_company_billing_controls_status_due
  ON company_billing_controls (billing_status, next_due_date);

CREATE INDEX IF NOT EXISTS idx_company_billing_controls_company
  ON company_billing_controls (company_id);
