const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const fs = require("node:fs/promises");
const path = require("node:path");

test("migration files are ordered and include production hardening migrations", async () => {
  const migrationsDir = path.resolve(__dirname, "../db/migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(files, [
    "001_multi_company_foundation.sql",
    "002_auth_security_foundation.sql",
    "003_party_orders_foundation.sql",
    "004_dispatch_party_fk_alignment.sql",
    "005_companies_name_uniqueness.sql",
    "006_project_reports_query_indexes.sql",
    "007_project_reports_enhanced_fields.sql",
    "008_crusher_reports_enhanced_fields.sql",
    "009_report_plant_links.sql",
    "010_plant_unit_reports_energy_expenses.sql",
    "011_plant_unit_reports_relax_required_fields.sql",
    "012_operational_units_plant_type.sql",
    "013_material_hsn_sac_code.sql",
    "014_employee_profile_practical_fields.sql",
    "015_company_profile_logo.sql",
    "016_company_billing_controls.sql",
    "017_company_billing_custom_cycle.sql",
    "018_company_billing_invoices.sql",
    "019_accounts_finance_foundation.sql",
    "020_accounts_finance_hardening.sql",
    "021_accounts_finance_phase3_governance.sql",
    "022_accounts_finance_control_plane.sql",
    "023_accounts_finance_phase4_policy_and_history_filters.sql",
    "024_accounts_finance_policy_operations.sql",
    "025_accounts_finance_policy_trigger_guards.sql",
    "026_accounts_finance_system_source_actor_integrity.sql",
    "027_auth_session_and_rate_limit_hardening.sql",
    "028_party_material_rates_party_fk_fix.sql",
    "029_party_material_rates_per_brass_royalty.sql",
    "030_party_material_rates_royalty_mode_constraint_fix.sql",
    "031_dispatch_reports_royalty_mode_constraint_fix.sql",
  ]);
});

test("company name uniqueness migration creates normalized unique index", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/005_companies_name_uniqueness.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/i);
  assert.match(sql, /uq_companies_company_name_normalized/i);
  assert.match(sql, /LOWER\(BTRIM\(company_name\)\)/i);
});

test("project report query index migration adds company-scoped analytics indexes", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/006_project_reports_query_indexes.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE INDEX IF NOT EXISTS/i);
  assert.match(sql, /idx_project_daily_reports_company_date_desc/i);
  assert.match(sql, /idx_project_daily_reports_company_project_date_desc/i);
  assert.match(sql, /idx_project_daily_reports_company_site_date_desc/i);
  assert.match(sql, /project_daily_reports\(company_id, report_date DESC, id DESC\)/i);
  assert.match(sql, /project_daily_reports\(company_id, project_name, report_date DESC, id DESC\)/i);
  assert.match(sql, /project_daily_reports\(company_id, site_name, report_date DESC, id DESC\)/i);
});

test("project report enhancement migration adds practical daily-report fields", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/007_project_reports_enhanced_fields.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS shift/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS weather/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS progress_percent/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS blockers/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS next_plan/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS report_status/i);
  assert.match(sql, /idx_project_daily_reports_company_status_date_desc/i);
});

test("crusher report enhancement migration adds operational reporting fields", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/008_crusher_reports_enhanced_fields.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS operational_status/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS breakdown_hours/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS downtime_reason/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS opening_stock_tons/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS closing_stock_tons/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS operators_count/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS maintenance_notes/i);
  assert.match(sql, /idx_crusher_daily_reports_company_status_date_desc/i);
});

test("report plant link migration anchors project and crusher reports to plant master", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/009_report_plant_links.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE crusher_daily_reports/i);
  assert.match(sql, /ALTER TABLE project_daily_reports/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS plant_id BIGINT REFERENCES plant_master\(id\)/i);
  assert.match(sql, /idx_crusher_daily_reports_company_plant_date_desc/i);
  assert.match(sql, /idx_project_daily_reports_company_plant_date_desc/i);
});

test("plant-unit report energy migration adds utility and expense capture fields", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/010_plant_unit_reports_energy_expenses.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS electricity_kwh/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS electricity_opening_reading/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS electricity_closing_reading/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS diesel_rate_per_litre/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS electricity_rate_per_kwh/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS diesel_cost/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS electricity_cost/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS labour_expense/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS maintenance_expense/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS other_expense/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS total_expense/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS expense_remarks/i);
  assert.match(sql, /idx_crusher_daily_reports_company_plant_status_date_desc/i);
});

test("plant-unit report relax migration drops rigid not-null requirements", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/011_plant_unit_reports_relax_required_fields.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER COLUMN shift DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN crusher_unit_name DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN material_type DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN production_tons DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN dispatch_tons DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN machine_hours DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN diesel_used DROP NOT NULL/i);
});

test("operational unit migration adds plant type to unit master", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/012_operational_units_plant_type.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE crusher_units/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS plant_type TEXT/i);
  assert.match(sql, /SET plant_type = 'Crusher'/i);
});

test("material HSN/SAC migration adds printable tax classification support", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/013_material_hsn_sac_code.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE material_master/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_material_master_hsn_sac_code/i);
});

test("employee profile migration adds optional practical HR fields", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/014_employee_profile_practical_fields.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE employees/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS email TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS emergency_contact_number/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS address TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS employment_type TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS id_proof_type TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS id_proof_number/i);
  assert.match(sql, /idx_employees_email_normalized/i);
  assert.match(sql, /idx_employees_employment_type/i);
});

