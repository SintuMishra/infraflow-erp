# Construction ERP - Role-Wise Access Control Policy
Date: 2026-04-22
Version: v1.0
Status: Approved Baseline

## 1) Purpose
This policy defines role-based access control (RBAC) for the Construction ERP platform so that every role has only the minimum required business access, while ensuring operational speed, auditability, and governance-grade security.

## 2) Scope
This policy applies to:
- Web admin/client portal modules
- Owner control/tenant governance modules
- API-level route authorization and middleware behavior
- Role normalization rules used by frontend and backend

## 3) Source of Truth
Access decisions in this document are derived from:
- Backend route guards (`authenticate` + `authorizeRoles`)
- Frontend role normalization and route access mapping
- Effective middleware behavior for super admin bypass and role alias normalization

## 4) Role Normalization
System role aliases are normalized before authorization checks.

| Input Role | Effective Role |
|---|---|
| `admin` | `manager` |
| `administrator` | `manager` |
| `customer_admin` | `manager` |
| `client_admin` | `manager` |
| `superadmin` | `super_admin` |
| `owner` | `super_admin` |

Policy implication:
- Any user created/stored as `admin` is treated as `manager` for permissions.

## 5) Role Definitions
1. `super_admin`
- Highest authority for client workspace and owner governance.
- Full control across all modules and emergency break-glass actions.

2. `manager` (includes normalized `admin`)
- Full client portal operational and finance-write authority.
- No owner-governance-only capabilities.

3. `hr`
- Workforce administration role with selected operational write capabilities.
- Read-heavy in finance modules, controlled write in assigned areas.

4. `crusher_supervisor`
- Plant/crusher/dispatch execution role.
- Operational write in assigned execution modules.

5. `site_engineer`
- Project execution role.
- Full write in project execution areas, read in related operations.

6. `operator`
- Restricted execution role.
- Focused access to request initiation flows.

## 6) Access Principles
- Principle of least privilege is enforced by route-level role guards.
- `super_admin` has override-level access for governance and business continuity.
- Owner control functions are isolated to `super_admin` only.
- Manager/admin (normalized) is the highest day-to-day client role.
- Sensitive posting/settlement finance operations are restricted to finance leadership roles.

## 7) Permission Legend
| Code | Meaning |
|---|---|
| `RW` | Read + Write |
| `R` | Read only |
| `-` | No access |

## 8) Master Access Matrix (Enforced)

| Module / Section | super_admin | manager | hr | crusher_supervisor | site_engineer | operator |
|---|---|---|---|---|---|---|
| Owner Control (Tenant Onboarding, managed companies, billing, permanent delete) | RW | - | - | - | - | - |
| Dashboard Summary API | RW | RW | RW | RW | RW | RW |
| Dashboard Commercial Exceptions API | RW | RW | RW | RW | RW | RW |
| Employees | RW | RW | RW | - | - | - |
| Auth Admin Actions (register login, admin reset password) | RW | RW | RW | - | - | - |
| Masters (crusher units, materials, shifts, vehicle types, config options) | RW | RW | RW | R | R | - |
| Company Profile | RW | RW | R | R | R | - |
| Plants | RW | RW | RW | R | R | - |
| Crusher Reports (Plant Unit Reports) | RW | RW | R | RW | - | - |
| Project Reports | RW | RW | R | - | RW | - |
| Dispatch Reports | RW | RW | R | RW | R | - |
| Boulder Reports | RW | RW | RW | RW | R | - |
| Vehicles | RW | RW | RW | R | R | - |
| Vendors | RW | RW | R | R | R | - |
| Parties | RW | RW | R | R | R | - |
| Transport Rates | RW | RW | R | R | R | - |
| Party Material Rates | RW | RW | R | R | R | - |
| Party Orders | RW | RW | RW | R | R | - |
| Purchase Requests | RW | RW | RW | RW | RW | RW |
| Purchase Orders | RW | RW | R | - | - | - |
| Goods Receipts | RW | RW | R | - | - | - |
| Purchase Invoices | RW | RW | R | - | - | - |
| Audit Logs | R | R | R | - | - | - |
| Accounts Masters | RW | RW | R | - | - | - |
| General Ledger | RW | RW | R | - | - | - |
| Journal Vouchers | RW | RW | R | - | - | - |
| Accounts Receivables | RW | RW | R | - | - | - |
| Accounts Payables | RW | RW | R | - | - | - |
| Cash & Bank | RW | RW | R | - | - | - |
| Posting Rules | RW | RW | R | - | - | - |
| Financial Reports | R | R | R | - | - | - |

## 9) Detailed Policy Notes by Domain

### 9.1 Governance
- Owner-control actions are exclusively `super_admin`.
- Includes tenant onboarding, managed company state changes, billing controls, and permanent delete flows.

### 9.2 Workforce and Identity
- Employee records and login administration are limited to `super_admin`, `manager`, `hr`.
- Prevents execution roles from unauthorized identity lifecycle actions.

### 9.3 Operations
- Crusher/project/dispatch/boulder modules are split by execution responsibility.
- `crusher_supervisor` and `site_engineer` get operational write only where directly accountable.

### 9.4 Procurement
- Purchase Request is the broadest module (including `operator`).
- Approval/edit control of requests is restricted to leadership (`super_admin`, `manager`).
- PO/GRN/Invoice write actions are leadership-controlled.

### 9.5 Finance
- Finance posting and settlement operations are restricted to `super_admin` and `manager`.
- `hr` has read visibility for oversight and coordination where configured.

### 9.6 Dashboard APIs
- Dashboard summary/commercial-exception APIs currently require authentication but are not role-filtered at route level.
- Therefore all authenticated roles can currently access these endpoints.

## 10) Exception and Temporary Elevation Policy
- Any temporary elevated permission must be:
1. Approved by authorized reviewer.
2. Time-bounded with explicit expiry date/time.
3. Logged in audit records with reason and approver identity.
4. Reviewed in the next access governance cycle.

## 11) Audit and Review Cycle
- Monthly: role-to-module drift check.
- Quarterly: full RBAC revalidation against organization structure.
- Release-based: mandatory RBAC verification for any new module or route.
- Incident-based: immediate review when unauthorized access or privilege drift is detected.

## 12) Document Control
Prepared By: ____________________
Reviewed By: ____________________
Approved By: ____________________
Effective Date: 2026-04-22
Next Review Date: ____________________

## 13) Reference Implementation Files
- `backend/src/middlewares/role.middleware.js`
- `backend/src/utils/role.util.js`
- `backend/src/modules/*/*.routes.js`
- `web_admin/src/utils/access.js`
- `web_admin/src/utils/roles.js`
