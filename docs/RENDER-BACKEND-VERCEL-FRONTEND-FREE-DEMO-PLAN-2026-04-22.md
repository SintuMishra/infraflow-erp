# Final Free Demo Deployment Plan (Render + Vercel)
Date: 2026-04-22
Status: Final

## 1) Stack (Best Fit For Current Code)
1. Frontend: Vercel (Hobby)
2. Backend: Render Free Web Service
3. Database: Render Free Postgres

Why this is best for this codebase now:
- Backend uses direct `pg` host/port/user/password config.
- Render Postgres integrates directly with current config.
- Avoids SSL/client-option patching needed by some external free Postgres providers.

## 2) Architecture
- Vercel frontend calls: `https://<render-backend>.onrender.com/api`
- Render backend connects to Render Postgres
- CORS restricted to Vercel domain(s)

## 3) Deployment Order (Exact)
1. Create Render Postgres (free)
2. Deploy backend on Render
3. Run migrations (`npm run migrate`)
4. Deploy frontend on Vercel
5. Update backend `CORS_ORIGIN` to Vercel domain
6. Run smoke validation and login checks

## 4) Render Backend Setup
Root directory: `production_ready_clone/backend`

Render service values:
- Runtime: Node
- Build command: `npm ci`
- Start command: `npm run migrate && npm start`
- Health check path: `/api/health`

Blueprint file included:
- `render.yaml` (repo root)

Backend env template included:
- `backend/.env.render.demo.example`

Critical backend env values:
- `NODE_ENV=production`
- `CORS_ORIGIN=https://<your-vercel-domain>`
- `JWT_SECRET` (>= 32 chars)
- `ONBOARDING_BOOTSTRAP_SECRET` (>= 24 chars)
- `EXPOSE_PASSWORD_RESET_TOKEN=false`
- `ENFORCE_COMPANY_SCOPE=true`
- `PASSWORD_RESET_DELIVERY_MODE=token_response` (demo)
- `PASSWORD_RESET_DELIVERY_CHANNELS=mobile`
- `PLATFORM_OWNER_COMPANY_ID=1` (or your owner company id)
- DB vars from Render Postgres connection

## 5) Vercel Frontend Setup
Root directory: `production_ready_clone/web_admin`

Vercel build values:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Frontend env template included:
- `web_admin/.env.vercel.demo.example`

Required frontend env values:
- `VITE_API_BASE_URL=https://<render-backend>.onrender.com/api`
- `VITE_PLATFORM_OWNER_COMPANY_ID=<same owner company id as backend>`

## 6) Demo Go-Live Verification Checklist
1. Open backend health:
   - `https://<render-backend>.onrender.com/api/health`
2. Open frontend and validate both login modes:
   - Owner login
   - Client login via company code
3. Validate employee flow:
   - Add employee
   - Create login
4. Validate role-access flow:
   - manager/hr/execution pages as expected
5. Validate Boulder report flow:
   - normal dropdown path
   - `Other` path with manual entry resolution
6. Keep one fallback owner account documented

## 7) Free-Tier Demo Safety
1. Warm backend 5-10 mins before meeting (Render free cold start avoidance).
2. Keep one tab active during demo.
3. Avoid heavy bulk actions/imports in live demo.
4. Keep demo credentials and backup user ready.

## 8) After Deal Lock (No Re-Architecture Needed)
1. Upgrade Render web service to paid.
2. Upgrade Render Postgres to paid with backup retention.
3. Move password reset delivery from `token_response` to `webhook`.
4. Add custom domains and monitoring/alerts.

## 9) Files Added For This Plan
- `render.yaml`
- `backend/.env.render.demo.example`
- `web_admin/.env.vercel.demo.example`
- `docs/RENDER-BACKEND-VERCEL-FRONTEND-FREE-DEMO-PLAN-2026-04-22.md`
