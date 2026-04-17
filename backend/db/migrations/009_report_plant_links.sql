-- Link operational reports to real plant records so filtering and ownership
-- stay grounded in the plant master instead of free-text labels alone.

ALTER TABLE crusher_daily_reports
  ADD COLUMN IF NOT EXISTS plant_id BIGINT REFERENCES plant_master(id);

ALTER TABLE project_daily_reports
  ADD COLUMN IF NOT EXISTS plant_id BIGINT REFERENCES plant_master(id);

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_plant_date_desc
  ON crusher_daily_reports(company_id, plant_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_plant_date_desc
  ON project_daily_reports(company_id, plant_id, report_date DESC, id DESC);
