-- Review script before applying staging sample unit-aware rates.
-- Highlights existing rows that may overlap functionally with the sample rows.

SELECT
  'party_material_rates' AS source_table,
  pmr.id,
  pm.party_name AS counterparty,
  pl.plant_name,
  mm.material_name,
  pmr.rate_per_ton,
  pmr.rate_unit,
  pmr.rate_unit_label,
  pmr.billing_basis,
  pmr.price_per_unit,
  pmr.effective_from,
  pmr.is_active
FROM public.party_material_rates pmr
JOIN public.party_master pm ON pm.id = pmr.party_id
JOIN public.plant_master pl ON pl.id = pmr.plant_id
JOIN public.material_master mm ON mm.id = pmr.material_id
WHERE pmr.company_id = 2
  AND pmr.party_id = 40
  AND pmr.plant_id = 4
  AND pmr.material_id IN (
    SELECT id FROM public.material_master
    WHERE company_id = 2
      AND material_name IN ('WMM Material', 'Crush Sand (M-Sand)', 'Aggregate 20mm', 'Stone Dust')
  )
ORDER BY mm.material_name, pmr.effective_from, pmr.id;

SELECT
  'transport_rates' AS source_table,
  tr.id,
  vm.vendor_name AS counterparty,
  pl.plant_name,
  mm.material_name,
  tr.rate_type,
  tr.rate_value,
  tr.distance_km,
  tr.billing_basis,
  tr.minimum_charge,
  tr.is_active
FROM public.transport_rates tr
JOIN public.vendor_master vm ON vm.id = tr.vendor_id
JOIN public.plant_master pl ON pl.id = tr.plant_id
JOIN public.material_master mm ON mm.id = tr.material_id
WHERE tr.company_id = 2
  AND tr.vendor_id = 9
  AND tr.plant_id = 4
  AND tr.material_id IN (
    SELECT id FROM public.material_master
    WHERE company_id = 2
      AND material_name IN ('WMM Material', 'Aggregate 20mm')
  )
ORDER BY mm.material_name, tr.id;
