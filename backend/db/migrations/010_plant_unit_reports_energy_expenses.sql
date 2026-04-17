-- Extend plant/unit operational reporting for energy and expense capture.

ALTER TABLE crusher_daily_reports
  ADD COLUMN IF NOT EXISTS electricity_kwh NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS electricity_opening_reading NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS electricity_closing_reading NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS diesel_rate_per_litre NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS electricity_rate_per_kwh NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS diesel_cost NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS electricity_cost NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS labour_expense NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS maintenance_expense NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS other_expense NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_expense NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS expense_remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_plant_status_date_desc
  ON crusher_daily_reports(company_id, plant_id, operational_status, report_date DESC, id DESC);
