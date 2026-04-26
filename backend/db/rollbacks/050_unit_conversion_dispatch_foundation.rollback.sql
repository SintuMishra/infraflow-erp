DROP INDEX IF EXISTS public.idx_dispatch_reports_transport_unit_id_snapshot;
DROP INDEX IF EXISTS public.idx_dispatch_reports_billing_unit_id_snapshot;
DROP INDEX IF EXISTS public.idx_dispatch_reports_quantity_source;
DROP INDEX IF EXISTS public.idx_dispatch_reports_conversion_id;
DROP INDEX IF EXISTS public.idx_dispatch_reports_entered_unit_id;

ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_transport_basis_snapshot_check,
  DROP CONSTRAINT IF EXISTS dispatch_reports_billing_basis_snapshot_check,
  DROP CONSTRAINT IF EXISTS dispatch_reports_conversion_method_snapshot_check,
  DROP CONSTRAINT IF EXISTS dispatch_reports_quantity_source_check,
  DROP COLUMN IF EXISTS conversion_notes_snapshot,
  DROP COLUMN IF EXISTS transport_quantity_snapshot,
  DROP COLUMN IF EXISTS transport_unit_id_snapshot,
  DROP COLUMN IF EXISTS transport_basis_snapshot,
  DROP COLUMN IF EXISTS billed_rate_snapshot,
  DROP COLUMN IF EXISTS billed_quantity_snapshot,
  DROP COLUMN IF EXISTS billing_unit_id_snapshot,
  DROP COLUMN IF EXISTS billing_basis_snapshot,
  DROP COLUMN IF EXISTS source_vehicle_capacity_unit_id,
  DROP COLUMN IF EXISTS source_vehicle_capacity_tons,
  DROP COLUMN IF EXISTS conversion_method_snapshot,
  DROP COLUMN IF EXISTS conversion_id,
  DROP COLUMN IF EXISTS conversion_factor_to_ton,
  DROP COLUMN IF EXISTS quantity_source,
  DROP COLUMN IF EXISTS entered_unit_id,
  DROP COLUMN IF EXISTS entered_quantity;

DROP INDEX IF EXISTS public.idx_party_master_default_dispatch_unit_id;

ALTER TABLE public.party_master
  DROP CONSTRAINT IF EXISTS party_master_dispatch_quantity_mode_check,
  DROP COLUMN IF EXISTS allow_manual_dispatch_conversion,
  DROP COLUMN IF EXISTS default_dispatch_unit_id,
  DROP COLUMN IF EXISTS dispatch_quantity_mode;

DROP INDEX IF EXISTS public.idx_transport_rates_rate_unit_id;

ALTER TABLE public.transport_rates
  DROP CONSTRAINT IF EXISTS transport_rates_billing_basis_check,
  DROP COLUMN IF EXISTS minimum_charge,
  DROP COLUMN IF EXISTS billing_basis,
  DROP COLUMN IF EXISTS rate_unit_id;

DROP INDEX IF EXISTS public.idx_party_material_rates_conversion_id;
DROP INDEX IF EXISTS public.idx_party_material_rates_rate_unit_id;

ALTER TABLE public.party_material_rates
  DROP CONSTRAINT IF EXISTS party_material_rates_billing_basis_check,
  DROP COLUMN IF EXISTS price_per_unit,
  DROP COLUMN IF EXISTS conversion_id,
  DROP COLUMN IF EXISTS billing_basis,
  DROP COLUMN IF EXISTS rate_unit_id;

DROP INDEX IF EXISTS public.idx_material_unit_conversions_company;
DROP INDEX IF EXISTS public.idx_material_unit_conversions_material;
DROP INDEX IF EXISTS public.uq_material_unit_conversion_effective;

DROP TABLE IF EXISTS public.material_unit_conversions;

DROP INDEX IF EXISTS public.idx_unit_master_dimension_type;
DROP INDEX IF EXISTS public.idx_unit_master_company_id;
DROP INDEX IF EXISTS public.uq_unit_master_company_name;
DROP INDEX IF EXISTS public.uq_unit_master_company_code;

DROP TABLE IF EXISTS public.unit_master;
