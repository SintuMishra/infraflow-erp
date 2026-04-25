ALTER TABLE equipment_logs
ADD COLUMN IF NOT EXISTS meter_unit VARCHAR(20) NOT NULL DEFAULT 'hours';

UPDATE equipment_logs
SET meter_unit = 'hours'
WHERE meter_unit IS NULL OR BTRIM(meter_unit) = '';

ALTER TABLE equipment_logs
ADD CONSTRAINT chk_equipment_logs_meter_unit
CHECK (meter_unit IN ('hours', 'km'));

CREATE INDEX IF NOT EXISTS idx_equipment_logs_meter_unit
ON equipment_logs (meter_unit);
