-- Performance indexes for report-heavy and list-heavy ERP workloads.
-- Safe additive migration only.

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_company_date_desc
  ON dispatch_reports(company_id, dispatch_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_company_plant_date_desc
  ON dispatch_reports(company_id, plant_id, dispatch_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_company_material_date_desc
  ON dispatch_reports(company_id, material_id, dispatch_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_company_vehicle_date_desc
  ON dispatch_reports(company_id, vehicle_id, dispatch_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_date_desc
  ON crusher_daily_reports(company_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_crusher_daily_reports_company_plant_date_desc
  ON crusher_daily_reports(company_id, plant_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_date_id_desc
  ON project_daily_reports(company_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_daily_reports_company_plant_date_id_desc
  ON project_daily_reports(company_id, plant_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_company_usage_date_desc
  ON equipment_logs(company_id, usage_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_company_plant_date_desc
  ON equipment_logs(company_id, plant_id, usage_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_vouchers_company_date_desc
  ON vouchers(company_id, voucher_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_company_voucher_line
  ON voucher_lines(company_id, voucher_id, line_number);

CREATE INDEX IF NOT EXISTS idx_party_orders_company_date_desc
  ON party_orders(company_id, order_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_party_orders_company_plant_date_desc
  ON party_orders(company_id, plant_id, order_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_party_material_rates_company_effective_desc
  ON party_material_rates(company_id, effective_from DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_party_material_rates_company_plant_material
  ON party_material_rates(company_id, plant_id, material_id, id DESC);
