# Procurement UAT and Go-Live Checklist

## Document Control
- Document ID: `ERP-PROC-UAT-GL-2026-04-22`
- Version: `1.0`
- Date: `2026-04-22`
- Status: `Official`
- Audience: Operations Head, Purchase Team, Finance Lead, QA Lead

## Scope
This checklist validates practical readiness of:
- `Purchase Requests`
- `Purchase Orders`
- `Goods Receipts (GRN)`
- `Purchase Invoices`
- `Accounts Payable linkage`

## Pre-UAT Setup
- Master data loaded: vendors, materials, ledgers, posting rules.
- Roles validated: `super_admin`, `manager`, `hr`.
- Finance posting rules active for:
  - `accounts_payable.bill_to_payable`
  - `accounts_payable.payment_settlement`
- Baseline database backup captured before UAT cycle.

## UAT Functional Cases
| Case ID | Flow | Expected Result | Status |
|---|---|---|---|
| PROC-UAT-01 | Create PR with multiple lines | PR saved in `draft`, totals correct | pending |
| PROC-UAT-02 | Submit + approve PR | Status transitions valid and audited | pending |
| PROC-UAT-03 | Create PO from approved PR | PO created with line linkage | pending |
| PROC-UAT-04 | Partial GRN against PO | PO status `partially_received` | pending |
| PROC-UAT-05 | Final GRN closes balance | PO status `closed` when all received | pending |
| PROC-UAT-06 | Create invoice with matched qty/rate | `match_status = matched`, AP link created | pending |
| PROC-UAT-07 | Create invoice with rate variance | `match_status = variance`, still postable by policy | pending |
| PROC-UAT-08 | Invoice with billed qty above received | `match_status = blocked`, AP posting blocked | pending |
| PROC-UAT-09 | Post draft invoice to AP manually | `payable_id` attached and status `posted` | pending |
| PROC-UAT-10 | Settle payable | settlement voucher posted, outstanding updated | pending |

## Security and Access Cases
- HR can view procurement records but cannot create/update/write routes.
- Non-finance operational roles cannot access procurement write APIs.
- Unauthenticated requests are blocked on all procurement endpoints.

## Data Integrity Cases
- No cross-company data leakage in list/detail APIs.
- GRN accepted quantity cannot exceed pending PO quantity.
- Invoice billed quantity cannot exceed received-not-invoiced balance.
- AP payable amount equals purchase invoice total for posted invoices.

## Go-Live Cutover Checklist
1. Apply migrations up to `036_phase1_procurement_grn_invoice.sql`.
2. Run backend test suite and frontend verify pipeline green.
3. Run procurement integration suite:
   - `cd backend && npm run test:procurement:integration`
4. Confirm both integration scenarios pass:
   - full chain: `PR -> PO -> GRN -> Invoice -> AP -> Settlement`
   - blocked invoice: billed quantity above received quantity does not create payable
5. Run dry-run with one company and sign-off all UAT cases.
6. Freeze role matrix and posting rule configurations.
7. Capture first-day operational monitoring owner list.

## Day-1 Monitoring
- Track blocked invoices and variance invoices every 2 hours.
- Reconcile PO received quantity vs GRN lines end of day.
- Reconcile purchase invoices vs payables count and value.
- Escalate any mismatch beyond 0.5% daily value threshold.
