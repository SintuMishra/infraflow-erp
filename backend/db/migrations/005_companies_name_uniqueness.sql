CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_company_name_normalized
ON companies (LOWER(BTRIM(company_name)));
