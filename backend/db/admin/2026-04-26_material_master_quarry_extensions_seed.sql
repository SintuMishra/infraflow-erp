BEGIN;

-- Safe, idempotent quarry material extension pack.
-- Adds commonly used optional quarry/commercial materials without overwriting
-- existing data. All values remain editable from the UI.

-- 1. Seed optional quarry materials into existing sections/categories.
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
      ('Aggregate 12mm', 'AGG-12', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 25mm', 'AGG-25', 'Aggregates', 'MT', '2517', 5.00),
      ('Aggregate 63mm', 'AGG-63', 'Aggregates', 'MT', '2517', 5.00),
      ('Crusher Dust', 'CRDUST', 'Fine Aggregate', 'MT', '2517', 5.00),
      ('Murum', 'MURUM', 'Aggregates', 'MT', '2517', 5.00),
      ('Screened Metal', 'SCR-MET', 'Aggregates', 'MT', '2517', 5.00),
      ('GSB Grade 1', 'GSB-G1', 'Aggregates', 'MT', '2517', 5.00),
      ('GSB Grade 2', 'GSB-G2', 'Aggregates', 'MT', '2517', 5.00),
      ('GSB Grade 3', 'GSB-G3', 'Aggregates', 'MT', '2517', 5.00)
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

-- 2. Seed default conversions by matching each material to an established family.
WITH unit_ids AS (
  SELECT LOWER(BTRIM(unit_code)) AS unit_code_key, id
  FROM public.unit_master
),
material_ids AS (
  SELECT id, company_id, material_name
  FROM public.material_master
  WHERE material_name IN (
    'Aggregate 12mm',
    'Aggregate 25mm',
    'Aggregate 63mm',
    'Crusher Dust',
    'Murum',
    'Screened Metal',
    'GSB Grade 1',
    'GSB Grade 2',
    'GSB Grade 3'
  )
),
seed(material_name, from_unit, to_unit, factor, method, notes) AS (
  VALUES
    -- Aggregate-family defaults
    ('Aggregate 12mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 12mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 25mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 25mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Aggregate 63mm', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Aggregate 63mm', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('Screened Metal', 'MT', 'CFT', 23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'CFT', 'MT', 0.043478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'BRASS', 'MT', 4.3478, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'MT', 'BRASS', 0.23, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Screened Metal', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    -- Fine aggregate / dust-family defaults
    ('Crusher Dust', 'MT', 'CFT', 25, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'CFT', 'MT', 0.04, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'BRASS', 'MT', 4, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'MT', 'BRASS', 0.25, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Crusher Dust', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    -- GSB / sub-base family defaults
    ('GSB Grade 1', 'MT', 'CFT', 22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'CFT', 'MT', 0.045455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'BRASS', 'MT', 4.5455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'MT', 'BRASS', 0.22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 1', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('GSB Grade 2', 'MT', 'CFT', 22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'CFT', 'MT', 0.045455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'BRASS', 'MT', 4.5455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'MT', 'BRASS', 0.22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 2', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    ('GSB Grade 3', 'MT', 'CFT', 22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'CFT', 'MT', 0.045455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'BRASS', 'MT', 4.5455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'MT', 'BRASS', 0.22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('GSB Grade 3', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.'),

    -- Murum defaults aligned with GSB/sub-base family as a starting point
    ('Murum', 'MT', 'CFT', 22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'CFT', 'MT', 0.045455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'BRASS', 'CFT', 100, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'CFT', 'BRASS', 0.01, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'BRASS', 'MT', 4.5455, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'MT', 'BRASS', 0.22, 'density_based', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'CUM', 'CFT', 35.3147, 'standard', 'Suggested default; editable as per material density/site agreement.'),
    ('Murum', 'CFT', 'CUM', 0.028317, 'standard', 'Suggested default; editable as per material density/site agreement.')
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
