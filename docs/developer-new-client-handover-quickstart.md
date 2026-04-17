# Construction ERP - Developer Quick Start for New Client Handover

## Document Control
- Document ID: `ERP-DEV-QUICKSTART-001`
- Version: `1.0`
- Date: `2026-04-17`
- Audience: Implementation Engineer, DevOps, Technical Support
- Classification: Internal Technical

## Purpose
Use this one-page checklist when onboarding any new customer tenant and handing over production access safely.

## 1) Pre-Setup (Before Tenant Creation)
1. Confirm signed commercial agreement and approved legal company name.
2. Confirm target go-live date, support contacts, and escalation owner.
3. Verify production env has:
- `ONBOARDING_BOOTSTRAP_SECRET` configured
- `PLATFORM_OWNER_COMPANY_ID` set to your platform-owner tenant id
- frontend `VITE_PLATFORM_OWNER_COMPANY_ID` matches backend owner id
- DB migrations up-to-date (`npm run migrate`)
- backup and restore readiness (snapshot + PITR capability)
4. Run owner-lock verification:
- `cd backend && npm run verify:owner-lock`

## 2) Tenant Bootstrap (Internal Only)
1. Open Tenant Onboarding UI (internal team use only).
2. Enter exact legal company name and verified owner details.
3. Run bootstrap using `x-bootstrap-secret`.
4. Record generated:
- company code
- owner username
- temporary password (store only in secure handover note)
5. Confirm audit log entry exists for onboarding event.
6. Prepare company login URL for handover:
- `/client-login/{companyCode}` (example: `/client-login/ACME_ROCK`)
- also share fallback entry page `/client-login` where company code can be entered manually

## 3) Secure Credential Handover
1. Share username and temporary password through approved secure channel only.
2. Send password separately from username when possible.
3. Require owner to login immediately and change password.
4. Confirm first login success and password-change completion.
5. Keep owner portal separate:
- your internal access URL is `/owner-login`
- do not provide owner URL to client operational users

## 4) Baseline Configuration (Day 0)
1. Company Profile: legal details, GST/PAN, print header readiness.
2. Masters: plants/units, materials, vehicles, required references.
3. Users and Roles: manager/hr/ops accounts as per client org chart.
4. Commercial: parties, party rates, order flow readiness.
5. Dispatch: print format validation with client logo and company details.

## 5) UAT and Signoff
1. Execute role-wise UAT (`super_admin`, `manager`, `hr`, read-only role if applicable).
2. Run one full lifecycle:
- order -> dispatch -> closure -> print -> audit visibility
3. Resolve critical findings.
4. Capture evidence in UAT report and get signoff.

## 6) Go-Live Execution
1. Announce go-live window and expected impact.
2. Take pre-release backup snapshot.
3. Run final checks:
- backend health/ready
- frontend build active
- auth and company scope checks
4. Enable operations for client users.

## 7) First 7-Day Hypercare
1. Daily queue check: dashboard + commercial exceptions.
2. Daily audit review for sensitive actions.
3. Resolve P0/P1 issues same day.
4. Maintain issue log with RCA and fix release references.

## 7A) Client Billing And Access Control (Owner Only)
1. Open `Tenant Onboarding` and use `Client Access Control`.
2. Search client by company name/code and verify legal identity fields.
3. For overdue/non-payment:
- click `Suspend Login Access`
- enter reason (for audit trail)
4. For payment settlement:
- click `Reactivate Login Access`
- add optional reactivation note
5. Validate outcome:
- suspended client cannot login via `/client-login/{companyCode}`
- all status changes are visible in audit logs

## 8) Safe Update Rules (No Data Loss)
1. Use forward-only migrations.
2. Prefer backward-compatible schema/app rollouts.
3. Never run destructive SQL directly in production.
4. Validate critical counts after every release.
5. Roll back app version quickly if severe issue; use DB rollback only if pre-planned.

## 9) Final Handover Package to Client
1. `docs/CLIENT-HANDOVER-PACKET.md` (or Hindi variant)
2. `docs/company-operations-guide-professional.md`
3. `docs/company-operations-guide-hi.md` (if needed)
4. support escalation matrix with contacts
5. signed go-live and UAT record

## 10) Completion Gate (Mark Done Only If All Yes)
- Tenant created and isolated correctly: YES/NO
- Owner credential handover done securely: YES/NO
- Password changed on first login: YES/NO
- UAT signed by business + operations + technical: YES/NO
- Backup/restore readiness verified: YES/NO
- Hypercare owner assigned for Day 0-7: YES/NO
