# Construction ERP Ultra-Premium Client Operational Guide (Hindi)

## डॉक्यूमेंट कंट्रोल
- डॉक्यूमेंट ID: ERP-CLIENT-OPS-ULTRA-HI-001
- वर्ज़न: 1.0
- तारीख: 19 अप्रैल 2026
- प्रोडक्ट स्कोप: `production_ready_clone` (backend + web admin)
- उपयोगकर्ता: क्लाइंट ओनर, ऑपरेशन्स हेड, एडमिन, कमर्शियल टीम, डिस्पैच टीम, फाइनेंस टीम

---

## 1. एग्जीक्यूटिव ओवरव्यू
यह Construction ERP production-grade multi-company system है, जिसे controlled operations, commercial accuracy और finance governance के लिए design किया गया है।

मुख्य ताकत:
- company-scoped data isolation और role-based access.
- owner workspace और client workspace अलग.
- dispatch, rates, party orders और print tightly integrated.
- accounts module में vouchers, AR/AP, cash-bank, reports, period/policy controls शामिल.
- governance के लिए audit logs और workflow transition history उपलब्ध.

---

## 2. रोल फ्रेमवर्क और जिम्मेदारी

## 2.1 Core Roles
- `super_admin`
- `manager`
- `hr`
- `crusher_supervisor`
- `site_engineer`

## 2.2 Role-wise जिम्मेदारी
### Super Admin
- सिस्टम और बिजनेस का पूर्ण नियंत्रण.
- onboarding, finance controls और sensitive governance actions संभाल सकता है.

### Manager
- operations + commercial + finance controller.
- daily high-impact decision owner.

### HR
- employee/admin support और selected operational/finance support.
- sensitive modules में limited controlled write access.

### Crusher Supervisor
- crusher operations और dispatch execution focused role.
- allowed sections में crusher/dispatch data create-update कर सकता है.

### Site Engineer
- project reporting और site execution visibility focused role.
- allowed sections में project reporting manage कर सकता है.

---

## 3. अनिवार्य Go-Live Sequence
Stable rollout के लिए यही sequence follow करें:

1. Owner-side tenant onboarding और company activation.
2. Company profile setup (legal + print identity).
3. Employee master और login users setup.
4. Masters configuration (plants, units, materials, shifts, vehicle types, config options).
5. Vendor और party creation.
6. Transport rate और party material rate setup.
7. Party order setup.
8. Vehicle और equipment readiness.
9. Crusher/project daily reports शुरू करें.
10. Dispatch operations और print validation शुरू करें.
11. Finance masters configure करें (groups/accounts/ledgers/FY/periods/rules).
12. Accounting cycle शुरू करें (vouchers, receivables, payables, settlements).
13. Governance cycle चलाएं (reports, period close/reopen, policy reviews, audit reviews).

---

## 4. Module-wise Detailed Operational Guide (Field by Field)

## 4.1 Authentication और Access

### 4.1.1 Client Login
Path: `/client-login/:companyCode`

Fields:
- `username` / `identifier`
- `password`

Examples:
- Identifier: `EMP001` / `manager01` / `9876543210`
- Password: `Abc@1234`

कौन उपयोग करेगा:
- उस company scope का active user.

### 4.1.2 Change Password
Fields:
- `currentPassword`
- `newPassword`

Password rule:
- कम से कम 8 characters, uppercase, lowercase, number, special character.

### 4.1.3 Forgot Password
Step-1 fields:
- `identifier`
- `mobileNumber`

Step-2 fields:
- `resetToken`
- `newPassword`

---

## 4.2 Tenant Onboarding (Owner Console)
Permission: केवल `super_admin`.

### 4.2.1 New Company Bootstrap
Fields:
- `bootstrapSecret`
- `companyName`
- `branchName`
- `ownerFullName`
- `ownerMobileNumber`
- `ownerDesignation`
- `ownerDepartment`
- `ownerJoiningDate`

Nested `companyProfile` fields:
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
- Identity: `companyName`, `branchName`, `companyEmail`, `companyMobile`
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

