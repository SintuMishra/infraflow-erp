#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [1/7] Backend tests"
(
  cd "$ROOT_DIR/backend"
  npm test
)

echo "==> [2/7] Backend app verification"
(
  cd "$ROOT_DIR/backend"
  npm run verify:app
)

echo "==> [3/7] Backend owner-lock verification"
(
  cd "$ROOT_DIR/backend"
  npm run verify:owner-lock
)

echo "==> [4/7] Backend go-live verification (production-safe local override)"
(
  cd "$ROOT_DIR/backend"
  npm run verify:go-live:local
)

echo "==> [5/7] Owner governance smoke (conditional)"
if [[ -n "${SMOKE_ADMIN_USERNAME:-}" && -n "${SMOKE_ADMIN_PASSWORD:-}" && -n "${SMOKE_ADMIN_COMPANY_ID:-}" && -n "${SMOKE_BOOTSTRAP_SECRET:-${ONBOARDING_BOOTSTRAP_SECRET:-}}" ]]; then
  (
    cd "$ROOT_DIR/backend"
    npm run smoke:owner-governance
  )
else
  echo "Skipping owner governance smoke: set SMOKE_ADMIN_USERNAME, SMOKE_ADMIN_PASSWORD, SMOKE_ADMIN_COMPANY_ID, and SMOKE_BOOTSTRAP_SECRET (or ONBOARDING_BOOTSTRAP_SECRET)."
fi

echo "==> [6/7] Frontend lint"
(
  cd "$ROOT_DIR/web_admin"
  npm run lint
)

echo "==> [7/7] Frontend production build"
(
  cd "$ROOT_DIR/web_admin"
  npm run build
)

cat <<'EOF'

All automated pre-live checks passed.

Manual checks still required:
1. Phone UAT flow: owner login -> onboarding -> client login by company code.
2. Create one dispatch/report and verify role-based hidden sections.
3. Take DB backup and verify rollback command in target environment.

EOF
