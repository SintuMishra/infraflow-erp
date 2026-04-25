ALTER TABLE equipment_logs
  ADD COLUMN IF NOT EXISTS opening_meter_reading NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS closing_meter_reading NUMERIC(10,2);

UPDATE equipment_logs
SET
  opening_meter_reading = COALESCE(opening_meter_reading, 0),
  closing_meter_reading = COALESCE(closing_meter_reading, usage_hours)
WHERE opening_meter_reading IS NULL
   OR closing_meter_reading IS NULL;

ALTER TABLE equipment_logs
  ALTER COLUMN opening_meter_reading SET NOT NULL,
  ALTER COLUMN closing_meter_reading SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_logs_meter_lookup
  ON equipment_logs (
    company_id,
    plant_id,
    lower(trim(equipment_name)),
    lower(trim(equipment_type)),
    usage_date DESC,
    id DESC
  );
