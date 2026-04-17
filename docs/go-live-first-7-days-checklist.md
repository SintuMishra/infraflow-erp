# Construction ERP - Go-Live First 7 Days Checklist

## Document Control
- Document ID: `ERP-GOLIVE-7D-001`
- Version: `1.0`
- Date: `2026-04-17`
- Audience: Operations Owner, Manager, Technical Owner

## Purpose
Provide a day-wise stabilization checklist for the first 7 days after go-live.

## Roles Involved
- Business Owner
- Operations Owner
- Super Admin / Manager
- HR/Admin
- Technical Owner (developer/vendor)

## Day 0 (Go-Live Day)
1. Confirm production deploy status and health endpoints.
2. Verify login for all key roles.
3. Validate company profile and print header.
4. Execute one end-to-end dispatch and print verification.
5. Confirm audit log entries are being recorded.

Exit criteria:
- critical path (login -> dispatch -> print) works.

## Day 1
1. Review morning dashboard and exception queue.
2. Verify masters diagnostics in Workspace Health.
3. Check for missing HSN/SAC and duplicate material codes.
4. Validate role behavior in Masters (read vs write).
5. Capture all user-reported issues in a single tracker.

Exit criteria:
- no P0 issues open; all P1 issues assigned.

## Day 2
1. Review dispatch status distribution (pending/completed/cancelled).
2. Validate party order linkage quality.
3. Check transport and material rate consistency on active dispatches.
4. Confirm read-only roles are not blocked from view screens.

Exit criteria:
- commercial and dispatch data quality acceptable.

## Day 3
1. Audit log review for sensitive modules:
   - masters
   - rates
   - company profile
2. Validate employee access hygiene:
   - inactive staff not retaining access
   - role assignments match responsibilities
3. Confirm password reset and change-password flow works.

Exit criteria:
- access governance and traceability validated.

## Day 4
1. Review plants/project reporting completeness.
2. Verify master-reference stability (no unintended frequent edits).
3. Validate print outputs with operations and accounts teams.

Exit criteria:
- report and print reliability confirmed by business users.

## Day 5
1. Conduct mini-UAT replay of core workflows.
2. Re-run backend masters route-access regression test.
3. Re-run frontend build verification in release branch.

Exit criteria:
- no regression observed in core modules.

## Day 6
1. Run weekly data quality review:
   - duplicate checks
   - missing mandatory tax fields
   - inactive/obsolete record cleanup
2. Close stale exception items or assign owners.

Exit criteria:
- weekly control checks complete.

## Day 7
1. Publish first-week stabilization summary:
   - incidents opened/closed
   - unresolved risks
   - training gaps
2. Approve transition from hypercare to standard support.
3. Sign off with business + technical owners.

Exit criteria:
- formal first-week sign-off completed.

## Severity and Response Targets
- P0 (critical outage): immediate response, restore same day
- P1 (major business impact): assign immediately, target fix < 24h
- P2 (moderate impact): target fix in planned patch
- P3 (minor): backlog and monitor trend

## Daily Reporting Template
- Date:
- Open P0/P1/P2/P3 counts:
- Key incidents today:
- Workflows validated today:
- Risks for tomorrow:
- Owner:

## Week-1 Sign-off
- Business Owner:
- Operations Owner:
- Technical Owner:
- Date:
- Status: PASS / CONDITIONAL PASS / HOLD
