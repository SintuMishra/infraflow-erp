# Construction ERP - FAQ and Troubleshooting Reference

## Document Control
- Document ID: `ERP-FAQ-TRB-001`
- Version: `1.0`
- Date: `2026-04-18`
- Audience: Support, operations, finance users

## 1. Quick Troubleshooting Matrix
| Problem | Common Cause | Fast Check | Recommended Resolution |
|---|---|---|---|
| Login rejected | wrong credentials/company context | verify company code and login mode | reset password or relogin with correct company scope |
| Data missing in list | active filters or role visibility | clear filters and confirm role | refresh page and verify module permission |
| Finance action blocked | voucher state/period lock/policy controls | check workflow state and period status | move voucher to required state or request authorized reopen/action |
| Settlement failed | amount > outstanding or invalid dates | compare outstanding vs entered amount | adjust settlement amount/date and retry |
| Export not generated | no rows in current filter | confirm table rows count | widen date range or clear restrictive filters |
| Company mismatch error | header/session scope mismatch | relogin and check active scope card | clear stale session and login again |

## 2. Finance-Specific FAQ
- Why cannot posted vouchers be edited?
  - Posted entries are immutable by control design. Use reversal workflow.

- Why does approval/post queue still show items?
  - Workflow queue is state-based. Ensure submit/approve/post sequence is completed.

- Why are ageing totals different from expected?
  - Check date filters, as-of date, and pending settlements not yet posted.

## 3. Operations FAQ
- Why dispatch completion is blocked?
  - Required invoice/billing data is incomplete.

- Why order linkage warnings appear?
  - Dispatch/order/rate consistency checks detected missing links.

- Why some users see fewer menu items?
  - Sidebar visibility follows role/workspace permission rules.

## 4. Escalation Steps
1. Capture screenshot and timestamp.
2. Note module, user role, and company scope.
3. Record exact error message.
4. Escalate with request ID (if available in response headers/log reference).

## 5. Related Documents
- `docs/company-operations-guide-professional.md`
- `docs/operations-section-wise-troubleshooting.md`
- `docs/finance-accounts-guide.md`
- `docs/role-permission-guide.md`
