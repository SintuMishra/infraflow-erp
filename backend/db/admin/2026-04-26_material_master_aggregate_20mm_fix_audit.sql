SELECT
  id,
  material_name,
  material_code,
  hsn_sac_code,
  company_id,
  updated_at
FROM public.material_master
WHERE material_name = 'Aggregate 20mm'
   OR material_code = 'AGG-20'
ORDER BY id;
