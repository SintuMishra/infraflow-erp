# Staging Validation And Safe Deployment Plan

Date: `2026-04-27`  
Scope: performance hardening rollout only  
Status: ready for staging validation, not yet approved for production deployment

## Purpose

This document covers the safe staging validation path for the recent performance changes:

- database performance indexes
- paginated list APIs
- lightweight lookup APIs
- default 30-day ranges for heavy reports
- backend in-memory caching
- frontend reference-data caching
- debounced report search
- reduced dispatch page refetching

This plan does not change production configuration and does not authorize deployment by itself.

## A. Problems Found In Current Changes

### Fixed

1. Master-data cache invalidation was incomplete.
- Risk:
  master bundle and lookup caches could stay stale for up to 60 seconds after config/material/shift/vehicle-type/crusher-unit changes.
- Fix applied:
  [`backend/src/modules/masters/masters.service.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/masters/masters.service.js:1)
  now invalidates `masters-bundle`, `masters-lookup`, and `materials-lookup` caches after create, update, and status operations.

### Reviewed And Safe

1. Route ordering is safe.
- New `/lookup` routes are declared before any `/:id` style paths.
- Checked in:
  [`backend/src/modules/plants/plants.routes.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/plants/plants.routes.js:1)
  [`backend/src/modules/vehicles/vehicles.routes.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/vehicles/vehicles.routes.js:1)
  [`backend/src/modules/parties/parties.routes.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/parties/parties.routes.js:1)
  [`backend/src/modules/masters/masters.routes.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/masters/masters.routes.js:1)

2. Backward compatibility is preserved for list APIs.
- Existing list endpoints still return the original array payload by default.
- Pagination is only activated when paginated query params are used.

3. Company isolation remains intact.
- All changed read paths still use request company scope.
- No write path changed the meaning of `company_id`.

4. Frontend build compatibility is confirmed.
- `web_admin` lint and production build both pass.

### Additional Improvement Applied

1. Party order paginated mode now uses SQL-level pagination instead of full-fetch slicing.
- File:
  [`backend/src/modules/party_orders/party_orders.model.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/party_orders/party_orders.model.js:203)
- Result:
  safer for higher order volume and better aligned with the rest of the performance work.

## B. Fixes Applied

Applied in this staging-prep pass:

- master cache invalidation completed in
  [`backend/src/modules/masters/masters.service.js`](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/backend/src/modules/masters/masters.service.js:1)

Already validated:

- backend verification passed:
  `npm run verify:local`
- frontend verification passed:
  `npm run verify:local`

## C. Staging Validation Checklist

Use a staging database with realistic company data volume. Validate with one manager user and one operational user.

### Auth And Scope

- Login succeeds for owner/admin flow
- Login succeeds for client/company flow
- `X-Company-Id` scoped screens only show the selected company data
- Refresh/navigation does not drop company context
- Unauthorized role cannot access restricted masters write screens

### Dashboard

- Dashboard summary loads successfully
- Dashboard reload is visibly faster on second load within cache window
- No stale cross-company data appears
- Commercial exceptions page still loads

### Dispatch

- Create dispatch works
- Edit dispatch works
- Status update works
- Dispatch list still returns expected records
- Dispatch report defaults to last 30 days when no date filter is set
- Dispatch search still works with debounce
- Dispatch page no longer refetches full reference bundles after status/update

### Plant / Crusher / Project Reports

- Plant/crusher report list loads with default date range
- Plant/crusher report create/update/delete still work
- Project report list loads with default date range
- Project report create/update/delete still work
- Summary totals remain consistent before/after pagination changes

### Finance Reports

- Voucher register loads with default 30-day window when dates are omitted
- Trial balance works
- Ledger report works
- Cash book and bank book work
- No report returns empty unexpectedly due to date handling

### Masters / Lookups

- `/masters` still returns the expected bundle for current screens
- `/masters/lookup` returns small dropdown payloads
- `/masters/materials/lookup` works in transport and party rate flows
- Config option create/update/status changes appear after cache window or immediate reload after invalidation
- Material updates reflect correctly in dropdowns

