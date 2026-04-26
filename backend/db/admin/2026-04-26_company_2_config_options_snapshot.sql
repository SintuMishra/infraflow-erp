BEGIN;

-- Snapshot of current config-option state for:
-- company_id = 2
-- company_name = Gajanan Global Construction LLP
--
-- Purpose:
-- Preserve the currently fed client-company dropdown data in version control.
-- This script is intentionally conservative:
-- 1. update matching company/type/value rows to the captured label/order/active state
-- 2. insert rows that are missing
-- 3. never delete rows
-- 4. never overwrite other companies

WITH snapshot(config_type, sort_order, option_label, option_value, is_active) AS (
  VALUES
    ('material_category', 1, 'Aggregates', 'AGTS', TRUE),
    ('material_category', 2, 'Admixtures', 'ADMXT', TRUE),
    ('material_category', 3, 'Bitumen', 'BITM', TRUE),
    ('material_category', 4, 'Cement', 'CEMT', TRUE),
    ('material_category', 5, 'Sand', 'SAND', TRUE),
    ('material_category', 6, 'Fuel', 'FUEL', TRUE),
    ('material_category', 7, 'Fine Aggregate', 'Fine Aggregate', TRUE),
    ('material_unit', 1, 'Metric Ton (MT)', 'MT', TRUE),
    ('material_unit', 2, 'Brass (BRASS)', 'BRASS', TRUE),
    ('material_unit', 3, 'Cubic Meter (CUM)', 'CUM', TRUE),
    ('material_unit', 4, 'Kilogram (KG)', 'KG', TRUE),
    ('material_unit', 5, 'Liter (LTR)', 'LTR', TRUE),
    ('material_unit', 6, 'Bags (Legacy BGS)', 'BGS', TRUE),
    ('material_unit', 7, 'Bag', 'BAG', TRUE),
    ('material_unit', 8, 'CFT', 'CFT', TRUE),
    ('material_unit', 9, 'DAY', 'DAY', TRUE),
    ('material_unit', 10, 'KM', 'KM', TRUE),
    ('material_unit', 11, 'NOS', 'NOS', TRUE),
    ('material_unit', 12, 'TRIP', 'TRIP', TRUE),
    ('plant_type', 1, 'Crushing Plant', 'CP', TRUE),
    ('plant_type', 2, 'Ready-Mix Concrete (RMC)', 'RMC', TRUE),
    ('plant_type', 3, 'Batching Plant', 'BP', TRUE),
    ('plant_type', 4, 'Hot Mix Plant', 'HMP', TRUE),
    ('power_source', 1, 'Electricity (Grid)', 'EGRID', FALSE),
    ('power_source', 2, 'DG Set (Generator)', 'DG SET', FALSE),
    ('power_source', 3, 'Hybrid (Grid/DG)', 'HYBRID', TRUE),
    ('power_source', 4, 'diesel', 'diesel', TRUE),
    ('power_source', 5, 'electricity', 'electricity', TRUE),
    ('power_source', 6, 'electric', 'electric', TRUE),
    ('vehicle_category', 1, 'Transit Mixer', 'TM', TRUE),
    ('vehicle_category', 2, 'Tipper/Hyva', 'TPR/HVA', TRUE),
    ('vehicle_category', 3, 'Bulldozer', 'BLDZ', TRUE),
    ('vehicle_category', 4, 'Excavator', 'EXVTR', TRUE),
    ('vehicle_category', 5, 'Loader', 'LDR', TRUE),
    ('vehicle_category', 6, 'Tanker', 'TNKR', TRUE),
    ('vehicle_category', 7, 'Motor Grader', 'MG', TRUE),
    ('vehicle_category', 8, 'Backhoe Loader', 'BACKL', TRUE),
    ('vehicle_category', 9, 'Scraper', 'SCPR', TRUE),
    ('vehicle_category', 10, 'Road Roller (Compactor)', 'RRC', TRUE),
    ('vehicle_category', 11, 'Asphalt Paver', 'PAVER', TRUE),
    ('vehicle_category', 12, 'Cold Planer (Miller)', 'MILLER', TRUE),
    ('vehicle_category', 13, 'Pick & Carry Crane (Hydra)', 'HYDRA', TRUE),
    ('vehicle_category', 14, 'Water Truck', 'WT', TRUE),
    ('vehicle_category', 15, 'Utility Vehicle', 'Utility Vehicle', TRUE),
    ('vehicle_category', 16, 'Road Roller', 'Road Roller', TRUE)
),
updated AS (
  UPDATE public.master_config_options mco
  SET
    option_label = s.option_label,
    sort_order = s.sort_order,
    is_active = s.is_active,
    updated_at = CURRENT_TIMESTAMP
  FROM snapshot s
  WHERE mco.company_id = 2
    AND mco.config_type = s.config_type
    AND LOWER(BTRIM(COALESCE(mco.option_value, ''))) = LOWER(BTRIM(s.option_value))
  RETURNING mco.config_type, mco.option_value
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
  s.config_type,
  s.option_label,
  s.option_value,
  s.sort_order,
  s.is_active,
  2
FROM snapshot s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.master_config_options existing
  WHERE existing.company_id = 2
    AND existing.config_type = s.config_type
    AND LOWER(BTRIM(COALESCE(existing.option_value, ''))) = LOWER(BTRIM(s.option_value))
);

COMMIT;
