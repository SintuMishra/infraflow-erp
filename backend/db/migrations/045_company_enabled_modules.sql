ALTER TABLE companies
ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '["operations","commercial","procurement","accounts"]'::jsonb;

UPDATE companies
SET enabled_modules = '["operations","commercial","procurement","accounts"]'::jsonb
WHERE enabled_modules IS NULL
   OR jsonb_typeof(enabled_modules) <> 'array';
