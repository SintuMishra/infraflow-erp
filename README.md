# Construction ERP System - Production Clone

This directory is an isolated production-hardening work copy of the main `construction_erp_system` project. It exists so release-quality fixes can be made without disturbing the in-progress source workspace.

## Scope Of This Clone

This clone includes production-hardened ERP modules with finance and governance controls:

- operational workflows (masters, parties, orders, dispatch, project/plant reports, vehicles)
- accounts/finance suite (ledger, vouchers, receivables, payables, cash/bank, reports)
- maker-checker workflow, period controls, policy controls, transition history
- company-scoped data safety and auditability controls
- backend migration/test toolchain including finance concurrency proof scripts
- frontend production build with role-aware route protection and premium admin UI
- low-cost deployment runbooks and Docker packaging for practical rollout

## Directory Layout

- `backend/` Express + PostgreSQL API
- `web_admin/` React + Vite admin interface
- `database/` reserved for schema/migration work
- `docs/` reserved for operational documentation

## Environment Setup

### Backend

Copy:

```bash
cp backend/.env.example backend/.env
```

Required variables:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### Frontend

Copy:

```bash
cp web_admin/.env.example web_admin/.env
```

Required variable:

- `VITE_API_BASE_URL`

## Run Locally

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd web_admin
npm install
npm run dev
```

## Verification Status

The workspace has been verified with:

- backend app verification (`npm run verify:app`)
- backend full test suite (`npm test`)
- finance concurrency suite (`npm run test:finance:concurrency`) in supported DB environment
- frontend lint (`npm run lint`)
- frontend production build (`npm run build`)

## Known Remaining Improvements

- centralized observability stack (beyond current app-level logs/checks)
- long-window performance and load evidence on live-like infra
- dynamic RBAC administration workflow refinements
- production operations automation depth (post-live hardening phase)

## Suggested Release Checklist

Before delivery, run:

```bash
cd backend && npm install && npm run verify:practical
cd ../web_admin && npm install && npm run verify:local
```

Optional advanced owner-governance smoke (requires stable owner credentials env vars):

```bash
cd backend && npm run smoke:owner-governance
```

Optional accounts reality smoke (sample-data workflow with auto cleanup):

```bash
cd backend && npm run smoke:accounts-mini
```

Or run the one-command pre-live pipeline:

```bash
cd /Users/sintumishra/projects/construction_erp_system/production_ready_clone
./scripts/final-prelive-check.sh
```

And manually verify:

- login flow
- dashboard load
- dispatch create/edit/status flow
- dispatch print view
- master data setup pages
- rates pages
- vehicles and parties management

## Notes

- This clone intentionally separates delivery work from the original project workspace.
- If you want to promote this clone into a standalone repo later, it is ready for Git initialization and release-branch cleanup.

## Documentation Handover

For production handover-ready documentation packs, start here:

- `docs/HANDOVER-DOCUMENTATION-INDEX.md`
- `docs/CLIENT-HANDOVER-PACKET.md`
- `docs/CLIENT-HANDOVER-PACKET-HI.md`
- `docs/developer-new-client-handover-quickstart.md`
- `docs/developer-new-client-handover-quickstart-hi.md`
- `docs/DEPLOYMENT-RUNBOOK.md`

This index maps:
- developer and architecture guides
- client/company operations documents (English + Hindi)
- finance operation and evidence docs
- release, UAT, and rollout checklists
