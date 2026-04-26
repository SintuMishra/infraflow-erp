BEGIN;

-- Safe, idempotent master-data seed for unit-aware dispatch readiness.
-- This script only inserts missing records. It does not overwrite existing
-- production data, rates, or historical dispatch snapshots.

-- 1. Ensure required global units exist in unit_master.
INSERT INTO public.unit_master (
  company_id,
  unit_code,
  unit_name,
  dimension_type,
  precision_scale,
  is_base_unit,
  is_active
)
SELECT
  NULL::BIGINT,
  seed.unit_code,
  seed.unit_name,
  seed.dimension_type,
  seed.precision_scale,
  seed.is_base_unit,
  TRUE
FROM (
  VALUES
    ('KM', 'Kilometer', 'distance', 2, FALSE),
    ('DAY', 'Day', 'time', 0, FALSE),
    ('LTR', 'Liter', 'volume', 3, FALSE)
) AS seed(unit_code, unit_name, dimension_type, precision_scale, is_base_unit)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.unit_master existing
  WHERE LOWER(BTRIM(existing.unit_code)) = LOWER(BTRIM(seed.unit_code))
);

-- 2. Ensure reusable config options exist for active companies.
-- Existing values are preserved. Only missing options are inserted.
WITH active_companies AS (
  SELECT c.id AS company_id
  FROM public.companies c
  WHERE c.is_active = TRUE
),
seed_options AS (
  SELECT *
  FROM (
    VALUES
      ('material_unit', 'MT', 'MT'),
      ('material_unit', 'KG', 'KG'),
      ('material_unit', 'CFT', 'CFT'),
      ('material_unit', 'CUM', 'CUM'),
      ('material_unit', 'BRASS', 'BRASS'),
      ('material_unit', 'BAG', 'BAG'),
      ('material_unit', 'NOS', 'NOS'),
      ('material_unit', 'TRIP', 'TRIP'),
      ('material_unit', 'LTR', 'LTR'),
      ('material_unit', 'KM', 'KM'),
      ('material_unit', 'DAY', 'DAY'),
      ('material_category', 'Aggregates', 'Aggregates'),
      ('material_category', 'Fine Aggregate', 'Fine Aggregate'),
      ('material_category', 'Sand', 'Sand'),
      ('material_category', 'Cement', 'Cement'),
      ('material_category', 'Bitumen', 'Bitumen'),
      ('material_category', 'Fuel', 'Fuel'),
      ('material_category', 'Admixtures', 'Admixtures'),
      ('vehicle_category', 'Tipper/Hyva', 'Tipper/Hyva'),
      ('vehicle_category', 'Transit Mixer', 'Transit Mixer'),
      ('vehicle_category', 'Excavator', 'Excavator'),
      ('vehicle_category', 'Loader', 'Loader'),
      ('vehicle_category', 'Backhoe Loader', 'Backhoe Loader'),
      ('vehicle_category', 'Road Roller', 'Road Roller'),
      ('vehicle_category', 'Water Truck', 'Water Truck'),
      ('vehicle_category', 'Utility Vehicle', 'Utility Vehicle'),
      ('plant_type', 'Crushing Plant', 'Crushing Plant'),
      ('plant_type', 'Ready-Mix Concrete (RMC)', 'Ready-Mix Concrete (RMC)'),
      ('plant_type', 'Batching Plant', 'Batching Plant'),
      ('plant_type', 'Hot Mix Plant', 'Hot Mix Plant'),
      ('power_source', 'electricity', 'electricity'),
      ('power_source', 'diesel', 'diesel'),
      ('power_source', 'hybrid', 'hybrid')
  ) AS t(config_type, option_label, option_value)
),
missing_options AS (
  SELECT
    ac.company_id,
    so.config_type,
    so.option_label,
    so.option_value,
    COALESCE((
      SELECT MAX(mco.sort_order)
      FROM public.master_config_options mco
      WHERE mco.company_id = ac.company_id
        AND mco.config_type = so.config_type
    ), 0)
    + ROW_NUMBER() OVER (
      PARTITION BY ac.company_id, so.config_type
      ORDER BY so.option_label, so.option_value
    ) AS sort_order
  FROM active_companies ac
  CROSS JOIN seed_options so
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.master_config_options existing
    WHERE existing.company_id = ac.company_id
      AND existing.config_type = so.config_type
      AND (
        LOWER(BTRIM(existing.option_label)) = LOWER(BTRIM(so.option_label))
        OR LOWER(BTRIM(COALESCE(existing.option_value, ''))) = LOWER(BTRIM(so.option_value))
      )
  )
)
INSERT INTO public.master_config_options (
  config_type,
  option_label,
  option_value,
  sort_order,
  is_active,
  company_id
)
SELECT
  mo.config_type,
  mo.option_label,
  mo.option_value,
  mo.sort_order,
  TRUE,
  mo.company_id
