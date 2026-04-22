ALTER TABLE purchase_request_lines
  DROP CONSTRAINT IF EXISTS chk_purchase_request_lines_item_category;

ALTER TABLE purchase_request_lines
  ADD CONSTRAINT chk_purchase_request_lines_item_category
  CHECK (item_category ~ '^[a-z][a-z0-9_]{1,49}$');

ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS chk_purchase_order_lines_item_category;

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT chk_purchase_order_lines_item_category
  CHECK (item_category ~ '^[a-z][a-z0-9_]{1,49}$');

ALTER TABLE goods_receipt_lines
  DROP CONSTRAINT IF EXISTS chk_goods_receipt_lines_item_category;

ALTER TABLE goods_receipt_lines
  ADD CONSTRAINT chk_goods_receipt_lines_item_category
  CHECK (item_category ~ '^[a-z][a-z0-9_]{1,49}$');

ALTER TABLE purchase_invoice_lines
  DROP CONSTRAINT IF EXISTS chk_purchase_invoice_lines_item_category;

ALTER TABLE purchase_invoice_lines
  ADD CONSTRAINT chk_purchase_invoice_lines_item_category
  CHECK (item_category ~ '^[a-z][a-z0-9_]{1,49}$');