test("company profile logo migration adds printable brand asset field", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/015_company_profile_logo.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE company_profile/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS company_logo_url TEXT/i);
});

test("company billing controls migration adds owner-governed billing lock controls", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/016_company_billing_controls.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS company_billing_controls/i);
  assert.match(sql, /company_id BIGINT NOT NULL UNIQUE/i);
  assert.match(sql, /billing_status VARCHAR\(24\) NOT NULL DEFAULT 'active'/i);
  assert.match(sql, /outstanding_amount NUMERIC\(12, 2\) NOT NULL DEFAULT 0/i);
  assert.match(sql, /updated_by_user_id BIGINT/i);
  assert.match(sql, /FOREIGN KEY \(company_id\) REFERENCES companies\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /chk_company_billing_status/i);
  assert.match(sql, /chk_company_billing_grace_window/i);
  assert.match(sql, /idx_company_billing_controls_status_due/i);
});

test("company billing custom cycle migration adds custom-cycle control fields", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/017_company_billing_custom_cycle.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS custom_cycle_label/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS custom_cycle_days/i);
  assert.match(sql, /chk_company_billing_custom_cycle_days/i);
});

test("company billing invoices migration adds invoice persistence for billing PDFs", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/018_company_billing_invoices.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS company_billing_invoices/i);
  assert.match(sql, /invoice_number VARCHAR\(64\) NOT NULL UNIQUE/i);
  assert.match(sql, /FOREIGN KEY \(company_id\) REFERENCES companies\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /idx_company_billing_invoices_company_date/i);
});

test("accounts finance foundation migration adds normalized double-entry core tables", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/019_accounts_finance_foundation.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_groups/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS chart_of_accounts/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ledgers/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS vouchers/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS voucher_lines/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS receivables/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS payables/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS settlements/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS bank_accounts/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS finance_posting_rules/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS finance_source_links/i);
  assert.match(sql, /prevent_posted_voucher_update/i);
  assert.match(sql, /Posted vouchers are immutable/i);
});

test("accounts finance hardening migration adds settlement and posting safety rails", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/020_accounts_finance_hardening.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /uq_receivables_company_dispatch/i);
  assert.match(sql, /uq_settlements_company_voucher/i);
  assert.match(sql, /validate_settlement_source_integrity/i);
  assert.match(sql, /Settlement exceeds receivable outstanding amount/i);
  assert.match(sql, /validate_voucher_posting_integrity/i);
  assert.match(sql, /Voucher cannot be posted with unbalanced debit\/credit totals/i);
});

test("accounts finance control-plane migration adds actor model and immutable transition logs", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/022_accounts_finance_control_plane.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS submitted_by_user_id/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS finance_transition_logs/i);
  assert.match(sql, /prevent_finance_transition_log_mutation/i);
  assert.match(sql, /trg_prevent_finance_transition_log_update/i);
});

test("accounts finance phase4 policy migration adds durable maker-checker policy controls", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/023_accounts_finance_phase4_policy_and_history_filters.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS finance_policy_controls/i);
  assert.match(sql, /allow_submitter_self_approval BOOLEAN NOT NULL DEFAULT FALSE/i);
  assert.match(sql, /allow_maker_self_posting BOOLEAN NOT NULL DEFAULT FALSE/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION enforce_voucher_maker_checker_policy/i);
  assert.match(sql, /CREATE TRIGGER trg_enforce_voucher_maker_checker_policy/i);
  assert.match(sql, /chk_finance_transition_logs_action/i);
  assert.match(sql, /'close'/i);
  assert.match(sql, /'reopen'/i);
});

test("accounts finance phase5 policy operations migration adds operational metadata controls", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/024_accounts_finance_policy_operations.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /ALTER TABLE finance_policy_controls/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS last_update_notes/i);
  assert.match(sql, /fk_finance_policy_controls_updated_by_user/i);
  assert.match(sql, /chk_finance_policy_controls_notes_len/i);
  assert.match(sql, /idx_finance_policy_controls_company_updated/i);
});

test("accounts finance phase5 policy trigger guard migration hardens null-policy behavior", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/025_accounts_finance_policy_trigger_guards.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE OR REPLACE FUNCTION enforce_voucher_maker_checker_policy/i);
  assert.match(sql, /COALESCE\(fpc.allow_submitter_self_approval, FALSE\)/i);
  assert.match(sql, /COALESCE\(policy_maker_self_posting, FALSE\)/i);
});

test("accounts finance phase5 source actor integrity migration allows source-linked approvals", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/026_accounts_finance_system_source_actor_integrity.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /DROP CONSTRAINT chk_vouchers_phase4_actor_integrity/i);
  assert.match(sql, /source_module IS NOT NULL/i);
  assert.match(sql, /source_record_id IS NOT NULL/i);
});

test("auth session and rate limit hardening migration creates refresh/session safety tables", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../db/migrations/027_auth_session_and_rate_limit_hardening.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS auth_refresh_tokens/i);
  assert.match(sql, /token_hash VARCHAR\(128\) NOT NULL UNIQUE/i);
  assert.match(sql, /user_id BIGINT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rate_limit_counters/i);
  assert.match(sql, /rate_key VARCHAR\(320\) PRIMARY KEY/i);
  assert.match(sql, /idx_rate_limit_counters_expiry/i);
});
