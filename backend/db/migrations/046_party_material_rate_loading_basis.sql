ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS loading_charge_basis VARCHAR(24) NOT NULL DEFAULT 'fixed';

UPDATE public.party_material_rates
SET
  loading_charge_basis = CASE
    WHEN COALESCE(loading_charge, 0) = 0 THEN 'none'
    ELSE COALESCE(NULLIF(loading_charge_basis, ''), 'fixed')
  END;

ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_loading_charge_basis_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_loading_charge_basis_check
  CHECK (loading_charge_basis IN ('none', 'fixed', 'per_ton', 'per_brass', 'per_trip'));

ALTER TABLE public.dispatch_reports
  ADD COLUMN IF NOT EXISTS loading_charge_basis VARCHAR(24) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS loading_charge_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS loading_charge_is_manual BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.dispatch_reports
SET
  loading_charge_basis = CASE
    WHEN COALESCE(loading_charge, 0) = 0 THEN 'none'
    ELSE COALESCE(NULLIF(loading_charge_basis, ''), 'fixed')
  END,
  loading_charge_rate = COALESCE(loading_charge_rate, loading_charge),
  loading_charge_is_manual = COALESCE(loading_charge_is_manual, FALSE);

ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_loading_charge_basis_check;

ALTER TABLE public.dispatch_reports
  ADD CONSTRAINT dispatch_reports_loading_charge_basis_check
  CHECK (loading_charge_basis IN ('none', 'fixed', 'per_ton', 'per_brass', 'per_trip'));
