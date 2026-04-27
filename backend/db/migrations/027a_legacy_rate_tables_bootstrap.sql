-- Bridge migration for fresh databases that already applied the legacy core
-- bootstrap before the rate tables were widened to the expected legacy shape.
-- This must run before 028_party_material_rates_party_fk_fix.sql.

ALTER TABLE public.transport_rates
  ADD COLUMN IF NOT EXISTS plant_id BIGINT,
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT,
  ADD COLUMN IF NOT EXISTS material_id BIGINT,
  ADD COLUMN IF NOT EXISTS rate_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS rate_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS plant_id BIGINT,
  ADD COLUMN IF NOT EXISTS party_id BIGINT,
  ADD COLUMN IF NOT EXISTS material_id BIGINT,
  ADD COLUMN IF NOT EXISTS rate_per_ton NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS royalty_mode VARCHAR(30),
  ADD COLUMN IF NOT EXISTS royalty_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS loading_charge NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
