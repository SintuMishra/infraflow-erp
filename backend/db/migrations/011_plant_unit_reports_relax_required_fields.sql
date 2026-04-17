-- Allow practical report capture when only part of the plant picture is
-- available at report time.

ALTER TABLE crusher_daily_reports
  ALTER COLUMN shift DROP NOT NULL,
  ALTER COLUMN crusher_unit_name DROP NOT NULL,
  ALTER COLUMN material_type DROP NOT NULL,
  ALTER COLUMN production_tons DROP NOT NULL,
  ALTER COLUMN dispatch_tons DROP NOT NULL,
  ALTER COLUMN machine_hours DROP NOT NULL,
  ALTER COLUMN diesel_used DROP NOT NULL;
