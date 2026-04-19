# Construction ERP Ultra-Premium Client Operational Guide (Hindi + English)

## Document Control
- Document ID: ERP-CLIENT-OPS-ULTRA-001
- Version: 1.0
- Date: 2026-04-19
- Scope: `production_ready_clone` full web admin + backend route/validation based operations
- Audience: Client Owner, Operations Head, Accounts Team, Admin Team, Supervisors

---

## 1) Production-Grade Analysis (Project Reality Check)

### English
This ERP implementation is production-oriented and professionally structured:
- Modular backend (`controller/service/model/validation`) with role middleware and company-scope enforcement.
- Multi-company isolation with `company_id` checks and token/header scope checks.
- Owner-vs-client workspace separation (`/owner-login` vs `/client-login/:companyCode`).
- Strong finance foundation: chart of accounts, ledgers, vouchers, receivable/payable, cash/bank, posting rules, reports, period/policy controls.
- Audit/governance built in (audit logs + finance transition history + policy controls).
- Test and verification scripts available (`npm test`, finance concurrency and hardening test scripts).

Operational quality level: **Production-ready with controlled governance**.

### Hindi
यह ERP implementation production-grade professional level पर बनाया गया है:
- Backend modular architecture (`controller/service/model/validation`) और role middleware के साथ.
- Multi-company isolation और strict company-scope enforcement.
- Owner और Client workspace अलग-अलग (`/owner-login` और `/client-login/:companyCode`).
- Finance modules fully structured: COA, ledgers, vouchers, AR/AP, cash-bank, posting rules, reports, period/policy controls.
- Audit और governance controls built-in हैं.
- Testing और verification scripts उपलब्ध हैं.

Quality verdict: **Production-ready + governance-controlled system**.

---

## 2) Role & Permission Matrix (Who Can Do What)

### Core Roles
- `super_admin`: full control (owner + client, including sensitive controls)
- `manager`: high operational + finance control
- `hr`: admin/operations/finance read+limited write (module dependent)
- `crusher_supervisor`: crusher/dispatch/vehicle operations focus
- `site_engineer`: project/dispatch visibility and operations focus

### Critical Permission Pattern (Implementation-accurate)
- Create/Edit sensitive commercial masters (`vendors`, `parties`, `rates`): mostly `super_admin`, `manager`
- Dispatch create/edit/status: `super_admin`, `manager`, `crusher_supervisor`
- Finance write (voucher/posting/AR settlement/AP settlement/cash-bank posting): `super_admin`, `manager`
- Finance read/reporting: `super_admin`, `manager`, `hr`
- Owner onboarding/company lifecycle controls: `super_admin` only

---

## 3) Correct Operational Sequence (Mandatory)

1. Owner onboarding (internal) and company activation
2. Company profile setup (legal + print identity)
3. Employees + login users creation
4. Masters and plants setup
5. Vendors and parties creation
6. Commercial rates setup (transport + party material)
7. Party orders creation
8. Vehicles + equipment setup
9. Crusher/project daily reporting start
10. Dispatch operations + print validation
11. Finance setup (COA, ledgers, periods, posting rules)
12. Voucher, AR/AP, cash-bank daily operations
13. Reports, period close/reopen, policy governance

---

## 4) Field-by-Field Operational Guide (Section Wise)

## A. Authentication & Access

### A1. Client Login (`/client-login/:companyCode`)
- `username` / `identifier`:
  - Example: `EMP001`, `manager@abc`, `9876543210`
  - Enter by: end user
- `password`:
  - Example: `Abc@1234`
  - Enter by: end user

Who can use:
- All valid active users of that company

### A2. Change Password
- `currentPassword`
- `newPassword` (min 8, uppercase/lowercase/number/special)

Who can edit:
- Logged-in user only

### A3. Forgot/Reset
- Request fields: `identifier`, `mobileNumber`
- Reset fields: `resetToken`, `newPassword`

---

## B. Tenant Onboarding (Owner Control Only)

Permissions:
- View/Create/Update/Suspend/Billing/Invoice: `super_admin` only (owner scope)

