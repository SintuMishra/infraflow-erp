#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_BASE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_PROD="${ROOT_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${ROOT_DIR}/backups"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DB_NAME="${POSTGRES_DB:-construction_erp_db}"
DB_USER="${POSTGRES_USER:-postgres}"
FILE_PATH="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.sql.gz"
CHECKSUM_PATH="${FILE_PATH}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "Creating PostgreSQL backup at ${FILE_PATH}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_BASE}" -f "${COMPOSE_PROD}" exec -T postgres \
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges \
  | gzip > "${FILE_PATH}"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${FILE_PATH}" > "${CHECKSUM_PATH}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${FILE_PATH}" > "${CHECKSUM_PATH}"
else
  echo "Warning: no sha256 tool found (sha256sum/shasum). Skipping checksum file."
  echo "Backup created: ${FILE_PATH}"
  exit 0
fi

echo "Backup created: ${FILE_PATH}"
echo "Checksum created: ${CHECKSUM_PATH}"
