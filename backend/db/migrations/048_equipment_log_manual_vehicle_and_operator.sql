ALTER TABLE equipment_logs
  ADD COLUMN IF NOT EXISTS manual_vehicle_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS driver_operator_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_manual_vehicle
  ON equipment_logs (
    company_id,
    lower(trim(manual_vehicle_number))
  );
