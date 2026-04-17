# Construction ERP - Company Operations Guide

> Legacy working draft. For official client handover and production operations, use:
> `docs/company-operations-guide-professional.md`

## 1. Purpose
This guide is for company owners, managers, HR/admin teams, supervisors, and operators who will use this ERP in daily business.

It explains:
- what each section does
- who should use which module
- the correct sequence to set up data
- day-to-day operational workflows
- monthly control checks and escalation paths

## 2. Who Should Use This System
Primary user groups:
- company owner / super admin
- managers
- HR/admin staff
- crusher supervisors
- site engineers
- operations and billing support users

## 3. Role Responsibilities (Business View)
Super Admin:
- full control of all modules
- owns onboarding, final approvals, and security posture

Manager:
- end-to-end operational/commercial control
- owns dispatch, rates, master quality, and daily reviews

HR/Admin:
- employee and account administration
- supports master data and controlled business updates

Crusher Supervisor:
- operational reporting and dispatch visibility
- read-only in sensitive admin sections like many master write actions

Site Engineer:
- project execution reporting and operational visibility
- read-only in sensitive admin sections like many master write actions

## 4. First-Time Go-Live Setup Sequence
Follow this order for clean implementation:
1. Tenant/company onboarding (owner account)
2. Company Profile setup (legal info, tax details, logo)
3. Employees setup and login creation
4. Masters setup:
   - Plants & Units
   - Sub Plants & Units
   - Materials
   - Shifts
   - Vehicle Types
   - Config options
5. Vendors and Parties setup
6. Transport Rates and Party Material Rates setup
7. Party Orders setup
8. Vehicles linking (vendor/ownership)
9. Trial dispatch and print validation
10. Audit log and dashboard verification

## 5. Core Menus and What They Are For
Dashboard:
- overall view of operations, dispatch, and exceptions

Plants & Units Reports:
- daily plant/crusher production, expenses, and operations reporting

Project Reports:
- daily site execution and progress tracking

Dispatch Reports:
- dispatch creation, tracking, and billing status lifecycle

Dispatch Print:
- printable dispatch/billing output with company branding

Vehicles:
- fleet and equipment registry with usage tracking

Vendors:
- transporter and supplier records

Transport Rates:
- logistics costing configuration

Parties:
- customer/buyer account setup

Party Material Rates:
- customer-wise selling rates

Party Orders:
- order lifecycle and pending quantity control

Commercial Exceptions:
- delayed, mismatched, or follow-up-required commercial items

Employees:
- employee directory and access management support

Masters:
- core configuration for consistent operations and billing

Company Profile:
- legal identity and invoice header branding

Audit Logs:
- who changed what and when

Tenant Onboarding:
- bootstrap utility (super admin only)

## 6. Masters Section - Best Practice Usage
Purpose:
- central control center for reusable business configuration

Key principles:
- keep only active and accurate records
- avoid duplicate material codes and names
- keep HSN/SAC complete for tax-facing material prints
- maintain at least one active shift, vehicle type, and sub plant/unit

Diagnostics usage:
1. open Masters -> Workspace Health
2. run diagnostics regularly
3. resolve warnings before billing cycles
4. use auto-fill HSN/SAC carefully, then review results

## 7. Daily Operations Workflow (Recommended)
Morning:
1. review dashboard alerts and exception cards
2. check plant/unit and project report entries
3. verify vehicle and material readiness for dispatch

During day:
1. create and update dispatch records
2. ensure linked party orders are correct
3. monitor pending/completed/cancelled status movement

End of day:
1. close pending records where possible
2. verify dispatch print completeness
3. check audit logs for sensitive changes
4. review exceptions requiring next-day follow-up

## 8. Commercial and Billing Workflow
1. maintain party and vendor master accuracy
2. keep transport rates and party material rates current
3. create party orders with realistic quantities
4. dispatch against valid party/order/material setup
5. ensure invoice-relevant fields are complete before final completion
6. print only validated dispatch records

## 9. Company Profile and Print Quality Controls
Required controls:
- company legal name and identifiers must match official records
- GST and tax fields must be reviewed by authorized staff
- logo should be clear and correctly sized
- print header should be verified after any company profile change

Recommendation:
- keep one approved logo version and avoid frequent branding changes

## 10. Employee and Access Governance
Account controls:
- create login only for active employees
- assign least-privilege roles
- review roles monthly or on employee transfer
- disable access immediately on exit/role change

Password controls:
- enforce password change when prompted
- use admin reset only through authorized personnel

## 11. Audit and Compliance Usage
Audit Logs should be reviewed for:
- master data status changes
- commercial configuration changes
- sensitive updates by high-privilege roles

Review frequency:
- daily for high-volume operations
- weekly for medium-volume operations
- always before monthly financial close

## 12. Data Quality Checklist (Weekly)
1. no duplicate active material codes
2. no active dispatch material without HSN/SAC
3. shifts are active and usable
4. vehicle types are active and complete
5. rates match approved commercial sheet
6. inactive/obsolete records are properly deactivated
7. audit logs do not show suspicious edits

## 13. Month-End Operational Checklist
1. reconcile dispatch totals with reports
2. close unresolved commercial exceptions
3. verify party order closure status
4. verify tax fields in materials and prints
5. review and approve key audit trails
6. lock operational period externally as per company policy

## 14. Incident and Escalation Flow
Level 1 (Operations Lead):
- data entry mistakes
- missing records
- status correction requests

Level 2 (Admin/Manager):
- role/access issues
- rate/master conflicts
- print/legal identity mismatches

Level 3 (Technical Team):
- API or page failures
- login/token/session issues
- migration/deployment incidents

When escalating, include:
- user role
- screen/module name
- exact action attempted
- timestamp
- screenshot and request ID (if visible)

## 15. Backup and Business Continuity Expectations
Operational policy recommendations:
- daily DB backup
- tested restore process
- release rollback plan
- documented emergency contacts
- periodic dry-run recovery simulation

## 16. User Training Plan (Recommended)
Phase 1:
- super admin + manager onboarding

Phase 2:
- HR/admin and commercial team workflows

Phase 3:
- supervisors and engineers operational training

Phase 4:
- audit and control training for leadership

Training outputs:
- module-wise SOPs
- role playbooks
- issue escalation contacts

## 17. Do and Don’t Guidelines
Do:
- enter complete and accurate data at source
- use proper role for each task
- review diagnostics and exceptions regularly
- keep company profile and rates current

Don’t:
- share credentials
- bypass role policy by using another account
- leave unresolved warnings for long periods
- print/commercialize records without validation

## 18. Quick FAQs
Q: Why can some users view but not edit Masters?
A: This is intentional role protection for data governance and compliance.

Q: Why does dispatch completion block sometimes?
A: Required commercial/tax details may be incomplete.

Q: Why did login stop after password reset?
A: User may need to complete mandatory password change first.

Q: Why did API reject with company mismatch?
A: Session company scope and request scope are not aligned.

## 19. Go-Live Acceptance Checklist
1. all required roles created and validated
2. company profile and print template approved
3. masters configured and diagnostics reviewed
4. rates and orders configured
5. one full dispatch lifecycle completed and printed
6. audit logs reviewed and accepted
7. escalation contacts published to user teams

## 20. Support and Ownership Model
Business owner:
- approves data governance and process policy

System owner (manager/super admin):
- ensures role discipline and operational compliance

Technical owner (developer/vendor team):
- handles bugs, releases, migrations, and technical incidents

This guide should be shared with all active users before production rollout and revisited whenever new modules or role rules are introduced.
