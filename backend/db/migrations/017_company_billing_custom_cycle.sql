ALTER TABLE company_billing_controls
  ADD COLUMN IF NOT EXISTS custom_cycle_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS custom_cycle_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_company_billing_custom_cycle_days'
  ) THEN
    ALTER TABLE company_billing_controls
      ADD CONSTRAINT chk_company_billing_custom_cycle_days
      CHECK (custom_cycle_days IS NULL OR custom_cycle_days BETWEEN 1 AND 365);
  END IF;
END $$;

