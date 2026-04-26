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
ORDER BY company_id, material_name;

SELECT
  mm.material_name,
  mm.category,
  COUNT(muc.id) FILTER (WHERE muc.is_active = TRUE) AS active_conversion_count
FROM public.material_master mm
LEFT JOIN public.material_unit_conversions muc
  ON muc.material_id = mm.id
WHERE mm.material_name IN (
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
GROUP BY mm.material_name, mm.category
ORDER BY mm.material_name;
