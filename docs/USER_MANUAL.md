# InfraFlow ERP — User Manual

**Construction Operations, Procurement & Financial Management Platform**

A practical guide for company owners, managers, operators, administration,
procurement teams, accounts teams, and other authorized business users.

> **Documentation edition:** Public repository edition  
> **Last updated:** September 2026  
> **Audience:** Non-technical and operational users  
> **Security note:** All names, companies, phone numbers, banking details,
> identifiers, and credentials shown in examples are fictional or sanitized.
> Never place real passwords, access tokens, bootstrap secrets, database
> credentials, or customer-sensitive information in documentation.

---


## Contents

- [Introduction](#1-introduction)
- [Quick Start Guide](#2-quick-start-guide)
- [Understanding the Screen](#3-understanding-the-screen)
- [User Roles and Access](#4-user-roles-and-access)
- [Dashboard](#5-dashboard)
- [Module Guide](#6-module-guide)
- [Reports](#7-reports)
- [Administration](#8-administration)
- [Daily Work Guide](#9-daily-work-guide)
- [Training](#10-training)
- [Troubleshooting](#11-troubleshooting)
- [Frequently Asked Questions](#12-frequently-asked-questions)
- [Glossary](#13-glossary)
- [Appendix](#14-appendix)

---

## 1. Introduction

#### What This System Does

- This system helps a construction or plant-based company manage daily work in one place.
- It helps you store company information.
- It helps you manage employees.
- It helps you manage plants, units, vehicles, equipment, vendors, and parties.
- It helps you record dispatch work.
- It helps you manage commercial rates and orders.
- It helps you manage purchase requests, purchase orders, goods receipts, and purchase invoices.
- It also includes accounts and audit tracking pages.

#### Who Should Use It

- Company owners
- Managers
- HR staff
- Crusher supervisors
- Site engineers
- Operators
- Accounts team
- Procurement team

#### Why It Is Useful

- It keeps important business records in one system.
- It reduces confusion caused by paper notes and scattered spreadsheets.
- It helps teams see daily work status quickly.
- It helps managers review reports.
- It helps owners monitor operations.
- It helps the company keep a clear record of what was created, changed, approved, or reviewed.

---

## 2. Quick Start Guide

#### Login

#### Important Login Note

- This system has two main login paths.
- The first path is for the platform owner.
- The second path is for a client company user.
- Use the correct path.
- If you use the wrong path, login may fail even if your password is correct.

#### Owner Login

1. Open your web browser.
2. Google Chrome is recommended.
3. Click on the address bar at the top of the browser.
4. Type the owner login web address.
5. Press Enter on your keyboard.
6. Wait for the login page to open.
7. You will see the owner login screen.
8. Look for the Username box.
9. Click inside the Username box.
10. Type your username.
11. Look for the Password box.
12. Click inside the Password box.
13. Type your password.
14. Click on the Login button.
15. Wait for the next page to load.
16. If login is successful, you will go to the owner workspace.
17. If login is not successful, you will see an error message on the screen.

#### Client Company Login

1. Open your web browser.
2. Click on the address bar at the top of the browser.
3. Type the client login web address.
4. Press Enter on your keyboard.
5. Wait for the company code page to open.
6. You will see the heading Enter Company Code.
7. Look for the Company Code box in the center of the screen.
8. Click inside the Company Code box.
9. Type the company code exactly as shared with you.
10. Example company code: DEMO_CONSTRUCTION
11. Click on the Continue button.
12. Wait for the login page to open.
13. You will now see the company-specific login screen.
14. Look for the Username box.
15. Type your username.
16. Look for the Password box.
17. Type your password.
18. Click on the Login button.
19. Wait for the dashboard or assigned workspace to open.

#### If You See A Password Change Screen

1. Read the message on the screen.
2. This usually means you are using a temporary password.
3. Enter your new password.
4. Confirm the new password if the page asks for it.
5. Click the Save or Update Password button.
6. Wait for the system to complete the change.
7. After that, log in again if needed.

#### Logout

1. Look at the top area of the screen.
2. Find the button named Log Out.
3. The Log Out button is shown in the top header area.
4. Click on the Log Out button.
5. Wait for the system to return to the login page.
6. After logout, your session ends.
7. You must log in again to continue work.

#### Forgot Password

1. Go to the login page.
2. Look for the Forgot Password link.
3. Click on the Forgot Password link.
4. Follow the instructions shown on the screen.
5. If your company has a password recovery process, complete that process.
6. If you are not able to reset the password, contact your system administrator.

---

## 3. Understanding the Screen

#### Main Screen Layout

- The left side of the screen contains the menu.
- The top area of the screen contains the header.
- The middle area of the screen contains the main working page.

#### Left Side Menu

- The left side menu is the main navigation area.
- It contains grouped links.
- You click one menu item to open one page.
- The groups shown depend on your role and your company module access.

#### Main Menu Groups Used In The System

- Overview
- Owner Control
- Logistics
- Procurement
- Commercial
- Accounts
- Administration

#### Top Header

#### What You Will See In The Header

- InfraFlow ERP badge
- Current page title
- Current page subtitle
- Today date
- Active Scope
- Signed In user name
- User role
- Log Out button

#### What Active Scope Means

- Active Scope shows which company or workspace you are currently using.
- This is important when one platform manages more than one company.

#### Mobile Screen Note

- On smaller screens, the left menu may be hidden.
- In that case, look for the Menu button in the top left area.
- Click Menu to open the left side navigation.
- Click Close to close it.

#### Common Buttons

| Button Name | What It Does | What You Should Expect |
|------------|--------------|------------------------|
| Login | Signs you into the system | Opens your assigned workspace |
| Continue | Moves you to the next login step | Opens the next screen |
| Save | Stores new information | Shows a success message if saved |
| Update | Changes existing information | Shows updated data on screen |
| Edit | Opens an existing record for change | Shows editable form |
| Delete | Removes a record or asks for confirmation | Record may disappear after confirmation |
| Refresh | Loads the latest data again | Page data updates |
| Export CSV | Downloads table data as a file | A file is downloaded to your computer |
| Show List / Hide List | Opens or hides record lists | List section appears or disappears |
| Show Form / Hide Form | Opens or hides entry form | Form section appears or disappears |
| View | Opens more details | Detailed record information opens |
| Log Out | Ends your session | Returns to login page |

#### Common Page Sections

- Overview
- Snapshot
- Search & Filters
- Workspace
- List
- Health
- Controls
- Insights

#### What These Mean

- Overview shows summary numbers.
- Snapshot shows quick business status.
- Search & Filters helps you narrow records.
- Workspace is the place where you create or edit records.
- List shows saved records.
- Health shows data quality or setup readiness.
- Controls provides action buttons.
- Insights provides warnings, trends, or suggestions.

---

## 4. User Roles and Access

#### Important Note

- Your role decides what you can open and what you can change.
- Your company module access also decides what menu items are visible.

#### Confirmed Roles In The System

| Role | What They Can Do | Example |
|------|------------------|---------|
| super_admin | Highest level access. Can manage core business areas. Platform owner can access owner control pages. | Company owner or platform owner |
| manager | Can manage many operational and control pages. | Operations manager |
| admin | Can access several business and people management pages. | Office administrator |
| hr | Can manage employee-related and several control pages. | HR executive |
| crusher_supervisor | Can work with plant and operational reporting pages. | Plant supervisor |
| site_engineer | Can work with project and site reporting pages. | Site engineer |
| operator | Can use limited day-to-day workflow pages such as purchase request entry where allowed. | Entry operator |

#### Module Access In The System

| Module | What It Covers | Example |
|--------|----------------|---------|
| Operations | Dispatch, plants, units, boulder flow, vehicles, equipment, vendors, transport rates | Daily field operations |
| Commercial | Parties, rates, orders, commercial exception handling | Billing and customer commercial setup |
| Procurement | Purchase requests, purchase orders, goods receipts, purchase invoices | Buying material and services |
| Accounts | Ledger, vouchers, receivables, payables, cash-bank, finance reports | Finance and accounting control |

#### What Happens If You Do Not Have Access

- Some menu items will not appear.
- Some pages may show an unauthorized message.
- Some action buttons may stay hidden.

---

## 5. Dashboard

#### How To Open

1. Look at the left side menu.
2. Find Dashboard under the Overview group.
3. Click on Dashboard.
4. Wait for the page to load.
5. You will see the page title Operations Dashboard.

#### Purpose

- The dashboard gives a quick live view of operations.
- It helps management review dispatch, production, fleet, and commercial alerts.

#### What You Will See

- Summary cards
- Management priorities
- Today’s operating base
- Commercial control queue
- Plant-wise dispatch today
- Plant-wise active vehicles
- Recent dispatch activity

#### Confirmed Dashboard Cards

| Card Name | What It Means | What User Should Understand |
|-----------|---------------|-----------------------------|
| Total Employees | Total employee records in the system | Shows workforce size |
| Active Plants | Total active plants or units | Shows active business sites |
| Today's Crusher Production | Production entered for today | Shows today’s production quantity |
| Yesterday Production | Production entered for yesterday | Helps compare daily output |
| Weekly Production | Total production for the week | Shows recent performance |
| Today's Dispatch Quantity | Total dispatch quantity for today | Shows daily dispatch volume |
| Vehicles Used Today | Number of vehicles used today | Shows how much fleet was active |
| Pending Dispatch | Dispatch records not completed yet | Needs follow-up |
| Completed Dispatch | Dispatch records completed | Shows finished work |
| Active Vehicles | Vehicles marked active | Shows available fleet base |
| Vehicles In Use | Vehicles currently being used | Shows working fleet count |
| Equipment Hours Today | Total equipment working hours today | Shows equipment usage |

#### How To Use The Dashboard

1. Open the Dashboard page.
2. Read the top summary cards first.
3. Check Pending Dispatch.
4. If Pending Dispatch is high, open Dispatch Reports and review incomplete records.
5. Check production cards.
6. If production is low, open Plants & Units Reports.
7. Check plant-wise sections.
8. If one plant looks unusual, open the detailed report page for that plant.
9. Check commercial exception sections if visible.
10. If you see missing rates, overdue orders, or unlinked dispatches, open Commercial Exceptions.

#### Real-Life Example

- A manager starts the day by opening Dashboard.
- The manager sees high Pending Dispatch.
- The manager clicks Dispatch Reports.
- The manager finds incomplete dispatch records.
- The manager asks the dispatch team to close the pending entries.

---

## 6. Module Guide

### Tenant Onboarding

#### Purpose

- This page is for owner control.
- It is used to create and manage client companies.
- It is also used to manage owner credentials and client access status.

#### Real-Life Example

- A software owner signs a new customer.
- The owner creates a new client company.
- The owner enables the required modules.
- The owner generates the client owner login.
- The owner shares the credentials securely.

#### How To Open

1. Look at the left side menu.
2. Find Owner Control.
3. Click Tenant Onboarding.
4. Wait for the page to load.
5. You will see the page title Tenant Onboarding.

#### What You Will See

- Production Bootstrap Flow
- Owner Profile Management
- Client Access Control
- Generated Owner Credentials


#### Main Bootstrap Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| bootstrapSecret | Secure bootstrap value used during authorized tenant onboarding | Configure securely outside source control; never expose publicly |
| companyName | New client company name | Demo Construction Pvt. Ltd. |
| branchName | Main branch or office name | Chandrapur Main Branch |
| enabledModules | Modules to activate for this client | Operations, Commercial |
| ownerFullName | Client owner full name | Demo Client Owner |
| ownerMobileNumber | Owner mobile number | 9000000000 |
| ownerDesignation | Owner job title | Managing Director |
| ownerDepartment | Owner department name | Admin |
| ownerJoiningDate | Owner joining date | 2026-04-27 |
| email | Company email address | office@example.com |
| mobile | Company contact number | 9000000000 |
| addressLine1 | Main address line | Plot 10, Industrial Area |
| city | City name | Chandrapur |
| stateName | State name | Maharashtra |
| stateCode | State code | 27 |
| pincode | Postal code | 442401 |
| gstin | Company GST number | 27ABCDE1234F1Z5 |
| pan | Company PAN number | ABCDE1234F |

#### Operations

#### Create New Client Company

1. Open Tenant Onboarding.
2. Go to the Production Bootstrap Flow section.
3. Click inside each field one by one.
4. Enter company details.
5. Choose the correct modules.
6. Enter owner details.
7. Review all values carefully.
8. Click the save or onboarding action button shown on the page.
9. Wait for the system response.
10. If successful, Generated Owner Credentials will appear.

#### Use Generated Owner Credentials

1. Go to the Generated Owner Credentials section.
2. Read the generated company code.
3. Read the generated username.
4. Read the temporary password.
5. Share these details through a secure private channel only.
6. Ask the customer to change the password after first login.

#### Common Mistakes

- Wrong mobile number
- Wrong GSTIN or PAN
- Wrong module selection
- Sharing credentials in a public group

---

### Audit Logs

#### Purpose

- This page shows who did what in the system.
- It helps management and owners review activity history.

#### Real-Life Example

- An owner wants to know who changed a dispatch record.
- The owner opens Audit Logs.
- The owner filters by event or user.
- The owner checks the recent activity and event details.

#### How To Open

1. Look at the left side menu.
2. Find Audit Logs under Owner Control or Administration.
3. Click Audit Logs.
4. Wait for the page to load.

#### What You Will See

- Audit Overview
- Filters
- Recent Activity
- Event Inspector

#### How To Use

1. Open Audit Logs.
2. Start with the Filters section.
3. Enter the date, event type, user, or other filter shown on the page.
4. Click or apply the filter.
5. Look at Recent Activity.
6. Click the event you want to inspect.
7. Read the Event Inspector details.

#### Deployment-Dependent Behavior

- Exact filter field list on this page
- Exact export options on this page

---

### Plants & Units Reports

#### Purpose

- This page stores daily plant production and operating data.
- It is used to monitor crusher or plant unit performance.

#### Real-Life Example

- A crusher supervisor enters today’s production.
- The supervisor enters diesel, electricity, stock, and breakdown details.
- Management later reviews output and cost trends.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Plants & Units Reports.
4. Wait for the page to load.
5. You will see the page title Plants & Units Reports.

#### What You Will See

- Plant Snapshot
- Analysis Controls
- Plant Insights
- Attention Queue
- Plants & Units Daily Reports


#### Main Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| reportDate | Date of the report | 2026-04-27 |
| plantId | Plant for which report is entered | Main Crusher Plant |
| shift | Shift name | Day Shift |
| crusherUnitName | Unit or sub-unit name | Unit 1 |
| materialType | Material produced or handled | 20 MM Aggregate |
| operationalStatus | Working condition of the plant | Running |
| productionTons | Quantity produced | 850 |
| dispatchTons | Quantity dispatched | 640 |
| machineHours | Machine running hours | 10 |
| dieselUsed | Diesel used | 120 |
| electricityKwh | Power used in KWH | 540 |
| electricityOpeningReading | Opening meter reading | 12450 |
| electricityClosingReading | Closing meter reading | 12990 |
| dieselRatePerLitre | Diesel rate | 92 |
| electricityRatePerKwh | Electricity rate | 8 |
| dieselCost | Diesel expense | 11040 |
| electricityCost | Electricity expense | 4320 |
| labourExpense | Labour cost | 18000 |
| maintenanceExpense | Maintenance cost | 5000 |
| otherExpense | Other cost | 1500 |
| totalExpense | Total expense | 39860 |
| breakdownHours | Breakdown time | 1.5 |
| openingStockTons | Opening stock | 220 |
| closingStockTons | Closing stock | 180 |
| operatorsCount | Number of operators | 8 |
| downtimeReason | Reason for downtime | Belt issue |
| maintenanceNotes | Maintenance remarks | Bearing check completed |
| expenseRemarks | Expense note | Fuel bill pending |
| remarks | General notes | Smooth operations |

#### Create New Record

1. Open Plants & Units Reports.
2. Go to the daily report entry section.
3. Click inside Report Date.
4. Select the correct date.
5. Choose the plant.
6. Choose the shift.
7. Enter production values.
8. Enter dispatch values.
9. Enter stock values.
10. Enter fuel and electricity values if used.
11. Enter expenses if available.
12. Enter remarks.
13. Click Save.
14. Wait for the success message.
15. The report should appear in the report list.

#### Search And Filter

1. Open Analysis Controls.
2. Use search text if you know a plant, unit, or material name.
3. Choose plant filter if needed.
4. Choose shift filter if needed.
5. Choose status filter if needed.
6. Choose date range if needed.
7. Wait for the list to refresh.

#### Common Mistakes

- Wrong report date
- Wrong plant selected
- Entering cost without checking rate
- Forgetting stock values
- Saving incomplete breakdown reason

---

### Project Reports

#### Purpose

- This page stores daily project site progress.
- It is used to track site work, manpower, machine use, and progress status.

#### Real-Life Example

- A site engineer records today’s project work.
- The engineer adds project progress, blockers, and next plan.
- Management reviews whether the project is on track.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Project Reports.
4. Wait for the page to load.

#### What You Will See

- Portfolio Snapshot
- Analysis Controls
- Execution Insights
- Attention Queue
- Project Daily Reports

#### Main Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| reportDate | Date of the report | 2026-04-27 |
| plantId | Linked plant or business unit | Project Site Plant |
| projectName | Name of the project | Highway Widening Package 3 |
| siteName | Site or work front name | Chainage 12 to 15 |
| shift | Shift or working period | Day Shift |
| weather | Weather condition | Clear |
| reportStatus | Work condition | On Track |
| progressPercent | Percent of progress | 65 |
| workDone | Work completed today | 200 cubic meter excavation |
| labourCount | Number of workers | 45 |
| machineCount | Number of machines | 6 |
| materialUsed | Material used today | 20 MM aggregate, cement |
| blockers | Problems stopping progress | Rain in one section |
| nextPlan | Next action plan | Finish base layer tomorrow |
| remarks | Extra comments | Client inspection expected |

#### Create New Record

1. Open Project Reports.
2. Go to the report entry area.
3. Fill Report Date.
4. Select Plant if the page asks for it.
5. Enter Project Name.
6. Enter Site Name.
7. Select Shift.
8. Select Weather.
9. Select Report Status.
10. Enter Progress Percent.
11. Enter today’s work in Work Done.
12. Enter Labour Count.
13. Enter Machine Count.
14. Enter Material Used.
15. Enter Blockers if any.
16. Enter Next Plan.
17. Enter Remarks.
18. Click Save.

Use Filters

1. Open Analysis Controls.
2. Search by project or site name.
3. Filter by plant if needed.
4. Filter by project if needed.
5. Filter by site if needed.
6. Filter by report status if needed.
7. Select date range.

---

### Dispatch Reports

#### Purpose

- This page is one of the most important pages in the system.
- It records dispatch activity.
- It supports billing, order linkage, transport linkage, and daily dispatch control.

#### Real-Life Example

- A dispatch team member creates a dispatch entry after material leaves the plant.
- The entry links the plant, material, party, order, vehicle, vendor, and quantity.
- Later the billing and management team can review the dispatch from the same page.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Dispatch Reports.
4. Wait for the page to load.
5. You will see the page title Dispatch Reports.

#### What You Will See

- Dispatch Workspace Health
- Dispatch Overview
- Dispatch Workspace
- Search & Filters
- Dispatch Report List


#### Main Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| dispatchDate | Dispatch date | 2026-04-27 |
| sourceType | Business source of the dispatch | Available options depend on configured workflow |
| plantId | Dispatch source plant | Main Crusher Plant |
| materialId | Material being sent | 20 MM Aggregate |
| partyId | Customer or billing party | ABC Infra |
| partyOrderId | Linked order number | PO-20260427-0001 |
| vehicleId | Vehicle used for dispatch | MH34AB1234 |
| transportVendorId | Transport vendor or transporter | XYZ Transport |
| destinationName | Destination site or customer place | Site A |
| quantityTons | Dispatch quantity in tons | 24 |
| enteredQuantity | Quantity entered in selected unit | 24 |
| enteredUnitId | Unit used for quantity entry | MT |
| quantitySource | Method used to determine dispatch quantity | Available options depend on configured workflow |
| remarks | General note | Delivered on time |
| ewbNumber | E-way bill number | EWB12345 |
| ewbDate | E-way bill date | 2026-04-27 |
| ewbValidUpto | E-way bill expiry | 2026-04-28 |
| invoiceNumber | Invoice number | INV-1023 |
| invoiceDate | Invoice date | 2026-04-27 |
| invoiceValue | Invoice amount | 48500 |
| distanceKm | Travel distance | 32 |
| otherCharge | Extra charge | 500 |
| loadingCharge | Loading charge | 300 |
| billingNotes | Billing note | Rate confirmed by sales |

#### Create New Dispatch Record

1. Open Dispatch Reports.
2. Go to Dispatch Workspace.
3. Click inside Dispatch Date.
4. Select the correct dispatch date.
5. Select the plant.
6. Select the material.
7. Select the party.
8. If an order exists, select the party order.
9. Select the vehicle.
10. Select the transport vendor if the page asks for it.
11. Enter destination name.
12. Enter quantity.
13. Choose the unit if needed.
14. Fill invoice and E-way bill details if available.
15. Fill distance and charges if applicable.
16. Enter remarks and billing notes if needed.
17. Click Save.
18. Wait for the confirmation message.
19. Check the Dispatch Report List to confirm the record appears.

#### View Record

1. Go to Dispatch Report List.
2. Find the required dispatch record.
3. Click the View or open action if shown.
4. Read the full details.

#### Edit Record

1. Find the dispatch record in the list.
2. Click Edit.
3. Update the required fields.
4. Click Save.
5. Wait for success confirmation.

#### Delete Or Cancel Record

- This workflow depends on access and status.
- Use the page action shown in the list.
- If the system asks for confirmation, read it carefully before you continue.
- Depends on deployment configuration for exact delete behavior.

#### Search

1. Open Search & Filters.
2. Type a search keyword.
3. Example keywords: party name, vehicle number, material name.
4. Wait for the page to refresh.

#### Filter

#### Available Confirmed Filter Types

- Plant filter
- Party filter
- Material filter
- Linked order filter
- Source type filter
- Status filter
- Date from
- Date to

#### Common Mistakes

- Wrong party selected
- Wrong vehicle selected
- Invoice number not entered when required by process
- Quantity entered in wrong unit
- Order not linked when commercial team expected a linked order

---

### Boulder Reports

#### Purpose

- This page tracks mine-to-crusher raw boulder movement.
- It also supports vehicle-level trip records.

#### Real-Life Example

- The team records raw boulder brought from mine to stock yard or crusher.
- Trip quantities are entered.
- Management later checks stock movement and crusher feed.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Boulder Reports.
4. Wait for the page to load.

#### What You Will See

- Boulder Snapshot
- Shift Entry Guidance
- Analysis Controls
- Shift Entry Console
- Mine-to-Crusher Vehicle Registry
- Boulder Daily Register

#### Main Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| reportDate | Report date | 2026-04-27 |
| plantId | Plant name | Quarry Plant |
| shiftId | Shift | Night Shift |
| crusherUnitId | Crusher unit | Unit 2 |
| sourceMineName | Mine source name | East Quarry |
| routeType | Movement route type | To Stock Yard |
| openingStockTons | Opening stock | 120 |
| inwardWeightTons | Total inward weight | 310 |
| directToCrusherTons | Direct to crusher quantity | 140 |
| crusherConsumptionTons | Consumption by crusher | 180 |
| closingStockTons | Closing stock | 110 |
| finishedOutputTons | Finished output | 150 |
| remarks | Notes | Smooth shift |

#### Trip Row Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| vehicleId | Vehicle used | MH31CD5678 |
| contractorNameSnapshot | Contractor name | Mine Haul Logistics |
| weighedTons | Trip weight | 18 |
| remarks | Trip note | No delay |

#### How To Enter A Shift Record

1. Open Boulder Reports.
2. Go to Shift Entry Console.
3. Select report date.
4. Select plant.
5. Select shift.
6. Select crusher unit if needed.
7. Enter source mine name.
8. Enter stock and inward values.
9. Enter crusher and output values.
10. Add vehicle trips if the screen asks for trip rows.
11. Enter remarks.
12. Click Save.

---

### Vehicles

#### Purpose

- This page manages the fleet.
- It is used for company vehicles, attached vehicles, and transporter-linked vehicles.

#### Real-Life Example

- The fleet team adds a new truck.
- The team links the truck to a plant and transporter.
- Dispatch users later select that truck during dispatch entry.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Vehicles.
4. Wait for the page to load.
5. You will see the fleet workspace.

#### What You Will See

- Workspace Health
- Workspace Controls
- Vehicle Search & Filters
- Fleet Workspace

#### Vehicle Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| vehicleNumber | Vehicle registration number | MH34AB1234 |
| vehicleType | Vehicle type | Hyva |
| assignedDriver | Driver name | Ramesh Shinde |
| status | Vehicle status | Active |
| ownershipType | Company-owned or vendor-linked | Company |
| vendorId | Linked vendor if outside vehicle | XYZ Transport |
| plantId | Assigned plant | Main Crusher Plant |
| vehicleCapacityTons | Load capacity | 24 |

#### Create New Vehicle

1. Open Vehicles.
2. Go to Fleet Workspace.
3. Click Add or open the vehicle form section.
4. Enter vehicle number.
5. Select vehicle type.
6. Enter assigned driver if available.
7. Select status.
8. Select ownership type.
9. Select vendor if it is not a company-owned vehicle.
10. Select plant assignment.
11. Enter vehicle capacity in tons.
12. Click Save.

#### Search And Filter

#### Confirmed Filters

- Vehicle search
- Ownership filter
- Status filter
- Plant filter

---

### Equipment

#### Purpose

- This page manages equipment usage logs.
- It tracks working hours or kilometer meter records.

#### Real-Life Example

- A machine operator completes a shift.
- The supervisor enters opening and closing meter readings.
- The system stores equipment usage and fuel use.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Equipment.
4. Wait for the page to load.

#### What You Will See

- Equipment Log Search & Filters
- Equipment Workspace

#### Equipment Entry Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| usageDate | Date of usage | 2026-04-27 |
| equipmentName | Equipment name | JCB 3DX |
| equipmentType | Equipment type | Loader |
| manualVehicleNumber | Manual machine number if used | EQ-001 |
| driverOperatorName | Operator name | Suresh |
| siteName | Working site | Yard A |
| openingMeterReading | Start meter reading | 1024 |
| closingMeterReading | End meter reading | 1034 |
| meterUnit | Hours or KM | Hours |
| usageHours | Total usage | 10 |
| fuelUsed | Fuel used | 35 |
| remarks | Notes | Hydraulic check done |
| plantId | Linked plant | Main Plant |

#### Create New Equipment Log

1. Open Equipment.
2. Go to Equipment Workspace.
3. Enter the usage date.
4. Enter equipment name.
5. Enter equipment type.
6. Enter operator name.
7. Enter site name.
8. Enter opening meter reading.
9. Enter closing meter reading.
10. Choose the meter unit.
11. Enter usage hours or distance if required.
12. Enter fuel used.
13. Add remarks if needed.
14. Select plant.
15. Click Save.

---

### Vendors & Transporters

#### Purpose

- This page stores external vendor and transporter details.
- It is used by operations and procurement teams.

#### Real-Life Example

- A new transporter starts working with the company.
- The office team creates the transporter record.
- Vehicles and transport rates can then be linked to that vendor.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Vendors.
4. Wait for the page to load.

#### What You Will See

- Workspace Health
- Connected Workflow
- Overview
- Workspace Controls
- Search & Filters
- Vendor Workspace

#### Vendor Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| vendorName | Vendor or transporter name | XYZ Transport |
| vendorType | Vendor category | Transporter |
| vendorTypeCustom | Custom type when Other is used | Diesel Supplier |
| contactPerson | Main contact name | Amit Sharma |
| mobileNumber | Contact mobile number | 9000000000 |
| address | Vendor address | MIDC Road, Chandrapur |

#### Create New Vendor

1. Open Vendors.
2. Go to Vendor Workspace.
3. Click Add or open the vendor form.
4. Enter vendor name.
5. Select vendor type.
6. If you choose Other, enter custom type.
7. Enter contact person.
8. Enter mobile number.
9. Enter address.
10. Click Save.

#### Common Mistakes

- No contact number
- Wrong vendor type
- Duplicate vendor record

---

### Transport Rates

#### Purpose

- This page stores plant-wise vendor transport rates.
- It supports costing and dispatch logic.

#### Real-Life Example

- A transporter charges different rates for different plants.
- The team stores the correct rate here.
- Dispatch and costing teams later use the same base rate.

#### How To Open

1. Look at the left side menu.
2. Find Logistics.
3. Click Transport Rates.
4. Wait for the page to load.

#### What You Will See

- Overview
- Search & Filters
- Costing Readiness
- Connected Workflow
- Transport Rate Workspace

#### Rate Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| plantId | Plant linked to this rate | Main Crusher Plant |
| vendorId | Transport vendor | XYZ Transport |
| materialId | Material linked to the rate | 20 MM Aggregate |
| billingBasis | How rate is charged | Per Trip |
| rateUnitId | Unit used when rate is unit-aware | MT |
| minimumCharge | Minimum transport charge | 2500 |
| rateType | Rate type used by legacy logic | Per Trip |
| rateValue | Main rate amount | 3200 |
| distanceKm | Distance in kilometers | 32 |

#### Create New Rate

1. Open Transport Rates.
2. Go to Transport Rate Workspace.
3. Select plant.
4. Select vendor.
5. Select material.
6. Choose billing basis.
7. Select unit if required.
8. Enter minimum charge if used.
9. Enter main rate value.
10. Enter distance if your company tracks route distance.
11. Click Save.

#### Search And Filter

#### Confirmed Filters

- Search
- Plant filter
- Vendor filter
- Status filter

---

### Parties

#### Purpose

- This page stores customer and billing party records.
- It is the base page for commercial work.

#### Real-Life Example

- A new buyer is added.
- The office team enters customer details.
- The commercial team later adds rates and orders for the same party.

#### How To Open

1. Look at the left side menu.
2. Find Commercial.
3. Click Parties.
4. Wait for the page to load.

#### What You Will See

- Overview
- Workspace Health
- Workspace Controls
- Search & Filters
- Party Workspace

Party Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| partyName | Customer or party name | ABC Infra Projects |
| partyCode | Internal code for the party | ABCINFRA |
| contactPerson | Main contact person | Rajesh Patil |
| mobileNumber | Contact mobile number | 9000000000 |
| gstin | GST number | 27ABCDE1234F1Z5 |
| pan | PAN number | ABCDE1234F |
| addressLine1 | Main address line | Plot 12, Market Road |
| addressLine2 | Extra address line | Near Petrol Pump |
| city | City name | Nagpur |
| stateName | State name | Maharashtra |
| stateCode | State code | 27 |
| pincode | Postal code | 440001 |
| partyType | Type of party | Customer |

#### Create New Party

1. Open Parties.
2. Go to Party Workspace.
3. Click Add or show the form.
4. Enter party name.
5. Enter party code.
6. Enter contact person.
7. Enter mobile number.
8. Enter GSTIN if available.
9. Enter PAN if available.
10. Enter address details.
11. Select party type.
12. Click Save.

#### Commercial Readiness Idea

- A party is more useful when identity, rates, and orders are complete.
- If setup is incomplete, dispatch may later stop or require manual correction.

---

### Party Material Rates

#### Purpose

- This page stores selling rates for each party and material.
- It also supports loading charge and royalty-related pricing logic.

#### Real-Life Example

- A customer has a special selling rate for one material at one plant.
- The rate is stored here.
- When dispatch is created, the commercial team can trace the agreed rate.

#### How To Open

1. Look at the left side menu.
2. Find Commercial.
3. Click Party Material Rates.
4. Wait for the page to load.

#### What You Will See

- Overview
- Search & Filters
- Commercial Readiness
- Party Material Rate Workspace

#### Rate Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| plantId | Plant where rate applies | Main Crusher Plant |
| partyId | Customer for this rate | ABC Infra |
| materialId | Material name | 20 MM Aggregate |
| billingBasis | How billing happens | Per Ton |
| rateUnitId | Unit used for billing | MT |
| pricePerUnit | Selling price per selected unit | 950 |
| conversionId | Unit conversion reference when conversion is required | System-linked when configured |
| ratePerTon | Selling price per ton | 950 |
| loadingCharge | Loading charge when applicable | Used according to configured commercial policy |
| royaltyCharge | Royalty or related commercial charge when applicable | Used according to configured commercial policy |

#### Create New Rate

1. Open Party Material Rates.
2. Go to Party Material Rate Workspace.
3. Select plant.
4. Select party.
5. Select material.
6. Choose billing basis.
7. Enter rate value.
8. Enter additional charge fields if your process uses them.
9. Click Save.

---

### Party Orders

#### Purpose

- This page keeps the customer order book.
- It tracks ordered quantity, planning, fulfillment, and pending quantity.

#### Real-Life Example

- A customer places an order for aggregate.
- The order is entered here.
- Dispatch records later reduce the pending quantity.

#### How To Open

1. Look at the left side menu.
2. Find Commercial.
3. Click Party Orders.
4. Wait for the page to load.

#### What You Will See

- Order Book Snapshot
- Order Workspace
- Search & Filters
- Party Order List

#### Order Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| orderNumber | Order number | PO-20260427-0001 |
| orderDate | Order date | 2026-04-27 |
| partyId | Customer placing order | ABC Infra |
| plantId | Source plant | Main Crusher Plant |
| materialId | Material ordered | 20 MM Aggregate |
| orderedQuantityTons | Ordered quantity | 500 |
| targetDispatchDate | Target dispatch date | 2026-04-30 |
| remarks | Notes | Priority delivery |
| status | Order status | Open |

#### Create New Order

1. Open Party Orders.
2. Go to Order Workspace.
3. Enter order date.
4. Enter or confirm order number.
5. Select party.
6. Select plant.
7. Select material.
8. Enter ordered quantity.
9. Enter target dispatch date if known.
10. Enter remarks.
11. Click Save.

#### Common Mistakes

- Wrong party selected
- Wrong material selected
- Quantity entered in wrong number
- Target dispatch date earlier than order date

---

### Commercial Exceptions

#### Purpose

- This page collects common commercial problems in one queue.
- It helps teams find missing rates, overdue orders, unlinked dispatches, and incomplete closures.

#### Real-Life Example

- A dispatch is created without a linked order.
- The issue appears in Commercial Exceptions.
- The commercial team reviews and fixes it.

#### How To Open

1. Look at the left side menu.
2. Find Commercial.
3. Click Commercial Exceptions.
4. Wait for the page to load.

#### What You Will See

- Exception Snapshot
- Filters
- Exception Queue

#### How To Use

1. Open the page.
2. Start with Exception Snapshot.
3. Review the count of problem items.
4. Use Filters to narrow the list.
5. Open the Exception Queue.
6. Review one exception at a time.
7. Follow the linked business page if the system provides a related link.

---

### Party Commercial Profile

#### Purpose

- This page works like one commercial control page for one party.
- It brings identity, rates, orders, and recent dispatches into one place.

#### Real-Life Example

- A manager wants to review one customer completely.
- The manager opens the customer commercial profile.
- The manager checks identity, rates, orders, and dispatches together.

#### What You Will See

- Commercial Snapshot
- Quick Setup Guide
- Operator Actions
- Activity Timeline
- Readiness
- Party Identity
- Material Rates
- Orders
- Recent Dispatches

#### Deployment-Dependent Behavior

- Exact navigation path from main menu for this page in daily usage
- Exact direct-create workflow from this page

---

### Purchase Requests

#### Purpose

- This page is the first procurement step.
- It is used to request materials, equipment items, spare parts, consumables, and services.

#### Real-Life Example

- A site team needs cement and diesel.
- The team creates a purchase request.
- A manager later reviews and approves it.

#### How To Open

1. Look at the left side menu.
2. Find Procurement.
3. Click Purchase Requests.
4. Wait for the page to load.

#### Main Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| requestDate | Date of request | 2026-04-27 |
| requiredByDate | Date by which item is needed | 2026-04-29 |
| vendorId | Suggested vendor if known | Shree Cement Supplier |
| requestPurpose | Reason for request | Site stock refill |
| notes | Extra notes | Urgent for morning use |

#### Line Item Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| itemSource | Whether item comes from master list or custom entry | Master |
| materialId | Material from system list | OPC Cement |
| customItemName | Custom item name if not in list | Cutting Disc |
| customItemUom | Unit of measure for custom item | Nos |
| customItemSpec | Item specification | 4 inch |
| itemCategory | Type of procurement item | Material |
| quantity | Requested quantity | 100 |
| unitRate | Estimated rate | 380 |
| description | Notes for this line | For block work |

#### Create Purchase Request

1. Open Purchase Requests.
2. Fill request date.
3. Fill required by date.
4. Select vendor if known.
5. Enter request purpose.
6. Add line items.
7. For each line, choose material or custom item.
8. Enter quantity.
9. Enter estimated unit rate if your process requires it.
10. Enter notes.
11. Click Save or Submit.

---

### Purchase Orders

#### Purpose

- This page is used after procurement approval.
- It creates official vendor orders.

#### Real-Life Example

- A purchase request is approved.
- The buying team creates a purchase order for the vendor.

#### How To Open

1. Look at the left side menu.
2. Find Procurement.
3. Click Purchase Orders.
4. Wait for the page to load.

#### Main Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| poDate | Purchase order date | 2026-04-27 |
| expectedDeliveryDate | Expected delivery date | 2026-04-30 |
| vendorId | Supplier name | Shree Cement Supplier |
| purchaseRequestId | Linked request if available | PR-1003 |
| notes | Extra notes | Deliver before noon |

#### Line Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| materialId | Material name | OPC Cement |
| itemCategory | Item category | Material |
| orderedQuantity | Quantity ordered | 100 |
| unitRate | Agreed rate | 385 |
| description | Extra notes | Fresh stock only |
| purchaseRequestLineId | Linked purchase request line | System-managed reference when applicable |

#### Create Purchase Order

1. Open Purchase Orders.
2. Enter PO date.
3. Enter expected delivery date.
4. Select vendor.
5. Select linked purchase request if the page asks for it.
6. Add line items.
7. Enter ordered quantity and unit rate.
8. Enter notes.
9. Click Save.

---

### Goods Receipts (GRN)

#### Purpose

- This page records material received against a purchase order.
- It updates received quantities.

#### Real-Life Example

- A truck brings ordered cement.
- The store or procurement team records the received quantity.

#### How To Open

1. Look at the left side menu.
2. Find Procurement.
3. Click Goods Receipts.
4. Wait for the page to load.

#### Main Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| purchaseOrderId | Purchase order being received | PO-20260427-0004 |
| vendorId | Supplier name | Shree Cement Supplier |
| receiptDate | Date of receipt | 2026-04-28 |
| notes | Receipt notes | All bags received in good condition |

#### Line Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| purchaseOrderLineId | Linked purchase order line | System-managed reference |
| materialId | Material received | OPC Cement |
| itemCategory | Item category | Material |
| receivedQuantity | Total received quantity | 100 |
| acceptedQuantity | Accepted quantity | 98 |
| rejectedQuantity | Rejected quantity | 2 |
| unitRate | Rate from order | 385 |
| remarks | Line note | 2 bags damaged |

#### Create Goods Receipt

1. Open Goods Receipts.
2. Select purchase order.
3. Wait for PO details to load.
4. Check vendor.
5. Check auto-loaded line items.
6. Enter received quantity.
7. Enter accepted quantity.
8. Enter rejected quantity if any.
9. Add remarks.
10. Click Save.

---

### Purchase Invoices

#### Purpose

- This page records supplier invoices.
- It supports PO, GRN, and invoice matching.

#### Real-Life Example

- Supplier sends invoice after delivery.
- The accounts or procurement team records the invoice.
- The system links it with the purchase order and receipt.

#### How To Open

1. Look at the left side menu.
2. Find Procurement.
3. Click Purchase Invoices.
4. Wait for the page to load.

#### Main Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| purchaseOrderId | Linked purchase order | PO-20260427-0004 |
| goodsReceiptId | Linked goods receipt | GRN-204 |
| vendorId | Supplier name | Shree Cement Supplier |
| invoiceDate | Supplier invoice date | 2026-04-28 |
| dueDate | Payment due date | 2026-05-05 |
| notes | Invoice notes | Payment after quality check |
| postToPayables | Whether invoice should move to payable workflow | Yes |

#### Line Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| purchaseOrderLineId | Linked purchase order line | System-managed reference |
| materialId | Material billed | OPC Cement |
| itemCategory | Item category | Material |
| billedQuantity | Invoice quantity | 98 |
| unitRate | Invoice rate | 385 |
| remarks | Line note | Final accepted quantity billed |

#### Create Purchase Invoice

1. Open Purchase Invoices.
2. Select purchase order.
3. Select goods receipt if available.
4. Check vendor.
5. Enter invoice date.
6. Enter due date.
7. Check line quantities.
8. Enter remarks.
9. Leave Post To Payables enabled if your finance team uses it.
10. Click Save.

---

### Accounts Dashboard

#### Purpose

- This page gives a quick finance view.
- It helps the accounts team review balances, receivables, payables, and period control.

#### How To Open

1. Look at the left side menu.
2. Find Accounts.
3. Click Accounts Dashboard.
4. Wait for the page to load.

#### What You Will See

- Finance Snapshot
- Period Control

#### Confirmed Snapshot Values

| Item | What It Means | Example |
|------|---------------|---------|
| Trial Balance Debit | Total debit side amount | ₹ 10,00,000 |
| Trial Balance Credit | Total credit side amount | ₹ 10,00,000 |
| AR Outstanding | Total receivable amount | ₹ 2,50,000 |
| AP Outstanding | Total payable amount | ₹ 1,80,000 |
| Balance Difference | Difference between debit and credit | ₹ 0 |
| Open Periods | Number of open accounting periods | 1 |

#### Available Actions

- Refresh
- Export Snapshot CSV
- Close or reopen accounting periods if permitted

#### Accounts Detailed Field Note

- The accounts module is present in the project.
- The daily accounting workflow is confirmed in code.
- Exact finance field-by-field operating policy should be reviewed with the finance process owner before training end users.

---

### Chart Of Accounts

#### Purpose

- Creates account groups, accounts, and ledgers.

#### What You Will See

- Finance Master Setup
- Create Account Group
- Create Account
- Create Ledger
- Chart and Ledgers

#### Deployment-Dependent Behavior

- Exact finance master field list to be trained for end users

---

### Ledger

#### Purpose

- Shows ledger transactions with balances.

#### What You Will See

- Ledger Filters
- Ledger Transactions

Common Use

1. Open Ledger.
2. Select the ledger or filter values.
3. Review transactions and balances.

---

### Voucher Entry

#### Purpose

- Creates journal, receipt, payment, and contra vouchers.

#### What You Will See

- Create Voucher
- Recent Vouchers
- Approval Inbox
- Recent Finance Activity

#### Deployment-Dependent Behavior

- Exact voucher approval rules for user training

---

### Accounts Receivable

#### Purpose

- Manages receivables linked to dispatch and billing.

#### What You Will See

- Dispatch Finance Control
- Open Receivables

---

### Accounts Payable

#### Purpose

- Manages supplier and party bills.

#### What You Will See

- Create Payable Bill
- Open Payables

---

### Cash / Bank

#### Purpose

- Manages bank accounts and cash or bank vouchers.

#### What You Will See

- Bank Accounts
- Cash/Bank Voucher
- Quick Balances

---

### Finance Posting Rules

#### Purpose

- Controls how source events create finance postings.

#### What You Will See

- Rules Overview
- Create Posting Rule
- Configured Rules

---

### Finance Policy Controls

#### Purpose

- Controls finance governance settings.

#### What You Will See

- Control Posture
- Policy Settings

---

### Accounting Period Controls

#### Purpose

- Closes and reopens accounting periods.

#### What You Will See

- Period Operations
- Period Compliance History

---

### Finance Reports

#### Purpose

- Provides trial balance, ageing, cash-bank books, and related finance views.

#### What You Will See

- Report Controls
- Report Output

---

### Employees

#### Purpose

- Stores employee records.
- Manages employee-related login and people information.

#### Real-Life Example

- HR adds a new employee.
- The employee is given the correct department and role.
- The employee later accesses the correct pages in the system.

#### How To Open

1. Look at the left side menu.
2. Find Administration.
3. Click Employees.
4. Wait for the page to load.

#### What You Will See

- Add Employee
- Search & Filters
- Employee List

Important Employee Fields Confirmed In Code

| Field Group | What It Means | Example |
|-------------|---------------|---------|
| Department | Employee department | Human Resources |
| Role | System role linked to access | hr |
| Designation | Job title | HR Executive |
| Status | Employment status | Active |
| Employment Type | Work type | Full Time |
| ID Proof Type | Identity proof type | Aadhaar |

#### Other Employee Detail Note

- The Employees page contains a large and detailed employee form.
- Role, department, designation, employment status, phone, email, and ID-proof related fields are confirmed in code.
- Exact full field-by-field manual text for every employee field depends on deployment configuration if your final business process uses all employee HR fields.

Basic Employee Creation Steps

1. Open Employees.
2. Go to Add Employee.
3. Enter basic identity details.
4. Select department.
5. Select system role.
6. Select designation.
7. Enter mobile number.
8. Enter email if used.
9. Select employment status.
10. Click Save.

---

### Masters

#### Purpose

- This page stores core setup data needed across the system.

#### Real-Life Example

- Before dispatch can work smoothly, the company sets up plants, materials, shifts, and vehicle types here.

#### How To Open

1. Look at the left side menu.
2. Find Administration.
3. Click Masters.
4. Wait for the page to load.

#### What You Will See

- Workspace Health
- Overview
- Workspace Controls
- Global Search & Filter
- Configuration Options
- Plants & Units
- Sub Plants & Units
- Materials
- Unit Master
- Material Unit Conversions
- Shifts
- Vehicle Types

Main Master Entry Groups

Configuration Options Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| configType | Type of option | plant_type |
| optionLabel | Display name | Crusher |
| optionValue | Saved value | crusher |
| sortOrder | Display order | 1 |

Plant Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| plantName | Plant name | Main Crusher Plant |
| plantCode | Plant code | MCP01 |
| plantType | Plant type | Crusher |
| location | Plant location | Chandrapur |
| powerSourceType | Main power source | Electricity |

Sub Plant Or Unit Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| unitName | Unit name | Unit 1 |
| unitCode | Unit code | U1 |
| location | Unit location | Yard Side |
| plantType | Unit plant type | Crusher |
| powerSourceType | Unit power source | Electricity |

Material Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| materialName | Material name | 20 MM Aggregate |
| materialCode | Material code | AGG20 |
| hsnSacCode | Tax code | 2517 |
| category | Material category | Aggregate |
| unit | Default unit | MT |
| gstRate | GST percentage | 5 |

Shift Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| shiftName | Shift name | Day Shift |
| startTime | Shift start time | 08:00 |
| endTime | Shift end time | 20:00 |

Unit Master Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| unitCode | Short unit code | MT |
| unitName | Full unit name | Metric Ton |
| dimensionType | Type of measurement | Weight |
| precisionScale | Decimal precision | 3 |
| isBaseUnit | Base unit or not | True |
| isActive | Whether unit is active | True |

Material Unit Conversion Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| materialId | Linked material | 20 MM Aggregate |
| fromUnitId | Starting unit | Brass |
| toUnitId | Target unit | MT |
| conversionFactor | Conversion value | 2.83 |
| conversionMethod | Conversion method | Standard |
| effectiveFrom | Start date | 2026-04-27 |
| effectiveTo | End date | 2026-12-31 |
| notes | Note on conversion | Standard site factor |
| isActive | Active or inactive | True |

Vehicle Type Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| typeName | Vehicle type name | Hyva |
| category | Vehicle category | Tipper |

How To Use Masters

1. Open Masters.
2. Decide which setup section you need.
3. Open that section.
4. Fill the relevant form.
5. Click Save.
6. Check that the new record appears in the list.

---

### Company Profile

#### Purpose

- This page stores the company’s legal, contact, bank, and invoice details.

#### Real-Life Example

- Before printing invoices or using company identity details, the admin updates company name, GST, bank account, and logo here.

#### How To Open

1. Look at the left side menu.
2. Find Administration.
3. Click Company Profile.
4. Wait for the page to load.

#### What You Will See

- Business Identity
- Address & Contact
- Banking & Terms
- Print Preview Snapshot

Business Identity Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| companyName | Legal company name | Demo Construction Pvt. Ltd. |
| logoUrl | Company logo image | Used when company branding is configured |
| branchName | Branch name | Chandrapur Main Branch |

#### Address And Contact Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| addressLine1 | Main address line | Plot 10, Industrial Area |
| city | City | Chandrapur |
| stateName | State | Maharashtra |
| stateCode | State code | 27 |
| pincode | Postal code | 442401 |
| gstin | GST number | 27ABCDE1234F1Z5 |
| pan | PAN number | ABCDE1234F |
| mobile | Contact mobile | 9000000000 |
| email | Contact email | office@example.com |

#### Banking And Terms Fields

| Field Name | What It Means | Example |
|------------|---------------|---------|
| bankName | Bank name | HDFC Bank |
| bankAccount | Account number | XXXXXXXXXXXX |
| ifscCode | IFSC code | DEMO0001234 |
| termsNotes | Invoice or business terms | Payment due within 7 days |

#### Update Company Profile

1. Open Company Profile.
2. Start with Business Identity.
3. Enter or update company name.
4. Update branch name.
5. Move to Address & Contact.
6. Update address and legal identity fields.
7. Move to Banking & Terms.
8. Update bank details and terms notes.
9. Click Save or Update.
10. Review Print Preview Snapshot.

---

### Plants

#### Purpose

- This page manages plant and unit records in a separate page flow.

#### What You Will See

- Add Plant / Unit
- Search & Filters
- Plant List

#### Deployment-Dependent Behavior

- Whether this page is still used in daily workflow after the larger Masters page rollout

---

### Dispatch Print

#### Purpose

- This route exists in the project.
- It is intended for dispatch-related print output.

#### Deployment-Dependent Behavior

- Exact daily user workflow for this page
- Exact fields shown in printed format

---

### Change Password

#### Purpose

- Allows a user to change password.

#### How To Use

1. Open the Change Password page when required.
2. Enter current password if the page asks for it.
3. Enter new password.
4. Confirm new password.
5. Click Save or Update Password.
6. Wait for success message.

#### Deployment-Dependent Behavior

- Exact field labels on the current screen

---

## 7. Reports

#### What Reports Mean In This System

- Reports are pages that show daily business entries in a review format.
- They also allow search, filters, and trend review.

#### Main Report Pages Confirmed

- Plants & Units Reports
- Project Reports
- Dispatch Reports
- Boulder Reports
- Finance Reports

#### How To Use Filters On Report Pages

1. Open the report page.
2. Go to the Search & Filters or Analysis Controls section.
3. Enter a search word if needed.
4. Choose the date range.
5. Choose plant, party, status, or other visible filter values.
6. Wait for the list to refresh.
7. Review the result list.

#### How To Export

1. Look for Export CSV or download button.
2. Click on it.
3. Wait for the file download.
4. Open the file from your browser download list or Downloads folder.

#### Important Note

- Export buttons are confirmed on several pages.
- Exact export format may vary by page.

---

## 8. Administration

#### Create User Through Employee Setup

#### Important Note

- In this system, employee setup and access control are connected.
- User creation is closely related to the Employees page and role assignment.

#### Basic Step-By-Step Flow

1. Open Employees.
2. Click Add Employee.
3. Enter employee identity details.
4. Select department.
5. Select role.
6. Select designation.
7. Save the employee record.
8. If login credentials are generated through your business workflow, share them through a secure method.
9. Ask the user to change the temporary password after first login.

#### Assign Role

1. Open Employees.
2. Find the employee in the Employee List.
3. Click Edit.
4. Look for the role field.
5. Select the correct role.
6. Save the changes.
7. Ask the employee to log out and log in again if access has changed.

#### Company Setup By Admin

1. Open Company Profile.
2. Update company identity, address, tax, and bank details.
3. Open Masters.
4. Configure plants, materials, shifts, units, and vehicle types.
5. Open Vendors and Parties.
6. Add outside vendors and customers.
7. Open commercial and logistics pages only after master data is ready.

---

## 9. Daily Work Guide

#### Daily Work For Dispatch Team

1. Log in to the system.
2. Open Dashboard.
3. Check Pending Dispatch.
4. Open Dispatch Reports.
5. Create new dispatch records for today’s movement.
6. Review incomplete dispatch entries.
7. Update missing invoice or transport details.
8. Log out after work is complete.

#### Daily Work For Plant Team

1. Log in to the system.
2. Open Dashboard.
3. Open Plants & Units Reports.
4. Enter daily plant production data.
5. Check breakdown or expense values.
6. Save the report.

#### Daily Work For Site Team

1. Log in to the system.
2. Open Project Reports.
3. Enter project progress.
4. Record blockers and next plan.
5. Save the report.

#### Daily Work For Commercial Team

1. Open Dashboard.
2. Review Commercial Control Queue if visible.
3. Open Commercial Exceptions.
4. Fix missing rates or order gaps.
5. Open Party Orders and Party Material Rates as needed.

#### Daily Work For Procurement Team

1. Open Purchase Requests.
2. Review new requests.
3. Create or update purchase orders.
4. Enter goods receipts when materials arrive.
5. Enter purchase invoices after supplier billing.

Daily Work For Admin Or HR

1. Open Employees.
2. Add or update employees if needed.
3. Open Masters for setup changes.
4. Open Company Profile for identity or invoice detail updates.

Weekly Review

1. Review Dashboard trends.
2. Review pending dispatches.
3. Review overdue orders.
4. Review vendor and party setup quality.
5. Review plant and project reporting gaps.
6. Review audit logs if a control check is needed.

Monthly Review

1. Check company profile details.
2. Review active and inactive employees.
3. Review transport rates and party material rates.
4. Review purchase and invoice workflow completion.
5. Review finance reports if accounts module is active.

---

## 10. Training

New User Training Plan

Day 1

- Learn login
- Learn logout
- Understand the left menu
- Understand the top header
- Open Dashboard
- Read summary cards

Practice Task For Day 1

- Log in
- Open Dashboard
- Identify Pending Dispatch
- Log out

Day 2

- Open one main daily page
- Learn search
- Learn filters
- Learn how to read list data

Practice Task For Day 2

- Open Dispatch Reports or Plants & Units Reports
- Use search
- Use one filter
- Clear the filter

Day 3

- Learn full create workflow
- Learn edit workflow
- Learn status review

Practice Task For Day 3

- Create one sample record
- Open the saved record
- Edit one field
- Save again

Day 4

- Learn linked workflow
- Example: Party -> Rate -> Order -> Dispatch
- Example: Purchase Request -> Purchase Order -> Goods Receipt -> Purchase Invoice

Day 5

- Review common mistakes
- Review troubleshooting steps
- Review secure password handling

---

## 11. Troubleshooting

Issue: Cannot Login

Solution

1. Check that you are on the correct login page.
2. If you are a client user, confirm the company code first.
3. Check username carefully.
4. Check password carefully.
5. Remember that uppercase and lowercase letters matter.
6. Try again.
7. If it still fails, contact your system administrator.

Issue: Company Code Not Working

Solution

1. Open the client login page again.
2. Enter the company code exactly as shared.
3. Remove extra spaces before or after the code.
4. Try again.
5. If it still fails, contact the person who shared the credentials.

Issue: Record Does Not Save

Solution

1. Check required fields.
2. Look for empty fields.
3. Check number fields for wrong format.
4. Check date fields.
5. Try saving again.

Issue: Filter Shows No Data

Solution

1. Clear the search box.
2. Clear all filters.
3. Check the date range.
4. Reload the page.

Issue: Wrong Menu Items Visible

Solution

1. Check the signed-in account.
2. Check the user role.
3. Check module access.
4. Log out and log in again.
5. Contact admin if access is still wrong.

Issue: Download Does Not Start

Solution

1. Click the export button once.
2. Wait a few seconds.
3. Check your Downloads folder.
4. Check if the browser blocked the download.

Issue: Data Looks Incomplete

Solution

1. Click Refresh if available.
2. Clear filters.
3. Check whether the record is active or inactive.
4. Check whether linked master data is missing.

---

## 12. Frequently Asked Questions

Question: Which login should I use?

Answer:

- Use Owner Login only for owner console users.
- Use Client Login for company users.

Question: Why do I not see some menu items?

Answer:

- Your role or module access may not allow those pages.

Question: Can I edit saved records?

Answer:

- Yes, if your role is allowed and the page supports editing.

Question: Can I delete records?

Answer:

- Some pages support delete or status change.
- Access rules apply.

Question: What if I enter wrong data?

Answer:

- Open the record.
- Use Edit if allowed.
- Save the corrected value.

Question: Who should use Audit Logs?

Answer:

- Owner users, admins, or reviewers who need activity traceability.

Question: What should be configured first in a new company?

Answer:

- Company Profile
- Masters
- Vendors
- Parties
- Commercial rates
- Orders
- Then daily operations

---

## 13. Glossary

Dispatch

- A record of material sent from one place to another.

Party

- A customer or billing entity.

Vendor

- An outside supplier, transporter, agency, or service provider.

Plant

- A production or operating location.

Unit

- A sub-section inside a plant or a measurement unit, depending on page context.

Shift

- A working time block such as day shift or night shift.

Purchase Request

- An internal request to buy an item or service.

Purchase Order

- An official order placed with a vendor.

Goods Receipt

- A confirmation that ordered goods have been received.

Purchase Invoice

- A supplier bill linked to purchased goods or services.

Receivable

- Money the company should receive.

Payable

- Money the company should pay.

Audit Log

- A system record of user and workflow actions.

Commercial Exception

- A business warning such as missing rate, overdue order, or unlinked dispatch.

---

## 14. Appendix

#### Application

- Live demo: https://infraflow-erp-ten.vercel.app

#### Owner Login

- Use the owner login flow provided by the deployed application.

#### Client Login

- Client users enter their assigned company code before authentication.

#### Support

- Deployment-specific support details should be provided by the organization operating the system.

#### Version

- Production manual prepared from project codebase on 27 Apr 2026

#### Date

- 27 Apr 2026

#### Confirmed Frontend Pages In The Project

- Login
- Owner Login
- Client Login
- Forgot Password
- Dashboard
- Employees
- Plants & Units Reports
- Project Reports
- Dispatch Reports
- Boulder Reports
- Vehicles
- Equipment
- Change Password
- Masters
- Vendors
- Transport Rates
- Party Material Rates
- Party Orders
- Purchase Requests
- Purchase Orders
- Goods Receipts
- Purchase Invoices
- Commercial Exceptions
- Party Commercial Profile
- Dispatch Print
- Company Profile
- Tenant Onboarding
- Parties
- Audit Logs
- Accounts Dashboard
- Chart of Accounts
- Ledger
- Voucher Entry
- Receivables
- Payables
- Cash / Bank
- Posting Rules
- Policy Controls
- Period Controls
- Finance Reports

#### Confirmed Main Backend Service Areas In The Project

- Auth
- Employees
- Plants & Units Reports
- Project Reports
- Dispatch Reports
- Dashboard
- Vehicles
- Masters
- Vendors
- Plants
- Transport Rates
- Party Material Rates
- Company Profile
- Parties
- Party Orders
- Audit Logs
- Onboarding
- Boulder Reports
- Purchase Requests
- Purchase Orders
- Goods Receipts
- Purchase Invoices
- Accounts Masters
- Accounts General Ledger
- Accounts Journal Vouchers
- Accounts Receivables
- Accounts Payables
- Accounts Cash-Bank
- Accounts Posting Rules
- Accounts Reports
- Health
- Ready

---

## Documentation Summary

#### What This Manual Covers

- Login and logout
- Screen layout
- Roles and module access
- Dashboard
- Owner control
- Logistics pages
- Commercial pages
- Procurement pages
- Administration pages
- Accounts page overview
- Daily work guidance
- Training guidance
- Troubleshooting
- Frequently asked questions
- Simple glossary
- Confirmed page and service list

What Deployment-Dependent Behavior

- Production URLs may vary by deployment
- Support ownership and escalation contacts vary by organization
- Advanced finance workflows should follow the organization's approved accounting policy
- Dispatch source and quantity-source options may vary with operational configuration
- Unit-conversion behavior depends on configured material and unit masters
- Delete, cancellation, and status-transition behavior depends on permissions and workflow state
- Dispatch print layout and process may vary by deployment
- Employee fields used in practice depend on the organization's HR process

#### Manual Quality Note

- This manual was prepared from the real project codebase.
- Real page names, real module names, real role names, and real field names were used where confirmed.
- Configuration-dependent behaviors are identified without exposing environment-specific implementation details.
