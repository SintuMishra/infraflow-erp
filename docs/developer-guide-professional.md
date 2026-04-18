# Construction ERP - Professional Developer Guide

## Document Control
- Document ID: `ERP-DEV-GUIDE-PRD-001`
- Version: `1.4`
- Date: `2026-04-18`
- Audience: Engineering, QA, DevOps, Technical Support
- Classification: Internal Technical
- Release candidate marker: `PRC-RC-2026-04-18-owner-governance-final`

## 1. Executive Overview
This guide defines the technical operating model for the Construction ERP platform in `production_ready_clone`, including architecture, setup, release controls, role security, testing, troubleshooting, and handover.

## 2. System Architecture
### 2.1 Applications
- Backend API: Node.js + Express + PostgreSQL (`production_ready_clone/backend`)
- Admin Frontend: React + Vite (`production_ready_clone/web_admin`)

### 2.2 Core Design Principles
- Company-scoped multi-tenant isolation
- Role-based authorization at route level
- Service-layer business validation
- Auditability of sensitive operations
- Operational-first UX and printable outputs

## 3. Module Inventory
### 3.1 Backend API Modules (`/api/*`)
- Auth, Employees, Onboarding
- Plant Unit Reports (Crusher), Project Reports
- Dispatch Reports, Dashboard, Vehicles
- Masters, Plants, Vendors, Parties
- Transport Rates, Party Material Rates, Party Orders
- Company Profile, Audit Logs
- Accounts Masters
- General Ledger and Journal Vouchers
- Accounts Receivable and Accounts Payable
- Cash/Bank
- Finance Posting Rules
- Financial Reports

### 3.2 Frontend Modules
- Authentication and session routes
- Operational workflows (reports, dispatch, vehicles)
- Commercial workflows (parties, rates, orders, exceptions)
- Administration (employees, masters, company profile, audit logs, tenant onboarding)
- Accounts and finance control suite:
  - accounts dashboard
  - chart of accounts and ledgers
  - voucher entry with workflow inbox
  - receivables and payables
  - cash/bank
  - finance reports
  - period controls
  - finance policy controls

## 4. Security and Access Model
### 4.1 Authentication
- JWT bearer token on protected routes
- Forced password change workflow for temporary credentials

### 4.2 Authorization (Role Groups)
- `admin`: super_admin, manager, hr
- `ops`: super_admin, manager, hr, crusher_supervisor, site_engineer
- `crusher`: super_admin, manager, hr, crusher_supervisor
- `projects`: super_admin, manager, hr, site_engineer

### 4.3 Company Isolation
- Frontend sends `X-Company-Id`
- Backend validates token company and header company
- Mismatch blocked with `403`

### 4.4 Split Login Surfaces (Owner vs Client)
- Owner portal route: `/owner-login`
- Client portal route: `/client-login/:companyCode`
- Backend login intent enforcement:
  - `owner` intent allows platform-owner `super_admin` scope only
  - `client` intent allows selected tenant scope only
- Public company context endpoint:
  - `GET /api/auth/login-context/:companyCode`
  - used to show validated company name on client login page

