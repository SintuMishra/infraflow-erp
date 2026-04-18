#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
BACKUP_DIR="${ROOT_DIR}/backups"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

if [[ "${OFFSITE_BACKUP_ENABLED:-false}" != "true" ]]; then
  echo "Offsite backup disabled (OFFSITE_BACKUP_ENABLED=false). Nothing to do."
  exit 0
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  echo "Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

provider="$(echo "${OFFSITE_BACKUP_PROVIDER:-}" | tr '[:upper:]' '[:lower:]')"

case "${provider}" in
  s3)
    if [[ -z "${OFFSITE_BACKUP_S3_URI:-}" ]]; then
      echo "OFFSITE_BACKUP_S3_URI is required for provider=s3"
      exit 1
    fi
    if ! command -v aws >/dev/null 2>&1; then
      echo "aws CLI not found. Install awscli to use provider=s3"
      exit 1
    fi
    aws s3 sync "${BACKUP_DIR}/" "${OFFSITE_BACKUP_S3_URI}/" --only-show-errors
    ;;
  rclone)
    if [[ -z "${OFFSITE_BACKUP_RCLONE_REMOTE:-}" ]]; then
      echo "OFFSITE_BACKUP_RCLONE_REMOTE is required for provider=rclone"
      exit 1
    fi
    if ! command -v rclone >/dev/null 2>&1; then
      echo "rclone not found. Install rclone to use provider=rclone"
      exit 1
    fi
    rclone sync "${BACKUP_DIR}/" "${OFFSITE_BACKUP_RCLONE_REMOTE}/" --progress
    ;;
  *)
    echo "Unsupported OFFSITE_BACKUP_PROVIDER: '${OFFSITE_BACKUP_PROVIDER:-}'"
    echo "Use provider 's3' or 'rclone'"
    exit 1
    ;;
esac

echo "Offsite backup sync completed."
