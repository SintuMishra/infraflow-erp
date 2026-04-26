BEGIN;

-- Staging-only sample rates for unit-aware dispatch UAT.
-- Do NOT run on production without explicit approval.
-- This script inserts only when the exact sample row does not already exist.
-- It does not update or deactivate existing rates.

-- Recommended scope in the current DB:
-- company_id = 2
-- party_id = 40  -> Lloyds Metals and Energy Ltd (Ghugus)
-- vendor_id = 9  -> Jungari Transport
-- plant_id = 4   -> Stone Crusher Plant

-- 1. Party material rate samples using new unit-aware fields
WITH ids AS (
  SELECT
    2::BIGINT AS company_id,
    40::BIGINT AS party_id,
    4::BIGINT AS plant_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'WMM Material') AS wmm_material_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'Crush Sand (M-Sand)') AS msand_material_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'Aggregate 20mm') AS agg20_material_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'Stone Dust') AS dust_material_id,
    (SELECT id FROM public.unit_master WHERE unit_code = 'MT') AS mt_unit_id,
    (SELECT id FROM public.unit_master WHERE unit_code = 'CFT') AS cft_unit_id,
    (SELECT id FROM public.unit_master WHERE unit_code = 'BRASS') AS brass_unit_id
),
seed AS (
  SELECT
    company_id,
    party_id,
    plant_id,
    wmm_material_id AS material_id,
    900.00::NUMERIC(12,2) AS rate_per_ton,
    'per_ton'::VARCHAR(30) AS billing_basis,
    mt_unit_id AS rate_unit_id,
    900.00::NUMERIC(12,2) AS price_per_unit,
    'per_ton'::VARCHAR(40) AS rate_unit,
    'MT'::VARCHAR(40) AS rate_unit_label,
    1.0000::NUMERIC(12,4) AS rate_units_per_ton,
    'per_brass'::VARCHAR(30) AS royalty_mode,
    800.00::NUMERIC(12,2) AS royalty_value,
    0.00::NUMERIC(12,2) AS loading_charge,
    'none'::VARCHAR(30) AS loading_charge_basis
  FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, wmm_material_id, 0, 'per_unit', cft_unit_id, 38.00, 'per_cft', 'CFT', 22.5000, 'per_brass', 800.00, 0.00, 'none' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, wmm_material_id, 0, 'per_unit', brass_unit_id, 3600.00, 'per_brass', 'BRASS', 0.2250, 'per_brass', 800.00, 0.00, 'none' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, msand_material_id, 1000.00, 'per_ton', mt_unit_id, 1000.00, 'per_ton', 'MT', 1.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, msand_material_id, 0, 'per_unit', cft_unit_id, 45.00, 'per_cft', 'CFT', 20.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, msand_material_id, 0, 'per_unit', brass_unit_id, 4200.00, 'per_brass', 'BRASS', 0.2000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, agg20_material_id, 950.00, 'per_ton', mt_unit_id, 950.00, 'per_ton', 'MT', 1.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, agg20_material_id, 0, 'per_unit', cft_unit_id, 42.00, 'per_cft', 'CFT', 23.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, dust_material_id, 700.00, 'per_ton', mt_unit_id, 700.00, 'per_ton', 'MT', 1.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
  UNION ALL
  SELECT company_id, party_id, plant_id, dust_material_id, 0, 'per_unit', cft_unit_id, 30.00, 'per_cft', 'CFT', 25.0000, 'per_brass', 600.00, 35.00, 'fixed' FROM ids
)
INSERT INTO public.party_material_rates (
  plant_id,
  party_id,
  material_id,
  rate_per_ton,
  royalty_mode,
  royalty_value,
  loading_charge,
  notes,
  is_active,
  company_id,
  tons_per_brass,
  rate_unit,
  rate_unit_label,
  rate_units_per_ton,
  effective_from,
  loading_charge_basis,
  rate_unit_id,
  billing_basis,
  conversion_id,
  price_per_unit
)
SELECT
  seed.plant_id,
  seed.party_id,
  seed.material_id,
  seed.rate_per_ton,
  seed.royalty_mode,
  seed.royalty_value,
  seed.loading_charge,
  'Staging UAT sample rate; editable from UI.' AS notes,
  TRUE,
  seed.company_id,
  CASE WHEN seed.billing_basis = 'per_unit' AND seed.rate_unit_label = 'BRASS' THEN 4.4444 ELSE NULL END,
  seed.rate_unit,
  seed.rate_unit_label,
  seed.rate_units_per_ton,
  CURRENT_DATE,
  seed.loading_charge_basis,
  seed.rate_unit_id,
  seed.billing_basis,
  NULL,
  seed.price_per_unit
