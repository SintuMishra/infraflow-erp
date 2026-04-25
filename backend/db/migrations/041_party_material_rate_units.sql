ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS rate_unit VARCHAR(30) NOT NULL DEFAULT 'per_ton',
  ADD COLUMN IF NOT EXISTS rate_unit_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS rate_units_per_ton NUMERIC(12,4) NOT NULL DEFAULT 1;

UPDATE public.party_material_rates
SET
  rate_unit = COALESCE(NULLIF(rate_unit, ''), 'per_ton'),
  rate_unit_label = COALESCE(NULLIF(rate_unit_label, ''), 'ton'),
  rate_units_per_ton = COALESCE(NULLIF(rate_units_per_ton, 0), 1);

ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_rate_unit_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_rate_unit_check
  CHECK (rate_unit IN ('per_ton', 'per_metric_ton', 'per_cft', 'per_brass', 'per_cubic_meter', 'per_trip', 'other'));

ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_rate_units_per_ton_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_rate_units_per_ton_check
  CHECK (rate_units_per_ton > 0);

ALTER TABLE public.dispatch_reports
  ADD COLUMN IF NOT EXISTS material_rate_unit VARCHAR(30) NOT NULL DEFAULT 'per_ton',
  ADD COLUMN IF NOT EXISTS material_rate_unit_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS material_rate_units_per_ton NUMERIC(12,4) NOT NULL DEFAULT 1;

UPDATE public.dispatch_reports
SET
  material_rate_unit = COALESCE(NULLIF(material_rate_unit, ''), 'per_ton'),
  material_rate_unit_label = COALESCE(NULLIF(material_rate_unit_label, ''), 'ton'),
  material_rate_units_per_ton = COALESCE(NULLIF(material_rate_units_per_ton, 0), 1);

ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_material_rate_unit_check;

ALTER TABLE public.dispatch_reports
  ADD CONSTRAINT dispatch_reports_material_rate_unit_check
  CHECK (material_rate_unit IN ('per_ton', 'per_metric_ton', 'per_cft', 'per_brass', 'per_cubic_meter', 'per_trip', 'other'));

ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_material_rate_units_per_ton_check;

ALTER TABLE public.dispatch_reports
  ADD CONSTRAINT dispatch_reports_material_rate_units_per_ton_check
  CHECK (material_rate_units_per_ton > 0);
