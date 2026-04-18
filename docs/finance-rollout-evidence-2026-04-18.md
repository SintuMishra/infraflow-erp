# Finance Rollout Evidence - 2026-04-18

## Scope
Phase 5 control-plane readiness evidence for Accounts/Finance:
- concurrency execution readiness
- policy-control operational verification
- maker-checker and period governance verification
- transition-history compliance checks

## Environment Prerequisites
- PostgreSQL reachable from backend runtime.
- `backend/.env` configured:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
- Migrations applied through latest finance migration (`024_accounts_finance_policy_operations.sql`).

## Migration Verification
1. `cd backend`
2. `npm run migrate`
3. Confirm migration log includes:
- `023_accounts_finance_phase4_policy_and_history_filters.sql`
- `024_accounts_finance_policy_operations.sql`

## Concurrency Test Execution
Run full DB-backed concurrency suite:
1. `cd backend`
2. `FINANCE_DB_INTEGRATION_TESTS=true node --test tests/finance-concurrency.integration.test.js`

Or via npm script:
1. `cd backend`
2. `npm run test:finance:concurrency`

Expected covered races:
- duplicate dispatch -> receivable creation (idempotent)
- two users settling same receivable (oversettle blocked)
- two users posting same voucher (single effective post)
- maker-checker segregation conflict behavior
- period close before posting
- DB trigger enforcement for direct same-user approve mutation

## Policy Control Verification
1. Open `Accounts -> Policy Controls` in web admin.
2. Confirm current policy values load.
3. Toggle one risky setting (example: `allowMakerSelfApproval`) with notes.
4. Save policy and confirm:
- update succeeds
- `Last Updated By` and `Last Updated At` refresh
- warning banner appears when risky toggles enabled
5. Revert setting back to strict mode and save.

Backend verification (optional API checks):
- `GET /api/accounts/general-ledger/policies`
- `PATCH /api/accounts/general-ledger/policies`

## Maker-Checker Verification
1. Create draft voucher as user A.
2. Submit voucher as user A.
3. Attempt approve as user A:
- should fail in strict policy mode.
4. Approve as user B:
- should succeed.
5. Attempt post as user B when approver-self-posting disabled:
- should fail.
6. Post as user C:
- should succeed.

## Period Control Verification
1. Open `Accounts -> Period Controls`.
2. Close an open period with remarks.
3. Attempt posting voucher dated in that period:
- should fail due closed period.
4. Reopen period with remarks.
5. Re-attempt post:
- should succeed if all other controls pass.

## Transition History Compliance Verification
1. Open `Accounts -> Finance Reports`.
2. Select `Finance Transition History` report.
3. Apply filters:
- `entityType`
- `action`
- `performedByUserId`
- date range
4. Confirm actor display uses name where available.
5. Use `Export CSV` and verify output columns:
- entity/action/state transition
- actor identifiers
- timestamps
- remarks

## Targeted Test Commands
- `cd backend && npm run test:finance:policy`
- `cd backend && npm test`
- `cd web_admin && npm run build`

## Evidence Notes
If DB-backed concurrency tests do not run:
- capture exact runtime error (example: connection permission/network issue)
- retain command output
- do not mark concurrency as proven until the suite passes in reachable infrastructure