Fields और examples:
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

Best practice:
- इस सेक्शन का डेटा legal-approved रखें; dispatch print/invoice इसी से बनते हैं।

---

## 4.4 Employees और Login Management
Access:
- List view: `super_admin`, `hr`, `manager`
- Create employee: `super_admin`, `hr`
- Update employee: `super_admin`, `hr`, `manager`
- Status control: primarily `super_admin`, `hr`

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

## 4.5 Masters और Plants

### 4.5.1 Plants
Access:
- View: सभी operational roles
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
- `distanceKm` (`per_km` में required)

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
- Linked dispatch orders का status change manager-controlled रखें।

---

## 4.11 Vehicles और Equipment Logs

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
- `vendorId` (non-company ownership में required)
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
- Expense: `labourExpense`, `maintenanceExpense`, `otherExpense`, `totalExpense`, `expenseRemarks`
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

## 4.14 Dispatch Reports (सबसे Critical Section)
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

System/commercial linked fields:
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

## 4.15 Accounts और Finance

## 4.15.1 Chart of Accounts और Ledgers
Access:
- Read: `super_admin`, `manager`, `hr`
- Create/modify: मुख्यतः `super_admin`, `manager`

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
- Minimum दो lines.
- हर line में debit या credit में से एक होना चाहिए।
- Total debit = total credit.

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
- `partyId` या `vendorId` (exactly one)
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
- `cashOrBankLedgerId` या `cashOrBankAccountId`
- `counterAccountId`, `counterLedgerId`
- optional `partyId` या `vendorId`
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
- Change status: `super_admin`, `manager`

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

उपयोग:
- sensitive action trace
- compliance evidence
- incident investigation

---

## 5. Daily / Weekly / Month-End SOP

## 5.1 Daily SOP
- Dashboard और pending exceptions check करें।
- Dispatch records और commercial linkage validate करें।
- Receivable/Payable settlement queue review करें।
- Print/invoice readiness verify करें।
- Sensitive audit events review करें।

## 5.2 Weekly SOP
- Masters hygiene: duplicates, missing HSN/GST, inactive critical records.
- Party/rate/order consistency check.
- Finance workflow backlog review.

## 5.3 Month-End SOP
- Dispatch vs finance reconciliation करें।
- Ageing reports analyze करें।
- Trial balance review करें।
- Controlled period close करें (remarks + approval evidence के साथ)।

---

## 6. Quick Data Entry Examples
- Plant: `plantName=Crusher Unit A`, `plantCode=CRA`, `plantType=Crusher`, `powerSourceType=diesel`
- Vendor: `vendorName=Shree Logistics`, `vendorType=Transporter`, `mobileNumber=9876500000`
- Party: `partyName=Maa Buildcon`, `gstin=22ABCDE1234F1Z5`, `partyType=customer`
- Party Rate: `ratePerTon=980`, `royaltyMode=per_ton`, `royaltyValue=50`, `loadingCharge=20`
- Party Order: `orderDate=2026-04-19`, `orderedQuantityTons=250`, `status=open`
- Dispatch: `quantityTons=22`, `invoiceValue=23500`, `distanceKm=42`, `status=pending`

Voucher sample:
- Line 1: DR Receivable 23,500
- Line 2: CR Sales 23,500

---

## 7. Governance Rules (अनिवार्य)
- Owner bootstrap secret client operations users के साथ share न करें।
- Policy overrides सिर्फ approved emergency window में enable करें।
- Reconciliation evidence के बिना period close न करें।
- Live operations में duplicate masters न रहने दें।
- Shared credentials strictly avoid करें।

---

## 8. Go-Live Acceptance Checklist
- Role access validation complete.
- Company profile + print verification complete.
- Masters complete और healthy.
- Commercial setup complete.
- Dispatch lifecycle successful.
- Finance lifecycle validated.
- Reports + governance controls active.
- Support + escalation owners assigned.

---

## 9. Escalation Template
Support/escalation में यह payload दें:
- User role:
- Module/page:
- Action attempted:
- Exact error:
- Date/time:
- Screenshot:

