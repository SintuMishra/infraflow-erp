# Low-Cost Production Deployment Runbook

For Oracle Cloud Always Free VM deployment, use the Oracle-specific runbook:
- `docs/oracle-cloud-free-tier-deployment-runbook.md`

## Target Architecture (Single VPS)
- 1 Linux VPS (Ubuntu 24.04 LTS)
- Docker Compose stack:
  - `web` (Nginx serving Vite build + reverse proxy `/api`)
  - `backend` (Node/Express API)
  - `postgres` (primary DB, persistent volume)
  - `redis` (AOF persistence enabled, persistent volume)
- TLS/SSL:
  - Recommended: host-level Nginx or Caddy terminating TLS and forwarding to `web:80`
  - App stack already reverse-proxy ready at `/api`

## Production Secret Generation (Mandatory)
Generate secrets on the server before first deploy:

```bash
openssl rand -base64 36 | tr -d '\n' && echo
openssl rand -hex 32 | tr -d '\n' && echo
```

Use generated values for:
- `POSTGRES_PASSWORD` (minimum 24 chars)
- `JWT_SECRET` (minimum 32 chars)
- `ONBOARDING_BOOTSTRAP_SECRET` (minimum 24 chars)

`./scripts/deploy.sh` now blocks deployment if placeholders are still present.

## Minimum Practical Server Size
- Recommended minimum for smooth production (single-company but real usage):
  - `2 vCPU`
  - `4 GB RAM`
  - `80 GB SSD`
- Better headroom (recommended once usage grows): `4 vCPU`, `8 GB RAM`

## Compose Production Resource Profile
Current production override (`docker-compose.prod.yml`) uses:
- `postgres`: `2 GB RAM`, `1.50 CPU`
- `backend`: `1.5 GB RAM`, `1.50 CPU`
- `redis`: `512 MB RAM`, `0.50 CPU`
- `web`: `384 MB RAM`, `0.75 CPU`

These are still low-cost but more stable than tiny limits under real finance/report usage.

## Prerequisites on Server
1. Install Docker Engine + Docker Compose plugin.
2. Ensure Docker starts automatically after reboot:
   - `sudo systemctl enable docker`
   - `sudo systemctl start docker`
2. Open inbound ports:
   - `80` (HTTP)
   - `443` (HTTPS, when TLS proxy is configured)
3. Clone repository on server.
4. Create production env file:
   - `cp .env.production.example .env.production`
   - Set strong secrets and real domain.
5. Tune DB pool values in `.env.production` (recommended defaults already provided):
   - `DB_POOL_MAX=20`
   - `DB_POOL_MIN=2`
   - `DB_POOL_IDLE_TIMEOUT_MS=30000`
   - `DB_POOL_CONNECTION_TIMEOUT_MS=5000`

## First-Time Deployment
From repo root:

```bash
cp .env.production.example .env.production
# edit .env.production with real values

./scripts/deploy.sh
```

What `deploy.sh` does:
1. Builds backend/web images
2. Starts `postgres` + `redis`
3. Runs migrations with `migrate` profile service
4. Starts `backend` + `web`
5. Performs health check against `/api/health` on `127.0.0.1:${WEB_PORT:-8080}`

## Manual Command Equivalents
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml build --pull backend web
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml --profile ops run --rm migrate
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d backend web
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Updating / Redeploying
```bash
git pull
./scripts/deploy.sh
```

## Backup Plan
- DB backup script:

```bash
./scripts/backup-db.sh
```

- Output location:
  - `backups/<db-name>-<timestamp>.sql.gz`
  - `backups/<db-name>-<timestamp>.sql.gz.sha256`

- Verify backup integrity:

```bash
# Linux
sha256sum -c /absolute/path/to/backup.sql.gz.sha256

# macOS
shasum -a 256 -c /absolute/path/to/backup.sql.gz.sha256
```

- Suggested schedule:
  - Nightly cron:

```bash
0 2 * * * cd /path/to/production_ready_clone && ./scripts/backup-db.sh >> /var/log/erp-backup.log 2>&1
```

## Offsite Backup (Low-Cost, Practical)
Keep local backups plus offsite sync. Two simple options are supported:

### Option A: S3-Compatible (AWS S3 / Cloudflare R2 / Backblaze B2 S3)
1. Install AWS CLI.
2. Configure credentials (`aws configure` or env vars).
3. Set in `.env.production`:
   - `OFFSITE_BACKUP_ENABLED=true`
   - `OFFSITE_BACKUP_PROVIDER=s3`
   - `OFFSITE_BACKUP_S3_URI=s3://your-backup-bucket/erp-backups`
4. Run:

```bash
./scripts/backup-offsite.sh
```

### Option B: rclone (B2/Wasabi/Google Drive/other)
1. Install and configure rclone remote.
2. Set in `.env.production`:
   - `OFFSITE_BACKUP_ENABLED=true`
   - `OFFSITE_BACKUP_PROVIDER=rclone`
   - `OFFSITE_BACKUP_RCLONE_REMOTE=yourremote:erp-backups`
3. Run:

```bash
./scripts/backup-offsite.sh
```

Recommended cron chain:

```bash
15 2 * * * cd /path/to/production_ready_clone && ./scripts/backup-db.sh && ./scripts/backup-offsite.sh >> /var/log/erp-backup.log 2>&1
```

## Restore Plan
```bash
./scripts/restore-db.sh /absolute/path/to/backup.sql.gz
```

Restore script behavior:
1. Prompts for explicit `RESTORE` confirmation
2. Drops and recreates target DB
3. Restores SQL dump into clean DB

## Rollback Plan (Safe, Practical)
1. Keep previous git tag/commit for every deployment.
2. Roll back code:

```bash
git checkout <previous_stable_tag_or_commit>
```

3. Redeploy stack:

```bash
./scripts/deploy.sh
```

4. If data-level rollback is required:
   - restore last known-good backup with `restore-db.sh`.

## Domain + HTTPS (Low-Cost, Realistic)
Recommended approach: Cloudflare DNS + host-level Caddy (simplest TLS automation).

### 1) Domain + DNS
1. Buy any low-cost domain.
2. Add domain to Cloudflare.
3. Create `A` record (`erp.your-domain.com`) -> VPS public IP.

### 2) Install Caddy on host
```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 3) Caddy reverse proxy config
Create `/etc/caddy/Caddyfile`:

```caddyfile
erp.your-domain.com {
    encode gzip
    reverse_proxy 127.0.0.1:80
}
```

Then:

```bash
sudo systemctl enable caddy
sudo systemctl restart caddy
```

### 4) Set production CORS
In `.env.production`:
- `CORS_ORIGIN=https://erp.your-domain.com`

Then redeploy:

```bash
./scripts/deploy.sh
```

## Health Verification
```bash
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/api/health
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/api/ready
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 backend web postgres redis
```

Expected:
- All services `Up` and healthy
- `/api/health` returns `success: true`
- `/api/ready` returns ready response

## Operational Notes
- Secrets are env-driven via `.env.production`.
- Deploy script blocks placeholder/weak critical secrets.
- DB and Redis data are persistent via named volumes.
- Containers are restart-safe (`restart: always` in prod override).
- Compose logging limits are enabled to avoid unbounded disk growth.
- Use `docker compose ... ps` after reboot to confirm services are healthy.
