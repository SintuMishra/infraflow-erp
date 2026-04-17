CREATE TABLE IF NOT EXISTS party_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(120) NOT NULL,
  order_date DATE NOT NULL,
  party_id BIGINT NOT NULL REFERENCES party_master(id),
  plant_id BIGINT NOT NULL REFERENCES plant_master(id),
  material_id BIGINT NOT NULL REFERENCES material_master(id),
  ordered_quantity_tons NUMERIC(12,2) NOT NULL CHECK (ordered_quantity_tons > 0),
  target_dispatch_date DATE NULL,
  remarks TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by BIGINT NULL REFERENCES users(id),
  updated_by BIGINT NULL REFERENCES users(id),
  company_id BIGINT NULL REFERENCES companies(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_party_orders_status
    CHECK (status IN ('open', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_party_orders_party_id
  ON party_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_party_orders_plant_id
  ON party_orders(plant_id);
CREATE INDEX IF NOT EXISTS idx_party_orders_material_id
  ON party_orders(material_id);
CREATE INDEX IF NOT EXISTS idx_party_orders_status
  ON party_orders(status);
CREATE INDEX IF NOT EXISTS idx_party_orders_company_id
  ON party_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_party_orders_order_date
  ON party_orders(order_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_orders_company_order_number
  ON party_orders(COALESCE(company_id, 0), order_number);

ALTER TABLE dispatch_reports
  ADD COLUMN IF NOT EXISTS party_order_id BIGINT NULL REFERENCES party_orders(id);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_party_order_id
  ON dispatch_reports(party_order_id);
