CREATE TABLE IF NOT EXISTS purchase_requests (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(64) NOT NULL,
  request_date DATE NOT NULL,
  required_by_date DATE NULL,
  vendor_id BIGINT NOT NULL REFERENCES vendor_master(id),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_by_user_id BIGINT NULL REFERENCES users(id),
  approved_by_user_id BIGINT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_requests_company_number UNIQUE (company_id, request_number),
  CONSTRAINT chk_purchase_requests_status CHECK (
    status IN ('draft', 'submitted', 'approved', 'closed', 'cancelled')
  ),
  CONSTRAINT chk_purchase_requests_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company_status_date
  ON purchase_requests(company_id, status, request_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_vendor
  ON purchase_requests(company_id, vendor_id, request_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS purchase_request_lines (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_request_id BIGINT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  material_id BIGINT NOT NULL REFERENCES material_master(id),
  description TEXT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_request_lines_number UNIQUE (purchase_request_id, line_number),
  CONSTRAINT chk_purchase_request_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_request_lines_unit_rate_non_negative CHECK (unit_rate >= 0),
  CONSTRAINT chk_purchase_request_lines_amount_non_negative CHECK (line_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_request_lines_company_material
  ON purchase_request_lines(company_id, material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_request_lines_request
  ON purchase_request_lines(purchase_request_id, line_number);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_number VARCHAR(64) NOT NULL,
  purchase_request_id BIGINT NULL REFERENCES purchase_requests(id),
  po_date DATE NOT NULL,
  expected_delivery_date DATE NULL,
  vendor_id BIGINT NOT NULL REFERENCES vendor_master(id),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_by_user_id BIGINT NULL REFERENCES users(id),
  approved_by_user_id BIGINT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_orders_company_number UNIQUE (company_id, po_number),
  CONSTRAINT chk_purchase_orders_status CHECK (
    status IN (
      'draft',
      'submitted',
      'approved',
      'partially_received',
      'closed',
      'cancelled'
    )
  ),
  CONSTRAINT chk_purchase_orders_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_status_date
  ON purchase_orders(company_id, status, po_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor
  ON purchase_orders(company_id, vendor_id, po_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_request
  ON purchase_orders(company_id, purchase_request_id);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_request_line_id BIGINT NULL REFERENCES purchase_request_lines(id),
  line_number INTEGER NOT NULL,
  material_id BIGINT NOT NULL REFERENCES material_master(id),
  description TEXT NULL,
  ordered_quantity NUMERIC(14, 3) NOT NULL,
  received_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_order_lines_number UNIQUE (purchase_order_id, line_number),
  CONSTRAINT chk_purchase_order_lines_ordered_positive CHECK (ordered_quantity > 0),
  CONSTRAINT chk_purchase_order_lines_received_non_negative CHECK (received_quantity >= 0),
  CONSTRAINT chk_purchase_order_lines_received_cap CHECK (received_quantity <= ordered_quantity),
  CONSTRAINT chk_purchase_order_lines_unit_rate_non_negative CHECK (unit_rate >= 0),
  CONSTRAINT chk_purchase_order_lines_amount_non_negative CHECK (line_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_company_material
  ON purchase_order_lines(company_id, material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order
  ON purchase_order_lines(purchase_order_id, line_number);
