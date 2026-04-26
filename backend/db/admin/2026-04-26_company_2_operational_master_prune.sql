BEGIN;

-- Operational master-data snapshot generated from local database.
-- Company: Gajanan Global Construction LLP
-- Company Code: GAJANAN_GLOBAL_CONSTRUCTION_LL
-- Source Company ID: 2
-- Mode: prune
-- Purpose:
-- Recreate locally-fed operational master/rate data in another database
-- without manual re-entry.
-- Preserve mode only inserts missing rows so already-fed target data stays intact.
-- Sync mode updates matching rows and inserts missing rows.
-- Prune mode deletes target-company rows that do not exist in the current local snapshot.
-- The script never deletes unrelated target-company data.


-- Transport Rates Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, vendorName, materialCode, materialName, rateType, rateValue, distanceKm, isActive, rateUnitCode, billingBasis, minimumCharge) AS (
  VALUES
    ('SCP', 'Jungari Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL)
)
DELETE FROM public.transport_rates tr
WHERE tr.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.transport_rate_id = tr.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE tr.plant_id = (
        SELECT pl.id
        FROM public.plant_master pl
        WHERE pl.company_id = (SELECT company_id FROM target_company)
          AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
        LIMIT 1
      )
      AND tr.vendor_id = (
        SELECT vm.id
        FROM public.vendor_master vm
        WHERE vm.company_id = (SELECT company_id FROM target_company)
          AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
        LIMIT 1
      )
      AND tr.material_id = (
        SELECT mm.id
        FROM public.material_master mm
        WHERE mm.company_id = (SELECT company_id FROM target_company)
          AND (
            LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
            OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
          )
        LIMIT 1
      )
      AND COALESCE(LOWER(BTRIM(tr.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
      AND COALESCE(tr.distance_km, -1) = COALESCE(seed.distanceKm::numeric, -1)
  );


-- Party Material Rates Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, partyCode, materialCode, materialName, effectiveFrom, ratePerTon, royaltyMode, royaltyValue, loadingCharge, notes, isActive, tonsPerBrass, rateUnit, rateUnitLabel, rateUnitsPerTon, loadingChargeBasis, rateUnitCode, billingBasis, pricePerUnit) AS (
  VALUES
    ('SCP', 'LLOYDS-GHG', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '510.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '660.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'DUST', 'Stone Dust', '2026-04-25', '420.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '630.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '680.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'DUST', 'Stone Dust', '2026-04-25', '430.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'WMM', 'WMM Material', '2026-04-25', '485.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '445.00', 'per_brass', '800.00', '0.00', '', TRUE, '4.5000', 'per_cft', 'CFT', '22.5000', 'none', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-KON', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '480.00', 'per_brass', '800.00', '50.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.5000', 'per_metric_ton', 'metric ton', '1.0000', 'fixed', NULL, NULL, NULL)
)
DELETE FROM public.party_material_rates pmr
WHERE pmr.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.party_material_rate_id = pmr.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE pmr.plant_id = (
        SELECT pl.id
        FROM public.plant_master pl
        WHERE pl.company_id = (SELECT company_id FROM target_company)
          AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
        LIMIT 1
      )
      AND pmr.party_id = (
        SELECT pt.id
        FROM public.party_master pt
        WHERE pt.company_id = (SELECT company_id FROM target_company)
          AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
        LIMIT 1
      )
      AND pmr.material_id = (
        SELECT mm.id
        FROM public.material_master mm
        WHERE mm.company_id = (SELECT company_id FROM target_company)
          AND (
            LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
            OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
          )
        LIMIT 1
      )
      AND COALESCE(pmr.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
  );


-- Material Unit Conversions Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialCode, materialName, fromUnitCode, toUnitCode, conversionFactor, conversionMethod, effectiveFrom, effectiveTo, notes, isActive) AS (
  VALUES
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'MT', '4.761900', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'MT', '0.047619', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'BRASS', '0.210000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'CFT', '21.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'MT', '4.444400', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'MT', '0.044444', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'BRASS', '0.225000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'CFT', '22.500000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE)
)
DELETE FROM public.material_unit_conversions muc
WHERE muc.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.conversion_id = muc.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates pmr
    WHERE pmr.conversion_id = muc.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE muc.material_id = (
        SELECT mm.id
        FROM public.material_master mm
        WHERE mm.company_id = (SELECT company_id FROM target_company)
          AND (
            LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
            OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
          )
        LIMIT 1
      )
      AND muc.from_unit_id = (
        SELECT um.id
        FROM public.unit_master um
        WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
          AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
        ORDER BY um.company_id NULLS FIRST, um.id
        LIMIT 1
      )
      AND muc.to_unit_id = (
        SELECT um.id
        FROM public.unit_master um
        WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
          AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
        ORDER BY um.company_id NULLS FIRST, um.id
        LIMIT 1
      )
      AND COALESCE(muc.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
  );


