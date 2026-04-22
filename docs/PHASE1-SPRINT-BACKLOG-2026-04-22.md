# Construction ERP Phase-1 Sprint Backlog

## Document Control
- Date: `2026-04-22`
- Plan Reference: `PHASE1-ERP-EXPANSION-ROADMAP-2026-04-22.md`
- Release Target: `2026-07-13`

## Usage
- Use this as the execution board for engineering + QA.
- Keep ticket status in one of: `todo`, `in_progress`, `blocked`, `done`.
- Do not move a ticket to `done` without passing acceptance criteria.

## Sprint Calendar
| Sprint | Dates | Primary Outcome |
|---|---|---|
| Sprint 1 | 2026-04-27 to 2026-05-09 | Procurement foundation (`PR`, `PO`) |
| Sprint 2 | 2026-05-10 to 2026-05-23 | Procurement completion (`GRN`) + inventory foundation |
| Sprint 3 | 2026-05-24 to 2026-06-06 | Inventory completion + controls |
| Sprint 4 | 2026-06-07 to 2026-06-20 | Contract billing (`contracts`, `RA`) |
| Sprint 5 | 2026-06-21 to 2026-07-03 | Payroll/compliance lite + stabilization |
| UAT Hardening | 2026-07-04 to 2026-07-10 | UAT fixes + regression closure |

## Global Definition Of Done
1. DB migration applied and rollback notes added.
2. Controller/service/model/validation implemented with company scope enforcement.
3. Route-level role access tests added.
4. Unit + integration tests added and green.
5. Audit event coverage added for status-changing actions.
6. Frontend page integrated in router and role guard maps.
7. Smoke flow script updated or added.
8. Documentation updated in module guide and operations guide.

## Sprint 1 Backlog (Procurement Foundation)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| P1-DB-01 | Add `purchase_requests`, `purchase_request_lines` tables | Backend | None | Migration runs clean, FK scope enforced, indexes on `company_id`, `status`, `request_date` | done |
| P1-BE-01 | `purchase_requests` module (CRUD + submit/cancel) | Backend | P1-DB-01 | Valid states only, audit logs recorded, company scope enforced | done |
| P1-FE-01 | `PurchaseRequestsPage` with list/create/edit/submit | Frontend | P1-BE-01 | Page usable for manager flow, role guard applied | done |
| P1-QA-01 | API tests for PR validation and access rules | QA/Backend | P1-BE-01 | Failing cases covered (invalid state, out-of-scope, unauthorized) | done |
| P1-DB-02 | Add `purchase_orders`, `purchase_order_lines` tables | Backend | P1-DB-01 | PO lines linked to PR lines and vendor/material, company-safe FKs | done |
| P1-BE-02 | `purchase_orders` module (create/approve/close) | Backend | P1-DB-02 | Partial/full quantity tracking works, invalid transitions blocked | done |
| P1-FE-02 | `PurchaseOrdersPage` with approve queue | Frontend | P1-BE-02 | Maker/checker separation respected at UI level | done |
| P1-QA-02 | Integration test `PR -> PO` | QA/Backend | P1-BE-02 | Happy path and over-quantity rejection path both pass | in_progress |

## Sprint 2 Backlog (GRN + Inventory Foundation)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| P2-DB-01 | Add `goods_receipts`, `goods_receipt_lines` tables | Backend | P1-DB-02 | GRN linked to PO lines, received qty caps enforced by DB + service | done |
| P2-BE-01 | `goods_receipts` module (partial/full receipt) | Backend | P2-DB-01 | PO status auto-updates to `partially_received`/`closed` correctly | done |
| P2-FE-01 | `GoodsReceiptsPage` | Frontend | P2-BE-01 | User can receive against open PO lines only | done |
| P2-QA-01 | Integration test `PR -> PO -> partial GRN -> full GRN` | QA/Backend | P2-BE-01 | End state closes PO, duplicate receipt blocked | in_progress |
| P2-DB-03 | Add `purchase_invoices`, `purchase_invoice_lines` tables | Backend | P2-DB-01 | Invoice lines linked to PO/GRN with match-status constraints | done |
| P2-BE-03 | `purchase_invoices` module with AP linkage | Backend | P2-DB-03 | 3-way match status computed and payable link created/postable | done |
| P2-FE-03 | `PurchaseInvoicesPage` | Frontend | P2-BE-03 | Finance can create invoice, review match status, post to AP | done |
| P2-QA-03 | Integration test `PO -> GRN -> Invoice -> AP` | QA/Backend | P2-BE-03 | Blocked/matched cases validated with payable creation checks | in_progress |
| P2-DB-02 | Add `inventory_items`, `inventory_site_balances` | Backend | P2-DB-01 | Site + material unique balance rows enforced | todo |
| P2-BE-02 | `inventory_items` master module | Backend | P2-DB-02 | Items CRUD with unit/category validation and company scope | todo |
| P2-FE-02 | `InventoryItemsPage` | Frontend | P2-BE-02 | Items management page functional with filters/search | todo |

