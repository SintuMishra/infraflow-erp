BEGIN;

-- Safe in-place correction for Aggregate 20mm master data.
-- Applies only if:
-- 1. the record still has the swapped values, and
-- 2. no other material already uses material_code = 'AGG-20'.

UPDATE public.material_master
SET
  material_code = 'AGG-20',
  hsn_sac_code = '2517',
  updated_at = CURRENT_TIMESTAMP
WHERE material_name = 'Aggregate 20mm'
  AND material_code = '2517'
  AND hsn_sac_code = 'AGG-20'
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_master other
    WHERE other.material_code = 'AGG-20'
      AND other.id <> public.material_master.id
  );

COMMIT;
