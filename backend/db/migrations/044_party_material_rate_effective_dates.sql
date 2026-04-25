ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS effective_from DATE;

UPDATE public.party_material_rates
SET effective_from = COALESCE(effective_from, CURRENT_DATE)
WHERE effective_from IS NULL;

ALTER TABLE public.party_material_rates
  ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE;

ALTER TABLE public.party_material_rates
  ALTER COLUMN effective_from SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_material_rates_effective_lookup
  ON public.party_material_rates (
    company_id,
    plant_id,
    party_id,
    material_id,
    is_active,
    effective_from DESC,
    id DESC
  );
