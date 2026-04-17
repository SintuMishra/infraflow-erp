# Construction ERP - Section-Wise Operational Troubleshooting Playbook

## Document Control
- Document ID: `ERP-OPS-TS-001`
- Version: `1.0`
- Date: `2026-04-17`
- Audience: Operations users, Managers, Admin teams, L1/L2 support

## How To Use This Playbook
1. Open the section matching your issue.
2. Match your symptom.
3. Perform the checks in order.
4. If unresolved, escalate using the provided escalation payload.

## Standard Escalation Payload (Use for every unresolved issue)
- User role:
- Module/page:
- Exact action performed:
- Error text (exact):
- Date/time:
- Screenshot:
- Request ID (if visible):

## 1. Login / Authentication
### Symptom: “Invalid username or password”
Checks:
1. Confirm username/identifier spelling.
2. Confirm caps lock and keyboard language.
3. Retry once after 30 seconds.
If unresolved:
- ask admin to verify account exists and is active.

### Symptom: “Password change is required”
Resolution:
1. Open Change Password.
2. Set new password as per policy.
3. Re-login and continue.

### Symptom: “Company scope mismatch” / sudden logout
Checks:
1. Logout and login again.
2. Ensure you are using correct company account.
3. Do not use shared or stale browser profiles.

## 2. Dashboard
### Symptom: dashboard cards not loading
Checks:
1. Refresh page once.
2. Confirm internet/server reachability.
3. Verify `/api/health` with technical team.

### Symptom: counts look outdated
Checks:
1. Validate record status filters in source modules.
2. Verify recent entries were saved successfully.
3. Recheck after 1-2 minutes.

## 3. Plants & Units Reports / Project Reports
### Symptom: cannot submit daily report
Checks:
1. Verify mandatory fields are filled.
2. Validate date and plant/project selection.
3. Check role has write access for this module.

### Symptom: edit/update blocked
Checks:
1. Verify report status allows edit.
2. Check if you are using the correct role.
3. Request manager review for period-control restrictions.

## 4. Dispatch Reports
### Symptom: dispatch cannot move to completed
Checks:
1. Ensure required billing/commercial fields are filled.
2. Check order linkage (if required).
3. Verify invoice-related values are valid.

### Symptom: vehicle not selectable / unavailable
Checks:
1. Verify vehicle is active.
2. Verify vehicle status is not occupied/unavailable.
3. Confirm vendor/ownership linkage is valid.

### Symptom: dispatch value/tax looks wrong
Checks:
1. Verify party material rate for selected material.
2. Verify transport rate and charge components.
3. Verify quantity and other charges.

## 5. Dispatch Print
### Symptom: company details/logo missing or incorrect
Checks:
1. Open Company Profile and verify save status.
2. Confirm logo is uploaded and visible after reload.
3. Retry print after profile refresh.

### Symptom: print layout not professional/aligned
Checks:
1. Confirm browser zoom is 100% before print.
2. Use standard A4 print settings.
3. Verify logo dimensions are not unusually distorted.

## 6. Masters (including Sub Plants & Units)
### Symptom: can view but cannot add/edit
Reason:
- role-based read-only behavior (expected for some operational roles).
Action:
1. Check your role with admin.
2. Request authorized admin role user for changes.

### Symptom: duplicate/validation error while saving
Checks:
1. Ensure no duplicate code/name exists.
2. Verify GST range is valid.
3. Verify HSN auto-rule format where applicable.

### Symptom: diagnostics show warnings
Actions:
1. fix missing HSN/SAC
2. resolve duplicate material codes
3. ensure active shift/vehicle type/sub plant availability
4. rerun diagnostics

## 7. Vendors / Parties
### Symptom: cannot create or edit records
Checks:
1. confirm role has manage permissions.
2. ensure required fields are complete.
3. check duplicate identity fields before save.

### Symptom: record not visible in downstream modules
Checks:
1. verify record is active.
2. verify correct company scope.
3. refresh target module and reselect filters.

## 8. Transport Rates / Party Material Rates
### Symptom: rate not picked in dispatch
Checks:
1. verify rate record is active.
2. verify exact plant, party/vendor, and material match.
3. verify rate type/value are valid.

### Symptom: wrong rate appears
Checks:
1. inspect duplicate or overlapping rate entries.
2. deactivate obsolete rate records.
3. re-test with clean filter context.

## 9. Party Orders
### Symptom: order status cannot change
Checks:
1. verify linked dispatch constraints.
2. verify pending quantity conditions.
3. confirm role allows special status override.

### Symptom: order completion blocked
Checks:
1. ensure delivered quantities are consistent.
2. verify no structural mismatch with linked dispatches.

## 10. Vehicles
### Symptom: vehicle status update fails
Checks:
1. check if linked dispatch/order state blocks transition.
2. verify vehicle and vendor references are valid.
3. retry after refreshing latest record state.

### Symptom: equipment logs not recording
Checks:
1. verify mandatory log fields.
2. verify plant/date associations.
3. confirm your role can write logs.

## 11. Employees and Access
### Symptom: employee login cannot be created
Checks:
1. employee must be active.
2. role assignment must be allowed.
3. login account may already exist.

### Symptom: user should not have access but still does
Actions:
1. disable login immediately.
2. verify role and employee status.
3. re-test unauthorized route behavior.

## 12. Company Profile
### Symptom: profile save fails
Checks:
1. verify tax/legal formats are valid.
2. verify logo payload/size is acceptable.
3. retry with clean data and stable connection.

### Symptom: updated details not reflected in print
Checks:
1. refresh page and re-open print.
2. confirm save success message occurred.
3. ensure no stale tab/session is used.

## 13. Audit Logs
### Symptom: expected activity not visible
Checks:
1. verify correct date/search filters.
2. confirm action was actually successful.
3. confirm user had permission and action endpoint supports auditing.

## 14. Unauthorized Page Access
### Symptom: redirected to unauthorized
Checks:
1. verify role entitlement for target module.
2. ask admin for role confirmation.
3. do not use another user’s account to bypass policy.

## 15. When To Escalate Immediately
Escalate as P0/P1 if:
- all users cannot login
- dispatch create/complete blocked for business-critical operations
- print output unusable for invoicing
- wrong-company data appears in session
- major role-security violation is observed

## 16. First-Aid Recovery Steps (Before Escalation)
1. refresh browser and retry once
2. logout/login once
3. verify role and active status
4. verify record is active and mapped correctly
5. retry with minimal valid data
6. capture screenshot + exact error and escalate
