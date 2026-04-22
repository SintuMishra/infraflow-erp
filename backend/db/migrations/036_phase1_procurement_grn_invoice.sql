CREATE TABLE IF NOT EXISTS goods_receipts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grn_number TEXT NOT NULL,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  vendor_id BIGINT NOT NULL REFERENCES vendor_master(id),
  receipt_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  notes TEXT NULL,
  received_by_user_id BIGINT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_goods_receipts_company_number UNIQUE (company_id, grn_number),
  CONSTRAINT chk_goods_receipts_status CHECK (status IN ('received', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_company_status_date
  ON goods_receipts(company_id, status, receipt_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_company_po
  ON goods_receipts(company_id, purchase_order_id, receipt_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  goods_receipt_id BIGINT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id BIGINT NOT NULL REFERENCES purchase_order_lines(id),
  line_number INT NOT NULL,
  material_id BIGINT NOT NULL REFERENCES material_master(id),
  received_quantity NUMERIC(14, 3) NOT NULL,
  accepted_quantity NUMERIC(14, 3) NOT NULL,
  rejected_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_goods_receipt_lines_number UNIQUE (goods_receipt_id, line_number),
  CONSTRAINT chk_goods_receipt_lines_received_positive CHECK (received_quantity > 0),
  CONSTRAINT chk_goods_receipt_lines_accepted_non_negative CHECK (accepted_quantity >= 0),
  CONSTRAINT chk_goods_receipt_lines_rejected_non_negative CHECK (rejected_quantity >= 0),
  CONSTRAINT chk_goods_receipt_lines_quantity_balance CHECK (
    accepted_quantity + rejected_quantity <= received_quantity
  ),
  CONSTRAINT chk_goods_receipt_lines_unit_rate_non_negative CHECK (unit_rate >= 0),
  CONSTRAINT chk_goods_receipt_lines_amount_non_negative CHECK (line_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_company_material
  ON goods_receipt_lines(company_id, material_id);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_company_po_line
  ON goods_receipt_lines(company_id, purchase_order_line_id);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  goods_receipt_id BIGINT NULL REFERENCES goods_receipts(id),
  vendor_id BIGINT NOT NULL REFERENCES vendor_master(id),
  payable_id BIGINT NULL REFERENCES payables(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  match_status TEXT NOT NULL DEFAULT 'pending',
  mismatch_notes TEXT NULL,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by_user_id BIGINT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_invoices_company_number UNIQUE (company_id, invoice_number),
  CONSTRAINT chk_purchase_invoices_status CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT chk_purchase_invoices_match_status CHECK (match_status IN ('pending', 'matched', 'variance', 'blocked')),
  CONSTRAINT chk_purchase_invoices_total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT chk_purchase_invoices_due_after_invoice CHECK (due_date >= invoice_date)
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_status_date
  ON purchase_invoices(company_id, status, invoice_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_match
  ON purchase_invoices(company_id, match_status, invoice_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_vendor
  ON purchase_invoices(company_id, vendor_id, invoice_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_invoice_id BIGINT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  purchase_order_line_id BIGINT NOT NULL REFERENCES purchase_order_lines(id),
  goods_receipt_line_id BIGINT NULL REFERENCES goods_receipt_lines(id),
  line_number INT NOT NULL,
  material_id BIGINT NOT NULL REFERENCES material_master(id),
  billed_quantity NUMERIC(14, 3) NOT NULL,
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'pending',
  variance_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  variance_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  variance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_invoice_lines_number UNIQUE (purchase_invoice_id, line_number),
  CONSTRAINT chk_purchase_invoice_lines_qty_positive CHECK (billed_quantity > 0),
  CONSTRAINT chk_purchase_invoice_lines_rate_non_negative CHECK (unit_rate >= 0),
  CONSTRAINT chk_purchase_invoice_lines_amount_non_negative CHECK (line_amount >= 0),
  CONSTRAINT chk_purchase_invoice_lines_match_status CHECK (match_status IN ('pending', 'matched', 'variance', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_company_material
  ON purchase_invoice_lines(company_id, material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_company_po_line
  ON purchase_invoice_lines(company_id, purchase_order_line_id);
