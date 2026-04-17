ALTER TABLE crusher_units
ADD COLUMN IF NOT EXISTS plant_type TEXT;

UPDATE crusher_units
SET plant_type = 'Crusher'
WHERE plant_type IS NULL OR BTRIM(plant_type) = '';
