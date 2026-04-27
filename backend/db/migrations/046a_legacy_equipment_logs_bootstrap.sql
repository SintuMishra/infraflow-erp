-- Bridge migration for fresh databases that applied the initial legacy
-- bootstrap before equipment_logs was widened to the expected operational
-- shape. This must run before 047_equipment_log_meter_readings.sql.

ALTER TABLE public.equipment_logs
  ADD COLUMN IF NOT EXISTS usage_date DATE,
  ADD COLUMN IF NOT EXISTS equipment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS equipment_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS site_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS usage_hours NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS fuel_used NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS created_by BIGINT,
  ADD COLUMN IF NOT EXISTS plant_id BIGINT;

UPDATE public.equipment_logs
SET usage_date = COALESCE(usage_date, log_date)
WHERE usage_date IS NULL;
