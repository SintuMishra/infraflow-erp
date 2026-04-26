SELECT
  company_id,
  config_type,
  option_label,
  option_value,
  is_active
FROM public.master_config_options
WHERE company_id = 2
  AND config_type IN ('material_unit', 'power_source')
ORDER BY config_type, sort_order, option_label;

SELECT 'plant_master' AS source, power_source_type AS value, COUNT(*) AS cnt
FROM public.plant_master
GROUP BY power_source_type
UNION ALL
SELECT 'crusher_units' AS source, power_source_type AS value, COUNT(*) AS cnt
FROM public.crusher_units
GROUP BY power_source_type
ORDER BY source, value;
