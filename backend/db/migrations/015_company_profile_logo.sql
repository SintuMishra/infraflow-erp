-- Add company logo field for print-ready document branding.
ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