### B1. New Tenant Bootstrap Fields
- `bootstrapSecret` Example: `internal-secret-token`
- `companyName` Example: `ABC Infra Pvt Ltd`
- `branchName` Example: `Raipur Unit 1`
- `ownerFullName` Example: `Ravi Sharma`
- `ownerMobileNumber` Example: `9876543210`
- `ownerDesignation` Example: `Director`
- `ownerDepartment` Example: `Admin`
- `ownerJoiningDate` Example: `2026-04-19`

Company Profile nested fields:
- `email` Example: `accounts@abcinfra.com`
- `mobile` Example: `9822001122`
- `addressLine1` Example: `Plot 21, Industrial Area`
- `city` Example: `Raipur`
- `stateName` Example: `Chhattisgarh`
- `stateCode` Example: `22`
- `pincode` Example: `492001`
- `gstin` Example: `22ABCDE1234F1Z5`
- `pan` Example: `ABCDE1234F`

### B2. Managed Client Company Edit/Billing Fields
- `companyName`, `branchName`, `companyEmail`, `companyMobile`
- `billingStatus` (`trial/active/overdue/grace/on_hold/suspended/closed`)
- `billingCycle` (`weekly/monthly/quarterly/half_yearly/yearly/custom`)
- `customCycleLabel`, `customCycleDays`
- `subscriptionPlan`, `planAmount`, `outstandingAmount`, `currencyCode`
- `nextDueDate`, `graceUntilDate`, `lastPaymentDate`
- `paymentReference`, `paymentTerms`, `internalNotes`

### B3. Invoice Draft Fields
- `invoiceDate`, `periodStartDate`, `periodEndDate`, `dueDate`
- `subscriptionPlan`, `planAmount`, `outstandingAmount`, `currencyCode`
- `paymentReference`, `paymentTerms`, `notes`

---

## C. Company Profile (Client Workspace)

Permissions:
- View: `super_admin`, `manager`, `hr`, `crusher_supervisor`, `site_engineer`
- Edit/Save: `super_admin`, `manager`

Fields (with examples):
- `companyName` (required): `ABC Infra Pvt Ltd`
- `logoUrl` (image data URL via upload)
- `branchName`: `Korba Plant`
- `addressLine1`: `Near NH Bypass, Sector 12`
- `addressLine2`: `Phase 2`
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
- `termsNotes`: `Payment due within 15 days`

Use effectively:
- Every print/invoice quality depends on this section.
- Update only with legal-approved data.

---

## D. Employees & User Access

Permissions:
- View/list: `super_admin`, `hr`, `manager`
- Create employee: `super_admin`, `hr`
- Edit employee: `super_admin`, `hr`, `manager`
- Employee status/login management: mostly `super_admin`, `hr`

Employee fields:
- `fullName` Example: `Ajay Verma`
- `mobileNumber` Example: `9988776655`
- `email` Example: `ajay.verma@abcinfra.com`
- `emergencyContactNumber` Example: `9876512345`
- `address` Example: `Ward 11, Bilaspur`
- `employmentType` (`full_time/contract/intern/temporary/consultant/other:...`)
- `idProofType` (`aadhaar/pan/driving_license/voter_id/passport/other:...`)
- `idProofNumber` Example: `ABCDE1234F`
- `department` Example: `Crusher`
- `designation` Example: `Shift Supervisor`
- `joiningDate` Example: `2026-01-05`
- `status` (`active/inactive/resigned/terminated`)
- `relievingDate` Example: `2026-12-31`
- `remarks` Example: `Night shift preferred`

---

## E. Masters + Plants

### E1. Plants
Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `plantName` Example: `Crusher Unit A`
- `plantCode` Example: `CR-A`
- `plantType` Example: `Crusher` / `Other: Lime Processing`
- `location` Example: `Raigarh`
- `powerSourceType` Example: `diesel/electric/hybrid/other:...`

### E2. Masters -> Crusher Unit
Fields:
- `unitName`, `unitCode`, `location`, `plantType`, `powerSourceType`

### E3. Masters -> Material
Fields:
- `materialName` Example: `20mm Aggregate`
- `materialCode` Example: `AGG20`
- `hsnSacCode` Example: `2517`
- `category` Example: `Aggregate`
- `unit` Example: `Ton`
- `gstRate` Example: `5`

