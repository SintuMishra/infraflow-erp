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
  seed.company_id,
  seed.unit_code,
  seed.unit_name,
  seed.dimension_type,
  seed.precision_scale,
  seed.is_base_unit,
  seed.is_active
FROM (
  VALUES
    (NULL::BIGINT, 'TON', 'Ton', 'weight', 3, TRUE, TRUE),
    (NULL::BIGINT, 'MT', 'Metric Ton', 'weight', 3, FALSE, TRUE),
    (NULL::BIGINT, 'KG', 'Kilogram', 'weight', 3, FALSE, TRUE),
    (NULL::BIGINT, 'CFT', 'Cubic Feet', 'volume', 3, FALSE, TRUE),
    (NULL::BIGINT, 'BRASS', 'Brass', 'volume', 3, FALSE, TRUE),
    (NULL::BIGINT, 'CUM', 'Cubic Meter', 'volume', 3, FALSE, TRUE),
    (NULL::BIGINT, 'TRIP', 'Trip', 'count', 0, FALSE, TRUE),
    (NULL::BIGINT, 'BAG', 'Bag', 'count', 0, FALSE, TRUE),
    (NULL::BIGINT, 'NOS', 'Numbers', 'count', 0, FALSE, TRUE)
) AS seed (
  company_id,
  unit_code,
  unit_name,
  dimension_type,
  precision_scale,
  is_base_unit,
  is_active
)
ON CONFLICT DO NOTHING;
