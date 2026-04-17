# Masters Role-by-Role UAT Checklist

## Scope
Validate that Masters is production-safe across UI, API authorization, and business behavior for:
- `super_admin`
- `manager`
- `hr`
- read-only operational roles (`crusher_supervisor`, `site_engineer`)

## Pre-checks
1. Seed at least one record in each section: Plants, Sub Plants & Units, Materials, Shifts, Vehicle Types, Config Options.
2. Ensure at least one material has blank HSN/SAC for diagnostics test.
3. Ensure at least one user account per role is active.
4. Confirm backend and frontend are running with the same environment.

## Automated Gate (Recommended Before Manual UAT)
1. Run backend regression for route-role enforcement:
   - `npm test -- masters-route-access.test.js`
2. Expected result:
   - all tests pass
   - read routes allow `crusher_supervisor` and `site_engineer`
   - write routes reject read-only roles with `403`

## Permission Matrix (Expected)
| Role | View Masters | Create/Edit/Status Change | Run Auto-fill HSN/SAC |
|---|---|---|---|
| super_admin | Yes | Yes | Yes |
| manager | Yes | Yes | Yes |
| hr | Yes | Yes | Yes |
| crusher_supervisor | Yes | No | No |
| site_engineer | Yes | No | No |

## UAT Cases

### A. Super Admin
1. Open `/masters` and verify all sections load.
2. Add one record in each section; verify success message and record appears in list.
3. Edit one record from each section; verify persisted update after refresh.
4. Toggle active/inactive status for one record in each section.
5. Run `Run Diagnostics` and validate issue cards and counts.
6. Run `Auto-fill Missing HSN/SAC` and verify material updates and audit trail.
Pass criteria: All write actions succeed; no unauthorized errors; diagnostics reflect latest state.

### B. Manager
1. Repeat Super Admin flow except tenant-only capabilities.
2. Validate no hidden write restriction appears in Masters.
Pass criteria: Same functional write coverage as super_admin in Masters.

### C. HR
1. Repeat create/edit/status for all sections.
2. Run diagnostics and auto-fill HSN/SAC.
3. Validate duplicate prevention errors (e.g., duplicate material code) show cleanly.
Pass criteria: Full write access with proper validation and conflict messages.

### D. Read-only (Crusher Supervisor / Site Engineer)
1. Open `/masters` and verify data is visible.
2. Confirm read-only banner appears in Workspace Health.
3. Confirm Add/Edit/Activate/Deactivate controls are disabled.
4. Confirm forms and edit panel cannot be used.
5. Try direct write API calls (POST/PATCH to `/masters/*`) with token.
Pass criteria: UI remains read-only; backend returns `403` for write APIs; diagnostics read works.

## Edge-case Regression Checks
1. Attempt update on deleted/nonexistent ID (PATCH status/edit): response should be `404`.
2. Attempt duplicate material code or duplicate config option label+type: response should be `409`.
3. Attempt invalid config sort order or invalid HSN rule code format: response should be `400`.
4. Attempt invalid GST rate (>100 or negative): response should be `400`.
5. Diagnostics should include:
   - missing HSN/SAC
   - duplicate active material codes
   - invalid GST rates
   - no active shifts/crusher units/vehicle types
   - missing active plant type/power source options

## Sign-off Template
- Environment:
- Date:
- Tester:
- Roles tested:
- Failed scenarios (if any):
- Evidence links (screenshots/logs):
- Final status: Pass / Conditional Pass / Fail
