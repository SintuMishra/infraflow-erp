# Deployment Runbook

## Objective

This runbook provides a practical, production-safe deployment sequence for `production_ready_clone` with clear quality gates and rollback guidance.

## Pre-Deployment Inputs

Prepare these before deployment:

- backend environment values (`JWT_SECRET`, DB credentials, `CORS_ORIGIN`)
- bootstrap security values (`ONBOARDING_BOOTSTRAP_SECRET`, `PLATFORM_OWNER_COMPANY_ID`)
- stable platform-owner `super_admin` login (for smoke flows)
- release commit SHA/tag

## Local Preflight Gate

Run locally on the release commit:

```bash
cd backend
npm ci
npm run verify:practical

cd ../web_admin
npm ci
npm run verify:local
```

Optional high-signal reality checks (requires smoke env vars):

```bash
cd ../backend
npm run smoke:owner-governance
npm run smoke:core-sections-write
npm run smoke:accounts-mini
```

Expected outcome:

- all verify commands pass
- smoke scripts pass
- no residual smoke tenant remains

## Deployment Sequence

Use this order to reduce risk:

1. backup database / ensure point-in-time restore path
2. deploy backend package
3. run `npm run migrate` on target environment
4. run backend health checks:
   - `GET /api/health`
   - `GET /api/ready`
5. deploy web admin build
6. validate login and critical flows

## Post-Deployment Validation

Validate these business-critical paths in production/staging:

- owner login and client login-context resolution
- accounts voucher lifecycle: create -> submit -> approve -> post -> reverse
- payables create and settlement
- receivables posting and settlement
- dispatch create/edit/status and invoice consistency
- dashboard summary and commercial exceptions

## Rollback Plan

If deployment fails after backend rollout:

1. stop incoming traffic to the failing release
2. restore previous backend artifact
3. if migration introduced incompatibility, restore DB from backup or execute approved reverse migration plan
4. confirm `/api/health` and `/api/ready` are healthy
5. redeploy previous web admin artifact if required

## Evidence Checklist

Capture and store:

- deployed commit SHA
- migration output logs
- verify command outputs
- smoke output JSON
- timestamped screenshots of key UI validations
