# Construction ERP Ultra-Premium Client Operational Guide (English)

## Document Control
- Document ID: ERP-CLIENT-OPS-ULTRA-EN-001
- Version: 1.0
- Date: 2026-04-19
- Product Scope: `production_ready_clone` (backend + web admin)
- Audience: Client Owner, COO/Operations Head, Admin, Commercial Team, Dispatch Team, Finance Team

---

## 1. Executive Overview
This Construction ERP is a production-grade multi-company platform built for controlled operations, commercial accuracy, and finance governance.

Core strengths:
- Company-scoped data isolation and role-based access.
- Owner workspace and client workspace are isolated.
- Dispatch, commercial rates, party orders, and print are tightly connected.
- Accounts module includes voucher workflows, AR/AP, cash/bank, reports, period controls, and policy controls.
- Audit and workflow transition evidence exist for governance.

---

## 2. Role Framework and Responsibility

## 2.1 Core Roles
- `super_admin`
- `manager`
- `hr`
- `crusher_supervisor`
- `site_engineer`

## 2.2 Responsibility by Role
### Super Admin
- Full business and system control.
- Can handle all sensitive actions including onboarding, finance control, and governance actions.

### Manager
- Operational + commercial + finance controller.
- Primary owner for day-to-day high-impact decisions.

### HR
- Employee/admin support and selected operational/finance support access.
- Mostly controlled write access in sensitive areas.

### Crusher Supervisor
- Crusher operations and dispatch execution focus.
- Can create/update crusher/dispatch operational data where allowed.

### Site Engineer
- Project reporting and site execution visibility.
- Can manage project reports where allowed.

---

## 3. Mandatory Go-Live Sequence
Follow this exact sequence for a stable rollout:

1. Owner-side tenant onboarding and company activation.
2. Company profile setup (legal identity + print identity).
3. Employee master creation and login user creation.
4. Masters configuration (plants, units, materials, shifts, vehicle types, config options).
5. Vendor and party creation.
6. Transport rate and party material rate setup.
7. Party order setup.
8. Vehicle and equipment readiness.
9. Start crusher/project daily report discipline.
10. Start dispatch operations and print validation.
11. Configure finance masters (groups/accounts/ledgers/FY/periods/rules).
12. Begin accounting cycle (vouchers, receivables, payables, settlements).
13. Governance cycle (reports, period close/reopen, policy reviews, audit reviews).

---

## 4. Module-by-Module Operational Guide (Field-by-Field)

## 4.1 Authentication and Access

### 4.1.1 Client Login
Path: `/client-login/:companyCode`

Fields:
- `username` / `identifier`
- `password`

Examples:
- Identifier: `EMP001` or `manager01` or `9876543210`
- Password: `Abc@1234`

Who uses:
- Any active user in that company scope.

### 4.1.2 Change Password
Fields:
- `currentPassword`
- `newPassword`

Password rule:
- Minimum 8 chars with uppercase, lowercase, number, special character.

Who can edit:
- Logged-in user only.

### 4.1.3 Forgot Password
Step-1 request fields:
- `identifier`
- `mobileNumber`

Step-2 reset fields:
- `resetToken`
- `newPassword`

---

## 4.2 Tenant Onboarding (Owner Console)
Permissions: `super_admin` only.

### 4.2.1 Bootstrap New Company
Fields:
- `bootstrapSecret`
- `companyName`
- `branchName`
- `ownerFullName`
- `ownerMobileNumber`
- `ownerDesignation`
- `ownerDepartment`
- `ownerJoiningDate`

`companyProfile` nested fields:
- `email`
- `mobile`
- `addressLine1`
- `city`
- `stateName`
- `stateCode`
- `pincode`
- `gstin`
- `pan`

Example:
- companyName: `ABC Infra Pvt Ltd`
- ownerFullName: `Ravi Sharma`
- gstin: `22ABCDE1234F1Z5`

### 4.2.2 Managed Company Controls
Editable fields:
- Company identity: `companyName`, `branchName`, `companyEmail`, `companyMobile`
- Billing posture: `billingStatus`, `billingCycle`, `customCycleLabel`, `customCycleDays`
- Commercial billing: `subscriptionPlan`, `planAmount`, `outstandingAmount`, `currencyCode`
- Date controls: `nextDueDate`, `graceUntilDate`, `lastPaymentDate`
- Tracking: `paymentReference`, `paymentTerms`, `internalNotes`

### 4.2.3 Invoice Drafting
Fields:
- `invoiceDate`, `periodStartDate`, `periodEndDate`, `dueDate`
- `subscriptionPlan`, `planAmount`, `outstandingAmount`, `currencyCode`
- `paymentReference`, `paymentTerms`, `notes`

---

## 4.3 Company Profile
Access:
- View: `super_admin`, `manager`, `hr`, `crusher_supervisor`, `site_engineer`
- Edit/Save: `super_admin`, `manager`

