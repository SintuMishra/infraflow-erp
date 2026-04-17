# Masters Release Checklist

## Change Scope
- Masters role access alignment (read for ops roles, write for admin roles only)
- Masters UI read-only enforcement for non-admin operational roles
- Masters diagnostics and reliability enhancements
- Naming polish: "Sub Plants & Units"
- Automated route-access regression tests
- Owner client-governance controls (client profile edit, billing status, suspend/reactivate access)
- Owner governance hardening (custom billing cycle input, billing invoice generation/print-save flow, permanent client delete with confirmation, owner self-profile management)

## Release Type Gate (Mandatory)
1. Mark release type:
- `TRIAL/UAT` or `PRODUCTION`
2. If `TRIAL/UAT`, optional reset command before smoke:
- `cd backend && npm run reset:trial -- --yes`
3. If `PRODUCTION`, do **not** run reset command on live database.

## Pre-Deploy Checklist
0. Keep local development env stable:
   - `backend/.env` keeps `NODE_ENV=development` for daily usage.
   - For production verification, run with command override: `NODE_ENV=production ...`.
   - Set production `CORS_ORIGIN` to real domain (never localhost in live deploy).
1. Confirm branch contains expected docs and tests:
   - `docs/masters-role-uat-checklist.md`
   - `docs/masters-uat-evidence-2026-04-17.md`
   - `backend/tests/masters-route-access.test.js`
2. Run backend regression:
   - `cd backend && npm test -- masters-route-access.test.js masters-service.test.js`
3. Run frontend production build:
   - `cd web_admin && npm run build`
4. Validate environment variables are present in target environment.
5. Confirm DB schema is at latest migration level.
6. Confirm rollback point is available (last known stable build/tag).
7. Confirm login surface split works:
   - `/owner-login` (owner-only)
   - `/client-login` and `/client-login/:companyCode` (client-only flow)
8. Production-only security check:
   - `NODE_ENV=production`
   - `CORS_ORIGIN` is not `*`
   - `EXPOSE_PASSWORD_RESET_TOKEN=false`
   - `JWT_SECRET` strong and non-placeholder
   - `ONBOARDING_BOOTSTRAP_SECRET` strong and non-placeholder
9. Owner lock check:
   - `cd backend && npm run verify:owner-lock`
10. Full one-command automated checks:
   - `cd /Users/sintumishra/projects/construction_erp_system/production_ready_clone`
   - `./scripts/final-prelive-check.sh`