## 5. Environment and Configuration
### 5.1 Backend Required Variables
- `PORT`, `NODE_ENV`, `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### 5.2 Backend Operational Variables
- `CORS_ORIGIN`, `LOG_LEVEL`, `ENFORCE_COMPANY_SCOPE`
- login/reset/onboarding rate-limit parameters
- `ONBOARDING_BOOTSTRAP_SECRET`
- `PLATFORM_OWNER_COMPANY_ID` (restrict tenant bootstrap to platform owner tenant)
- `EXPOSE_PASSWORD_RESET_TOKEN` (must be `false` in production)

### 5.3 Frontend Variables
- `VITE_API_BASE_URL`
- `VITE_PLATFORM_OWNER_COMPANY_ID` (hide tenant onboarding UI for non-owner tenants)

## 6. Database and Migration Governance
- Migration runner: `npm run migrate`
- Migration folder: `backend/db/migrations`
- Migration registry table: `schema_migrations`
- Rule: never edit applied migration files in production; add new forward-only migration.

## 7. Local Development SOP
### 7.1 Backend
1. `cd backend`
2. `npm install`
3. create `.env`
4. `npm run migrate`
5. `npm run dev`

### 7.2 Frontend
1. `cd web_admin`
2. `npm install`
3. create `.env`
4. `npm run dev`

## 8. Testing and Quality Gate
### 8.1 Mandatory Checks
- `cd backend && npm test`
- `cd backend && npm run verify:app`
- `cd backend && npm run test:finance:concurrency`
- `cd web_admin && npm run build`
- `cd web_admin && npm run lint`

### 8.2 Masters-specific Security Regression
- `cd backend && npm test -- masters-route-access.test.js masters-service.test.js`

## 9. Deployment Runbook
### 9.1 Pre-Deploy
- verify migrations and env vars
- run full quality gate
- confirm rollback artifact/tag

### 9.2 Deploy
- deploy backend
- deploy frontend static bundle
- restart services
- validate `/api/health` and `/api/ready`

### 9.3 Post-Deploy Smoke
- login and dashboard load
- role matrix behavior in Masters
- one dispatch create->complete->print flow
- audit log verification for sensitive updates

## 10. Operational Reliability Controls
- request ID traceability in API responses
- structured error handling with safe 5xx responses
- rate limiting on login and password-reset surfaces
- startup guard for company-scope foundation

## 11. Tenant Onboarding - Technical Deep Dive
### 11.1 What This Module Actually Does
- Endpoint: `POST /api/onboarding/bootstrap-company-owner`
- Access control: requires authenticated `super_admin` session and `x-bootstrap-secret` header compared against `ONBOARDING_BOOTSTRAP_SECRET`
- Guard rails:
  - onboarding disabled if bootstrap secret is not configured
  - rate-limited endpoint
  - payload validation for required fields
  - duplicate legal company-name protection
  - audit logging for success/failure attempts

### 11.2 Atomic Bootstrap Output
Single request creates all required first-day records in one transaction:
- `companies` tenant record (active)
- company profile baseline
- owner employee record
- owner login user (`super_admin`) with generated temporary password

### 11.3 Why Confusion Happens
- The generated temporary password is returned only in onboarding response flow and should be treated as one-time sensitive output.
- Onboarding is not a public client self-signup; it is internal controlled provisioning.
- If company-scope migrations are missing (`company_id` in key tables), onboarding intentionally fails.

### 11.4 Production Rule
- expose onboarding UI only to internal implementation/admin team
- do not share bootstrap secret with client users
- rotate bootstrap secret periodically
- keep owner portal URL internal (`/owner-login`) and provide clients only scoped company URL (`/client-login/{companyCode}`)

## 12. Commercial Exceptions - Technical Deep Dive
### 12.1 What This Module Is
- Exception queue endpoint: `GET /api/dashboard/commercial-exceptions`
- Review endpoint: `POST /api/dashboard/commercial-exceptions/review`
- Assignment endpoint: `POST /api/dashboard/commercial-exceptions/assign`

This is a computed control layer, not a separate ledger table.

### 12.2 How Exceptions Are Generated
System calculates exception rows from live data:
- overdue open orders with pending quantity
- active orders missing active rate
- dispatches not linked to an open order when link should exist
- completed dispatches missing invoice/E-Way closure details

### 12.3 Review/Assign Storage Model
- review and assignment are persisted through `audit_logs` events
- queue state is reconstructed from current business data + latest audit events
- result: transparent traceability and no duplicate exception-state table drift

### 12.4 Operational Meaning
- This page is an operational risk queue.
- It does not replace invoicing/order/dispatch masters.
- Teams should close root issue in source module, then mark review/assignment in queue.

## 13. Multi-Company Delivery and Handover Model
If you sell to multiple companies, use one platform with strict company isolation and run this per customer.

Quick execution sheet:
- `docs/developer-new-client-handover-quickstart.md`
- `docs/developer-new-client-handover-quickstart-hi.md`

### 13.1 New Customer Provisioning SOP
1. Create commercial contract, legal company name, and implementation scope.
2. Run onboarding bootstrap (`/onboarding/bootstrap-company-owner`) for that company.
3. Deliver owner credentials through secure channel (never plain group chat/email without controls).
4. Force immediate password change on first login.
5. Configure company profile, logo, masters, parties, rates, and role users.
6. Execute role-wise UAT checklist and signoff.
7. Provide handover packet from `docs/HANDOVER-DOCUMENTATION-INDEX.md`.

### 13.2 What To Hand Over To Each Client
- company operations guide (English/Hindi as needed)
- role-specific SOP and escalation matrix
- support contact channels and SLA
- backup/restore policy statement
- release communication template (what changes, when, expected impact)

### 13.3 Recommended Commercial Operating Model
- one implementation project board per customer
- one UAT evidence file per customer and release
- separate billing/support tracker per tenant
- centralized engineering release branch with tested migration policy

## 14. Incident Response Playbook
### 14.1 Authentication Failure
- validate JWT secret and token expiration
- verify client storage/session state

### 14.2 Company Scope Error (`403` mismatch)
- validate user company and `X-Company-Id`
- clear stale session and re-authenticate

### 14.3 Migration Failure
- inspect failing SQL and migration order
- verify DB permissions and lock contention
- resolve forward and rerun migration

### 14.4 Role Access Regression
- rerun `masters-route-access.test.js`
- validate route middleware order and role list

## 15. Post-Go-Live Maintenance and Update Strategy
### 15.1 Does Update Stop Client Work?
Not necessarily. With correct strategy, most releases are near-zero downtime:
- frontend static deploys: usually no hard downtime
- backend rolling restart: brief impact if not load-balanced
- schema changes: low impact if backward-compatible migrations are used

### 15.2 Update Categories
- Hotfix: critical bug/security; fast patch and targeted verification.
- Minor release: features/improvements; scheduled window + smoke tests.
- Major release: structural changes; pre-announced maintenance window + rollback plan.

### 15.3 No-Data-Loss Release Rules
- backup before every production migration (snapshot + PITR capability)
- forward-only migrations, no destructive ad-hoc SQL in production
- deploy DB migrations before app code only when backward-compatible
- keep API compatibility for at least one release overlap when possible
- run post-deploy data integrity checks and reconcile queue

### 15.4 Safe Rollout Pattern
1. Announce release and expected impact.
2. Take verified backup.
3. Run migrations.
4. Deploy backend (rolling/blue-green preferred).
5. Deploy frontend.
6. Run smoke tests (login, dispatch create/print, exceptions queue, audit logs).
7. Monitor errors and latency for 30-60 minutes.
8. If severe issue: rollback app version and execute DB rollback strategy only if pre-planned.

### 15.5 Bug Fix While System Is Live
- prefer additive fixes (new columns/flags) over breaking changes
- isolate risky changes behind feature flags
- patch during low-traffic windows for operational modules
- keep incident log and RCA for repeated defects

## 16. Coding and Change Standards
- keep controllers thin; business rules in services
- enforce company scope in every read/write path
- add tests for any role/security/business-rule change
- update docs for user-visible behavior changes

## 17. Handover Package Checklist
Release must include:
- technical guide (this doc)
- company operations guide
- masters UAT checklist
- masters UAT evidence report
- masters release checklist
- latest build/test evidence

## 18. Support Model
- L1: operations support (usage/data issues)
- L2: product admin/manager (role/process issues)
- L3: engineering (bugs, deployment, data integrity incidents)

## 19. Continuous Improvement Roadmap
- OpenAPI generation
- centralized permission matrix tests across all modules
- persistent distributed rate limiter
- staging IaC and deployment automation
- seeded QA dataset for repeatable UAT