Fields and examples:
- `companyName` (required): `ABC Infra Pvt Ltd`
- `logoUrl` (uploaded image)
- `branchName`: `Korba Plant`
- `addressLine1`: `Sector 11 Industrial Zone`
- `addressLine2`: `Near Highway`
- `city`: `Korba`
- `stateName`: `Chhattisgarh`
- `stateCode`: `22`
- `pincode`: `495677`
- `gstin`: `22ABCDE1234F1Z5`
- `pan`: `ABCDE1234F`
- `mobile`: `9876543210`
- `email`: `billing@abcinfra.com`
- `bankName`: `HDFC Bank`
- `bankAccount`: `50200012345678`
- `ifscCode`: `HDFC0001234`
- `termsNotes`: `Payment due in 15 days`

Best use:
- Keep this legally accurate; dispatch print/invoice outputs depend on this section.

---

## 4.4 Employees and Login Operations
Access:
- Employee list: `super_admin`, `hr`, `manager`
- Create employee: `super_admin`, `hr`
- Update employee: `super_admin`, `hr`, `manager`
- Status control: mostly `super_admin`, `hr`

Employee fields:
- `fullName`
- `mobileNumber`
- `email`
- `emergencyContactNumber`
- `address`
- `employmentType` (`full_time/contract/intern/temporary/consultant/other`)
- `idProofType` (`aadhaar/pan/driving_license/voter_id/passport/other`)
- `idProofNumber`
- `department`
- `designation`
- `joiningDate`
- `status` (`active/inactive/resigned/terminated`)
- `relievingDate`
- `remarks`

Example:
- fullName: `Ajay Verma`
- employmentType: `contract`
- idProofType: `pan`
- idProofNumber: `ABCDE1234F`

---

## 4.5 Masters and Plants

### 4.5.1 Plants
Access:
- View: all operational roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `plantName`
- `plantCode`
- `plantType`
- `location`
- `powerSourceType`

Example:
- plantName: `Crusher Unit A`
- plantCode: `CRA`
- plantType: `Crusher`
- powerSourceType: `diesel`

### 4.5.2 Masters - Crusher Unit
Fields:
- `unitName`, `unitCode`, `location`, `plantType`, `powerSourceType`

### 4.5.3 Masters - Material
Fields:
- `materialName`, `materialCode`, `hsnSacCode`, `category`, `unit`, `gstRate`

Example:
- materialName: `20mm Aggregate`
- materialCode: `AGG20`
- hsnSacCode: `2517`
- gstRate: `5`

### 4.5.4 Masters - Shift
Fields:
- `shiftName`, `startTime`, `endTime`

### 4.5.5 Masters - Vehicle Type
Fields:
- `typeName`, `category`

### 4.5.6 Masters - Config Options
Fields:
- `configType`
- `optionLabel`
- `optionValue`
- `sortOrder`

Supported config types:
- `plant_type`
- `power_source`
- `material_category`
- `material_unit`
- `vehicle_category`
- `material_hsn_rule`

---

## 4.6 Vendors
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `vendorName`
- `vendorType`
- `contactPerson`
- `mobileNumber`
- `address`

Example:
- vendorName: `Shree Logistics`
- vendorType: `Transporter`

---

## 4.7 Parties
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `partyName`
- `partyCode`
- `contactPerson`
- `mobileNumber`
- `gstin`
- `pan`
- `addressLine1`
- `addressLine2`
- `city`
- `stateName`
- `stateCode`
- `pincode`
- `partyType` (`customer/supplier/both`)

---

## 4.8 Transport Rates
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `plantId`
- `vendorId`
- `materialId`
- `rateType` (`per_trip/per_km`)
- `rateValue`
- `distanceKm` (required for `per_km`)

Example:
- rateType: `per_km`
- rateValue: `42`
- distanceKm: `28`

---

## 4.9 Party Material Rates
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `plantId`
- `partyId`
- `materialId`
- `ratePerTon`
- `royaltyMode` (`per_ton/fixed/none`)
- `royaltyValue`
- `loadingCharge`
- `notes`

---

## 4.10 Party Orders
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `orderNumber` (optional/manual)
- `orderDate`
- `partyId`
- `plantId`
- `materialId`
- `orderedQuantityTons`
- `targetDispatchDate`
- `remarks`
- `status` (`open/completed/cancelled`)

Operational rule:
- Linked-dispatch order status changes should be manager-controlled.

---

## 4.11 Vehicles and Equipment Logs

### 4.11.1 Vehicles
Access:
- View: operational roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `vehicleNumber`
- `vehicleType`
- `assignedDriver`
- `status` (`active/in_use/inactive/maintenance`)
- `ownershipType` (`company/attached_private/transporter`)
- `vendorId` (required if ownership is non-company)
- `plantId`
- `vehicleCapacityTons`

