ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_rate_unit_check;

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_rate_unit_check
  CHECK (rate_unit IN ('per_ton', 'per_metric_ton', 'per_cft', 'per_brass', 'per_cubic_meter', 'per_trip', 'other'));

ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_material_rate_unit_check;

ALTER TABLE public.dispatch_reports
  ADD CONSTRAINT dispatch_reports_material_rate_unit_check
  CHECK (material_rate_unit IN ('per_ton', 'per_metric_ton', 'per_cft', 'per_brass', 'per_cubic_meter', 'per_trip', 'other'));
