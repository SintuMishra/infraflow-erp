-- Crusher report enrichment for production operations review
-- Keeps new fields optional so rollout stays backward compatible.

ALTER TABLE crusher_daily_reports
  ADD COLUMN IF NOT EXISTS operational_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS breakdown_hours NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS downtime_reason TEXT,
  ADD COLUMN IF NOT EXISTS opening_stock_tons NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS closing_stock_tons NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS operators_count INTEGER,
  ADD COLUMN IF NOT EXISTS maintenance_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_date_desc
  ON crusher_daily_reports(company_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_status_date_desc
  ON crusher_daily_reports(company_id, operational_status, report_date DESC, id DESC);