### 4.11.2 Equipment Logs
Access:
- View: operational roles
- Create: `super_admin`, `manager`, `crusher_supervisor`, `site_engineer`

Fields:
- `usageDate`
- `equipmentName`
- `equipmentType`
- `siteName`
- `usageHours`
- `fuelUsed`
- `remarks`
- `plantId`

---

## 4.12 Crusher Reports (Plant Unit Reports)
Access:
- View: `super_admin`, `manager`, `crusher_supervisor`, `hr`
- Create/Edit/Delete: `super_admin`, `manager`, `crusher_supervisor`

Fields:
- Identity: `reportDate`, `plantId`, `shift`, `crusherUnitName`, `materialType`
- Production: `productionTons`, `dispatchTons`, `machineHours`, `dieselUsed`
- Electricity: `electricityKwh`, `electricityOpeningReading`, `electricityClosingReading`
- Rate/cost: `dieselRatePerLitre`, `electricityRatePerKwh`, `dieselCost`, `electricityCost`
- Expenses: `labourExpense`, `maintenanceExpense`, `otherExpense`, `totalExpense`, `expenseRemarks`
- Operations: `operationalStatus`, `breakdownHours`, `downtimeReason`, `maintenanceNotes`
- Stock/team: `openingStockTons`, `closingStockTons`, `operatorsCount`
- General: `remarks`

---

## 4.13 Project Reports
Access:
- View: `super_admin`, `manager`, `site_engineer`, `hr`
- Create/Edit/Delete: `super_admin`, `manager`, `site_engineer`

Fields:
- `reportDate`, `plantId`, `projectName`, `siteName`
- `shift`, `weather`, `reportStatus`
- `progressPercent`
- `workDone`
- `labourCount`, `machineCount`
- `materialUsed`
- `blockers`
- `nextPlan`
- `remarks`

---

## 4.14 Dispatch Reports (Critical Operational Control)
Access:
- View: `super_admin`, `manager`, `hr`, `crusher_supervisor`, `site_engineer`
- Create/Edit/Status: `super_admin`, `manager`, `crusher_supervisor`

Input fields:
- `dispatchDate`
- `sourceType`
- `plantId`, `materialId`, `partyId`
- `partyOrderId` (optional but recommended)
- `vehicleId`, `transportVendorId`
- `destinationName`
- `quantityTons`
- `remarks`

EWB fields:
- `ewbNumber` (12 digits)
- `ewbDate`
- `ewbValidUpto`

Invoice fields:
- `invoiceNumber`
- `invoiceDate`
- `invoiceValue`
- `distanceKm`
- `otherCharge`
- `billingNotes`

System/commercial linkage fields:
- `partyMaterialRateId`, `transportRateId`
- `materialRatePerTon`, `materialAmount`
- `transportRateType`, `transportRateValue`, `transportCost`
- `royaltyMode`, `royaltyValue`, `royaltyAmount`
- `loadingCharge`
- `totalInvoiceValue`
- `gstRate`, `cgst`, `sgst`, `igst`, `totalWithGst`

Status values:
- `pending`, `completed`, `cancelled`

Finance linkage status:
- `financeStatus`
- `canPostToFinance`
- `financePostingState`
- `financeNotes`

---

## 4.15 Accounts and Finance

## 4.15.1 Chart of Accounts and Ledgers
Access:
- Read: `super_admin`, `manager`, `hr`
- Create/modify: mostly `super_admin`, `manager`

Account Group fields:
- `groupCode`, `groupName`, `nature`

Account fields:
- `accountGroupId`, `accountCode`, `accountName`, `accountType`, `normalBalance`

Ledger fields:
- `accountId`, `ledgerCode`, `ledgerName`

## 4.15.2 Voucher Entry
Access:
- Read: `super_admin`, `manager`, `hr`
- Draft/submit/approve/reject/post/reverse: `super_admin`, `manager`

Voucher header fields:
- `voucherType`
- `voucherDate`
- `narration`
- `autoPost`

Voucher line fields:
- `accountId`
- `ledgerId`
- `debit`
- `credit`
- `lineNarration`

Rules:
- At least two lines.
- Every line must have either debit or credit.
- Total debit must equal total credit.

## 4.15.3 Receivables
Access:
- Read list: `super_admin`, `manager`, `hr`
- Actions: `super_admin`, `manager`

Fields:
- Mark ready: `financeNotes`
- Create from dispatch: `dueDate`
- Settle: `amount`, `settlementDate`, `referenceNumber`, `notes`, optional `bankLedgerId`

## 4.15.4 Payables
Access:
- Read list: `super_admin`, `manager`, `hr`
- Create/settle: `super_admin`, `manager`