### E4. Masters -> Shift
Fields:
- `shiftName` Example: `Day`
- `startTime` Example: `08:00`
- `endTime` Example: `20:00`

### E5. Masters -> Vehicle Type
Fields:
- `typeName` Example: `12 Wheeler`
- `category` Example: `Heavy`

### E6. Masters -> Config Options
Fields:
- `configType` (`plant_type/power_source/material_category/material_unit/vehicle_category/material_hsn_rule`)
- `optionLabel` Example: `Crusher`
- `optionValue` Example: `Crusher` or HSN code like `2517`
- `sortOrder` Example: `10`

---

## F. Vendors

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `vendorName` Example: `Shree Logistics`
- `vendorType` Example: `Transporter` / `Other: Crane Rental`
- `contactPerson` Example: `Nitin Yadav`
- `mobileNumber` Example: `9876500000`
- `address` Example: `Transport Nagar, Raipur`

---

## G. Parties

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `partyName` Example: `Maa Buildcon`
- `partyCode` Example: `MB001`
- `contactPerson` Example: `Rohit Sinha`
- `mobileNumber` Example: `9811122233`
- `gstin` Example: `22ABCDE1234F1Z5`
- `pan` Example: `ABCDE1234F`
- `addressLine1`, `addressLine2`
- `city`, `stateName`, `stateCode`, `pincode`
- `partyType` (`customer/supplier/both`)

---

## H. Transport Rates

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `plantId` (select)
- `vendorId` (select)
- `materialId` (select)
- `rateType` Example: `per_trip` or `per_km`
- `rateValue` Example: `1450`
- `distanceKm` required for per km Example: `42`

---

## I. Party Material Rates

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`

Fields:
- `plantId`
- `partyId`
- `materialId`
- `ratePerTon` Example: `980`
- `royaltyMode` (`per_ton/fixed/none`)
- `royaltyValue` Example: `50`
- `loadingCharge` Example: `20`
- `notes` Example: `Apr contract revised`

---

## J. Party Orders

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `orderNumber` (optional manual, otherwise auto pattern)
- `orderDate` Example: `2026-04-19`
- `partyId`, `plantId`, `materialId`
- `orderedQuantityTons` Example: `250`
- `targetDispatchDate` Example: `2026-04-25`
- `remarks` Example: `Priority delivery`
- `status` (`open/completed/cancelled`)

Tip:
- Linked-dispatch orders should be status-managed carefully (manager/super_admin for sensitive transitions).

---

## K. Vehicles & Equipment Logs

### K1. Vehicles
Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`, `hr`

Fields:
- `vehicleNumber` Example: `CG04AB1234`
- `vehicleType` Example: `12 Wheeler`
- `assignedDriver` Example: `Ramesh`
- `status` (`active/in_use/inactive/maintenance`)
- `ownershipType` (`company/attached_private/transporter`)
- `vendorId` (required for non-company)
- `plantId`
- `vehicleCapacityTons` Example: `25`

### K2. Equipment Logs
Permissions:
- View: all ops roles
- Create: `super_admin`, `manager`, `crusher_supervisor`, `site_engineer`

Fields:
- `usageDate` Example: `2026-04-19`
- `equipmentName` Example: `JCB`
- `equipmentType` Example: `Excavator`
- `siteName` Example: `Site-03`
- `usageHours` Example: `8`
- `fuelUsed` Example: `22`
- `remarks` Example: `Normal`
- `plantId`

---

## L. Crusher Reports (Plants & Units Reports)

Permissions:
- View: `super_admin`, `manager`, `crusher_supervisor`, `hr`
- Create/Edit/Delete: `super_admin`, `manager`, `crusher_supervisor`

