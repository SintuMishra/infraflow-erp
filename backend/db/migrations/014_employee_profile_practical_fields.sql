-- Add practical optional employee profile fields for production operations.
-- Keeps onboarding lightweight while supporting HR-grade records.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS id_proof_type TEXT,
  ADD COLUMN IF NOT EXISTS id_proof_number VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_employees_email_normalized
  ON employees (LOWER(BTRIM(email)));

CREATE INDEX IF NOT EXISTS idx_employees_employment_type
  ON employees (employment_type);
