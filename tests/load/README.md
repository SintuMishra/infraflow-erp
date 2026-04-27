# Load Testing Guide

These scripts are for **staging validation only**.

They assume:

- backend API is reachable directly
- login works with the same JWT + `X-Company-Id` model used by the frontend
- you have a valid staging user and company

## Requirements

- `k6` installed locally

## Environment Variables

Required:

- `BASE_URL`
- `TEST_EMAIL`
- `TEST_PASSWORD`
- `COMPANY_ID`

Recommended:

- `LOGIN_INTENT`

Optional:

- `REPORT_RANGE_DAYS`
- `VUS`
- `DURATION`
- `ALLOW_NON_STAGING`

## Examples

Login-only baseline:

```bash
BASE_URL=https://staging-api.example.com/api \
TEST_EMAIL=demo_user \
TEST_PASSWORD='secret' \
COMPANY_ID=2 \
LOGIN_INTENT=client \
k6 run tests/load/k6-login.js
```

Core ERP mixed traffic with 25 users:

```bash
BASE_URL=https://staging-api.example.com/api \
TEST_EMAIL=demo_user \
TEST_PASSWORD='secret' \
COMPANY_ID=2 \
LOGIN_INTENT=client \
VUS=25 \
DURATION=5m \
k6 run tests/load/k6-erp-core.js
```

Core ERP mixed traffic with 60 users:

```bash
BASE_URL=https://staging-api.example.com/api \
TEST_EMAIL=demo_user \
TEST_PASSWORD='secret' \
COMPANY_ID=2 \
LOGIN_INTENT=client \
VUS=60 \
DURATION=10m \
k6 run tests/load/k6-erp-core.js
```

Core ERP mixed traffic with 100 users:

```bash
BASE_URL=https://staging-api.example.com/api \
TEST_EMAIL=demo_user \
TEST_PASSWORD='secret' \
COMPANY_ID=2 \
LOGIN_INTENT=client \
VUS=100 \
DURATION=10m \
k6 run tests/load/k6-erp-core.js
```

Core ERP mixed traffic with 120 users:

```bash
BASE_URL=https://staging-api.example.com/api \
TEST_EMAIL=demo_user \
TEST_PASSWORD='secret' \
COMPANY_ID=2 \
LOGIN_INTENT=client \
VUS=120 \
DURATION=10m \
k6 run tests/load/k6-erp-core.js
```

## Pass / Warning / Fail

### PASS

- `http_req_failed < 1%`
- `checks > 99%`
- overall `p95 < 1000ms`
- normal APIs average under `300ms`
- report APIs average under `1000ms`
- no sustained DB CPU spike

### WARNING

- `http_req_failed` between `1%` and `2%`
- `checks` between `97%` and `99%`
- `p95` between `1000ms` and `1500ms`
- short DB CPU spikes that recover quickly
- isolated 5xx spikes during dashboard/report bursts

### FAIL

- `http_req_failed >= 2%`
- `checks < 97%`
- `p95 > 1500ms`
- repeated auth failures
- company-scope/header mismatches
- sustained DB CPU spike or connection saturation

## What To Check After Each Run

### Render Logs

- repeated `401`, `403`, or company-scope errors
- repeated `500` responses
- timeout or upstream reset messages
- repeated migration or boot-time errors
- memory pressure / restart events

### Database Logs / Metrics

- sustained CPU spikes instead of short peaks
- slow query patterns on dispatch, dashboard, project, crusher, or voucher reads
- connection exhaustion / waiting clients
- lock contention
- rising latency after increasing from `60` to `100` or `120` users

## Final Go / No-Go

Production is allowed only if all of these are true:

- staging functional checklist passes
- k6 error rate is below `1%`
- k6 checks pass rate is above `99%`
- p95 API duration stays below `1000ms`
- no sustained DB CPU spike
- no auth or company-scope errors
- report totals remain correct

## Success Targets

- normal APIs average under `300ms`
- report endpoints average under `1s`
- failed request rate under `1%`
- no sustained DB CPU spike

## Suggested Sequence

1. Run `k6-login.js`
2. Run `k6-erp-core.js` with `VUS=25`
3. Repeat at `60`, `100`, and `120`
4. Check Render logs and database metrics after every run

These scripts are read-only and safe for staging because they only hit login and `GET` report/list/lookup endpoints.