-- Vehicles Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vehicleNumber, vehicleType, assignedDriver, status, ownershipType, vendorName, plantCode, vehicleCapacityTons) AS (
  VALUES
    ('MH34AB9090', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34AQ3454', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34CF4565', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32'),
    ('MH34CF4567', 'BharatBenz', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32')
)
DELETE FROM public.vehicles vh
WHERE vh.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.vehicle_id = vh.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.ledgers l
    WHERE l.vehicle_id = vh.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.voucher_lines vl
    WHERE vl.vehicle_id = vh.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(vh.vehicle_number)) = LOWER(BTRIM(seed.vehicleNumber))
  );


-- Employees Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(employeeCode, fullName, department, designation, status, relievingDate, remarks, mobileNumber, joiningDate, email, emergencyContactNumber, address, employmentType, idProofType, idProofNumber) AS (
  VALUES
    ('EMP0002', 'Jayant Umakant Mamidwar', 'Admin', 'Managing Director', 'active', NULL, NULL, '8044566382', '2026-04-17', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PRJ0001', 'JaiPrakash Mishra', 'Projects', 'Manager', 'active', NULL, NULL, '7667315773', '2026-04-18', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PLT0001', 'Praful Mohitkar', 'Crusher', 'Supervisor', 'active', NULL, NULL, '7667315773', '2026-04-20', NULL, NULL, NULL, 'full_time', NULL, NULL)
)
DELETE FROM public.employees emp
WHERE emp.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_requests pr
    WHERE pr.requested_by_employee_id = emp.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.employee_id = emp.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(emp.employee_code)) = LOWER(BTRIM(seed.employeeCode))
  );


-- Party Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(partyName, partyCode, contactPerson, mobileNumber, gstin, pan, addressLine1, addressLine2, city, stateName, stateCode, pincode, partyType, isActive, dispatchQuantityMode, defaultDispatchUnitCode, allowManualDispatchConversion) AS (
  VALUES
    ('Lloyds Metals and Energy Ltd (Ghugus)', 'LLOYDS-GHG', 'Mr. Akshay Vora (CS)', '7172285398', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A 1-2, MIDC Area', 'Ghugus', 'Chandrapur', 'Maharashtra', '27', '442505', 'customer', TRUE, NULL, NULL, NULL),
    ('Lloyds Metals (Konsari Plant)', 'LLOYDS-KON', 'Plant Manager', '7172285103', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A-1, Chamorshi', 'Industrial Area, Konsari', 'Gadchiroli', 'Maharashtra', '27', '442707', 'customer', TRUE, NULL, NULL, NULL),
    ('Sonai Infrastructure Pvt Ltd', 'SONAI-INFRA', 'Plant Manager', '2069086908', '27AAOCS1420M1Z3', 'AAOCS1420M', 'Manthan+, 1st Floor, Shriram Plaza', 'Opp. Ram Mandir', 'Sangli', 'Maharashtra', '27', '416416', 'customer', TRUE, NULL, NULL, NULL)
)
DELETE FROM public.party_master pm
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.ledgers l
    WHERE l.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates pmr
    WHERE pmr.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_orders po
    WHERE po.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payables p
    WHERE p.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.receivables r
    WHERE r.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.voucher_lines vl
    WHERE vl.party_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(pm.party_code)) = LOWER(BTRIM(seed.partyCode))
  );


-- Vendor Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vendorName, vendorType, contactPerson, mobileNumber, address, isActive) AS (
  VALUES
    ('Jungari Transport', 'Transporter', 'Santosh Jungari', NULL, 'Mohda', TRUE),
    ('Sidhesh Transport', 'Transporter', 'Nikash Sindhe', NULL, 'Mohda', TRUE),
    ('K.K. Transport', 'Transporter', 'KK', NULL, 'Chandrapur', TRUE)
)
DELETE FROM public.vendor_master vm
WHERE vm.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.transport_vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.goods_receipts gr
    WHERE gr.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.ledgers l
    WHERE l.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payables p
    WHERE p.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_invoices pi
    WHERE pi.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_request_line_supplier_quotes prlsq
    WHERE prlsq.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_requests pr
    WHERE pr.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transport_rates tr
    WHERE tr.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.vehicles vh
    WHERE vh.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.voucher_lines vl
    WHERE vl.vendor_id = vm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
  );