Fields:
- `reportDate`, `plantId`, `shift`, `crusherUnitName`, `materialType`
- Production metrics: `productionTons`, `dispatchTons`, `machineHours`, `dieselUsed`
- Electricity metrics: `electricityKwh`, `electricityOpeningReading`, `electricityClosingReading`
- Rate/cost: `dieselRatePerLitre`, `electricityRatePerKwh`, `dieselCost`, `electricityCost`
- Expense: `labourExpense`, `maintenanceExpense`, `otherExpense`, `totalExpense`, `expenseRemarks`
- Ops health: `operationalStatus`, `breakdownHours`, `downtimeReason`, `maintenanceNotes`
- Stock/manpower: `openingStockTons`, `closingStockTons`, `operatorsCount`
- `remarks`

---

## M. Project Reports

Permissions:
- View: `super_admin`, `manager`, `site_engineer`, `hr`
- Create/Edit/Delete: `super_admin`, `manager`, `site_engineer`

Fields:
- `reportDate`, `plantId`, `projectName`, `siteName`
- `shift`, `weather`, `reportStatus`
- `progressPercent` (0-100)
- `workDone`
- `labourCount`, `machineCount`
- `materialUsed`, `blockers`, `nextPlan`, `remarks`

---

## N. Dispatch Reports (Most Critical Operational Section)

Permissions:
- View: all ops roles
- Create/Edit/Status: `super_admin`, `manager`, `crusher_supervisor`

Core fields:
- `dispatchDate`
- `sourceType` (`Crusher/Project/Plant/Store`)
- `plantId`, `materialId`, `partyId`, `partyOrderId` (optional linkage)
- `vehicleId`, `transportVendorId`
- `destinationName`
- `quantityTons`
- `remarks`

E-way bill fields:
- `ewbNumber` (12 digit)
- `ewbDate`
- `ewbValidUpto`

Invoice fields:
- `invoiceNumber`
- `invoiceDate`
- `invoiceValue`
- `distanceKm`
- `otherCharge`
- `billingNotes`

System-derived/commercial fields (auto from setup):
- `partyMaterialRateId`, `transportRateId`
- `materialRatePerTon`, `materialAmount`
- `transportRateType`, `transportRateValue`, `transportCost`
- `royaltyMode`, `royaltyValue`, `royaltyAmount`
- `loadingCharge`
- `totalInvoiceValue`, `gstRate`, `cgst`, `sgst`, `igst`, `totalWithGst`

Status:
- `pending/completed/cancelled`

Finance linkage flags:
- `financeStatus`, `canPostToFinance`, `financePostingState`, `financeNotes`

---

## O. Accounts & Finance Operations (Deep Practical Guide)

### O0. First-Time Setup Order (Must Follow)
### English
Run accounts setup in this exact order so non-accounting users avoid confusion:
1. `Chart of Accounts` -> create groups, accounts, ledgers.
2. `Posting Rules` -> map business events to debit/credit accounts.
3. `Policy Controls` -> set maker-checker posture.
4. `Period Controls` -> ensure current period is open.
5. `Cash/Bank` -> create bank accounts with valid cash/bank ledger mapping.
6. Start transactions: `Vouchers` + `Receivables` + `Payables`.
7. Validate in `Reports` and `Dashboard`.

### Hindi
Accounts setup हमेशा इसी क्रम में करें:
1. `Chart of Accounts` -> group, account, ledger बनाएं.
2. `Posting Rules` -> event to debit/credit mapping करें.
3. `Policy Controls` -> maker-checker policy set करें.
4. `Period Controls` -> current period open होना चाहिए.
5. `Cash/Bank` -> valid cash/bank ledger के साथ bank account बनाएँ.
6. फिर transactions शुरू करें: `Vouchers`, `Receivables`, `Payables`.
7. `Reports` और `Dashboard` में verify करें.

---

## O1. Accounts Dashboard (`/accounts/dashboard`)

Permissions:
- Read: `super_admin`, `manager`, `hr`
- Period status update action: `super_admin`, `manager`

### English
What it does:
- Gives finance health snapshot from trial balance + AR + AP + period status.
- Quick close/reopen actions are available for authorized roles.

Key operational fields:
- `status` for accounting period: `open` / `soft_closed` / `closed`
- `statusNotes` example: `Month-end lock after reconciliation`

Use sequence:
1. Check receivable/payable totals.
2. Verify current period state.
3. Close period only after voucher posting and settlement checks.

