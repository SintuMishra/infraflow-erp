ALTER TABLE material_master
ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT;

CREATE INDEX IF NOT EXISTS idx_material_master_hsn_sac_code
ON material_master (hsn_sac_code);