-- Vehicle Type Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(typeName, category, isActive) AS (
  VALUES
    ('Tata Signa', 'Tipper/Hyva', TRUE),
    ('Ashok Leyland', 'Tipper/Hyva', TRUE),
    ('BharatBenz', 'Tipper/Hyva', TRUE),
    ('Eicher', 'Tipper/Hyva', TRUE),
    ('JCB 3DX', 'Backhoe Loader', TRUE),
    ('Hindustan Wheel Loader', 'Loader', TRUE),
    ('L&T Komatsu PC210', 'Excavator', TRUE),
    ('Schwing Stetter CP30', 'Transit Mixer', TRUE),
    ('Hyundai R210 Smart', 'Excavator', TRUE),
    ('Water Tanker', 'Water Truck', TRUE),
    ('Mahindra Bolero Camper', 'Utility Vehicle', TRUE),
    ('CASE 752 Tandem Roller', 'Road Roller (Compactor)', TRUE),
    ('Mahindra Scorpio N', 'Utility Vehicle', TRUE)
)
DELETE FROM public.vehicle_type_master vt
WHERE vt.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(vt.type_name)) = LOWER(BTRIM(seed.typeName))
  );


-- Crusher Units Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(unitName, unitCode, location, powerSourceType, isActive, plantType) AS (
  VALUES
    ('Primary Crushing Line', 'CRU-PLC-01', 'Main crushing bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Secondary Screening Line', 'CRU-SSL-01', 'Screening deck', 'electric', TRUE, 'Crushing Plant'),
    ('Stock Yard Feed Hopper', 'CRU-SFH-01', 'Stock yard feed point', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Primary Hopper', 'SCP-PH-01', 'Stone Crusher Plant intake', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Secondary Line', 'SCP-SL-01', 'Stone Crusher Plant secondary line', 'electric', TRUE, 'Crushing Plant'),
    ('Dolomite Primary Crusher', 'DCU-PC-01', 'Dolomite Crusher Unit primary bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Dolomite Screening Deck', 'DCU-SD-01', 'Dolomite Crusher Unit screening deck', 'electric', TRUE, 'Crushing Plant')
)
DELETE FROM public.crusher_units cu
WHERE cu.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.boulder_daily_reports bdr
    WHERE bdr.crusher_unit_id = cu.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(cu.unit_code)) = LOWER(BTRIM(seed.unitCode))
  );


-- Plant Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantName, plantCode, plantType, location, powerSourceType, isActive) AS (
  VALUES
    ('Stone Crusher Plant', 'SCP', 'Crushing Plant', 'Mohada', 'hybrid', TRUE),
    ('Wandhari RMC Plant', 'Wandri', 'Ready-Mix Concrete (RMC)', 'Wandri Phata', 'hybrid', TRUE),
    ('Rasa Concrete Road Plant', 'RASA-1', 'Ready-Mix Concrete (RMC)', 'Rasa', 'hybrid', TRUE),
    ('Dolomite Crusher Unit', 'Dolomite', 'Crushing Plant', 'Gadchiroli', 'hybrid', TRUE)
)
DELETE FROM public.plant_master pm
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.boulder_daily_reports bdr
    WHERE bdr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.crusher_daily_reports cdr
    WHERE cdr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.equipment_logs el
    WHERE el.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.ledgers l
    WHERE l.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates pmr
    WHERE pmr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_orders po
    WHERE po.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_daily_reports pdr
    WHERE pdr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transport_rates tr
    WHERE tr.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.vehicles vh
    WHERE vh.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.voucher_lines vl
    WHERE vl.plant_id = pm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode))
  );


