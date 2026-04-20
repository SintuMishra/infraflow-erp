ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_royalty_mode_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_royalty_mode_check
  CHECK (royalty_mode IN ('per_ton', 'per_brass', 'fixed', 'none'));

ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_tons_per_brass_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_tons_per_brass_check
  CHECK (
    tons_per_brass IS NULL
    OR tons_per_brass > 0
  );
