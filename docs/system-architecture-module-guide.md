# Construction ERP - System Architecture and Module Guide

## Document Control
- Document ID: `ERP-SYS-ARCH-001`
- Version: `1.0`
- Date: `2026-04-18`
- Audience: Product, engineering, implementation, support

## 1. Runtime Topology
- Backend API: Node.js + Express (`backend`)
- Database: PostgreSQL
- Frontend Admin: React + Vite (`web_admin`)
- API root: `/api`

## 2. Core Architecture Pattern
Backend follows modular structure:
- `routes` for API wiring
- `modules/<domain>` with controller/service/model/validation split
- middleware-driven authentication and role checks
- company-scoped query enforcement for multi-tenant safety

Frontend follows page-first structure:
- `src/pages/*` for module pages
- `AppShell` + `Sidebar` + `Header` for shared layout
- route-level protected access via `ProtectedRoute` and role maps

## 3. Active API Modules (From Current Route Wiring)
- `/auth`
- `/employees`
- `/dashboard`
- `/masters`
- `/vendors`
- `/plants`
- `/vehicles`
- `/parties`
- `/party-orders`
- `/party-material-rates`
- `/transport-rates`
- `/dispatch-reports`
- `/project-reports`
- `/plant-unit-reports`
- `/company-profile`
- `/audit-logs`
- `/onboarding`

Accounts and Finance APIs:
- `/accounts/masters`
- `/accounts/general-ledger`
- `/accounts/journal-vouchers`
- `/accounts/receivables`
- `/accounts/payables`
- `/accounts/cash-bank`
- `/accounts/posting-rules`
- `/accounts/reports`

## 4. Frontend Module Surfaces
Primary page groups:
- Operational: dashboard, dispatch, project/crusher reports, vehicles
- Commercial: parties, party orders, rates, exceptions
- Admin and governance: employees, masters, audit logs, onboarding
- Finance: accounts dashboard, chart of accounts, ledger, voucher entry, receivables, payables, cash/bank, reports, period controls, policy controls

## 5. Data and Control Principles
- All business-critical actions are expected to run in company scope
- Finance posting uses workflow states and governance controls
- Period status and finance policy control behavior of posting actions
- Audit and transition evidence support operational traceability

## 6. Testing and Verification Model
Common verification commands:
- Backend app load: `cd backend && npm run verify:app`
- Backend suite: `cd backend && npm test`
- Finance concurrency proof suite: `cd backend && npm run test:finance:concurrency`
- Frontend lint/build: `cd web_admin && npm run lint && npm run build`

## 7. Documentation Map
Use these docs together:
- `docs/developer-guide-professional.md`
- `docs/company-operations-guide-professional.md`
- `docs/user-manual-bilingual-professional.md`
- `docs/finance-uat-flow-2026-04-18.md`
- `docs/finance-rollout-evidence-2026-04-18.md`
- `docs/low-cost-production-deployment.md`