-- Material Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialName, materialCode, category, unit, isActive, gstRate, hsnSacCode) AS (
  VALUES
    ('Aggregate 10mm', 'AGG-10', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm', 'AGG-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm', 'AGG-40', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB (Granular Sub-Base)', 'GSB', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('WMM Material', 'WMM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Dolomite Boulders', 'DOL-RAW', 'Aggregates', 'MT', TRUE, '5.00', '2518'),
    ('Crush Sand (M-Sand)', 'M-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Stone Dust', 'DUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Plaster Sand (P-Sand)', 'P-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Dolomite 20mm', 'DOL-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('OPC 53 Grade', 'OPC-53', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('PPC Cement', 'PPC', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('Bitumen VG-30', 'BIT-VG30', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Emulsion', 'EMUL', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Plasticizers', 'ADM-PLAS', 'Admixtures', 'LTR', TRUE, '18.00', '3824'),
    ('Retarders', 'ADM-RET', 'Admixtures', 'LTR', TRUE, '18.00', '2710'),
    ('Diesel (HSD)', 'DSL', 'Fuel', 'LTR', TRUE, '0.00', '2710'),
    ('Aggregate 6mm', 'AGG-06', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm VSI', 'AGG-06-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm Non-VSI', 'AGG-06-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm VSI', 'AGG-10-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm Non-VSI', 'AGG-10-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm VSI', 'AGG-20-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm Non-VSI', 'AGG-20-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm VSI', 'AGG-40-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm Non-VSI', 'AGG-40-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 12mm', 'AGG-12', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 25mm', 'AGG-25', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 63mm', 'AGG-63', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Crusher Dust', 'CRDUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Murum', 'MURUM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Screened Metal', 'SCR-MET', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 1', 'GSB-G1', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 2', 'GSB-G2', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 3', 'GSB-G3', 'Aggregates', 'MT', TRUE, '5.00', '2517')
)
DELETE FROM public.material_master mm
WHERE mm.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.goods_receipt_lines grl
    WHERE grl.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_unit_conversions muc
    WHERE muc.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates pmr
    WHERE pmr.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_orders po
    WHERE po.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_invoice_lines pil
    WHERE pil.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_order_lines pol
    WHERE pol.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_request_lines prl
    WHERE prl.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transport_rates tr
    WHERE tr.material_id = mm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
       OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
  );


-- Referenced Units Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(scopeKey, unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive) AS (
  VALUES
    ('global', 'MT', 'Metric Ton', 'weight', 3, FALSE, TRUE),
    ('global', 'KG', 'Kilogram', 'weight', 3, FALSE, TRUE),
    ('global', 'CFT', 'Cubic Feet', 'volume', 3, FALSE, TRUE),
    ('global', 'BRASS', 'Brass', 'volume', 3, FALSE, TRUE),
    ('global', 'CUM', 'Cubic Meter', 'volume', 3, FALSE, TRUE),
    ('global', 'BAG', 'Bag', 'count', 0, FALSE, TRUE)
)
DELETE FROM public.unit_master um
WHERE um.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_reports dr
    WHERE dr.billing_unit_id_snapshot = um.id
       OR dr.entered_unit_id = um.id
       OR dr.source_vehicle_capacity_unit_id = um.id
       OR dr.transport_unit_id_snapshot = um.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_unit_conversions muc
    WHERE muc.from_unit_id = um.id
       OR muc.to_unit_id = um.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_master pm
    WHERE pm.default_dispatch_unit_id = um.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_material_rates pmr
    WHERE pmr.rate_unit_id = um.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transport_rates tr
    WHERE tr.rate_unit_id = um.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE seed.scopeKey = 'company'
      AND LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  );


-- Config Options Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(configType, optionLabel, optionValue, sortOrder, isActive) AS (
  VALUES
    ('material_category', 'Aggregates', 'AGTS', 1, TRUE),
    ('material_category', 'Admixtures', 'ADMXT', 2, TRUE),
    ('material_category', 'Bitumen', 'BITM', 3, TRUE),
    ('material_category', 'Cement', 'CEMT', 4, TRUE),
    ('material_category', 'Sand', 'SAND', 5, TRUE),
    ('material_category', 'Fuel', 'FUEL', 6, TRUE),
    ('material_category', 'Fine Aggregate', 'Fine Aggregate', 7, TRUE),
    ('material_unit', 'Metric Ton (MT)', 'MT', 1, TRUE),
    ('material_unit', 'Brass (BRASS)', 'BRASS', 2, TRUE),
    ('material_unit', 'Cubic Meter (CUM)', 'CUM', 3, TRUE),
    ('material_unit', 'Kilogram (KG)', 'KG', 4, TRUE),
    ('material_unit', 'Liter (LTR)', 'LTR', 5, TRUE),
    ('material_unit', 'Bags (Legacy BGS)', 'BGS', 6, TRUE),
    ('material_unit', 'Bag', 'BAG', 7, TRUE),
    ('material_unit', 'CFT', 'CFT', 8, TRUE),
    ('material_unit', 'DAY', 'DAY', 9, TRUE),
    ('material_unit', 'KM', 'KM', 10, TRUE),
    ('material_unit', 'NOS', 'NOS', 11, TRUE),
    ('material_unit', 'TRIP', 'TRIP', 12, TRUE),
    ('plant_type', 'Crushing Plant', 'CP', 1, TRUE),
    ('plant_type', 'Ready-Mix Concrete (RMC)', 'RMC', 2, TRUE),
    ('plant_type', 'Batching Plant', 'BP', 3, TRUE),
    ('plant_type', 'Hot Mix Plant', 'HMP', 4, TRUE),
    ('power_source', 'Electricity (Grid)', 'EGRID', 1, FALSE),
    ('power_source', 'DG Set (Generator)', 'DG SET', 2, FALSE),
    ('power_source', 'Hybrid (Grid/DG)', 'HYBRID', 3, TRUE),
    ('power_source', 'diesel', 'diesel', 4, TRUE),
    ('power_source', 'electricity', 'electricity', 5, TRUE),
    ('power_source', 'electric', 'electric', 6, TRUE),
    ('vehicle_category', 'Transit Mixer', 'TM', 1, TRUE),
    ('vehicle_category', 'Tipper/Hyva', 'TPR/HVA', 2, TRUE),
    ('vehicle_category', 'Bulldozer', 'BLDZ', 3, TRUE),
    ('vehicle_category', 'Excavator', 'EXVTR', 4, TRUE),
    ('vehicle_category', 'Loader', 'LDR', 5, TRUE),
    ('vehicle_category', 'Tanker', 'TNKR', 6, TRUE),
    ('vehicle_category', 'Motor Grader', 'MG', 7, TRUE),
    ('vehicle_category', 'Backhoe Loader', 'BACKL', 8, TRUE),
    ('vehicle_category', 'Scraper', 'SCPR', 9, TRUE),
    ('vehicle_category', 'Road Roller (Compactor)', 'RRC', 10, TRUE),
    ('vehicle_category', 'Asphalt Paver', 'PAVER', 11, TRUE),
    ('vehicle_category', 'Cold Planer (Miller)', 'MILLER', 12, TRUE),
    ('vehicle_category', 'Pick & Carry Crane (Hydra)', 'HYDRA', 13, TRUE),
    ('vehicle_category', 'Water Truck', 'WT', 14, TRUE),
    ('vehicle_category', 'Utility Vehicle', 'Utility Vehicle', 15, TRUE),
    ('vehicle_category', 'Road Roller', 'Road Roller', 16, TRUE)
)
DELETE FROM public.master_config_options mco
WHERE mco.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(mco.config_type)) = LOWER(BTRIM(seed.configType))
      AND LOWER(BTRIM(COALESCE(mco.option_value, ''))) = LOWER(BTRIM(COALESCE(seed.optionValue, '')))
  );


