# Company Hierarchy Safe Upgrade Plan

## Document Control
- Document ID: `ERP-HIERARCHY-UPGRADE-PLAN-001`
- Version: `1.0`
- Date: `2026-04-26`
- Status: `Official Working Plan`
- Owner: Product + Engineering

## Purpose
This document defines the safe upgrade strategy for adding parent-child company hierarchy and shared master data to the live ERP system without breaking the current production multi-company behavior.

It is designed to act as the single tracking document from planning through development, staging, pilot rollout, production deployment, post-deploy validation, and stabilization.

## Scope
This plan covers:
- company hierarchy extension
- shared master data model
- reporting safety rules
- staging and deployment strategy
- migration safety
- feature flag rollout
- pilot release and gradual production enablement
- rollback readiness

This plan does not authorize direct production editing or direct production behavior changes without staged validation.

## Business Goal
Add support for:
- one parent company with multiple child companies
- shared masters across child companies
- strict transaction ownership by operating company
- separate child-company reports
- combined parent-level reports

## Non-Negotiable Core Rule
`SHARED MASTER != SHARED TRANSACTION`

Always follow:
- master data may be shared for selection and reference
- every transaction must belong to exactly one operating company
- all reports must filter by `transaction.company_id`

Never do:
- filter reports by `owner_company_id`
- merge transaction ownership across companies
- assume same plant/material/vehicle means same company data

## Current System Baseline
Current architecture observations:
- system already supports multi-company as isolated tenants
- `company_id` is the current isolation key across masters and transactions
- backend auth enforces active company scope using JWT plus `X-Company-Id`
- reports currently run in single-company mode
- backend deployment on Render currently starts with `npm run migrate && npm start`
- frontend is deployed on Vercel
- migrations are SQL-file based and applied sequentially

## Current Production Risk Summary
High-risk points in current setup:
- Render backend deploy can automatically run pending migrations on production
- there is no safe hierarchy behavior in production yet
- company scope is deeply embedded across operations, finance, procurement, and reports
- direct edits on production branch can unintentionally change live behavior
- duplicate master cleanup can be destructive if performed automatically

## Safe Upgrade Principles
1. Do not edit production behavior directly.
2. Do not release hierarchy behavior without feature flags.
3. Keep current single-company flow working unchanged while flags are off.
4. Use additive, backward-compatible migrations first.
5. Test in staging before production.
6. Roll out to one pilot client before broader enablement.
7. Never auto-delete or auto-merge used production masters.

## Target Architecture Summary

### Company Hierarchy
Add:
- `companies.parent_company_id`
- `companies.company_type` with `PARENT`, `CHILD`, `STANDALONE`

### Shared Master Model
Add to target master tables:
- `owner_company_id`
- `visibility_scope` with `PRIVATE`, `PARENT_SHARED`, `GROUP_SHARED`

### Transaction Rule
Every transaction must continue storing:
- `company_id = operating company`

### Reporting Rule
All reports must:
1. resolve selected company set
2. filter using `WHERE transaction.company_id IN (...)`
3. apply date, plant, vehicle, material, and other filters

## Safe Branch Workflow
Mandatory branch workflow:
- keep production branch stable
- create a dedicated feature branch
- use PR review for every release slice
- merge only after staging validation
- tag release commits before production rollout

Recommended branch names:
- `feature/company-hierarchy-foundation`
- `feature/shared-masters-foundation`
- `feature/hierarchy-reporting-scope`
- `release/hierarchy-pilot`

## Environments Strategy

### Local Development
Use local environment for:
- schema and API development
- unit and integration tests
- basic UI verification

### Staging Environment
Create:
- separate Render staging backend
- separate Vercel staging or preview frontend
- separate staging database
- separate staging environment variables

Staging must use:
- production-like configuration
- production-like row volume where possible
- sanitized or copied representative data

### Production Environment
Production must remain unchanged until:
- migrations are validated on staging
- feature flags are off by default
- pilot rollout plan is approved

## Feature Flag Plan
Introduce feature flags before behavior rollout:
- `ENABLE_COMPANY_HIERARCHY=false`
- `ENABLE_SHARED_MASTERS=false`
- `ENABLE_MULTI_COMPANY_REPORT_SCOPE=false`

Optional pilot targeting:
- `ENABLE_COMPANY_HIERARCHY_COMPANY_IDS=...`

