ALTER TABLE boulder_daily_reports
  ADD COLUMN IF NOT EXISTS shift_id BIGINT REFERENCES shift_master(id),
  ADD COLUMN IF NOT EXISTS crusher_unit_id BIGINT REFERENCES crusher_units(id),
  ADD COLUMN IF NOT EXISTS crusher_unit_name_snapshot VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_shift_date_desc
  ON boulder_daily_reports (company_id, shift_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_unit_date_desc
  ON boulder_daily_reports (company_id, crusher_unit_id, report_date DESC, id DESC);