### Hindi
यह section क्या करता है:
- Trial balance, AR, AP और period health का quick snapshot देता है.
- Authorized user period close/reopen कर सकता है.

मुख्य fields:
- Period `status`: `open` / `soft_closed` / `closed`
- `statusNotes` उदाहरण: `Reconciliation complete - lock applied`

इस्तेमाल क्रम:
1. AR/AP totals check करें.
2. Current period status verify करें.
3. Voucher/settlement validate करने के बाद ही period close करें.

---

## O2. Chart of Accounts (`/accounts/chart-of-accounts`)

Permissions:
- Read: `super_admin`, `manager`, `hr`
- Create/status controls: `super_admin`, `manager`

### English
What it does:
- Finance master foundation: no voucher/reporting works correctly without this.

Fields and examples:
- Account Group:
  - `groupCode`: `ASSET_CURR`
  - `groupName`: `Current Assets`
  - `nature`: `asset/liability/equity/income/expense`
- Account:
  - `accountGroupId`: `1`
  - `accountCode`: `11001`
  - `accountName`: `Cash in Hand`
  - `accountType`: `ledger/cash/bank/customer/supplier`
  - `normalBalance`: `debit/credit`
- Ledger:
  - `accountId`: `5`
  - `ledgerCode`: `CASH_MAIN`
  - `ledgerName`: `Main Cash Ledger`

Who should edit:
- Master creation/change: Finance controller (`manager`/`super_admin`)
- `hr` should keep read-only in SOP.

### Hindi
यह section क्या करता है:
- यह finance की base structure है; इसके बिना voucher/report सही नहीं होंगे.

Fields और examples:
- Account Group:
  - `groupCode`: `ASSET_CURR`
  - `groupName`: `Current Assets`
  - `nature`: `asset/liability/equity/income/expense`
- Account:
  - `accountGroupId`: `1`
  - `accountCode`: `11001`
  - `accountName`: `Cash in Hand`
  - `accountType`: `ledger/cash/bank/customer/supplier`
  - `normalBalance`: `debit/credit`
- Ledger:
  - `accountId`: `5`
  - `ledgerCode`: `CASH_MAIN`
  - `ledgerName`: `Main Cash Ledger`

कौन edit करे:
- Master creation/change: `manager` / `super_admin`
- SOP में `hr` को mostly read-only रखें.

---

## O3. Voucher Entry (`/accounts/vouchers`)

Permissions:
- Read list/inbox/activity: `super_admin`, `manager`, `hr`
- Create/submit/approve/post/reverse: `super_admin`, `manager`

### English
What it does:
- Double-entry accounting + maker-checker workflow.

Header fields:
- `voucherType`: `journal/receipt/payment/contra`
- `voucherDate`: `YYYY-MM-DD`
- `narration`: `Monthly fuel expense adjustment`
- `autoPost`: `true/false`

Line fields (minimum 2 lines):
- `accountId`
- `ledgerId` (must belong to selected account)
- `debit`
- `credit`
- `lineNarration`

System rules:
- Each line must have either debit or credit (not both).
- Voucher must balance: total debit = total credit.
- Workflow actions: `submit` -> `approve/reject` -> `post` -> optional `reverse`.

Practical entry example:
- Line 1: `accountId=Fuel Expense`, `ledgerId=Fuel Expense Ledger`, `debit=25000`, `credit=0`
- Line 2: `accountId=Cash`, `ledgerId=Main Cash Ledger`, `debit=0`, `credit=25000`

### Hindi
यह section क्या करता है:
- Double-entry voucher posting और maker-checker workflow handle करता है.

Header fields:
- `voucherType`: `journal/receipt/payment/contra`
- `voucherDate`: `YYYY-MM-DD`
- `narration`: `Monthly diesel adjustment`
- `autoPost`: `true/false`

Line fields (कम से कम 2 lines):
- `accountId`
- `ledgerId` (selected account का ledger होना चाहिए)
- `debit`
- `credit`
- `lineNarration`

System rules:
- हर line में debit या credit में से एक ही होना चाहिए.
- Total debit = total credit mandatory.
- Workflow: `submit` -> `approve/reject` -> `post` -> जरूरत हो तो `reverse`.

