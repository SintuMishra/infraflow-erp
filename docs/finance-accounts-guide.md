# Construction ERP - Finance and Accounts Operations Guide

## Document Control
- Document ID: `ERP-FIN-OPS-001`
- Version: `1.0`
- Date: `2026-04-18`
- Audience: Finance managers, accountants, compliance reviewers

## 1. Scope
This guide covers practical usage of the Accounts module already implemented in the ERP.

## 2. Finance Workspaces
- Accounts Dashboard
- Chart of Accounts and Ledgers
- Voucher Entry + workflow inbox
- Receivables
- Payables
- Cash/Bank
- Finance Reports
- Accounting Period Controls
- Finance Policy Controls

## 3. Voucher Lifecycle
1. Create draft voucher with balanced lines
2. Submit for checker review
3. Approve or reject
4. Post approved voucher
5. Use reversal for corrections

Control expectations:
- Unbalanced vouchers must not post
- Posted vouchers are immutable
- Workflow and transition evidence must remain visible

## 4. Receivables and Dispatch Linkage
- Completed dispatch can be marked finance-ready
- Receivable creation is controlled from dispatch linkage
- Settlement should not exceed outstanding
- Use CSV exports for review and reconciliation packs

## 5. Payables Workflow
- Create payable bills with due-date sanity
- Track outstanding by status
- Settle with reference capture
- Keep bill-date/due-date quality clean for ageing reports

## 6. Cash/Bank Operations
- Bank account master should be ledger-linked
- Receipt/payment/contra entries should validate required ledgers
- Keep narration and references complete for audit and bank reconciliation

## 7. Reports and Compliance Views
Primary outputs:
- Trial balance
- Voucher register
- Receivable ageing
- Payable ageing
- Cash book
- Bank book
- Finance transition history

Use exports for:
- month-end evidence
- internal controls review
- management pack circulation

## 8. Period and Policy Governance
- Period close/reopen affects posting safety
- Policy controls define same-user exceptions in maker-checker flow
- Keep dangerous overrides minimal and time-bound

## 9. UAT and Evidence References
- `docs/finance-uat-flow-2026-04-18.md`
- `docs/finance-rollout-evidence-2026-04-18.md`
- `docs/finance-production-hardening-report-2026-04-18.md`

## 10. Daily Finance Checklist
- Review approval and posting queues
- Check ageing trend and overdue movement
- Validate period posture before posting windows
- Export transition/compliance data for daily log pack
