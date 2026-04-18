# Oracle Cloud Free Tier Deployment Runbook

## Scope
- Target: low-cost single-VM production deployment on Oracle Cloud Always Free.
- Stack: `web` + `backend` + `postgres` + `redis` with Docker Compose.
- This runbook is for the main application database only.
- Finance concurrency proof database remains isolated in `backend/docker-compose.finance-test.yml` and must not be reused for production.

## Recommended Oracle Shape and Storage
- Best default on Always Free:
  - `VM.Standard.A1.Flex`
  - `2 OCPU`, `12 GB RAM` (if quota allows)
  - `80-120 GB` boot volume
- Fallback (tight quota):
  - `1 OCPU`, `6 GB RAM`, `80 GB` boot volume
- OS:
  - Ubuntu 24.04 LTS or Oracle Linux 8/9

## Network and Security List (OCI)
1. Reserve and attach a static public IPv4 to the VM.
2. Security list ingress rules:
   - `22/tcp` from your admin IP only
   - `80/tcp` from `0.0.0.0/0`
   - `443/tcp` from `0.0.0.0/0`
3. Do not expose `5432` or `6379` publicly.
4. On VM firewall (if enabled), allow only `22`, `80`, `443`.

## VM Preparation
```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Kolkata
```

### Install Docker + Compose Plugin (Ubuntu)
```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"
```

Reconnect SSH once after `usermod`.

### Install Docker + Compose Plugin (Oracle Linux 8/9)
```bash
sudo dnf update -y
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"
```

## Deploy Application
```bash
git clone <your-repo-url> construction_erp_system
cd construction_erp_system/production_ready_clone
cp .env.production.example .env.production
```

Set `.env.production` values:
- strong `POSTGRES_PASSWORD`, `JWT_SECRET`, `ONBOARDING_BOOTSTRAP_SECRET`
- `CORS_ORIGIN=https://erp.your-domain.com`
- `WEB_BIND_IP=127.0.0.1`
- `WEB_PORT=8080`
- DB pool defaults:
  - `DB_POOL_MAX=20`
  - `DB_POOL_MIN=2`
  - `DB_POOL_IDLE_TIMEOUT_MS=30000`
  - `DB_POOL_CONNECTION_TIMEOUT_MS=5000`

Generate secrets:
```bash
openssl rand -base64 36 | tr -d '\n' && echo
openssl rand -hex 32 | tr -d '\n' && echo
```

Run deployment:
```bash
./scripts/deploy.sh
```

## Domain + TLS (Cloudflare + Caddy)
1. Add domain in Cloudflare.
2. Create `A` record:
   - `erp.your-domain.com` -> VM public IP.
3. Install Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```
4. Install config:
```bash
sudo cp deploy/Caddyfile.oracle.example /etc/caddy/Caddyfile
sudo sed -i 's/erp.your-domain.com/<your-real-domain>/g' /etc/caddy/Caddyfile
sudo sed -i 's/ops@your-domain.com/<your-email>/g' /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy
```
5. Verify HTTPS:
```bash
curl -I https://<your-real-domain>/api/health
```

## Health and Runtime Verification
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8080/api/ready
curl -fsS https://<your-real-domain>/api/health
```

## Backups and Offsite
Local backup:
```bash
./scripts/backup-db.sh
```

Verify backup integrity:
```bash
sha256sum -c /absolute/path/to/backup.sql.gz.sha256
```

Offsite sync (S3/R2/B2 or rclone):
```bash
./scripts/backup-offsite.sh
```

Suggested cron:
```bash
15 2 * * * cd /home/ubuntu/construction_erp_system/production_ready_clone && ./scripts/backup-db.sh && ./scripts/backup-offsite.sh >> /var/log/erp-backup.log 2>&1
```

Restore:
```bash
./scripts/restore-db.sh /absolute/path/to/backup.sql.gz
```

## Monitoring (Low-Cost)
- Uptime checks:
  - Uptime Kuma (self-hosted) or Better Stack free tier.
  - Monitor:
    - `https://<domain>/api/health`
    - `https://<domain>/api/ready`
- Host metrics:
  - `htop`, `df -h`, `free -m` daily check
  - optional Netdata free agent
- Container health:
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 backend web postgres redis
```
- Backup verification:
  - weekly restore drill on a temporary DB/container.

## Reboot and Rollback Safety
- Docker restart on boot:
```bash
sudo systemctl enable docker
```
- Containers restart policy already `always` in prod override.
- Rollback:
```bash
git checkout <last-known-good-tag>
./scripts/deploy.sh
```
- Data rollback when needed:
```bash
./scripts/restore-db.sh /absolute/path/to/backup.sql.gz
```