---

## O4. Receivables (`/accounts/receivables`)

Permissions:
- List/read: `super_admin`, `manager`, `hr`
- `mark-ready`, `create`, `settle`: `super_admin`, `manager`

### English
What it does:
- Converts completed dispatch into AR and tracks customer collection.

Flow:
1. Dispatch queue: `mark-ready` with note.
2. Create AR from dispatch using due date.
3. Settle receivable partially or fully.

Fields:
- Mark ready:
  - `financeNotes`: `Checked with dispatch docs`
- Create AR:
  - `dueDate`: `2026-04-30`
- Settle AR:
  - `amount`: `10000`
  - `settlementDate`: `2026-04-21`
  - `referenceNumber`: `UTR847362`
  - `notes`: `NEFT collected`
  - optional `bankLedgerId`: `12`

Guardrails:
- Settlement amount > 0
- Settlement amount cannot exceed outstanding
- Settlement date format must be valid

### Hindi
यह section क्या करता है:
- Completed dispatch को receivable में convert करता है और collection track करता है.

Flow:
1. Dispatch को `mark-ready` करें.
2. `dueDate` देकर AR create करें.
3. Amount के अनुसार partial/full settlement करें.

Fields:
- Mark ready:
  - `financeNotes`: `Dispatch docs checked`
- Create AR:
  - `dueDate`: `2026-04-30`
- Settle AR:
  - `amount`, `settlementDate`, `referenceNumber`, `notes`, optional `bankLedgerId`

Guardrails:
- Settlement amount positive होना चाहिए.
- Outstanding amount से ज्यादा settlement allowed नहीं.

---

## O5. Payables (`/accounts/payables`)

Permissions:
- List/read: `super_admin`, `manager`, `hr`
- Create/settle: `super_admin`, `manager`

### English
What it does:
- Creates supplier/party liability and tracks outgoing payment settlement.

Create payable fields:
- `partyId` or `vendorId` (exactly one required)
- `referenceNumber`: `BILL-APR-442`
- `billDate`: `2026-04-19`
- `dueDate`: `2026-05-04`
- `amount`: `48000`
- `notes`: `Diesel purchase invoice`

Settle fields:
- `amount`
- `settlementDate`
- `referenceNumber`
- optional `bankLedgerId`

Guardrails:
- Amount must be > 0
- Due date cannot be before bill date
- Do not select both party and vendor
- Settlement cannot exceed outstanding

### Hindi
यह section क्या करता है:
- Vendor/party liability (देय राशि) बनाता है और payment settlement track करता है.

Create payable fields:
- `partyId` या `vendorId` (दोनों नहीं; एक mandatory)
- `referenceNumber`, `billDate`, `dueDate`, `amount`, `notes`

Settle fields:
- `amount`, `settlementDate`, `referenceNumber`, optional `bankLedgerId`

Guardrails:
- Amount > 0 होना चाहिए
- `dueDate` < `billDate` allowed नहीं
- Settlement outstanding amount से ज्यादा नहीं होना चाहिए

---

## O6. Cash / Bank (`/accounts/cash-bank`)

Permissions:
- Read list: `super_admin`, `manager`, `hr`
- Create/update/posting: `super_admin`, `manager`

### English
What it does:
- Manages bank masters and cash/bank movement vouchers.

Bank account fields:
- `accountName`: `HDFC Current A/c`
- `bankName`: `HDFC Bank`
- `branchName`: `Raipur Main`
- `accountNumber`: `50200012345678`
- `ifscCode`: `HDFC0001234`
- `ledgerId`: must map to active `cash/bank` account type ledger
- Status update:
  - `isActive`: `true/false`
  - `isDefault`: `true/false`

Cash/Bank voucher fields:
- `voucherType`: `receipt/payment/contra`
- `voucherDate`
- `amount`
- `cashOrBankLedgerId` (or `cashOrBankAccountId`)
- `counterAccountId`
- `counterLedgerId` (must belong to counter account)
- Optional: `partyId` or `vendorId` (only one)
- `narration`

