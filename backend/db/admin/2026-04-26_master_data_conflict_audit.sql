-- Conflict and audit report for master-data setup.
-- This script does not modify data.

-- 1. Required units missing
SELECT required.unit_code
FROM (
  VALUES ('MT'),('KG'),('TON'),('CFT'),('CUM'),('BRASS'),('BAG'),('NOS'),('TRIP'),('KM'),('DAY'),('LTR')
) AS required(unit_code)
LEFT JOIN public.unit_master u
  ON LOWER(BTRIM(u.unit_code)) = LOWER(BTRIM(required.unit_code))
WHERE u.id IS NULL
ORDER BY required.unit_code;

-- 2. Weight-base inconsistency
SELECT id, unit_code, unit_name, is_base_unit, is_active
FROM public.unit_master
WHERE dimension_type = 'weight'
ORDER BY unit_code;

-- 3. Material conflicts called out in the audit
SELECT id, material_name, material_code, hsn_sac_code, unit, category, gst_rate, is_active
FROM public.material_master
WHERE material_name IN (
  'Aggregate 20mm',
  'Emulsion',
  'OPC 53 Grade',
  'PPC Cement',
  'Stone Dust'
)
ORDER BY material_name;

-- 4. Categories used by materials but not available as config options for the same company
SELECT DISTINCT
  mm.company_id,
  mm.category AS missing_category
FROM public.material_master mm
WHERE mm.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.master_config_options mco
    WHERE mco.company_id = mm.company_id
      AND mco.config_type = 'material_category'
      AND LOWER(BTRIM(mco.option_label)) = LOWER(BTRIM(mm.category))
  )
ORDER BY mm.company_id, mm.category;

