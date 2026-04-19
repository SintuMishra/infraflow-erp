ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS tons_per_brass NUMERIC(12,4);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'party_material_rates'
      AND column_name = 'tons_per_brass'
  ) THEN
    UPDATE public.party_material_rates
    SET tons_per_brass = NULL
    WHERE tons_per_brass IS NOT NULL
      AND tons_per_brass <= 0;
  END IF;
END;
$$;
