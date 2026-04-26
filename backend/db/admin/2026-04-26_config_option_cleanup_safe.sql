BEGIN;

-- Safe cleanup for confusing dropdown/config options.
-- Scope: company_id = 2
-- Strategy:
-- 1. add only missing active choices that match actual stored values
-- 2. clarify legacy labels instead of deleting them
-- 3. deactivate verbose legacy power-source options only if they are unused

-- Add missing power source option used by live crusher data.
INSERT INTO public.master_config_options (
  config_type,
  option_label,
  option_value,
  sort_order,
  is_active,
  company_id
)
SELECT
  'power_source',
  'electric',
  'electric',
  COALESCE((
    SELECT MAX(sort_order)
    FROM public.master_config_options
    WHERE company_id = 2
      AND config_type = 'power_source'
  ), 0) + 1,
  TRUE,
  2
WHERE NOT EXISTS (
  SELECT 1
  FROM public.master_config_options
  WHERE company_id = 2
    AND config_type = 'power_source'
    AND LOWER(BTRIM(option_value)) = 'electric'
);

-- Clarify legacy material-unit labels without changing their stored values.
UPDATE public.master_config_options
SET option_label = 'Bags (Legacy BGS)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'BGS'
  AND option_label = 'Bags';

UPDATE public.master_config_options
SET option_label = 'Bag', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'BAG'
  AND option_label = 'BAG';

UPDATE public.master_config_options
SET option_label = 'Metric Ton (MT)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'MT'
  AND option_label = 'MT (Metric Tonne)';

UPDATE public.master_config_options
SET option_label = 'Kilogram (KG)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'KG'
  AND option_label = 'Kg';

UPDATE public.master_config_options
SET option_label = 'Cubic Meter (CUM)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'CUM'
  AND option_label = 'Cum (Cubic Meter)';

UPDATE public.master_config_options
SET option_label = 'Liter (LTR)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'LTR'
  AND option_label = 'Liters';

UPDATE public.master_config_options
SET option_label = 'Brass (BRASS)', updated_at = CURRENT_TIMESTAMP
WHERE company_id = 2
  AND config_type = 'material_unit'
  AND option_value = 'BRASS'
  AND option_label = 'Brass';

-- Deactivate verbose legacy power-source options only if they are not used
-- in current plant or crusher data.
UPDATE public.master_config_options mco
SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
WHERE mco.company_id = 2
  AND mco.config_type = 'power_source'
  AND mco.option_value IN ('DG SET', 'EGRID', 'HYBRID')
  AND mco.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.plant_master pm
    WHERE LOWER(BTRIM(COALESCE(pm.power_source_type, ''))) = LOWER(BTRIM(mco.option_value))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.crusher_units cu
    WHERE LOWER(BTRIM(COALESCE(cu.power_source_type, ''))) = LOWER(BTRIM(mco.option_value))
  );

COMMIT;
