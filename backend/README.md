# Backend Operations

## Environment

Copy `.env.example` to `.env` and set production-safe values for:

- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `ONBOARDING_BOOTSTRAP_SECRET`
- `PLATFORM_OWNER_COMPANY_ID` (recommended: platform owner tenant company id)
- `CORS_ORIGIN`
- `EXPOSE_PASSWORD_RESET_TOKEN=false` in production

Production startup guards enforce:
- `CORS_ORIGIN` must not be `*`
- `JWT_SECRET` must be non-placeholder and minimum 32 characters
- `ONBOARDING_BOOTSTRAP_SECRET` (when set) must be non-placeholder and minimum 24 characters

Recommended production defaults:

- Keep `ENFORCE_COMPANY_SCOPE=true`
- Keep `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5`
- Keep `PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS=5`
- Keep `ONBOARDING_RATE_LIMIT_MAX_ATTEMPTS=10` or lower for tightly controlled internal use

## Migrations

Run all pending schema migrations before starting the app:

```bash
npm run migrate
```

This applies:

- multi-company foundation
- auth security foundation
- party order foundation
- dispatch alignment changes
- normalized unique company-name protection

## Tenant Onboarding

Use the protected bootstrap flow only for internal operations.

API path:

```text
POST /api/onboarding/bootstrap-company-owner
```

Required protection:

- authenticated session with `super_admin` role
- set `ONBOARDING_BOOTSTRAP_SECRET`
- set `PLATFORM_OWNER_COMPANY_ID` to platform owner tenant id
- send it in the `x-bootstrap-secret` header
- expose the endpoint only to trusted internal users or networks

Preferred operational flow:

1. Apply migrations with `npm run migrate`.
2. Start the backend with production environment values.
3. Use the admin `Tenant Onboarding` screen as `super_admin`.
4. Capture the generated owner username and temporary password once.
5. Deliver those credentials through a secure internal channel only.
6. Require password rotation at first login.

Expected behavior:

- first valid request returns `201`
- duplicate legal company name returns `409`
- invalid `ownerJoiningDate` format returns `400`
- invalid `companyProfile.email` returns `400`

## Validation Notes

The onboarding flow is now designed to:

- create company, company profile, owner employee, and `super_admin` user atomically
- roll back everything if any step fails
- prevent duplicate company names at both service and database layers
- rate-limit onboarding attempts
- write audit events for successful bootstrap

## Quick Verification

```bash
npm test
npm run verify:owner-lock
npm run verify:go-live
```

## Trial Reset Helper

For repeatable demo/UAT resets, use:

```bash
npm run reset:trial -- --yes
```

This clears runtime business data (keeps migration history), recreates one owner company baseline, and prints fresh owner login credentials.

If you need to validate the full onboarding path locally, start the backend with a temporary bootstrap secret:

```bash
ONBOARDING_BOOTSTRAP_SECRET=local-bootstrap-secret npm start
```
