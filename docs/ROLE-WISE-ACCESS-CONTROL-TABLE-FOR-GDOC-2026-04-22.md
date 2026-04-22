# Role-Wise Access Control Table (Google Doc Copy-Paste)
Date: 2026-04-22
Version: v1.0

## A) Role Normalization
| Input Role | Effective Role |
|---|---|
| admin | manager |
| administrator | manager |
| customer_admin | manager |
| client_admin | manager |
| superadmin | super_admin |
| owner | super_admin |

## B) Permission Legend
| Symbol | Meaning |
|---|---|
| RW | Read + Write |
| R | Read only |
| - | No access |

## C) Complete Access Table
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

## D) Procurement Detail Table
| Action | super_admin | manager | hr | crusher_supervisor | site_engineer | operator |
|---|---|---|---|---|---|---|
| Purchase Request - Read | Yes | Yes | Yes | Yes | Yes | Yes |
| Purchase Request - Create | Yes | Yes | Yes | Yes | Yes | Yes |
| Purchase Request - Edit | Yes | Yes | No | No | No | No |
| Purchase Request - Approve/Status | Yes | Yes | No | No | No | No |
| Purchase Order - Read | Yes | Yes | Yes | No | No | No |
| Purchase Order - Create/Edit/Status | Yes | Yes | No | No | No | No |
| Goods Receipt - Read | Yes | Yes | Yes | No | No | No |
| Goods Receipt - Create | Yes | Yes | No | No | No | No |
| Purchase Invoice - Read | Yes | Yes | Yes | No | No | No |
| Purchase Invoice - Create/Post | Yes | Yes | No | No | No | No |

## E) Quick Role Summary
| Role | Summary |
|---|---|
| super_admin | Full client + owner governance control |
| manager (admin alias) | Full client portal control, no owner governance |
| hr | Employee/admin control + selected operations write + finance read |
| crusher_supervisor | Crusher/dispatch/boulder execution write |
| site_engineer | Project execution write + related operational read |
| operator | Purchase request focused restricted role |

## F) Sign-off Block
Prepared By: ____________________
Reviewed By: ____________________
Approved By: ____________________
Effective Date: 2026-04-22
Next Review Date: ____________________
