BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'party_material_rates'
      AND constraint_name = 'party_material_rates_party_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.party_material_rates
      DROP CONSTRAINT party_material_rates_party_id_fkey;
  END IF;
END $$;

-- Remove legacy rows that cannot be linked to party_master because earlier
-- schema versions accidentally pointed party_id to vendor_master.
DELETE FROM public.party_material_rates pmr
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_master p
  WHERE p.id = pmr.party_id
);

ALTER TABLE public.party_material_rates
  ADD CONSTRAINT party_material_rates_party_id_fkey
  FOREIGN KEY (party_id)
  REFERENCES public.party_master(id);

COMMIT;
