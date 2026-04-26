BEGIN;

-- Safe, idempotent aggregate material expansion for staging/admin use.
-- Does not overwrite existing material records.
-- Adds commonly used aggregate variants with editable master fields only.

-- 1. Seed aggregate materials for active non-system companies.
WITH target_companies AS (
  SELECT c.id AS company_id
  FROM public.companies c
  WHERE c.is_active = TRUE
    AND c.company_code <> 'SINSOFTWARE_SOLUTIONS'
),
seed AS (
  SELECT *
  FROM (
    VALUES
      ('Aggregate 6mm', 'AGG-06', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 6mm VSI', 'AGG-06-VSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 6mm Non-VSI', 'AGG-06-NVSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 10mm VSI', 'AGG-10-VSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 10mm Non-VSI', 'AGG-10-NVSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 20mm VSI', 'AGG-20-VSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 20mm Non-VSI', 'AGG-20-NVSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 40mm VSI', 'AGG-40-VSI', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 40mm Non-VSI', 'AGG-40-NVSI', 'Aggregates', 'MT', '2517', 5.00)
  ) AS t(material_name, material_code, category, unit, hsn_sac_code, gst_rate)
)
INSERT INTO public.material_master (
  material_name,
  material_code,
  category,
  unit,
  is_active,
  gst_rate,
  company_id,
  hsn_sac_code
)
SELECT
  seed.material_name,
  seed.material_code,
  seed.category,
  seed.unit,
  TRUE,
  seed.gst_rate,
  tc.company_id,
  seed.hsn_sac_code
FROM target_companies tc
CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_master existing
  WHERE LOWER(BTRIM(existing.material_name)) = LOWER(BTRIM(seed.material_name))
     OR LOWER(BTRIM(COALESCE(existing.material_code, ''))) = LOWER(BTRIM(seed.material_code))
);

-- 2. Seed default conversions for the aggregate family.
-- These use the same editable default factors as the current aggregate 10/20/40 setup.
WITH unit_ids AS (
  SELECT LOWER(BTRIM(unit_code)) AS unit_code_key, id
  FROM public.unit_master
),
material_ids AS (
  SELECT id, company_id, material_name
  FROM public.material_master
  WHERE material_name IN (
    'Aggregate 6mm',
    'Aggregate 6mm VSI',
    'Aggregate 6mm Non-VSI',
    'Aggregate 10mm VSI',
    'Aggregate 10mm Non-VSI',
    'Aggregate 20mm VSI',
    'Aggregate 20mm Non-VSI',
    'Aggregate 40mm VSI',
    'Aggregate 40mm Non-VSI'
  )
),
seed(material_name, from_unit, to_unit, factor, method, notes) AS (
  VALUES
    ('Aggregate 6mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 6mm VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 6mm Non-VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 6mm Non-VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 10mm VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 10mm Non-VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 10mm Non-VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 20mm VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 20mm Non-VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 20mm Non-VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 40mm VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 40mm Non-VSI', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 40mm Non-VSI', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.')
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