Create fields:
- `partyId` or `vendorId` (exactly one)
- `referenceNumber`
- `billDate`
- `dueDate`
- `amount`
- `notes`

Settle fields:
- `amount`
- `settlementDate`
- `referenceNumber`
- optional `bankLedgerId`

## 4.15.5 Cash/Bank
Access:
- Read: `super_admin`, `manager`, `hr`
- Create/update/post: `super_admin`, `manager`

Bank account fields:
- `accountName`, `bankName`, `branchName`, `accountNumber`, `ifscCode`, `ledgerId`
- Status fields: `isActive`, `isDefault`

Cash/bank voucher fields:
- `voucherType`
- `voucherDate`
- `amount`
- `cashOrBankLedgerId` or `cashOrBankAccountId`
- `counterAccountId`, `counterLedgerId`
- optional `partyId` or `vendorId`
- `narration`

## 4.15.6 Posting Rules
Access:
- Read: `super_admin`, `manager`, `hr`
- Create/activate/deactivate: `super_admin`, `manager`

Fields:
- `ruleCode`
- `eventName`
- `sourceModule`
- `voucherType`
- `debitAccountId`
- `creditAccountId`
- `partyRequired`
- `vendorRequired`
- `requiresApproval`
- `autoPostEnabled`
- `rulePriority`
- `isActive`

## 4.15.7 Period Controls
Access:
- Read: `super_admin`, `manager`, `hr`
- Change period status: `super_admin`, `manager`

Fields:
- `status` (`open/soft_closed/closed`)
- `statusNotes`

## 4.15.8 Finance Policy Controls
Access:
- Read: `super_admin`, `manager`, `hr`
- Update: `super_admin`, `manager`

Fields:
- `allowSubmitterSelfApproval`
- `allowMakerSelfApproval`
- `allowApproverSelfPosting`
- `allowMakerSelfPosting`
- `lastUpdateNotes`

## 4.15.9 Finance Reports
Report keys:
- `trial-balance`
- `ledger`
- `party-ledger`
- `voucher-register`
- `receivable-ageing`
- `payable-ageing`
- `cash-book`
- `bank-book`
- `finance-transition-history`

Filters:
- Date range: `dateFrom`, `dateTo`
- Ageing: `asOfDate`
- Ledger report: `ledgerId`
- Party ledger report: `partyId`
- Transition history: `entityType`, `action`, `performedByUserId`, `limit`

---

## 4.16 Audit Logs
Access:
- `super_admin`, `manager`, `hr`

Use for:
- Sensitive activity trace
- Compliance evidence
- Investigation support

---

## 5. Daily/Weekly/Month-End SOP

## 5.1 Daily SOP
- Check dashboard and pending exceptions.
- Validate dispatch records and commercial linkages.
- Review receivable/payable settlement queues.
- Validate print/invoice readiness.
- Review sensitive audit events.

## 5.2 Weekly SOP
- Masters hygiene: duplicates, missing HSN/GST, inactive critical records.
- Party/rate/order consistency check.
- Finance workflow backlog review.

## 5.3 Month-End SOP
- Dispatch vs finance reconciliation.
- Ageing reports review.
- Trial balance review.
- Controlled period close with notes and approvals.

---

## 6. Data Entry Quick Examples
- Plant: `plantName=Crusher Unit A`, `plantCode=CRA`, `plantType=Crusher`, `powerSourceType=diesel`
- Vendor: `vendorName=Shree Logistics`, `vendorType=Transporter`, `mobileNumber=9876500000`
- Party: `partyName=Maa Buildcon`, `gstin=22ABCDE1234F1Z5`, `partyType=customer`
- Party rate: `ratePerTon=980`, `royaltyMode=per_ton`, `royaltyValue=50`, `loadingCharge=20`
- Party order: `orderDate=2026-04-19`, `orderedQuantityTons=250`, `status=open`
- Dispatch: `quantityTons=22`, `invoiceValue=23500`, `distanceKm=42`, `status=pending`

Voucher sample:
- Line 1: DR Receivable 23,500
- Line 2: CR Sales 23,500

---

## 7. Governance Rules (Non-Negotiable)
- Never share owner bootstrap secret with client operations users.
- Keep policy overrides disabled unless emergency and approved.
- Do not close periods without reconciliation evidence.
- Do not allow duplicate masters in live operations.
- Use unique user accounts only; no shared credentials.

---

## 8. Go-Live Acceptance Checklist
- Role access validated.
- Company profile and print verified.
- Masters complete and healthy.
- Commercial setup complete.
- Dispatch lifecycle successful.
- Finance lifecycle validated.
- Reporting and governance controls operational.
- Support and escalation owners assigned.

---

## 9. Escalation Template
Use this payload for support/escalation:
- User role:
- Module/page:
- Action attempted:
- Exact error:
- Date/time:
- Screenshot:

