-- Audit newly requested aggregate family coverage.

SELECT
  id,
  material_name,
  material_code,
  category,
  unit,
  hsn_sac_code,
  gst_rate,
  company_id,
  is_active
FROM public.material_master
WHERE material_name IN (
  'Aggregate 6mm',
  'Aggregate 6mm VSI',
  'Aggregate 6mm Non-VSI',
  'Aggregate 10mm',
  'Aggregate 10mm VSI',
  'Aggregate 10mm Non-VSI',
  'Aggregate 20mm',
  'Aggregate 20mm VSI',
  'Aggregate 20mm Non-VSI',
  'Aggregate 40mm',
  'Aggregate 40mm VSI',
  'Aggregate 40mm Non-VSI'
)
ORDER BY company_id, material_name;

SELECT
  mm.material_name,
  COUNT(muc.id) AS active_conversion_count
FROM public.material_master mm
LEFT JOIN public.material_unit_conversions muc
  ON muc.material_id = mm.id
 AND muc.is_active = TRUE
WHERE mm.material_name IN (
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
GROUP BY mm.material_name
ORDER BY mm.material_name;