-- Shift Master Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(shiftName, startTime, endTime, isActive) AS (
  VALUES
    ('Morning', '08:30:00', '19:30:00', TRUE),
    ('Night', '19:30:00', '08:30:00', TRUE)
)
DELETE FROM public.shift_master sm
WHERE sm.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (
    SELECT 1
    FROM public.boulder_daily_reports bdr
    WHERE bdr.shift_id = sm.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM seed
    WHERE LOWER(BTRIM(sm.shift_name)) = LOWER(BTRIM(seed.shiftName))
  );


-- Company Profile Prune
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(companyName, branchName, addressLine1, addressLine2, city, stateName, stateCode, pincode, gstin, pan, mobile, email, bankName, bankAccount, ifscCode, termsNotes, isActive, companyLogoUrl) AS (
  VALUES
    ('Gajanan Global Construction LLP', 'Chandrapur Main Branch', 'House No. 212, M.I.D.C. Road, Datala', 'Kotwali Ward', 'Chandrapur', 'Maharashtra', '27', '442401', '27AABFG7700Q1Z3', 'AABFG7700Q', '8044566382', 'gcccha.project@gmail.com', NULL, NULL, NULL, NULL, TRUE, NULL)
)
DELETE FROM public.company_profile cp
WHERE cp.company_id = (SELECT company_id FROM target_company)
  AND NOT EXISTS (SELECT 1 FROM seed);


COMMIT;
