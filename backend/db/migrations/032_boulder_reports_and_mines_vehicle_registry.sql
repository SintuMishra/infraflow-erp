CREATE TABLE IF NOT EXISTS boulder_logistics_vehicles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(40) NOT NULL,
  contractor_name VARCHAR(160) NOT NULL,
  vehicle_type VARCHAR(60),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_boulder_logistics_vehicles_company_vehicle
  ON boulder_logistics_vehicles (company_id, LOWER(BTRIM(vehicle_number)));

CREATE INDEX IF NOT EXISTS idx_boulder_logistics_vehicles_company_active
  ON boulder_logistics_vehicles (company_id, is_active, id DESC);

CREATE TABLE IF NOT EXISTS boulder_daily_reports (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  plant_id BIGINT NOT NULL REFERENCES plant_master(id),
  shift VARCHAR(100),
  source_mine_name VARCHAR(160),
  vehicle_id BIGINT REFERENCES boulder_logistics_vehicles(id) ON DELETE SET NULL,
  vehicle_number_snapshot VARCHAR(40) NOT NULL,
  contractor_name_snapshot VARCHAR(160) NOT NULL,
  route_type VARCHAR(32) NOT NULL DEFAULT 'to_stock_yard',
  opening_stock_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  inward_weight_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  direct_to_crusher_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  crusher_consumption_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_stock_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  finished_output_tons NUMERIC(12,2),
  yield_percent NUMERIC(7,2),
  process_loss_tons NUMERIC(12,2),
  process_loss_percent NUMERIC(7,2),
  remarks TEXT,
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT boulder_daily_reports_route_type_check
    CHECK (route_type IN ('to_stock_yard', 'direct_to_crushing_hub')),
  CONSTRAINT boulder_daily_reports_non_negative_check
    CHECK (
      opening_stock_tons >= 0
      AND inward_weight_tons >= 0
      AND direct_to_crusher_tons >= 0
      AND crusher_consumption_tons >= 0
      AND closing_stock_tons >= 0
      AND (finished_output_tons IS NULL OR finished_output_tons >= 0)
      AND (yield_percent IS NULL OR yield_percent >= 0)
      AND (process_loss_tons IS NULL OR process_loss_tons >= 0)
      AND (process_loss_percent IS NULL OR process_loss_percent >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_date_desc
  ON boulder_daily_reports (company_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_plant_date_desc
  ON boulder_daily_reports (company_id, plant_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_vehicle_date_desc
  ON boulder_daily_reports (company_id, vehicle_id, report_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_boulder_daily_reports_company_route_date_desc
  ON boulder_daily_reports (company_id, route_type, report_date DESC, id DESC);
