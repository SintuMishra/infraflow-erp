ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS requested_by_employee_id BIGINT NULL REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS request_purpose TEXT NULL;

ALTER TABLE purchase_request_lines
  ADD COLUMN IF NOT EXISTS item_category TEXT NOT NULL DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_purchase_request_lines_item_category'
  ) THEN
    ALTER TABLE purchase_request_lines
      ADD CONSTRAINT chk_purchase_request_lines_item_category
      CHECK (item_category IN ('material', 'equipment', 'spare_part', 'consumable', 'service'));
  END IF;
END $$;

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS item_category TEXT NOT NULL DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_purchase_order_lines_item_category'
  ) THEN
    ALTER TABLE purchase_order_lines
      ADD CONSTRAINT chk_purchase_order_lines_item_category
      CHECK (item_category IN ('material', 'equipment', 'spare_part', 'consumable', 'service'));
  END IF;
END $$;

ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS item_category TEXT NOT NULL DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_goods_receipt_lines_item_category'
  ) THEN
    ALTER TABLE goods_receipt_lines
      ADD CONSTRAINT chk_goods_receipt_lines_item_category
      CHECK (item_category IN ('material', 'equipment', 'spare_part', 'consumable', 'service'));
  END IF;
END $$;

ALTER TABLE purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS item_category TEXT NOT NULL DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_purchase_invoice_lines_item_category'
  ) THEN
    ALTER TABLE purchase_invoice_lines
      ADD CONSTRAINT chk_purchase_invoice_lines_item_category
      CHECK (item_category IN ('material', 'equipment', 'spare_part', 'consumable', 'service'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company_requester
  ON purchase_requests(company_id, requested_by_employee_id, request_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_request_lines_company_category
  ON purchase_request_lines(company_id, item_category);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_company_category
  ON purchase_order_lines(company_id, item_category);
