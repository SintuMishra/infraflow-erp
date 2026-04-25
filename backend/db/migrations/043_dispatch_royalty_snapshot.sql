ALTER TABLE public.dispatch_reports
  ADD COLUMN IF NOT EXISTS royalty_tons_per_brass NUMERIC(12,4);