### Operational Masters

- Plants list still works without pagination params
- Plants paginated mode works with `?paginate=true&page=1&limit=25`
- Vehicles list and lookup both work
- Parties list and lookup both work
- Party orders list works in both legacy and paginated mode
- Party material rates list works in both legacy and paginated mode

### Company Safety

- Verify no screen shows another company's plants, vehicles, parties, or reports
- Verify dispatch/report totals match the same company before and after deployment on staging

## D. Deployment Checklist

### Before Staging Deploy

- Confirm current branch contains only intended changes
- Run backend verify:
  `cd backend && npm run verify:local`
- Run frontend verify:
  `cd web_admin && npm run verify:local`
- Prepare staging DB backup or snapshot

### Staging Deployment Order

1. Apply DB migration on staging first
- run:
  `cd backend && npm run migrate`

2. Deploy backend to staging
- validate health/app boot

3. Deploy frontend to staging
- point to staging backend

4. Run the checklist in section C

5. Run load tests from `tests/load/`

6. Review:
- Render logs
- DB CPU / query behavior
- frontend network waterfall

### Production Deployment Order

Only if staging passes:

1. Confirm production DB backup completed
2. Deploy backend with migration
3. Smoke test login + dashboard + dispatch list immediately
4. Deploy frontend
5. Monitor logs for at least one business cycle

## E. Rollback Plan

### Render Backend

If backend behavior is bad after deploy:

1. Roll back to the previous successful Render deployment
2. Re-run smoke checks on:
- login
- dashboard
- dispatch list
- masters

### Vercel Frontend

If frontend behavior is bad after deploy:

1. Promote/redeploy the previous successful Vercel deployment
2. Clear browser cache only if users still see stale assets

### Database / Migration

This performance migration is additive only:

- it adds indexes
- it does not drop/rename columns
- it does not delete data

If migration causes unexpected DB pressure:

1. Roll back application deployment first
2. Keep the indexes in place unless they are proven harmful
3. If absolutely necessary, drop only the problematic index manually in staging first

If a severe production DB issue occurs:

1. restore from production backup only if app rollback is insufficient
2. do not restore casually because this migration is non-destructive

### Cache / Behavior Safety

There is no external Redis or feature flag to disable.  
If behavior looks stale:

- restart backend service to flush in-memory cache
- refresh frontend deployment or browser session

## F. Load Test Scripts And Commands

Scripts created:

- [tests/load/README.md](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/tests/load/README.md:1)
- [tests/load/k6-login.js](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/tests/load/k6-login.js:1)
- [tests/load/k6-erp-core.js](/Users/sintumishra/projects/construction_erp_system/production_ready_clone/tests/load/k6-erp-core.js:1)

The scripts now:

- use `BASE_URL`, `TEST_EMAIL`, `TEST_PASSWORD`, and `COMPANY_ID`
- enforce staging/local-only execution unless `ALLOW_NON_STAGING=true` is explicitly supplied
- use read-only traffic only
- validate:
  - `http_req_failed < 1%`
  - `checks > 99%`
  - `p95 < 1000ms`

Recommended run order:

1. Login-only baseline
2. Core ERP mixed traffic at `25` VUs
3. Core ERP mixed traffic at `60` VUs
4. Core ERP mixed traffic at `100` VUs
5. Core ERP mixed traffic at `120` VUs

## G. Final Go / No-Go Recommendation

Current recommendation: **GO for staging**, **NO-GO for production until staging validation and load testing complete**.

Reason:

- code verification is green
- compatibility checks are good
- the only staging-safety bug found in this review was fixed
- one non-blocking optimization remains for party-order pagination, but it is not a blocker for staging

Production go-live should require all of the following:

- staging checklist passed
- load tests meet targets
- no sustained DB CPU spike
- no cross-company data leaks
- dispatch/report totals match expected company-scoped values