Contra rule:
- Both sides must be cash/bank type.

### Hindi
यह section क्या करता है:
- Bank master maintain करता है और cash-bank movement vouchers post करता है.

Bank account fields:
- `accountName`, `bankName`, `branchName`, `accountNumber`, `ifscCode`, `ledgerId`
- `ledgerId` active cash/bank ledger होना चाहिए.
- Status:
  - `isActive`
  - `isDefault`

Cash/Bank voucher fields:
- `voucherType`, `voucherDate`, `amount`
- `cashOrBankLedgerId` / `cashOrBankAccountId`
- `counterAccountId`, `counterLedgerId`
- optional `partyId` या `vendorId` (एक ही)
- `narration`

Contra rule:
- Contra में दोनों side cash/bank type होने चाहिए.

---

## O7. Posting Rules (`/accounts/posting-rules`)

Permissions:
- Read: `super_admin`, `manager`, `hr`
- Create/status toggle: `super_admin`, `manager`

### English
What it does:
- Defines automatic accounting behavior from source events.

Fields:
- `ruleCode`: `DISPATCH_AR_01`
- `eventName`: `dispatch_receivable`
- `sourceModule`: `dispatch`
- `voucherType`: `journal/receipt/payment/contra/sales_invoice/purchase_bill/reversal`
- `debitAccountId`, `creditAccountId` (must be different)
- `partyRequired`, `vendorRequired`
- `requiresApproval`, `autoPostEnabled`
- `rulePriority`: `100`
- `isActive`

Use tip:
- Keep higher priority (lower number) for critical rules with strict approval.

### Hindi
यह section क्या करता है:
- Source event के आधार पर automatic accounting rule define करता है.

Fields:
- `ruleCode`, `eventName`, `sourceModule`, `voucherType`
- `debitAccountId`, `creditAccountId` (same नहीं होने चाहिए)
- `partyRequired`, `vendorRequired`
- `requiresApproval`, `autoPostEnabled`
- `rulePriority`
- `isActive`

---

## O8. Period Controls (`/accounts/period-controls`)

Permissions:
- Read: `super_admin`, `manager`, `hr`
- Status change: `super_admin`, `manager`

### English
Period status fields:
- `status`: `open` / `soft_closed` / `closed`
- `statusNotes`: `FY26 Apr closed after reconciliation`

When to use:
- `open`: daily posting window
- `soft_closed`: controlled freeze with emergency override path
- `closed`: final lock

### Hindi
Period status fields:
- `status`: `open` / `soft_closed` / `closed`
- `statusNotes`: `April month-end close completed`

कब use करें:
- `open`: normal posting
- `soft_closed`: controlled freeze
- `closed`: final lock

---

## O9. Finance Policy Controls (`/accounts/policy-controls`)

Permissions:
- Read: `super_admin`, `manager`, `hr`
- Update: `super_admin`, `manager`

### English
Fields:
- `allowSubmitterSelfApproval`
- `allowMakerSelfApproval`
- `allowApproverSelfPosting`
- `allowMakerSelfPosting`
- `lastUpdateNotes` (max 400 chars)

Recommended production posture:
- Keep all self-approval/self-posting toggles `false` unless emergency governance exception is approved.

### Hindi
Fields:
- `allowSubmitterSelfApproval`
- `allowMakerSelfApproval`
- `allowApproverSelfPosting`
- `allowMakerSelfPosting`
- `lastUpdateNotes` (max 400 chars)

Production recommendation:
- Governance safety के लिए self-approval / self-posting toggles सामान्यतः `false` रखें.

---

## O10. Finance Reports (`/accounts/reports`)

Permissions:
- Read/export: `super_admin`, `manager`, `hr`

### English
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
- Date range: `dateFrom`, `dateTo` (YYYY-MM-DD)
- Ageing: `asOfDate`
- Ledger report: `ledgerId`
- Party ledger: `partyId`
- Transition history:
  - `entityType`: `voucher/accounting_period`
  - `action`: `create/submit/approve/post/reject/reverse/close/reopen`
  - `performedByUserId`
  - `limit`, `page`, optional `format=json/csv`

