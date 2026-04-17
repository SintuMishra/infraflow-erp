-- Project report enrichment for practical daily execution review
-- Keeps the module backward compatible by making all new fields optional.

ALTER TABLE project_daily_reports
  ADD COLUMN IF NOT EXISTS shift VARCHAR(20),
  ADD COLUMN IF NOT EXISTS weather VARCHAR(30),
  ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS blockers TEXT,
  ADD COLUMN IF NOT EXISTS next_plan TEXT,
  ADD COLUMN IF NOT EXISTS report_status VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_status_date_desc
  ON project_daily_reports(company_id, report_status, report_date DESC, id DESC);
