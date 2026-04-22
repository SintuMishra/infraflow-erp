# Construction ERP Phase-1 Expansion Roadmap

## Document Control
- Date: `2026-04-22`
- Owner: Product + Engineering
- Scope: Phase-1 functional expansion after current production baseline

## Goal
Deliver the highest-impact missing modules for real-world construction company operations without destabilizing the existing production-ready core.

## Execution Artifacts
- `docs/PHASE1-SPRINT-BACKLOG-2026-04-22.md`
- `docs/PHASE1-SPRINT-BACKLOG-IMPORT-2026-04-22.csv`

## Phase-1 Modules (Priority Order)
1. Procurement (`PR -> PO -> GRN -> Purchase Bill Link`)
2. Stores & Inventory (`stock ledger, issue/return, reorder alerts`)
3. Contract Billing (`client contract items, RA bill, certification status`)
4. Payroll & Compliance Lite (`attendance import, wage run, PF/ESI/TDS registers`)

## Delivery Window
- Planned start: `2026-04-27`
- Planned code-freeze: `2026-07-03`
- Planned UAT close: `2026-07-10`
- Planned production release: `2026-07-13`

## Stream-Wise Build Plan

### Stream A: Procurement (Weeks of 2026-04-27 to 2026-05-16)
Backend:
- Add modules: `purchase_requests`, `purchase_orders`, `goods_receipts`
- Add validation states: `draft`, `submitted`, `approved`, `partially_received`, `closed`, `cancelled`
- Enforce company scope + audit logs on every status transition
- Link GRN lines to vendor and material masters

Database:
- Create tables:
  - `purchase_requests`
  - `purchase_request_lines`
  - `purchase_orders`
  - `purchase_order_lines`
  - `goods_receipts`
  - `goods_receipt_lines`
- Add indexes for `company_id`, `status`, `request_date`, `vendor_id`
- Add FK guardrails for cross-company integrity

Frontend:
- Pages:
  - `PurchaseRequestsPage`
  - `PurchaseOrdersPage`
  - `GoodsReceiptsPage`
- Add role permissions for maker-checker in procurement workflows

Tests:
- Model tests for state transitions and quantity caps
- Route access tests for approval permissions
- Integration test: `PR -> PO -> partial GRN -> full GRN -> close`

### Stream B: Stores & Inventory (Weeks of 2026-05-18 to 2026-06-06)
Backend:
- Add modules: `inventory_items`, `stock_movements`, `stock_reorder_rules`
- Movement types: `grn_in`, `issue_out`, `return_in`, `adjustment`
- Prevent negative stock unless explicit policy override enabled

Database:
- Create tables:
  - `inventory_items`
  - `inventory_site_balances`
  - `stock_movements`
  - `stock_reorder_rules`
- Add material+site unique constraints

Frontend:
- Pages:
  - `InventoryItemsPage`
  - `StockLedgerPage`
  - `MaterialIssueReturnPage`
- Add dashboard cards for below-reorder items

Tests:
- Concurrency test for parallel issue transactions
- Validation tests for movement type and quantity signs
- Report test for opening/running/closing stock correctness

### Stream C: Contract Billing (Weeks of 2026-06-08 to 2026-06-20)
Backend:
- Add modules: `client_contracts`, `contract_items`, `ra_bills`
- RA states: `draft`, `submitted`, `certified`, `rejected`, `invoiced`
- Link certified RA bills to receivables creation

Database:
- Create tables:
  - `client_contracts`
  - `client_contract_items`
  - `ra_bills`
  - `ra_bill_lines`
- Add constraints to prevent billing beyond contract quantity/value

Frontend:
- Pages:
  - `ClientContractsPage`
  - `RABillsPage`
  - `RACertificationQueuePage`

Tests:
- Overbilling prevention tests
- RA certification permission tests
- AR integration test from certified RA

### Stream D: Payroll & Compliance Lite (Weeks of 2026-06-22 to 2026-07-03)
Backend:
- Add modules: `attendance_entries`, `payroll_runs`, `statutory_registers`
- Generate salary sheets and summary registers for PF/ESI/TDS
- Keep this phase export-first (CSV/JSON) before e-filing integration

Database:
- Create tables:
  - `attendance_entries`
  - `payroll_runs`
  - `payroll_run_lines`
  - `statutory_register_snapshots`

Frontend:
- Pages:
  - `AttendanceImportPage`
  - `PayrollRunPage`
  - `ComplianceRegistersPage`

Tests:
- Payroll computation tests with edge cases (LOP, overtime, deduction caps)
- Permission tests for payroll lock/finalize actions
- Register snapshot consistency tests

## Cross-Cutting Non-Negotiables
- Keep multi-company isolation and enforce company FK scope.
- Keep audit trail for every approval/state transition.
- Add migration rollback notes for each new migration file.
- Add smoke scripts for each new module flow.
- Add route-level authorization tests for all write endpoints.

## Release Gates
1. All module tests green in CI.
2. `final-prelive-check.sh` remains green without regressions.
3. UAT sign-off from Operations + Finance + Admin.
4. Dry-run migration on staging snapshot with rollback proof.
5. Production cutover checklist completed on release day (`2026-07-13`).

## Out-of-Scope for Phase-1
- Full GST/TDS e-filing automation
- Advanced payroll tax engine for all state regimes
- Heavy BI data warehouse layer
- Mobile field-app rollout

## Immediate Next Action (Week of 2026-04-27)
1. Freeze detailed schema for Procurement + Inventory.
2. Create migration sequence IDs and API contract drafts.
3. Start Stream A implementation with PR/PO foundations.
