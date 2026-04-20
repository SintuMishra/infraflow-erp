ALTER TABLE boulder_daily_reports
  ADD COLUMN IF NOT EXISTS vehicle_runs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE boulder_daily_reports
  DROP CONSTRAINT IF EXISTS boulder_daily_reports_route_type_check;

ALTER TABLE boulder_daily_reports
  ADD CONSTRAINT boulder_daily_reports_route_type_check
    CHECK (route_type IN ('to_stock_yard', 'direct_to_crushing_hub', 'mixed'));

ALTER TABLE boulder_daily_reports
  DROP CONSTRAINT IF EXISTS boulder_daily_reports_vehicle_runs_array_check;

ALTER TABLE boulder_daily_reports
  ADD CONSTRAINT boulder_daily_reports_vehicle_runs_array_check
    CHECK (jsonb_typeof(vehicle_runs) = 'array');
