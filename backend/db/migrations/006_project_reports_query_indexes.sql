-- Project report query performance hardening
-- Supports company-scoped reporting filters for date, project, and site slices.

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_date_desc
  ON project_daily_reports(company_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_project_date_desc
  ON project_daily_reports(company_id, project_name, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_site_date_desc
  ON project_daily_reports(company_id, site_name, report_date DESC, id DESC);
