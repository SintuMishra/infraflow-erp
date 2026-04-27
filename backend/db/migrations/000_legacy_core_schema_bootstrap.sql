-- Fresh-database bootstrap for legacy ERP tables.
-- This is intentionally additive and idempotent so existing environments that
-- already have the legacy schema are unaffected.

CREATE TABLE IF NOT EXISTS company_profile (
  id BIGSERIAL PRIMARY KEY,
  company_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  employee_id BIGINT REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plant_master (
  id BIGSERIAL PRIMARY KEY,
  plant_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_master (
  id BIGSERIAL PRIMARY KEY,
  vendor_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_master (
  id BIGSERIAL PRIMARY KEY,
  party_name VARCHAR(255) NOT NULL,
  party_type VARCHAR(60),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_config_options (
  id BIGSERIAL PRIMARY KEY,
  option_key VARCHAR(120),
  option_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crusher_units (
  id BIGSERIAL PRIMARY KEY,
  unit_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_master (
  id BIGSERIAL PRIMARY KEY,
  material_code VARCHAR(80),
  material_name VARCHAR(255),
  gst_rate NUMERIC(5, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shift_master (
  id BIGSERIAL PRIMARY KEY,
  shift_name VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_type_master (
  id BIGSERIAL PRIMARY KEY,
  type_name VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crusher_daily_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE,
  shift VARCHAR(20),
  crusher_unit_name VARCHAR(255),
  material_type VARCHAR(255),
  production_tons NUMERIC(12, 2),
  dispatch_tons NUMERIC(12, 2),
  machine_hours NUMERIC(10, 2),
  diesel_used NUMERIC(10, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_daily_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE,
  project_name VARCHAR(255),
  site_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  vehicle_number VARCHAR(50),
  status VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_logs (
  id BIGSERIAL PRIMARY KEY,
  log_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_rates (
  id BIGSERIAL PRIMARY KEY,
  plant_id BIGINT,
  vendor_id BIGINT,
  material_id BIGINT,
  rate_type VARCHAR(30),
  rate_value NUMERIC(12, 2),
  distance_km NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_material_rates (
  id BIGSERIAL PRIMARY KEY,
  plant_id BIGINT,
  party_id BIGINT,
  material_id BIGINT,
  rate_per_ton NUMERIC(12, 2),
  royalty_mode VARCHAR(30),
  royalty_value NUMERIC(12, 2),
  loading_charge NUMERIC(12, 2),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatch_reports (
  id BIGSERIAL PRIMARY KEY,
  dispatch_date DATE,
  source_type VARCHAR(50),
  source_name VARCHAR(255),
  material_type VARCHAR(255),
  vehicle_number VARCHAR(50),
  destination_name VARCHAR(255),
  quantity_tons NUMERIC(12, 2),
  status VARCHAR(30),
  remarks TEXT,
  created_by BIGINT,
  party_id BIGINT,
  plant_id BIGINT,
  material_id BIGINT,
  vehicle_id BIGINT,
  transport_vendor_id BIGINT,
  party_material_rate_id BIGINT,
  transport_rate_id BIGINT,
  invoice_number VARCHAR(120),
  invoice_date DATE,
  invoice_value NUMERIC(14, 2),
  distance_km NUMERIC(12, 2),
  material_rate_per_ton NUMERIC(12, 2),
  material_amount NUMERIC(14, 2),
  transport_rate_type VARCHAR(30),
  transport_rate_value NUMERIC(12, 2),
  transport_cost NUMERIC(14, 2),
  royalty_mode VARCHAR(30),
  royalty_value NUMERIC(12, 2),
  royalty_amount NUMERIC(14, 2),
  loading_charge NUMERIC(12, 2),
  other_charge NUMERIC(14, 2),
  total_invoice_value NUMERIC(14, 2),
  billing_notes TEXT,
  gst_rate NUMERIC(5, 2),
  cgst NUMERIC(14, 2),
  sgst NUMERIC(14, 2),
  igst NUMERIC(14, 2),
  total_with_gst NUMERIC(14, 2),
  ewb_number VARCHAR(120),
  ewb_date DATE,
  ewb_valid_upto DATE,
  finance_status VARCHAR(30),
  can_post_to_finance BOOLEAN,
  finance_posting_state VARCHAR(30),
  finance_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