11. Advanced owner governance automation (recommended for production cut):
   - Set `SMOKE_ADMIN_USERNAME`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_ADMIN_COMPANY_ID`, and `SMOKE_BOOTSTRAP_SECRET` (or `ONBOARDING_BOOTSTRAP_SECRET`).
   - Run: `cd backend && npm run smoke:owner-governance`
   - This script validates custom billing cycle persistence, invoice history persistence, owner self-profile update, server-backed client filters, and permanent delete lifecycle.

## Deployment Steps
1. Deploy backend release artifact.
2. Deploy frontend release artifact.
3. Clear CDN/static cache if applicable.
4. Restart app services and verify health endpoints.

## Post-Deploy Smoke (15-20 min)

### A. Route Access Smoke
1. Login as `super_admin` and open `/masters`.
2. Login as `manager` and open `/masters`.
3. Login as `hr` and open `/masters`.
4. Login as `crusher_supervisor` and open `/masters`.
5. Login as `site_engineer` and open `/masters`.
Expected:
- All roles above can view masters.
- Read-only banner appears for `crusher_supervisor` and `site_engineer`.

### A2. Login Surface Smoke
1. Open `/login` and verify portal selector appears.
2. Open `/owner-login` and verify owner-branded console login.
3. Open `/client-login` and verify company-code entry screen.
4. Open `/client-login/:companyCode` and verify company context loads.
Expected:
- Owner and client entry points are clearly separated.
- Client flow is company-scoped.

### B. Write Permissions Smoke
1. As `super_admin`, create/edit/toggle one record (any section).
2. As `manager`, run `Auto-fill Missing HSN/SAC` once.
3. As `hr`, update one material field and save.
4. As `crusher_supervisor` and `site_engineer`, verify Add/Edit/Activate actions are blocked.
Expected:
- Admin roles can write.
- Read-only roles cannot write.

### C. Diagnostics Smoke
1. Open Workspace Health in Masters.
2. Click `Run Diagnostics`.
3. Verify issue cards render with severity and counts.
Expected:
- Diagnostics load successfully without console/API errors.

### D. Naming and UX Smoke
1. Verify section label shows `Sub Plants & Units` (not `Crusher Units`).
2. Verify global section filter and summary card use `Sub Plants & Units` label.

### E. API Error Handling Smoke
1. Trigger one duplicate payload (e.g., existing material code).
2. Trigger one invalid payload (e.g., invalid GST or malformed HSN rule value).
Expected:
- Duplicate: `409` behavior/message.
- Invalid payload: `400` behavior/message.

### F. Security Smoke (Production Window)
1. Verify failed login attempts are rate-limited.
2. Verify password-reset token is never exposed in API response.
3. Verify client user cannot access tenant onboarding route.
Expected:
- Rate limit and secret exposure controls operate as expected.

### G. Phone UAT Flow (Mandatory)
1. Owner login from phone (`/owner-login`).
2. Onboard one company from owner portal.
3. Client login using `/client-login/:companyCode`.
4. Create one dispatch/report entry from client flow.
5. Verify role-based hidden sections:
   - Client users cannot see owner-only sections (tenant onboarding, add-company/sell controls).
Expected:
- Complete owner->client flow works on phone without layout or access leaks.

### H. Client Billing And Access Control Smoke
1. Login as platform owner and open Tenant Onboarding -> Client Access Control.
2. Edit one client profile and save.
3. Update billing fields (`billingStatus`, due date, outstanding amount) and save.
4. Suspend the same client with a reason.
5. Verify:
   - New login from `/client-login/:companyCode` is blocked.
   - Existing token/API calls for that company return `COMPANY_ACCESS_DISABLED`.
6. Reactivate client and verify login works again.
Expected:
- Owner can control lifecycle of each client company.
- Suspended clients cannot continue operations until restored.

### H2. Owner Governance Advanced Billing/Delete/Profile Smoke
1. In Client Access Control, set `billingCycle=custom` and enter `customCycleLabel` and/or `customCycleDays`, then save.
2. Generate one billing invoice and verify invoice appears in invoice history for the same client.
3. Use `Generate Invoice + PDF` and verify browser print dialog allows `Save as PDF` and download.
4. Toggle `Hide Client List` and re-open `Show Client List`; verify client filters (status + billing status + search) still apply correctly.
5. In Owner Profile Management, update owner details and refresh page; verify values persist from API.
6. Create one test client and run permanent delete with a mandatory deletion reason.
7. Verify deleted client is removed from onboarding list and client login context no longer resolves.
Expected:
- Custom billing cycle input is persisted correctly.
- Invoice generation is persisted and printable/saveable as PDF.
- Hide/show and filters remain stable and non-dummy.
- Owner can self-manage profile information.
- Permanent delete removes client company and scoped data safely.

## Rollback Criteria
Rollback if any of the following are true:
1. Any role loses required Masters access.
2. Read-only roles can perform write actions.
3. Admin write actions fail consistently.
4. Diagnostics endpoint fails for valid admin users.
5. Frontend Masters page fails to render post-deploy.
6. Owner/client login surface separation fails.
7. Any production security smoke fails.
8. Suspended company is still able to login or access APIs.

## Rollback Steps
1. Revert frontend to previous stable build.
2. Revert backend to previous stable build.
3. Restart services.
4. Re-run minimal smoke:
   - `super_admin` open `/masters`
   - `crusher_supervisor` read-only check
   - one admin write action

## Backup And Rollback Command Template (PostgreSQL)
1. Backup before first live tenant:
   - `pg_dump "postgresql://<user>:<password>@<host>:<port>/<db>" -Fc -f prelive_backup_$(date +%Y%m%d_%H%M%S).dump`
2. Restore drill command (staging/sandbox first):
   - `pg_restore --clean --if-exists --no-owner --dbname="postgresql://<user>:<password>@<host>:<port>/<db>" prelive_backup_<timestamp>.dump`

## Sign-off
- Release candidate marker: `PRC-RC-2026-04-18-owner-governance-final`
- Freeze date: `2026-04-18`
- Freeze scope note: Owner governance production pass finalized with invoice issuer-logo optional rendering + print-safe fallback.
- Deployment date/time:
- Release owner:
- QA owner:
- Smoke completed by:
- Release type: TRIAL/UAT or PRODUCTION
- Final status: PASS / FAIL
- Notes:
