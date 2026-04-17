# Construction ERP - Developer Guide

> Legacy working draft. For official handover and production usage, use:
> `docs/developer-guide-professional.md`

## 1. Purpose
This document is the primary technical guide for engineers maintaining, extending, or deploying the `production_ready_clone` project.

Audience:
- backend developers
- frontend developers
- DevOps/release engineers
- QA engineers validating technical behavior

## 2. Product Scope
The system is a multi-company Construction ERP with operational, commercial, and administrative workflows.

Primary capabilities:
- multi-company isolation with company-scoped requests and data
- role-based access control (RBAC)
- employee and login management
- plant/unit and project daily reporting
- dispatch lifecycle with billing and print
- master data governance (materials, shifts, config, sub plants/units)
- commercial setup (parties, vendors, rates, orders)
- company profile and branded print headers
- audit logging and commercial exception tracking
- tenant/company onboarding for owner bootstrap

## 3. Repository Layout
Root: `production_ready_clone/`

- `backend/`: Express + PostgreSQL API
- `web_admin/`: React + Vite admin UI
- `backend/db/migrations/`: SQL migrations (`001` to `015`)
- `docs/`: operations, UAT, release, and technical guides
- `database/`: reserved schema workspace
- `mobile_app/`: placeholder for future mobile module

## 4. Technology Stack
Backend:
- Node.js
- Express 5
- PostgreSQL (`pg`)
- JWT auth
- custom in-memory rate limiting

Frontend:
- React 19
- React Router 7
- Axios
- Vite

## 5. Runtime Architecture
Request lifecycle:
1. frontend calls API through shared Axios client (`X-Company-Id` + Bearer token)
2. backend auth middleware validates JWT and company scope
3. role middleware enforces endpoint access
4. controller validates payload and calls service
5. service applies normalization/rules and calls model
6. model executes SQL via pooled PostgreSQL connection
7. response returns standardized success/error payload

Cross-cutting concerns:
- request ID (`X-Request-Id`) per backend request
- structured logging via internal logger
- global error handler with safe messages
- optional audit event recording for critical actions

## 6. Authentication, Authorization, and Company Isolation
Authentication:
- JWT token required for protected routes
- `mustChangePassword` sessions are restricted until password update

Company isolation:
- frontend adds `X-Company-Id` from session user
- backend compares token company and header company
- mismatch is blocked (`403`)
- `company_id` verification is enforced at startup when enabled

RBAC role groups (`web_admin/src/utils/access.js`):
- `admin`: `super_admin`, `manager`, `hr`
- `ops`: `super_admin`, `manager`, `hr`, `crusher_supervisor`, `site_engineer`
- `crusher`: `super_admin`, `manager`, `hr`, `crusher_supervisor`
- `projects`: `super_admin`, `manager`, `hr`, `site_engineer`

## 7. Backend Module Map
Base API prefix: `/api`

- `/health`, `/ready`: platform health and readiness
- `/auth`: login, password flows, register users, me
- `/employees`: employee records and HR admin workflows
- `/plant-unit-reports` and `/crusher-reports`: plant/crusher daily ops reports
- `/project-reports`: project daily reports
- `/dispatch-reports`: dispatch operations + status lifecycle
- `/dashboard`: consolidated metrics and exception views
- `/vehicles`: fleet and equipment logs
- `/masters`: master data + diagnostics + HSN auto-fill
- `/plants`: plant/unit workspace
- `/vendors`: vendor master
- `/parties`: party/customer master
- `/transport-rates`: logistics costing
- `/party-material-rates`: sales rate contracts
- `/party-orders`: commercial order book
- `/company-profile`: legal/profile + logo
- `/audit-logs`: change tracking
- `/onboarding`: tenant bootstrap

## 8. Frontend Page Map
Major pages in `web_admin/src/pages`:
- authentication: Login, Forgot Password, Change Password, Unauthorized
- overview: Dashboard
- operations: Plants/Units Reports, Project Reports, Dispatch Reports, Dispatch Print, Vehicles, Plants
- commercial: Parties, Party Material Rates, Party Orders, Party Commercial Profile, Commercial Exceptions
- administration: Employees, Masters, Company Profile, Tenant Onboarding, Audit Logs
- reference: Vendors, Transport Rates

## 9. Environment Configuration
Backend required env vars (`backend/src/config/env.js`):
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Backend optional/controlled env vars:
- `CORS_ORIGIN`
- `LOG_LEVEL`
- `ENFORCE_COMPANY_SCOPE`
- login/reset/onboarding rate-limit controls
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `EXPOSE_PASSWORD_RESET_TOKEN` (must be false in production)
- `ONBOARDING_BOOTSTRAP_SECRET`

Frontend env vars:
- `VITE_API_BASE_URL`

## 10. Local Setup
Backend:
1. `cd backend`
2. `npm install`
3. create `.env` from `.env.example`
4. `npm run migrate`
5. `npm run dev`

Frontend:
1. `cd web_admin`
2. `npm install`
3. create `.env` from `.env.example`
4. `npm run dev`

