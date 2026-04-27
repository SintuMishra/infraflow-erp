-- Bridge migration for fresh databases that applied the initial legacy
-- bootstrap before dispatch_reports was widened to the expected legacy shape.
-- This must run before 031_dispatch_reports_royalty_mode_constraint_fix.sql.

ALTER TABLE public.dispatch_reports
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS created_by BIGINT,
  ADD COLUMN IF NOT EXISTS material_id BIGINT,
  ADD COLUMN IF NOT EXISTS transport_vendor_id BIGINT,
  ADD COLUMN IF NOT EXISTS party_material_rate_id BIGINT,
  ADD COLUMN IF NOT EXISTS transport_rate_id BIGINT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS material_rate_per_ton NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS material_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS transport_rate_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS transport_rate_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS transport_cost NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS royalty_mode VARCHAR(30),
  ADD COLUMN IF NOT EXISTS royalty_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS royalty_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS loading_charge NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS other_charge NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS billing_notes TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS cgst NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS sgst NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS igst NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_with_gst NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS ewb_number VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ewb_date DATE,
  ADD COLUMN IF NOT EXISTS ewb_valid_upto DATE;
