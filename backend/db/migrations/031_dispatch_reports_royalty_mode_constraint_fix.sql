ALTER TABLE public.dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_royalty_mode_check;

ALTER TABLE public.dispatch_reports
  ADD CONSTRAINT dispatch_reports_royalty_mode_check
  CHECK (
    royalty_mode IS NULL
    OR royalty_mode IN ('per_ton', 'per_brass', 'fixed', 'none')
  );