## 11. Database Migrations
Migration runner:
- command: `npm run migrate`
- script: `backend/src/scripts/runMigrations.js`
- migration table: `schema_migrations`

Current migration series:
- `001` multi-company foundation
- `002` auth security foundation
- `003` party orders foundation
- `004` dispatch-party FK alignment
- `005` company name uniqueness
- `006` project report indexes
- `007` project report fields enhancement
- `008` crusher report fields enhancement
- `009` report-plant links
- `010` plant-unit energy expenses
- `011` relaxed required fields for plant-unit reports
- `012` operational units plant type
- `013` material HSN/SAC support
- `014` employee practical profile fields
- `015` company profile logo support
- `016` company billing controls
- `017` company billing custom cycle fields
- `018` company billing invoices

## 12. Scripts and Verification
Backend scripts:
- `npm test`: full node test suite
- `npm run verify:app`: module load verification
- `npm run migrate`: migration runner
- `npm run smoke:dashboard-audit`: dashboard/audit smoke
- `npm run smoke:core-sections`: read-flow smoke
- `npm run smoke:core-sections-write`: write-flow smoke
- `npm run smoke:owner-governance`: owner billing/profile/delete governance smoke
- `npm run bootstrap:owner`: bootstrap company owner
- `npm run report:missing-hsn`: report missing HSN/SAC records

Frontend scripts:
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

Recommended CI quality gate:
1. backend tests
2. app verification
3. frontend build
4. frontend lint

## 13. Masters Hardening (Current State)
Implemented controls include:
- workspace diagnostics endpoint and UI
- auto-fill HSN/SAC for eligible active materials
- duplicate prevention and strict normalization in service layer
- not-found handling for updates (`404`)
- role-safe UI behavior (read-only ops roles)
- route-access automated regression test
- naming polish: "Sub Plants & Units"

Reference docs:
- `docs/masters-role-uat-checklist.md`
- `docs/masters-uat-evidence-2026-04-17.md`
- `docs/masters-release-checklist.md`

## 14. Error Handling and API Conventions
Common response shape:
- success responses: `{ success: true, data, message? }`
- error responses: `{ success: false, message, requestId? }`

Typical status conventions:
- `400`: validation error
- `401`: unauthenticated/invalid token
- `403`: unauthorized role/company mismatch/password change required
- `404`: missing target record
- `409`: conflict (duplicate business identity)
- `429`: rate limit
- `500`: unexpected server error

## 15. Security Controls
- JWT token verification on protected routes
- company-scope mismatch protection
- protected role assignment rules
- password reset flow and TTL validation
- login/reset/onboarding rate limiting
- production guard against reset-token exposure
- audit event tracking for important mutations

## 16. Deployment Runbook
Pre-deploy:
1. run migrations in target environment
2. run backend tests and app verification
3. run frontend production build
4. validate env vars and secrets

Deploy:
1. deploy backend
2. deploy frontend static build
3. restart services
4. check `/api/health` and `/api/ready`

Post-deploy smoke:
1. authenticate and open dashboard
2. validate masters read/write matrix
3. create and complete one dispatch lifecycle
4. print dispatch document with company profile assets
5. review audit log entries

Rollback strategy:
1. redeploy previous backend and frontend artifacts
2. rerun minimal smoke
3. open incident log for root-cause analysis

## 17. Troubleshooting Guide
Issue: `401 Invalid or expired token`
- verify token exists
- verify JWT secret consistency across environment
- ensure session not cleared by expired credentials

Issue: `403 Company scope mismatch`
- verify token `companyId` and header `X-Company-Id`
- clear stale frontend local storage session and relogin

Issue: startup failure for missing env variables
- backend env parser enforces required vars; verify `.env` correctness

Issue: migration failures
- check SQL syntax in the failed migration
- verify DB user permissions for DDL
- inspect `schema_migrations` state before rerun

Issue: read-only users can modify UI
- validate frontend role checks on impacted page
- validate backend route role guard remains intact
- rerun `masters-route-access.test.js` if masters-specific

Issue: logo not persisting on profile
- ensure backend payload limit and `company_profile.logo` migration are present

## 18. Development Standards
- keep controllers thin; place business rules in services
- preserve company scoping in all new data access queries
- add tests for role changes, validation, and cross-company behavior
- avoid breaking response shape used by frontend pages
- add/update docs in `docs/` for all production-visible behavior changes

## 19. Handover Checklist for New Developers
1. read this guide
2. run backend and frontend locally
3. execute migrations and tests
4. verify role access and company scope behavior
5. review current docs in `docs/` for release/UAT practices
6. shadow one end-to-end flow: onboarding -> masters -> rates -> dispatch -> print -> audit

## 20. Future Enhancement Recommendations
- OpenAPI/Swagger endpoint documentation generation
- centralized permission matrix test generator for all modules
- persistent/distributed rate-limit storage for scaled deployment
- staging and production infrastructure-as-code templates
- automated seed datasets for QA/UAT environments