### Hindi
Report keys:
- `trial-balance`, `ledger`, `party-ledger`, `voucher-register`, `receivable-ageing`, `payable-ageing`, `cash-book`, `bank-book`, `finance-transition-history`

Filters:
- `dateFrom`, `dateTo`
- `asOfDate`
- `ledgerId`
- `partyId`
- Transition history के लिए `entityType`, `action`, `performedByUserId`, `limit`, `page`

---

## O11. Accounts UAT Checklist (Role-wise)

### English
- HR user can view all accounts pages but cannot create voucher/payable/settlement.
- Manager can create voucher, submit, approve, post, and reverse (as per policy control state).
- Receivable/payable settlement blocks invalid amount locally and via backend validation.
- Cash/Bank voucher rejects counter account-ledger mismatch.
- Period close/reopen entries appear in workflow history/audit trail.
- Reports export CSV with same applied filters.

### Hindi
- HR user accounts pages view कर सके लेकिन create/settle/post actions block हों.
- Manager voucher lifecycle execute कर सके (policy toggle के अनुसार).
- Receivable/Payable settlement में invalid amount block होना चाहिए.
- Cash/Bank में account-ledger mismatch पर error आना चाहिए.
- Period close/reopen history audit trail में दिखना चाहिए.
- Reports CSV export filter-consistent होना चाहिए.

---

## P. Audit Logs

Permissions:
- Access: `super_admin`, `manager`, `hr`

Use:
- Sensitive action traceability
- Role misuse detection
- Month-end governance evidence

---

## 5) Daily, Weekly, Month-End SOP

### Daily (Hindi + English)
- Dashboard and pending exceptions review करें
- Dispatch entries + commercial linkage validate करें
- AR/AP settlement queue check करें
- Print validation for billing docs करें
- Sensitive audit actions check करें

### Weekly
- Masters hygiene: duplicates, inactive critical master, missing HSN/GST
- Party/rate/order alignment review
- Finance workflow backlog review (draft/submitted/approved/post pending)

### Month-End
- Dispatch to finance reconciliation
- Ageing reports review
- Trial balance sanity
- Period close with remarks + approval trace

---

## 6) Practical Data Entry Examples (Quick Copy)

- Plant: `plantName=Crusher Unit A, plantCode=CRA, plantType=Crusher, powerSourceType=diesel`
- Vendor: `vendorName=Shree Logistics, vendorType=Transporter, mobileNumber=9876500000`
- Party: `partyName=Maa Buildcon, gstin=22ABCDE1234F1Z5, partyType=customer`
- Party Rate: `ratePerTon=980, royaltyMode=per_ton, royaltyValue=50, loadingCharge=20`
- Party Order: `orderDate=2026-04-19, orderedQuantityTons=250, status=open`
- Dispatch: `quantityTons=22, invoiceValue=23500, distanceKm=42, status=pending`
- Voucher line sample:
  - Line1: `accountId=Sales, ledgerId=Party-MaaBuildcon, credit=23500`
  - Line2: `accountId=Receivable, ledgerId=Party-MaaBuildcon, debit=23500`

---

## 7) Governance Notes (Must Follow)

### English
- Never share owner onboarding secret with client users.
- Keep maker-checker overrides disabled unless emergency and documented.
- Do not close periods without reconciliation evidence.
- Avoid duplicate masters and stale inactive references in live workflows.

### Hindi
- Owner onboarding secret client users के साथ share न करें.
- Maker-checker override केवल documented emergency में ही enable करें.
- Reconciliation evidence के बिना period close न करें.
- Duplicate masters और stale inactive references avoid करें.

---

## 8) Final Adoption Checklist

- Role mapping signed off
- Company profile print verified
- Masters complete and health checks clean
- Commercial setup complete (rates + orders)
- Dispatch and print trial successful
- Finance cycle validated (voucher -> AR/AP -> reports)
- Period control and audit review working

---

## 9) Source of Truth Note

This guide is generated from the current implementation in:
- Backend route/validation/model logic
- Frontend page-level forms and workflow controls
- Existing production handover docs

For future changes, regenerate this guide after any route/validation/form updates.
