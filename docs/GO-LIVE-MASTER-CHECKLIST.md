# Construction ERP - Go-Live Master Checklist

## Document Control
- Document ID: `ERP-GOLIVE-MASTER-001`
- Version: `1.0`
- Date: `2026-04-17`
- Audience: Business Owner, Operations Owner, Technical Owner, QA

## Purpose
Single final gate to decide `GO / NO-GO` before production release.

## 1) Release Type
- Release type selected: `TRIAL/UAT` or `PRODUCTION`
- Change window approved: YES/NO
- Rollback owner assigned: YES/NO

## 2) Environment and Security Gate
1. Backend env validated:
- `NODE_ENV=production`
- `CORS_ORIGIN` is not `*`
- `EXPOSE_PASSWORD_RESET_TOKEN=false`
- `JWT_SECRET` strong and non-placeholder
- `ONBOARDING_BOOTSTRAP_SECRET` strong and non-placeholder
2. Frontend env validated:
- `VITE_API_BASE_URL` points to target API
- `VITE_PLATFORM_OWNER_COMPANY_ID` matches backend owner company id
3. Owner lock verification:
- `cd backend && npm run verify:owner-lock` -> PASS/FAIL
4. Go-live preflight verification:
- `cd backend && npm run verify:go-live` -> PASS/FAIL

## 3) Build and Test Gate
1. `cd backend && npm run migrate` -> PASS/FAIL
2. `cd backend && npm run verify:app` -> PASS/FAIL
3. `cd backend && npm test` -> PASS/FAIL
4. `cd web_admin && npm run lint` -> PASS/FAIL
5. `cd web_admin && npm run build` -> PASS/FAIL

## 4) Access and Tenant Gate
1. `/login` portal selector works.
2. `/owner-login` works for platform owner only.
3. `/client-login` and `/client-login/:companyCode` work for client flow.
4. Client users cannot access tenant onboarding.
5. Owner can access tenant onboarding only in owner scope.

## 5) Core Workflow Gate
1. Company profile saved and print header verified.
2. Masters basic setup validated.
3. One complete business flow validated:
- order -> dispatch -> closure -> print
4. Audit logs recorded for sensitive actions.

## 6) Data Integrity Gate
1. No unintended trial records in production DB.
2. Required tenant/company data exists and scoped correctly.
3. Backup snapshot completed before deploy.
4. Restore drill evidence available or confirmed.

## 7) Deployment and Smoke Gate
1. Backend deployed and health checks pass:
- `/api/health`
- `/api/ready`
2. Frontend deployed and cache invalidation complete.
3. 15-20 minute post-deploy smoke pass complete.

## 8) Go / No-Go Decision
- Business Owner: GO / NO-GO
- Operations Owner: GO / NO-GO
- Technical Owner: GO / NO-GO
- Final Decision: GO / NO-GO
- Decision Time:
- Notes:

## 9) If NO-GO
1. Execute rollback to previous stable version.
2. Communicate hold with reason and next window.
3. Log incident and corrective actions.