## Sprint 3 Backlog (Inventory Completion)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| P3-DB-01 | Add `stock_movements`, `stock_reorder_rules` | Backend | P2-DB-02 | Movement types constrained, reorder rules scoped per site/item | todo |
| P3-BE-01 | Stock movement engine (`grn_in`, `issue_out`, `return_in`, `adjustment`) | Backend | P3-DB-01 | Running balance accurate, negative stock blocked by default | todo |
| P3-BE-02 | Reorder alert query/API | Backend | P3-DB-01 | Below-threshold list accurate and filterable by site | todo |
| P3-FE-01 | `StockLedgerPage` | Frontend | P3-BE-01 | Opening/running/closing balance view available by date range | todo |
| P3-FE-02 | `MaterialIssueReturnPage` | Frontend | P3-BE-01 | Issue/return forms validate movement direction and quantity | todo |
| P3-QA-01 | Concurrency tests for parallel stock issues | QA/Backend | P3-BE-01 | Overspend/negative-race blocked under concurrent requests | todo |

## Sprint 4 Backlog (Contract Billing)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| P4-DB-01 | Add `client_contracts`, `client_contract_items` | Backend | None | Contract quantities/values scoped by company and party | todo |
| P4-BE-01 | Contracts module (create/amend/activate/close) | Backend | P4-DB-01 | Closed contracts lock further billable actions | todo |
| P4-FE-01 | `ClientContractsPage` | Frontend | P4-BE-01 | Contract item setup/edit and status transitions available | todo |
| P4-DB-02 | Add `ra_bills`, `ra_bill_lines` | Backend | P4-DB-01 | Line-level cap vs contract qty/value enforced | todo |
| P4-BE-02 | RA module (`draft`, `submitted`, `certified`, `rejected`, `invoiced`) | Backend | P4-DB-02 | Certification audit trail stored, invalid transitions blocked | todo |
| P4-BE-03 | Create receivable from certified RA | Backend | P4-BE-02 | AR entry idempotent and source-linked to RA | todo |
| P4-FE-02 | `RABillsPage` + `RACertificationQueuePage` | Frontend | P4-BE-02 | Certification flow role-restricted and operational | todo |
| P4-QA-01 | Integration `contract -> RA -> certify -> receivable` | QA/Backend | P4-BE-03 | Overbilling and duplicate receivable cases blocked | todo |

## Sprint 5 Backlog (Payroll & Compliance Lite + Stabilization)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| P5-DB-01 | Add `attendance_entries`, `payroll_runs`, `payroll_run_lines` | Backend | None | Payroll period uniqueness and row integrity enforced | todo |
| P5-BE-01 | Attendance ingest (CSV schema + validation) | Backend | P5-DB-01 | Invalid row report generated with row-level errors | todo |
| P5-BE-02 | Payroll computation service (base, LOP, OT, deductions) | Backend | P5-DB-01 | Totals deterministic and re-runnable idempotently | todo |
| P5-DB-02 | Add `statutory_register_snapshots` | Backend | P5-BE-02 | Snapshot immutability for finalized payroll run | todo |
| P5-BE-03 | Compliance export API (PF/ESI/TDS summary) | Backend | P5-DB-02 | CSV/JSON exports available for finalized runs only | todo |
| P5-FE-01 | `AttendanceImportPage` | Frontend | P5-BE-01 | Preview + validation errors visible before commit | todo |
| P5-FE-02 | `PayrollRunPage` | Frontend | P5-BE-02 | Draft/finalize cycle with role restrictions works | todo |
| P5-FE-03 | `ComplianceRegistersPage` | Frontend | P5-BE-03 | Export actions work and are audit logged | todo |
| P5-QA-01 | Payroll edge-case test pack | QA/Backend | P5-BE-02 | LOP/OT/deduction caps validated with fixtures | todo |
| P5-QA-02 | Full phase regression + pre-live run | QA | All prior | `final-prelive-check.sh` remains green | todo |

## UAT Hardening Backlog (2026-07-04 to 2026-07-10)
| Ticket | Scope | Owner | Depends On | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| UAT-01 | Operations UAT feedback fixes | Engineering | Sprint 1-5 | All Sev-1 and Sev-2 defects closed | todo |
| UAT-02 | Finance UAT feedback fixes | Engineering | Sprint 1-5 | All posting/report mismatches resolved | todo |
| UAT-03 | Security and access regression pack | QA | Sprint 1-5 | Unauthorized access attempts blocked in all new modules | todo |
| UAT-04 | Deployment dry-run + rollback proof | DevOps/Backend | UAT-01, UAT-02 | Successful dry run and validated rollback notes | todo |

## Critical Risks And Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Cross-company data leakage via new joins | High | Mandatory `company_id` in every relation and query contract tests |
| Inventory race conditions | High | Row-level locking + concurrency tests in Sprint 3 |
| Billing overrun vs contract quantities | High | DB constraints + service validation + integration tests |
| Payroll calculation disputes | Medium | Deterministic compute snapshots + audit trace + fixture regression pack |
| Timeline slippage | Medium | Keep out-of-scope items frozen until Phase-1 closes |

## Weekly Ritual
1. Monday: sprint planning and dependency review.
2. Wednesday: cross-stream integration checkpoint.
3. Friday: demo + acceptance criteria sign-off.
