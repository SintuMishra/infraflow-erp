# Finance UAT Flow (2026-04-18)

## Goal
Validate real-world end-to-end accounting flow in company-scoped ERP context.

## Preconditions
- Backend and frontend running.
- Company context selected.
- Finance write user role: `super_admin` or `manager`.

## UAT Steps

1. Bootstrap finance masters
- API/UI: `Accounts > Masters > Bootstrap Defaults`
- Expected:
  - account groups/accounts/control ledgers created
  - posting rules created
  - audit event logged (`finance.bootstrap.defaults`).

2. Sync party/vendor ledgers
- API/UI: `Accounts > Masters > Sync Party Ledgers`
- Expected:
  - customer/supplier/vendor ledgers created idempotently
  - repeated run should not duplicate ledgers.

3. Create chart/ledger sanity record
- Add one operational ledger under valid active account (if needed).
- Expected:
  - company-scope validation passes
  - invalid cross-company references are rejected.

4. Create accounting period (open)
- Add FY and period for voucher dates used in UAT.
- Expected:
  - no overlap violation
  - period falls within FY date window.

5. Create manual journal voucher
- API/UI: `Accounts > Voucher Entry`
- Create balanced DR/CR lines.
- Post voucher.
- Expected:
  - draft created
  - post succeeds only when balanced + approved + period open
  - audit logged.

6. Dispatch to receivable control flow
- Ensure a dispatch record is `completed` and invoice value > 0.
- Mark dispatch finance-ready.
- Create receivable from dispatch.
- Expected:
  - duplicate create blocked for same dispatch
  - source link persisted (`dispatch_to_receivable`)
  - dispatch finance state updated.

7. Receive customer payment (settle receivable)
- Settle a partial amount first.
- Settle remaining amount second.
- Expected:
  - settlement amount cannot exceed outstanding
  - outstanding/status transitions: `open -> partial -> settled`
  - settlement voucher posted
  - settlement source links traceable.

8. Create and settle payable
- Create payable against party or vendor (exactly one).
- Settle payable by payment voucher.
- Expected:
  - invalid dual-counterparty blocked
  - dueDate before billDate blocked
  - settlement date before billDate blocked
  - outstanding/status transitions validated.

9. Validate financial reports
- Run from `Accounts > Reports`:
  - Trial Balance
  - Ledger report (for impacted ledger)
  - Receivable Ageing
  - Payable Ageing
  - Cash Book
  - Bank Book
  - Voucher Register
- Expected:
  - trial balance reflects posted movements only
  - running balances start from opening + prior movement
  - ageing bucket totals reconcile with outstanding.

10. Reverse a posted finance transaction
- Reverse a posted journal/payment/receipt voucher.
- Expected:
  - reversal voucher auto-created and posted
  - original voucher status changed to `reversed`
  - posted voucher direct edits blocked
  - source link marks reversal metadata.

11. Security and scope checks
- Try finance write actions with `hr` role.
- Try accessing records outside selected company scope.
- Expected:
  - write denied for unauthorized roles
  - company scope enforced.

## UAT Evidence To Capture
- Voucher numbers + statuses before/after posting/reversal.
- Receivable/payable outstanding snapshots before and after settlements.
- Report screenshots showing balances and ageing buckets.
- Audit log entries for create/post/settle/reverse events.

## Pass Criteria
- No unbalanced posting allowed.
- No posted voucher mutable through API/DB paths.
- No settlement beyond outstanding.
- No duplicate dispatch receivable creation.
- Reports reconcile to transaction activity.
- Role and company scope protections consistently enforced.