FROM seed
WHERE seed.material_id IS NOT NULL
  AND seed.rate_unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates existing
    WHERE existing.company_id = seed.company_id
      AND existing.party_id = seed.party_id
      AND existing.plant_id = seed.plant_id
      AND existing.material_id = seed.material_id
      AND COALESCE(existing.billing_basis, '') = seed.billing_basis
      AND COALESCE(existing.rate_unit_id, 0) = seed.rate_unit_id
      AND COALESCE(existing.price_per_unit, -1) = seed.price_per_unit
      AND existing.is_active = TRUE
  );

-- 2. Transport rate samples using new unit-aware fields
WITH ids AS (
  SELECT
    2::BIGINT AS company_id,
    9::BIGINT AS vendor_id,
    4::BIGINT AS plant_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'WMM Material') AS wmm_material_id,
    (SELECT id FROM public.material_master WHERE company_id = 2 AND material_name = 'Aggregate 20mm') AS agg20_material_id,
    (SELECT id FROM public.unit_master WHERE unit_code = 'MT') AS mt_unit_id,
    (SELECT id FROM public.unit_master WHERE unit_code = 'CFT') AS cft_unit_id
),
seed AS (
  SELECT company_id, vendor_id, plant_id, wmm_material_id AS material_id, 'per_trip'::VARCHAR(30) AS billing_basis, NULL::BIGINT AS rate_unit_id, 5500.00::NUMERIC(12,2) AS rate_value, NULL::NUMERIC(12,2) AS distance_km, NULL::NUMERIC(12,2) AS minimum_charge FROM ids
  UNION ALL
  SELECT company_id, vendor_id, plant_id, agg20_material_id, 'per_ton', mt_unit_id, 180.00, NULL, NULL FROM ids
  UNION ALL
  SELECT company_id, vendor_id, plant_id, wmm_material_id, 'per_unit', cft_unit_id, 10.00, NULL, NULL FROM ids
  UNION ALL
  SELECT company_id, vendor_id, plant_id, agg20_material_id, 'per_km', NULL, 80.00, 25.00, NULL FROM ids
  UNION ALL
  SELECT company_id, vendor_id, plant_id, wmm_material_id, 'per_day', NULL, 8000.00, NULL, NULL FROM ids
  UNION ALL
  SELECT company_id, vendor_id, plant_id, agg20_material_id, 'per_trip', NULL, 5500.00, NULL, 6000.00 FROM ids
)
INSERT INTO public.transport_rates (
  plant_id,
  vendor_id,
  material_id,
  rate_type,
  rate_value,
  distance_km,
  is_active,
  company_id,
  rate_unit_id,
  billing_basis,
  minimum_charge
)
SELECT
  seed.plant_id,
  seed.vendor_id,
  seed.material_id,
  seed.billing_basis,
  seed.rate_value,
  seed.distance_km,
  TRUE,
  seed.company_id,
  seed.rate_unit_id,
  seed.billing_basis,
  seed.minimum_charge
FROM seed
WHERE seed.material_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.transport_rates existing
    WHERE existing.company_id = seed.company_id
      AND existing.vendor_id = seed.vendor_id
      AND existing.plant_id = seed.plant_id
      AND existing.material_id = seed.material_id
      AND COALESCE(existing.billing_basis, '') = seed.billing_basis
      AND COALESCE(existing.rate_unit_id, 0) = COALESCE(seed.rate_unit_id, 0)
      AND COALESCE(existing.minimum_charge, -1) = COALESCE(seed.minimum_charge, -1)
      AND existing.rate_value = seed.rate_value
      AND existing.is_active = TRUE
  );

COMMIT;
