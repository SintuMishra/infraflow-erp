#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_BASE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_PROD="${ROOT_DIR}/docker-compose.prod.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  echo "Copy .env.production.example to .env.production and update secrets."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

for secret_key in POSTGRES_PASSWORD JWT_SECRET ONBOARDING_BOOTSTRAP_SECRET; do
  secret_value="${!secret_key:-}"
  if [[ -z "${secret_value}" ]]; then
    echo "Missing required secret: ${secret_key}"
    exit 1
  fi
  if [[ "${secret_value}" == *"replace_with"* ]]; then
    echo "Placeholder detected for ${secret_key}. Generate a strong secret before deploy."
    exit 1
  fi
done

if (( ${#JWT_SECRET} < 32 )); then
  echo "JWT_SECRET must be at least 32 characters."
  exit 1
fi

if (( ${#POSTGRES_PASSWORD} < 24 )); then
  echo "POSTGRES_PASSWORD must be at least 24 characters."
  exit 1
fi

if (( ${#ONBOARDING_BOOTSTRAP_SECRET} < 24 )); then
  echo "ONBOARDING_BOOTSTRAP_SECRET must be at least 24 characters."
  exit 1
fi

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_BASE}" -f "${COMPOSE_PROD}" "$@"
}

echo "[1/5] Build latest backend/web images"
compose build --pull backend web

echo "[2/5] Start database and redis"
compose up -d postgres redis

echo "[3/5] Run migrations"
compose --profile ops run --rm migrate

echo "[4/5] Start backend and web"
compose up -d backend web

echo "[5/5] Deployment status"
compose ps

echo "Checking health endpoint..."
if curl -fsS "http://127.0.0.1:${WEB_PORT:-8080}/api/health" >/dev/null; then
  echo "Deployment healthy"
else
  echo "Warning: /api/health check failed. Inspect logs with:"
  echo "docker compose --env-file ${ENV_FILE} -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} logs --tail=200"
fi
