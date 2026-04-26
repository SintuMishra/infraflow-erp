-- Verification pack for unit-aware dispatch master readiness.

-- 1. Unit count
SELECT COUNT(*) AS unit_count
FROM public.unit_master;

-- 2. Inactive TON check
SELECT unit_code, unit_name, is_active, is_base_unit
FROM public.unit_master
WHERE unit_code = 'TON';

-- 3. Missing required units
SELECT required.unit_code
FROM (
  VALUES ('MT'),('KG'),('TON'),('CFT'),('CUM'),('BRASS'),('BAG'),('NOS'),('TRIP'),('KM'),('DAY'),('LTR')
) AS required(unit_code)
LEFT JOIN public.unit_master u
  ON LOWER(BTRIM(u.unit_code)) = LOWER(BTRIM(required.unit_code))
WHERE u.id IS NULL
ORDER BY required.unit_code;

-- 4. Material count by category
SELECT category, COUNT(*) AS material_count
FROM public.material_master
GROUP BY category
ORDER BY category;

-- 5. Materials with missing HSN
SELECT id, material_name, material_code
FROM public.material_master
WHERE COALESCE(BTRIM(hsn_sac_code), '') = ''
ORDER BY material_name;

-- 6. Materials with missing GST
SELECT id, material_name, material_code
FROM public.material_master
WHERE gst_rate IS NULL
ORDER BY material_name;

-- 7. Conversions count by material
SELECT
  mm.material_name,
  COUNT(muc.id) FILTER (WHERE muc.is_active = TRUE) AS active_conversion_count
FROM public.material_master mm
LEFT JOIN public.material_unit_conversions muc
  ON muc.material_id = mm.id
GROUP BY mm.material_name
ORDER BY mm.material_name;

-- 8. Duplicate active conversions
SELECT
  material_id,
  from_unit_id,
  to_unit_id,
  COUNT(*) AS duplicate_count
FROM public.material_unit_conversions
WHERE is_active = TRUE
GROUP BY material_id, from_unit_id, to_unit_id
HAVING COUNT(*) > 1;

-- 9. Active materials missing conversions
SELECT mm.id, mm.material_name, mm.unit
FROM public.material_master mm
LEFT JOIN public.material_unit_conversions muc
  ON muc.material_id = mm.id
 AND muc.is_active = TRUE
WHERE mm.is_active = TRUE
  AND mm.material_name IN (
    'WMM Material',
    'Aggregate 10mm',
    'Aggregate 20mm',
    'Aggregate 40mm',
    'Crush Sand (M-Sand)',
    'Plaster Sand (P-Sand)',
    'GSB (Granular Sub-Base)',
    'Stone Dust',
    'Dolomite 20mm',
    'Dolomite Boulders',
    'OPC 53 Grade',
    'PPC Cement'
  )
GROUP BY mm.id, mm.material_name, mm.unit
HAVING COUNT(muc.id) = 0
ORDER BY mm.material_name;

-- 10. Vehicles missing capacity
SELECT id, vehicle_number, vehicle_type, vehicle_capacity_tons, status
FROM public.vehicles
WHERE COALESCE(vehicle_capacity_tons, 0) <= 0
ORDER BY vehicle_number;

-- 11. Party rates using unit-aware fields
SELECT COUNT(*) AS unit_aware_party_rate_count
FROM public.party_material_rates
WHERE billing_basis IS NOT NULL
   OR rate_unit_id IS NOT NULL
   OR price_per_unit IS NOT NULL;

-- 12. Transport rates using unit-aware fields
SELECT COUNT(*) AS unit_aware_transport_rate_count
FROM public.transport_rates
WHERE billing_basis IS NOT NULL
   OR rate_unit_id IS NOT NULL
   OR minimum_charge IS NOT NULL;

-- 13. Dispatches missing snapshots
SELECT COUNT(*) AS dispatches_missing_snapshots
FROM public.dispatch_reports
WHERE billing_basis_snapshot IS NULL
   OR billed_quantity_snapshot IS NULL
   OR transport_basis_snapshot IS NULL
   OR transport_quantity_snapshot IS NULL;

-- 14. Old dispatch compatibility count
SELECT COUNT(*) AS legacy_dispatch_count
FROM public.dispatch_reports
WHERE entered_quantity IS NULL
  AND entered_unit_id IS NULL
  AND quantity_source IS NULL;