Rules:
- flags must protect backend behavior, not only UI
- production deploy with flags off must preserve current behavior
- pilot enablement must be limited to selected company IDs

## Database Safety Plan

### Migration Rules
- never run destructive migrations first on production
- add columns first
- use safe defaults
- backfill existing records safely
- avoid dropping or renaming existing columns in first release
- prepare rollback notes before deploy

### Initial Safe Schema Changes
Phase-1-safe additions:
- `companies.parent_company_id`
- `companies.company_type default 'STANDALONE'`
- `company_user_access`
- `owner_company_id` on shared-master candidates
- `visibility_scope default 'PRIVATE'`
- indexes for hierarchy and reports

### Backfill Rules
- existing companies become `STANDALONE`
- existing masters become `PRIVATE`
- existing transaction `company_id` remains unchanged

### Backup Rules
Before production migration:
- take DB backup or ensure point-in-time restore is available
- record backup timestamp and release SHA
- do not proceed without verified restore path

## Duplicate Master Strategy
This must be handled carefully and never as a blind cleanup.

### Detection
Detect duplicates using:
- normalized label
- trimmed/lowercase comparison
- similarity matching

### Canonical Selection
Prefer:
- parent-owned intended shared master
- otherwise the most-used referenced master
- otherwise the oldest clean active record

### Handling Rules
If duplicate is unused:
- safe delete allowed after review

If duplicate is used:
- remap references safely in controlled migration
- or mark inactive

Never:
- delete referenced rows directly
- break foreign keys
- auto-merge without dry-run preview and audit

## Master Visibility Resolution Rules
When loading dropdowns for a child company, return masters in this order:
1. child `PRIVATE`
2. parent `PARENT_SHARED`
3. `GROUP_SHARED`

Then:
- de-duplicate before returning
- include ownership/visibility labels

Expected UI labels:
- `Plant A (Shared from Parent)`
- `Plant B (Private)`

## Transaction Validation Rules
Before saving a transaction:
- validate selected plant/material/vehicle/employee/config master is visible to active company
- reject inactive or unrelated masters
- save transaction using operating `company_id`

## Report Logic Rules
All report implementations must follow this sequence:
1. resolve company set from user access and selected hierarchy
2. filter transaction tables by `company_id`
3. apply all other filters
4. aggregate and label by actual transaction company

Hard stop conditions:
- if query logic filters by `owner_company_id`
- if query logic infers company from master owner
- if query logic mixes sibling company transactions

If any of the above appears in implementation:
- stop
- do not deploy
- report and fix

## Phased Rollout Plan

### Phase 0: Preparation and Safety Controls
Goal:
- establish safe process before any behavior change

Tasks:
- create feature branch
- define feature flags
- create staging backend/frontend/database
- document release ownership and rollback owner
- confirm backup process

Exit criteria:
- staging environment exists
- branch workflow agreed
- feature flag approach approved

### Phase 1: Schema Foundation Only
Goal:
- add hierarchy and shared-master columns with no production behavior change

Tasks:
- add `parent_company_id`
- add `company_type`
- add `company_user_access`
- add `owner_company_id`
- add `visibility_scope`
- backfill standalone/private defaults
- add supporting indexes

Exit criteria:
- migrations pass locally
- migrations pass on staging
- current production behavior unchanged with flags off

### Phase 2: Backend Hierarchy Services
Goal:
- introduce internal hierarchy resolution without changing existing flows

Tasks:
- add hierarchy utility/service
- add descendant resolution
- add user multi-company access resolution
- keep current write scope model intact

Exit criteria:
- old APIs still pass existing checks
- hierarchy APIs tested in staging

### Phase 3: Shared Master Read Model
Goal:
- enable child company to view private plus shared masters

Tasks:
- implement visibility resolver
- implement de-duplicated master list payloads
- add owner/visibility metadata
- keep writes guarded by feature flags

Exit criteria:
- staging dropdowns show correct visible masters
- no duplicate confusing options returned

### Phase 4: Transaction Validation Layer
Goal:
- allow use of shared masters without breaking ownership

Tasks:
- validate master visibility on writes
- reject unrelated or inactive masters
- preserve transaction `company_id`

Exit criteria:
- dispatch and other writes pass with valid shared masters
- invalid cross-company references are rejected

