# Construction ERP - Professional Company Operations Guide

## Document Control
- Document ID: `ERP-OPS-GUIDE-PRD-001`
- Version: `1.3`
- Date: `2026-04-18`
- Audience: Company Owners, Managers, Admin Teams, Supervisors, Engineers
- Classification: Business Operations

## 1. Purpose
This guide explains how to operate the ERP system in production with consistent data quality, role discipline, and billing reliability.

## 2. Business Outcomes This System Supports
- daily production and project visibility
- controlled dispatch and invoice-ready outputs
- master-data governance for tax and reporting accuracy
- commercial control over rates, orders, and exceptions
- accountability via audit logs

## 3. Role Responsibility Matrix
### Super Admin
- full platform authority
- policy ownership and final approvals

### Manager
- operational and commercial control
- dispatch, rate, and compliance oversight

### HR/Admin
- employee and account governance
- controlled master and admin support operations

### Crusher Supervisor
- plant operations and dispatch visibility
- limited write capability in sensitive admin modules

### Site Engineer
- project operations and reporting
- limited write capability in sensitive admin modules

## 3A. Platform Owner vs Client Company Access (Production Policy)
- platform owner login URL: `/owner-login`
- client company login URL: `/client-login/{companyCode}`
- client login page must show registered company context before credential entry
- owner login is restricted to platform-owner `super_admin` scope only
- client login is restricted to selected company scope only
- client users must never see tenant onboarding or platform sales/company-creation flows
- restricted sections must remain hidden in sidebar and blocked server-side by role middleware

## 4. Go-Live Setup Sequence (Mandatory)
1. onboard company owner account
2. complete company profile and logo
3. create employee records and logins
4. configure masters (including Sub Plants & Units)
5. configure vendors and parties
6. configure transport and party material rates
7. create party orders
8. link vehicles and validate readiness
9. perform trial dispatch and print
10. review audit logs and dashboard controls

### Tenant Onboarding Control SOP (Mandatory)
- onboarding is internal-only and must be executed by a logged-in `super_admin`
- onboarding menu/route is visible only for platform-owner tenant configuration
- onboarding requires valid bootstrap secret (`x-bootstrap-secret`) for each run
- never share bootstrap secret with client-side operational users
- after onboarding, share credentials through secure channel only
- confirm first login and immediate password change before tenant activation
- record onboarding reference and approval source in internal tracker
- share company-specific login URL with company code as part of handover

## 5. Operational SOP (Daily)
### Start of Day
- review dashboard and exception queues
- validate plant/project report readiness
- verify critical masters (materials, shifts, vehicles)

### During Operations
- create/update dispatch records with correct linkage
- validate party order alignment and status
- monitor pending and blocked commercial records

### End of Day
- close actionable pending entries
- verify print quality and invoice fields
- review sensitive audit events
- assign unresolved exceptions

## 6. Master Data Governance SOP
- maintain unique material names/codes
- keep HSN/SAC complete for tax-facing materials
- maintain at least one active shift, vehicle type, and sub plant/unit
- run diagnostics regularly in Masters workspace
- use auto-fill HSN/SAC only with post-run review

## 7. Commercial Control SOP
- keep rates and orders synchronized with approved contracts
- separate logistics cost (transport rates) from selling rates (party material rates)
- avoid dispatch completion before mandatory billing fields are ready
- close exception backlog before month-end

## 8. Print and Branding SOP
- company profile values must match legal records
- logo should remain approved and standardized
- verify print output after any company profile update
- do not release external prints without validation

## 9. Weekly Control Checklist
1. duplicate master records check
2. missing HSN/SAC review
3. active shift/vehicle/sub-unit availability
4. rate and order consistency review
5. audit log review for sensitive actions
6. unresolved exception aging review

## 10. Month-End Governance Checklist
1. dispatch totals reconciliation
2. commercial exception closure
3. party order closure and pending review
4. tax-field and print-header compliance check
5. approval sign-off by manager/super admin
6. voucher workflow queue cleared (draft/submitted/approved posture)
7. receivable and payable ageing review completed
8. period control posture verified before close/reopen

## 11. Incident and Escalation Model
### L1 (Operations Lead)
- data entry corrections
- routine workflow support

### L2 (Manager/Admin)
- role/access changes
- business-rule or process conflicts

### L3 (Technical Team)
- application errors
- authentication/session problems
- deployment/data integrity incidents

Escalation ticket must include:
- user role
- module/page
- action attempted
- exact error message
- timestamp and screenshot

Detailed section-wise troubleshooting:
- `docs/operations-section-wise-troubleshooting.md`
- `docs/operations-section-wise-troubleshooting-hi.md`
- `docs/developer-new-client-handover-quickstart.md` (technical implementation handover checklist)
- `docs/developer-new-client-handover-quickstart-hi.md` (Hindi technical handover checklist)

## 12. Security and User Discipline
- never share credentials
- enforce role-based usage
- remove/disable access immediately on role exit
- complete mandatory password changes promptly
- owner portal credentials must be managed separately from all client-company credentials
- bootstrap secret must remain internal and rotated on schedule

## 12A. Audit Logs Requirement Decision
- audit logs are mandatory for production-grade client companies
- minimum required users with audit visibility: company `super_admin`, manager, and HR/Admin
- recommendation: keep audit logs enabled by default for every tenant from day 1
- do not grant audit visibility to general operational roles unless contractually required

## 13. New User Training Plan
- batch 1: super admin + manager
- batch 2: HR/admin + commercial users
- batch 3: supervisors + engineers
- periodic refresher every quarter

## 14. Go-Live Acceptance Criteria
Release is accepted only when:
1. role-based access is validated
2. one full dispatch lifecycle is successfully executed and printed
3. masters diagnostics pass required thresholds
4. audit logs confirm traceability
5. escalation contacts are published and acknowledged

## 15. Business Continuity Recommendations
- daily DB backup policy
- tested restore process
- rollback-ready release artifacts
- named emergency contacts across business and technical teams

## 16. Quick FAQ
Q: Why can some users only view Masters?
A: Read-only access protects critical master data quality and compliance.

Q: Why is dispatch completion blocked?
A: Required billing/tax fields are incomplete or invalid.

Q: Why does company mismatch error occur?
A: Session company and request scope are not aligned.

Q: Why can finance team not post voucher directly in some cases?
A: Maker-checker and period controls can block posting until approval/state conditions are satisfied.

## 17. Sign-off Section
- Operations Owner:
- Company Admin Owner:
- Technical Owner:
- Go-live Date:
- Final Status: PASS / HOLD
- Notes:
