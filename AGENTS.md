# AGENTS.md

## Project Type
Production-grade Construction ERP for real-world business operations.

## Tech Stack
- Backend: Node.js (Express)
- Database: PostgreSQL
- Frontend: React (Vite)
- Architecture: Modular backend under `backend/src/modules`

## Existing ERP Scope
The ERP already includes operational/business modules around:
- companies
- parties
- party_orders
- party_material_rates
- dispatch
- projects
- vehicles
- masters
- dashboard
- audit_logs

## Core Business Flow
Party → Rate → Order → Dispatch → Billing / Closure → Finance

## Architectural Rules
- Always inspect existing repository structure before changing architecture.
- Reuse existing controller/service/model/validation patterns.
- Reuse existing route structure, middleware style, response style, and naming conventions.
- Do not introduce disconnected sub-architectures.
- Prefer extending existing business flows over duplicating them.
- Do not create duplicate masters if an equivalent master already exists.
- All finance features must integrate natively into the ERP.

## Multi-Company Rules
- Multi-company support is mandatory.
- Every finance table, query, service, route, report, and validation must respect `company_id`.
- Never bypass company scoping.
- All reports and transactions must be filtered safely by company.

## Finance Rules (CRITICAL)
- Double-entry accounting only.
- No unbalanced voucher can ever be approved or posted.
- Posted vouchers are immutable.
- Corrections must happen through reversal and repost, not unsafe editing.
- Every financial entry must track source linkage:
  - source module
  - source record id
  - source type/table if applicable
- Party acts as customer/supplier/both subledger basis.
- Dispatch is a controlled revenue trigger, not a blind auto-post source.
- Prevent duplicate source posting wherever applicable.
- Settlement cannot exceed outstanding amount.
- Financial state transitions must be explicit and validated.
- No hard delete for posted finance records.

## Data Integrity Rules
- Use database constraints, indexes, foreign keys, and checks where appropriate.
- Protect posted vouchers and lines at DB level where required.
- Use transactions for finance-critical write operations.
- Voucher lines must never exist without a valid voucher.
- Status transitions must be validated in code and protected from invalid mutations.
- Future extensibility for GST/TDS, fixed assets, project costing, plant costing, and budgeting must be preserved.

## Audit and Compliance Rules
- Use `audit_logs` for all finance create/update/approve/post/reverse actions.
- Preserve who created, approved, posted, reversed, and when.
- Keep all finance flows traceable and reversible where appropriate.
- Do not mark finance work complete unless auditability is wired.

## ERP Integration Rules
Finance must integrate with:
- parties
- dispatch
- projects
- plants / crusher units
- vehicles / equipment
- companies
- dashboard
- audit_logs

Specific rules:
- Reuse party master for customer/supplier ledgers.
- Support project, plant, vehicle, and party tagging on finance entries.
- Dispatch-linked receivables must be controlled, idempotent, and traceable.
- Party/ledger sync must not create duplicate ledgers repeatedly.

## UX Rules
- Must feel enterprise-grade and premium.
- Must match the existing admin UI structure and style.
- No basic CRUD-only UX.
- Must be practical for real accountants and finance managers.
- Include good forms, filters, validation messages, loading states, and empty states.
- Reports and workflows must be usable, not just visible.

## Code Quality Rules
- No dummy code.
- No TODO-based fake completion.
- No fake success responses.
- Full validation is required.
- Production-ready logic only.
- Keep code readable, consistent, and testable.
- Do not claim something is complete if it is only scaffolded.

## Testing Rules
- Add meaningful tests for business-critical finance behavior.
- Cover at least:
  - voucher balancing
  - posted voucher immutability
  - reversal flow
  - company scoping
  - source-link posting integrity
  - settlement cap validation
  - AR/AP correctness
  - finance route access protection
  - report correctness for key finance flows
- Prefer real service/route/business-rule tests over superficial tests.

## Completion Rules
A finance task is not complete unless:
- DB migration exists
- backend routes/services/validations exist
- frontend UI is wired
- company scoping works
- audit logs are wired
- tests exist for critical rules
- finance flows work end-to-end
- code is integrated into existing ERP architecture
- implementation is practical for real-world usage

## Goal
Build and continuously harden a complete, production-grade, professional, ultra-premium Accounts/Finance module integrated into the ERP, not standalone.