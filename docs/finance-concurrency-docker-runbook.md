# Finance Concurrency Proof Runbook (Docker Postgres)

## Purpose
Run DB-backed finance concurrency tests in an isolated Postgres instance so race-condition behavior is proven without touching the main development DB.

## Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- Node/npm dependencies installed in `backend/`

## Dedicated Test DB
- Compose file: `backend/docker-compose.finance-test.yml`
- Postgres host: `127.0.0.1`
- Port: `55432`
- DB: `construction_erp_finance_test`
- User: `postgres`
- Password: `postgres`

## One-Command Proof
From `backend/`:

```bash
npm run proof:finance:concurrency
```

This does:
1. Start dedicated Postgres container
2. Wait for DB readiness
3. Apply all backend migrations to the test DB
4. Run DB-backed concurrency suite (`npm run test:finance:concurrency`)
5. Auto-stop container at exit (default)

## Manual Step-by-Step
From `backend/`:

```bash
npm run db:finance:concurrency:up
npm run db:finance:concurrency:wait
npm run migrate:finance:concurrency
npm run test:finance:concurrency:docker
```

## Keep DB Running for Debugging
```bash
cd backend
KEEP_FINANCE_TEST_DB_UP=true npm run proof:finance:concurrency
```

Stop later:

```bash
npm run db:finance:concurrency:down
```

## Reset/Clean DB Volume
```bash
cd backend
npm run db:finance:concurrency:reset
```

Then rerun migrations before testing.

## Interpreting Results
- **Pass**: all concurrency tests execute and pass.
- **Skip**: environment still not connecting to dedicated DB.
- **Fail**: real finance concurrency/business-rule issue; use failure output as blocker source-of-truth.

## Safety Notes
- Scripts force dedicated DB env vars (port `55432`, DB `construction_erp_finance_test`).
- Main local DB (`construction_erp_db` on `5432`) is not touched by the dedicated proof flow.
