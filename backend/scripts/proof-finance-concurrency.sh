#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-55432}"
export DB_NAME="${DB_NAME:-construction_erp_finance_test}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export FINANCE_DB_INTEGRATION_TESTS=true

if [[ "${KEEP_FINANCE_TEST_DB_UP:-false}" != "true" ]]; then
  cleanup() {
    npm run db:finance:concurrency:down >/dev/null 2>&1 || true
  }
  trap cleanup EXIT
fi

if [[ "${FINANCE_TEST_RESET_DB:-true}" == "true" ]]; then
  npm run db:finance:concurrency:reset >/dev/null 2>&1 || true
fi

npm run db:finance:concurrency:up
npm run db:finance:concurrency:wait
npm run db:finance:concurrency:init
npm run migrate
npm run test:finance:concurrency
