# Finance Production Hardening Report (2026-04-18)

## Scope Completed
Phase-2 hardening was applied directly to DB, backend, tests, and Accounts UI for production-readiness uplift.

## Audited Finance Files

### Database
- `backend/db/migrations/019_accounts_finance_foundation.sql`
- `backend/db/migrations/020_accounts_finance_hardening.sql`

### Backend Modules
- `backend/src/modules/accounts_masters/*`
- `backend/src/modules/general_ledger/*`
- `backend/src/modules/journal_vouchers/*`
- `backend/src/modules/accounts_receivable/*`
- `backend/src/modules/accounts_payable/*`
- `backend/src/modules/cash_bank/*`
- `backend/src/modules/finance_posting_rules/*`
- `backend/src/modules/financial_reports/*`
- `backend/src/routes/index.js`

### Frontend Accounts Surfaces
- `web_admin/src/pages/AccountsDashboardPage.jsx`
- `web_admin/src/pages/AccountsChartOfAccountsPage.jsx`
- `web_admin/src/pages/AccountsLedgerPage.jsx`
- `web_admin/src/pages/AccountsVoucherEntryPage.jsx`
- `web_admin/src/pages/AccountsReceivablesPage.jsx`
- `web_admin/src/pages/AccountsPayablesPage.jsx`
- `web_admin/src/pages/AccountsCashBankPage.jsx`
- `web_admin/src/pages/AccountsReportsPage.jsx`
- `web_admin/src/pages/accountsCommon.js`
- `web_admin/src/app/router.jsx`
- `web_admin/src/utils/access.js`

### Finance Tests
- `backend/tests/finance-engine.test.js`
- `backend/tests/accounts-receivable.service.test.js`
- `backend/tests/finance-route-access.test.js`
- `backend/tests/finance-validations.test.js` (new)
- `backend/tests/dashboard-commercial-exceptions.test.js` (stability fix)

## Hardening Changes Implemented

### 1. Financial Integrity
- Enforced stricter source-link contract in GL engine: `sourceModule/sourceRecordId/sourceEvent` must be complete when source-linked posting is used.
- Hardened voucher line validation:
  - party + vendor cannot coexist in one line
  - mapped party/vendor ledgers require matching party/vendor in lines
  - company-scope checks for party/vendor/plant/vehicle tags
- Improved reversal traceability:
  - reversal voucher now uses explicit source event
  - original source-links are marked `reversed` with reversal voucher metadata.
- Settlement flow hardening:
  - settlement source voucher must be `posted`
  - settlement date cannot precede source invoice/bill date
  - settlement posting now blocks maker-checker pending path in this flow (prevents subledger mutation without posted GL)
  - deterministic settlement source events added for idempotency semantics.

### 2. Database Hardening
- Removed overly restrictive unique constraint (`one voucher per settlement`) from `settlements`.
- Added scale indexes for outstanding/status/date usage on receivables/payables.
- Added cross-company composite integrity constraints/FKs for:
  - `voucher_lines -> vouchers(account/company)`
  - `voucher_lines -> chart_of_accounts(company)`
  - `voucher_lines -> ledgers(company)`
  - `ledgers -> chart_of_accounts(company)`
  - `receivables/payables/settlements -> vouchers(company)`
- Extended settlement trigger to validate on `INSERT` and `UPDATE`, and prevent source mutation after creation.
- Added posted voucher mutation protection trigger to prevent unsafe field edits.
- Extended posted voucher line immutability to block `INSERT` in addition to `UPDATE/DELETE`.

### 3. Backend Transition + Access Hardening
- Tightened finance write routes to `super_admin`/`manager` only:
  - payables create/settle
  - receivables mark-ready/create/settle
  - cash-bank create/update/voucher writes
- Receivable dispatch posting now updates dispatch finance status according to actual posting outcome (`posted` vs queued/pending path).
- Mark-dispatch-ready now blocks non-completed/already-posted dispatch states.
- Posting-rule creation now validates:
  - voucher type validity
  - debit/credit account difference
  - account scope + active status
  - party/vendor requirement conflict.
- Accounts masters hardened with pre-validation of cross-company references and date overlap checks for FY/period setup.

### 4. Reporting Hardening
- Fixed trial-balance aggregation bug so only posted/reversed vouchers contribute to sums.
- Added closing debit/credit decomposition in trial balance output.
- Ledger report now returns proper opening balance and running balances from opening + prior transactions.
- Party ledger report now supports opening + running balances.
- Receivable/payable ageing now returns practical accountant outputs:
  - detailed items
  - bucket totals
  - total outstanding.
- Voucher register now returns both item list and overall debit/credit totals.
- Cash book and bank book now include running balances by ledger stream.

### 5. UI/UX Uplift (Accounts)
- Upgraded shared Accounts visual system in `accountsCommon.js`:
  - stronger hierarchy, spacing, table legibility, card depth.
- Reports page upgraded with:
  - loading feedback
  - report summary cards (totals/buckets)
  - compatibility with richer backend report payloads (`rows`, `items`, `lines`, `totals`, `bucketTotals`).

## Risks Found and Fixed
- **Cross-company FK drift risk** in finance core tables: fixed via composite company-aware constraints.
- **Posted voucher line insertion loophole**: fixed with DB trigger coverage on insert/update/delete.
- **Settlement subledger mutation without guaranteed posted voucher**: fixed by blocking pending settlement posting path.
- **Source-link inconsistency and weak idempotency**: fixed by mandatory source tuple + deterministic settlement events.
- **Trial balance over-counting due to LEFT JOIN logic**: fixed via conditional aggregation.
- **Finance write access too broad (`hr`)**: restricted.

## Remaining Gaps For Full Enterprise Maturity
- Full maker-checker workflow state machine (draft -> submitted -> approved -> posted) with separate approval endpoints.
- Period close governance tooling (close/reopen workflows with privilege + lock reports).
- GST/TDS layered posting packs and statutory return extracts.
- Reversal propagation for AR/AP status objects (currently GL/source-link safe, but domain-level reversal automation can be expanded).
- Concurrency hardening with advisory locks around high-volume auto-post event streams.

## Production-Readiness Checklist
- [x] Finance migrations exist and run in order.
- [x] Company-scoped integrity enforced in critical finance relations.
- [x] Double-entry and posting integrity validated in code + DB.
- [x] Posted voucher immutability protected in service path and DB trigger path.
- [x] Settlement caps and non-negative constraints enforced.
- [x] Source-link traceability and duplicate posting prevention strengthened.
- [x] Finance write routes role-protected.
- [x] Reports produce accountant-usable outputs (opening/running/bucketed totals).
- [x] Backend tests passing.
- [x] Finance validation tests expanded.

## Commands (Migrate, Test, Launch)

### Backend
```bash
cd backend
npm run migrate
npm test
npm run dev
```

### Frontend
```bash
cd web_admin
npm install
npm run dev
```

### Optional Readiness Checks
```bash
cd backend
npm run verify:app
npm run verify:go-live
```
