# Construction ERP System - Production Clone

This directory is an isolated production-hardening work copy of the main `construction_erp_system` project. It exists so release-quality fixes can be made without disturbing the in-progress source workspace.

## Scope Of This Clone

This clone currently includes:

- backend env hardening with required variable checks
- transaction support in the backend DB layer
- dispatch GST field persistence and validation improvements
- transactional dispatch and vehicle-status updates
- dashboard equipment-log query correction
- frontend API base URL moved to environment config
- frontend lint cleanup to a no-error baseline
- route-level lazy loading for the admin frontend
- backend verification scripts and baseline tests
- owner governance hardening (custom billing cycle, invoice persistence, permanent client delete, owner self-profile)

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

The clone has been verified with:

- backend app module load
- backend test run
- backend route and middleware smoke tests
- frontend production build
- frontend lint with no blocking errors

Current remaining quality items are warnings and product-level improvements, not immediate release blockers.

## Known Remaining Improvements

- add backend linting and automated tests
- add database migrations and seed scripts
- reduce frontend bundle size with route-level code splitting
- finish remaining frontend hook/dependency warning cleanup
- add deployment notes for staging and production

## Suggested Release Checklist

Before delivery, run:

```bash
cd backend && npm install
cd ../web_admin && npm install
cd ../backend && npm test && npm run verify:app && npm run start
cd ../web_admin && npm run lint && npm run build
```

Optional advanced owner-governance smoke (requires stable owner credentials env vars):

```bash
cd backend && npm run smoke:owner-governance
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

This index maps:
- developer/technical documents
- client/company operations documents (English + Hindi)
- release and UAT checklists/evidence