FROM missing_options mo;

-- 3. Seed material-wise conversions only for materials with explicit approved factors.
-- No overwrite: if an active conversion already exists for material/from/to, it is preserved.
WITH unit_ids AS (
  SELECT LOWER(BTRIM(unit_code)) AS unit_code_key, id
  FROM public.unit_master
),
material_ids AS (
  SELECT id, company_id, material_name
  FROM public.material_master
  WHERE material_name IN (
    'WMM Material',
    'Aggregate 10mm',
    'Aggregate 20mm',
    'Aggregate 40mm',
    'Crush Sand (M-Sand)',
    'Plaster Sand (P-Sand)',
    'GSB (Granular Sub-Base)',
    'Stone Dust',
    'Dolomite 20mm',
    'Dolomite Boulders',
    'OPC 53 Grade',
    'PPC Cement'
  )
),
seed(material_name, from_unit, to_unit, factor, method, notes) AS (
  VALUES
    ('WMM Material', 'MT', 'CFT', 22.5, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'CFT', 'MT', 0.044444, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'BRASS', 'MT', 4.4444, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'MT', 'BRASS', 0.225, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('WMM Material', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 10mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 20mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 40mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Crush Sand (M-Sand)', 'MT', 'CFT', 20, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'CFT', 'MT', 0.05, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'BRASS', 'MT', 5, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'MT', 'BRASS', 0.2, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crush Sand (M-Sand)', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Plaster Sand (P-Sand)', 'MT', 'CFT', 20, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'CFT', 'MT', 0.05, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'BRASS', 'MT', 5, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'MT', 'BRASS', 0.2, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Plaster Sand (P-Sand)', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('GSB (Granular Sub-Base)', 'MT', 'CFT', 22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'CFT', 'MT', 0.045455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'BRASS', 'MT', 4.5455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'MT', 'BRASS', 0.22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB (Granular Sub-Base)', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Stone Dust', 'MT', 'CFT', 25, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'CFT', 'MT', 0.04, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'BRASS', 'MT', 4, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'MT', 'BRASS', 0.25, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Stone Dust', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Dolomite 20mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite 20mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Dolomite Boulders', 'MT', 'CFT', 21, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'CFT', 'MT', 0.047619, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'BRASS', 'MT', 4.7619, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'MT', 'BRASS', 0.21, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Dolomite Boulders', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('OPC 53 Grade', 'MT', 'BAG', 20, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('OPC 53 Grade', 'BAG', 'MT', 0.05, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('OPC 53 Grade', 'MT', 'KG', 1000, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('OPC 53 Grade', 'KG', 'MT', 0.001, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('PPC Cement', 'MT', 'BAG', 20, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('PPC Cement', 'BAG', 'MT', 0.05, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('PPC Cement', 'MT', 'KG', 1000, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('PPC Cement', 'KG', 'MT', 0.001, 'standard', 'Suggested default; editable as per material density/site agreement.')
)
INSERT INTO public.material_unit_conversions (
  company_id,
  material_id,
  from_unit_id,
  to_unit_id,
  conversion_factor,
  conversion_method,
  effective_from,
  effective_to,
  notes,
  is_active
)
SELECT
  m.company_id,
  m.id,
  fu.id,
  tu.id,
  seed.factor,
  seed.method,
  CURRENT_DATE,
  NULL,
  seed.notes,
  TRUE
FROM seed
JOIN material_ids m
  ON m.material_name = seed.material_name
JOIN unit_ids fu
  ON fu.unit_code_key = LOWER(BTRIM(seed.from_unit))
JOIN unit_ids tu
  ON tu.unit_code_key = LOWER(BTRIM(seed.to_unit))
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_unit_conversions existing
  WHERE existing.material_id = m.id
    AND existing.from_unit_id = fu.id
    AND existing.to_unit_id = tu.id
    AND existing.is_active = TRUE
);

COMMIT;
