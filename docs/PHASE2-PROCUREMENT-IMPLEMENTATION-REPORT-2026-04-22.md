# Phase-2 Procurement Implementation Report

## Document Control
- Document ID: `ERP-PHASE2-PROC-IMPL-2026-04-22`
- Version: `1.0`
- Date: `2026-04-22`
- Status: `Official`

## Summary
Implemented practical Phase-2 procurement coverage:
- `goods_receipts` + `goods_receipt_lines`
- `purchase_invoices` + `purchase_invoice_lines`
- 3-way matching status computation (`matched`, `variance`, `blocked`)
- AP linkage by creating/posting payable from purchase invoices

## Backend Changes
- Migration added:
  - `backend/db/migrations/036_phase1_procurement_grn_invoice.sql`
- New modules:
  - `backend/src/modules/goods_receipts/*`
  - `backend/src/modules/purchase_invoices/*`
- API route mounts added:
  - `/api/goods-receipts`
  - `/api/purchase-invoices`
- Company scope required tables extended with new procurement tables.

## Frontend Changes
- Added pages:
  - `web_admin/src/pages/GoodsReceiptsPage.jsx`
  - `web_admin/src/pages/PurchaseInvoicesPage.jsx`
- Added route guards + router entries + sidebar links for both pages.

## Test and Verification Additions
- Migration runner updated for `036` and table assertions.
- API mount tests updated for new routes.
- Route access test coverage added for Phase-2 procurement modules.

## Practical Behavior Implemented
- GRN creation validates PO/vendor scope and line quantity caps.
- PO line `received_quantity` auto-updated on GRN creation.
- PO status auto-moves to `partially_received` / `closed`.
- Invoice create computes line/header match status against PO/received quantities.
- Blocked invoice cannot be posted to payable.
- Matched/variance invoice can auto-create AP payable and be posted.

## Residual Work
- Add dedicated integration tests for complete chain with DB fixtures.
- Add procurement exception dashboard for blocked/variance monitoring.
- Add approval-policy thresholds for variance tolerances by amount.
