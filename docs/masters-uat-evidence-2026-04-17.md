# Masters UAT Evidence Report

- Date: 2026-04-17
- Environment: local production_ready_clone workspace
- Scope: Masters role matrix, reliability checks, and build readiness
- Extended governance scope: owner client controls, custom billing cycles, invoice persistence, and owner profile management
- Advanced polish scope: server-backed onboarding filters (`status`, `billingStatus`) and owner-governance smoke automation
- Status: PASS

## Evidence Summary

1. Backend automated verification
- Command: `npm test -- masters-route-access.test.js masters-service.test.js`
- Result: PASS
- Aggregate suite result observed in latest full run baseline: `195 passed, 0 failed`

2. Frontend production build verification
- Command: `npm run build`
- Result: PASS
- Vite build completed successfully with generated production bundles.

3. Owner governance hardening verification
- Backend migration: `npm run migrate`
- Result: PASS
- Applied billing enhancements:
  - `017_company_billing_custom_cycle.sql`
  - `018_company_billing_invoices.sql`
- Backend regression after feature wiring:
  - `npm test -- onboarding-route-access.test.js onboarding-controller.test.js onboarding-service.test.js auth-service.test.js`
  - Result: PASS
- Extended baseline suite result observed in latest full run: `200 passed, 0 failed`
 - Additional targeted verification:
   - `node --test backend/tests/onboarding-controller.test.js backend/tests/onboarding-route-access.test.js backend/tests/auth-route-access.test.js`
   - `node --test backend/tests/onboarding-service.test.js`
   - Result: PASS

4. Owner governance automation enhancement
- Added executable smoke script:
  - `backend/src/scripts/smokeOwnerGovernanceFlow.js`
  - npm alias: `npm run smoke:owner-governance`
- Coverage validated by script logic:
  - owner self-profile update persistence (`PATCH /auth/me/profile`)
  - custom billing cycle persistence (`billingCycle=custom`, `customCycleLabel`, `customCycleDays`)
  - invoice generation + invoice-history persistence
  - server-backed client filters (`/onboarding/companies` with `status` and `billingStatus`)
  - permanent client delete + login context invalidation

## Role Matrix Covered

- `super_admin`: read + write routes allowed
- `manager`: read + write routes allowed
- `hr`: read + write routes allowed
- `crusher_supervisor`: read routes allowed, write routes denied (`403`)
- `site_engineer`: read routes allowed, write routes denied (`403`)
- unauthenticated request checks: denied (`401`)

## Controls Confirmed

- Masters route middleware sequence remains correct:
  - `authenticate -> authorizeRoles -> controller`
- Read routes validated:
  - `GET /masters`
  - `GET /masters/health-check`
- Write routes validated:
  - config options, crusher units (Sub Plants & Units), materials, shifts, vehicle types, and status/auto-fill endpoints.

## Notes

- UI has read-only controls for non-admin operational roles.
- Section naming polish in Masters is applied as "Sub Plants & Units".
- Checklist reference: `docs/masters-role-uat-checklist.md`.
- Login split baseline also validated in current release line:
  - `/owner-login`
  - `/client-login`
  - `/client-login/:companyCode`
- Owner governance feature line validated in current release branch:
  - custom billing cycle manual input (`customCycleLabel`, `customCycleDays`)
  - billing invoice persistence and print/save PDF flow from Tenant Onboarding
  - permanent client delete endpoint with mandatory deletion reason
  - owner self-profile read/update (`GET /auth/me`, `PATCH /auth/me/profile`)

## Final Freeze Addendum (2026-04-18)

- Freeze marker: `PRC-RC-2026-04-18-owner-governance-final`
- Additional final polish verification:
  - Invoice print template renders optional issuer logo using `issuerProfile.logoUrl`
  - Non-logo scenarios render print-safe fallback block (`No Logo`)
  - No API contract change required (existing `issuerProfile` payload reused)
- Re-validation after final polish:
  - `cd web_admin && npm run lint` -> PASS
  - `cd web_admin && npm run build` -> PASS
