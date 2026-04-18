#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_BASE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_PROD="${ROOT_DIR}/docker-compose.prod.yml"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 /absolute/path/to/backup.sql.gz"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

DB_NAME="${POSTGRES_DB:-construction_erp_db}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "WARNING: this will replace all data in database '${DB_NAME}'."
read -r -p "Type 'RESTORE' to continue: " CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

echo "Recreating database '${DB_NAME}'..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_BASE}" -f "${COMPOSE_PROD}" exec -T postgres \
  psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
  -c "CREATE DATABASE ${DB_NAME};"

echo "Restoring backup from ${BACKUP_FILE}"
gzip -dc "${BACKUP_FILE}" | docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_BASE}" -f "${COMPOSE_PROD}" exec -T postgres \
  psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1

echo "Restore completed successfully."