### Phase 5: Report Scope Upgrade
Goal:
- support parent combined and multi-company reporting safely

Tasks:
- implement company-set report filtering
- preserve single-company reports
- add indexes and optimize high-volume report tables

Exit criteria:
- child totals remain correct
- parent combined totals equal sum of children
- no full scan regressions in staging for key report paths

### Phase 6: UI Rollout Behind Flags
Goal:
- add hierarchy and shared-master UX without affecting current users

Tasks:
- hierarchy management screen
- parent-child linking
- shared master toggles
- report scope filters
- company labels on combined report rows

Exit criteria:
- UI hidden when flags are off
- UI behaves correctly in staging when flags are on

### Phase 7: Pilot Client Enablement
Goal:
- enable only one selected parent-child group

Tasks:
- choose pilot client
- enable flags for pilot only
- compare existing and new reports
- validate operational flows daily

Exit criteria:
- pilot runs without data mixing
- no transaction ownership issues
- no report mismatch against expected totals

### Phase 8: Production Rollout and Monitoring
Goal:
- gradually release to more clients

Tasks:
- enable by batches
- monitor logs and support tickets
- validate report totals and dropdown behavior
- keep duplicate cleanup manual and controlled

Exit criteria:
- stable production behavior
- no cross-company leakage
- no rollback signals

## Deployment Testing Plan

### Local Pre-Deploy Checks
- backend tests pass
- backend app verification passes
- frontend lint passes
- frontend build passes
- migration dry-run passes on local test DB

### Staging Checks
- staging migration passes
- staging app boots correctly
- staging login works
- single-company existing flow unchanged
- dispatch works
- plant/project/dispatch reports work
- report totals match baseline with flags off

### Pilot Checks
- shared masters visible only where allowed
- transactions save to correct child company
- parent combined report matches child sums
- no sibling leakage for child-only users

### Production Release Checks
- DB backup complete
- rollback owner assigned
- previous release SHA recorded
- feature flags confirmed off or pilot-only before deploy
- post-deploy smoke checks pass

## Rollback Plan

### Fastest Safety Action
- disable hierarchy-related feature flags immediately

### Frontend Rollback
- redeploy previous Vercel deployment
- keep flags off until stable

### Backend Rollback
- redeploy previous Render release
- confirm health endpoints pass

### Database Rollback
Preferred first-release rollback method:
- keep additive columns in place
- roll back backend/frontend code
- keep feature flags off

If data or migration failure occurs:
- restore database from backup or use point-in-time recovery
- only use reverse migration scripts if tested and approved

## Tracking Checklist

### Planning
- [ ] business goal validated
- [ ] core rule approved
- [ ] pilot client identified

### Engineering
- [ ] feature branch created
- [ ] feature flags added
- [ ] schema migration PR approved
- [ ] backend hierarchy PR approved
- [ ] shared master PR approved
- [ ] reports PR approved
- [ ] frontend PR approved

### Staging
- [ ] staging backend ready
- [ ] staging frontend ready
- [ ] staging DB ready
- [ ] staging env vars configured
- [ ] staging migration successful

### Pilot
- [ ] pilot data prepared
- [ ] pilot feature flags enabled
- [ ] pilot report validation completed
- [ ] pilot support observation completed

### Production
- [ ] backup completed
- [ ] deployment approved
- [ ] post-deploy smoke completed
- [ ] monitoring completed
- [ ] rollout sign-off recorded

## What Not To Do
- do not edit production branch directly
- do not enable hierarchy behavior without flags
- do not rewrite core multi-company isolation
- do not change transaction ownership logic
- do not use `owner_company_id` in report filters
- do not auto-delete duplicate masters
- do not auto-merge referenced masters without review
- do not run untested destructive migration on production

## Ownership and Sign-Off
Before each release stage, confirm:
- product owner approval
- engineering approval
- deployment owner approval
- backup confirmation
- rollback confirmation

## Recommended Companion Documents
Use this plan together with:
- `docs/DEPLOYMENT-RUNBOOK.md`
- `docs/GO-LIVE-MASTER-CHECKLIST.md`
- `docs/system-architecture-module-guide.md`
- `docs/developer-guide-professional.md`

## Status Notes
Use this section as a running log during execution:

- `YYYY-MM-DD`:
  - branch created:
  - staging ready:
  - migration status:
  - pilot status:
  - production status:
