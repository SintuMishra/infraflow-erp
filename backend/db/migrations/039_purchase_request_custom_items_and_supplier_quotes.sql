ALTER TABLE purchase_request_lines
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE purchase_request_lines
  ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_item_uom VARCHAR(64),
  ADD COLUMN IF NOT EXISTS custom_item_spec TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_purchase_request_line_item_reference'
  ) THEN
    ALTER TABLE purchase_request_lines
      ADD CONSTRAINT chk_purchase_request_line_item_reference
      CHECK (
        material_id IS NOT NULL
        OR NULLIF(BTRIM(custom_item_name), '') IS NOT NULL
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_request_line_supplier_quotes (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_request_id BIGINT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  purchase_request_line_id BIGINT NOT NULL REFERENCES purchase_request_lines(id) ON DELETE CASCADE,
  vendor_id BIGINT NULL REFERENCES vendor_master(id),
  supplier_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(120) NULL,
  contact_phone VARCHAR(32) NULL,
  quoted_unit_rate NUMERIC(14, 2) NULL,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'INR',
  lead_time_days INTEGER NULL,
  quote_notes TEXT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pr_quote_supplier_name_non_blank CHECK (BTRIM(supplier_name) <> ''),
  CONSTRAINT chk_pr_quote_rate_non_negative CHECK (
    quoted_unit_rate IS NULL OR quoted_unit_rate >= 0
  ),
  CONSTRAINT chk_pr_quote_lead_time_non_negative CHECK (
    lead_time_days IS NULL OR lead_time_days >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_pr_line_quotes_request_line
  ON purchase_request_line_supplier_quotes(purchase_request_line_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_pr_line_quotes_company_request
  ON purchase_request_line_supplier_quotes(company_id, purchase_request_id, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pr_line_single_selected_quote
  ON purchase_request_line_supplier_quotes(purchase_request_line_id)
  WHERE is_selected = TRUE;