-- 5. Active conversions that conflict with suggested defaults
WITH unit_ids AS (
  SELECT LOWER(BTRIM(unit_code)) AS unit_code_key, id
  FROM public.unit_master
),
material_ids AS (
  SELECT id, material_name
  FROM public.material_master
),
seed(material_name, from_unit, to_unit, factor) AS (
  VALUES
    ('WMM Material', 'MT', 'CFT', 22.5),
    ('WMM Material', 'CFT', 'MT', 0.044444),
    ('WMM Material', 'BRASS', 'CFT', 100),
    ('WMM Material', 'CFT', 'BRASS', 0.01),
    ('WMM Material', 'BRASS', 'MT', 4.4444),
    ('WMM Material', 'MT', 'BRASS', 0.225),
    ('Aggregate 10mm', 'MT', 'CFT', 23),
    ('Aggregate 10mm', 'CFT', 'MT', 0.043478),
    ('Aggregate 10mm', 'BRASS', 'CFT', 100),
    ('Aggregate 10mm', 'CFT', 'BRASS', 0.01),
    ('Aggregate 10mm', 'BRASS', 'MT', 4.3478),
    ('Aggregate 10mm', 'MT', 'BRASS', 0.23),
    ('Aggregate 20mm', 'MT', 'CFT', 23),
    ('Aggregate 20mm', 'CFT', 'MT', 0.043478),
    ('Aggregate 20mm', 'BRASS', 'CFT', 100),
    ('Aggregate 20mm', 'CFT', 'BRASS', 0.01),
    ('Aggregate 20mm', 'BRASS', 'MT', 4.3478),
    ('Aggregate 20mm', 'MT', 'BRASS', 0.23),
    ('Aggregate 40mm', 'MT', 'CFT', 23),
    ('Aggregate 40mm', 'CFT', 'MT', 0.043478),
    ('Aggregate 40mm', 'BRASS', 'CFT', 100),
    ('Aggregate 40mm', 'CFT', 'BRASS', 0.01),
    ('Aggregate 40mm', 'BRASS', 'MT', 4.3478),
    ('Aggregate 40mm', 'MT', 'BRASS', 0.23),
    ('Crush Sand (M-Sand)', 'MT', 'CFT', 20),
    ('Crush Sand (M-Sand)', 'CFT', 'MT', 0.05),
    ('Crush Sand (M-Sand)', 'BRASS', 'CFT', 100),
    ('Crush Sand (M-Sand)', 'CFT', 'BRASS', 0.01),
    ('Crush Sand (M-Sand)', 'BRASS', 'MT', 5),
    ('Crush Sand (M-Sand)', 'MT', 'BRASS', 0.2),
    ('Plaster Sand (P-Sand)', 'MT', 'CFT', 20),
    ('Plaster Sand (P-Sand)', 'CFT', 'MT', 0.05),
    ('Plaster Sand (P-Sand)', 'BRASS', 'CFT', 100),
    ('Plaster Sand (P-Sand)', 'CFT', 'BRASS', 0.01),
    ('Plaster Sand (P-Sand)', 'BRASS', 'MT', 5),
    ('Plaster Sand (P-Sand)', 'MT', 'BRASS', 0.2),
    ('GSB (Granular Sub-Base)', 'MT', 'CFT', 22),
    ('GSB (Granular Sub-Base)', 'CFT', 'MT', 0.045455),
    ('GSB (Granular Sub-Base)', 'BRASS', 'CFT', 100),
    ('GSB (Granular Sub-Base)', 'CFT', 'BRASS', 0.01),
    ('GSB (Granular Sub-Base)', 'BRASS', 'MT', 4.5455),
    ('GSB (Granular Sub-Base)', 'MT', 'BRASS', 0.22),
    ('Stone Dust', 'MT', 'CFT', 25),
    ('Stone Dust', 'CFT', 'MT', 0.04),
    ('Stone Dust', 'BRASS', 'CFT', 100),
    ('Stone Dust', 'CFT', 'BRASS', 0.01),
    ('Stone Dust', 'BRASS', 'MT', 4),
    ('Stone Dust', 'MT', 'BRASS', 0.25),
    ('Dolomite 20mm', 'MT', 'CFT', 23),
    ('Dolomite 20mm', 'CFT', 'MT', 0.043478),
    ('Dolomite 20mm', 'BRASS', 'CFT', 100),
    ('Dolomite 20mm', 'CFT', 'BRASS', 0.01),
    ('Dolomite 20mm', 'BRASS', 'MT', 4.3478),
    ('Dolomite 20mm', 'MT', 'BRASS', 0.23),
    ('Dolomite Boulders', 'MT', 'CFT', 21),
    ('Dolomite Boulders', 'CFT', 'MT', 0.047619),
    ('Dolomite Boulders', 'BRASS', 'CFT', 100),
    ('Dolomite Boulders', 'CFT', 'BRASS', 0.01),
    ('Dolomite Boulders', 'BRASS', 'MT', 4.7619),
    ('Dolomite Boulders', 'MT', 'BRASS', 0.21),
    ('OPC 53 Grade', 'MT', 'BAG', 20),
    ('OPC 53 Grade', 'BAG', 'MT', 0.05),
    ('OPC 53 Grade', 'MT', 'KG', 1000),
    ('OPC 53 Grade', 'KG', 'MT', 0.001),
    ('PPC Cement', 'MT', 'BAG', 20),
    ('PPC Cement', 'BAG', 'MT', 0.05),
    ('PPC Cement', 'MT', 'KG', 1000),
    ('PPC Cement', 'KG', 'MT', 0.001)
)
SELECT
  m.material_name,
  seed.from_unit,
  seed.to_unit,
  seed.factor AS suggested_factor,
  existing.conversion_factor AS existing_factor,
  existing.effective_from,
  existing.notes
FROM seed
JOIN material_ids m
  ON m.material_name = seed.material_name
JOIN unit_ids fu
  ON fu.unit_code_key = LOWER(BTRIM(seed.from_unit))
JOIN unit_ids tu
  ON tu.unit_code_key = LOWER(BTRIM(seed.to_unit))
JOIN public.material_unit_conversions existing
  ON existing.material_id = m.id
 AND existing.from_unit_id = fu.id
 AND existing.to_unit_id = tu.id
 AND existing.is_active = TRUE
WHERE ABS(existing.conversion_factor - seed.factor) > 0.000001
ORDER BY m.material_name, seed.from_unit, seed.to_unit;
