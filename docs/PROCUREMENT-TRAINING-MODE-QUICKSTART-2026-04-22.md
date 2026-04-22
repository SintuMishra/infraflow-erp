# Procurement Training Mode Quickstart

## Document Control
- Document ID: `ERP-PROC-TRAINING-2026-04-22`
- Version: `1.0`
- Date: `2026-04-22`
- Status: `Official`
- Audience: Purchase team, site manager, finance team

## What This Module Does
Procurement controls buying flow from need to payment for:
- Material
- Equipment
- Spare parts
- Consumables
- Services

Flow:
1. `Purchase Request (PR)` = what we need.
2. `Purchase Order (PO)` = what we ordered.
3. `Goods Receipt (GRN)` = what actually arrived.
4. `Purchase Invoice` = what vendor billed.
5. `Accounts Payable` = what finance will pay.

## Why Two Dates In Forms
Two dates are intentional and required for control:
1. `Request Date / PO Date / Invoice Date` = transaction document date.
2. `Required By / Expected Delivery / Due Date` = operational deadline or payment commitment date.

This separation helps:
- Delay tracking (planned vs actual).
- Vendor performance measurement.
- Cash-flow planning and payable aging.

System-enforced rules:
- `Required By Date >= Request Date`
- `Expected Delivery Date >= PO Date`
- `Receipt Date >= PO Date`
- `Payment Due Date >= Invoice Date`

## Training Example (One Full Cycle)
Use this sample:
- Item Category: `spare_part`
- Item: `20mm Aggregate` (from master catalog)
- Vendor: `Shree Stone Supplies` (optional at PR stage, required at PO stage)
- Required Qty: `10 tons`
- PO Rate: `₹100/ton`
- Expected Amount: `₹1,000`

## Step 0: Before Starting
Ensure these masters exist:
1. Item exists in `Masters` (material master is used as item catalog).
2. Vendor exists in `Vendors` (needed before PO creation).
If missing, create them first.

## Step 1: Create Purchase Request
Page: `Procurement -> Purchase Requests`

1. Click `Create Purchase Request`.
2. Fill:
   - `Request Date`
   - `Required By Date`
   - `Vendor` (optional)
   - `Request Purpose`
3. Add line:
   - Item Category: `spare_part` (or material/equipment/consumable/service)
   - Item Source:
     - `From Master` for existing item
     - `New Custom Item` when item is not in master
   - If custom item, enter:
     - `Custom item name`
     - `Unit`
     - `Specification`
   - Qty: `10`
   - Unit Rate: `100`
4. Add supplier quotations for same line:
   - Multiple quote rows allowed
   - Vendor master selection optional
   - Manual supplier name/contact supported
   - Capture quoted rate and lead time
   - Mark one quote as `Select` when preferred
5. Save.
6. Click `Submit`.
7. Click `Approve`.

Expected:
- PR status moves: `draft -> submitted -> approved`.

## Step 2: Create Purchase Order
Page: `Procurement -> Purchase Orders`

1. Click `Create Purchase Order`.
2. Select:
   - `Vendor`
   - Optional PR link: choose the PR from Step 1.
3. Add line with same values:
   - Item Category: `spare_part`
   - Item: `20mm Aggregate`
   - Ordered Qty: `10`
   - Unit Rate: `100`
4. Save.
5. Click `Submit`.
6. Click `Approve`.

Expected:
- PO status moves: `draft -> submitted -> approved`.

## Step 3: Record Goods Receipt (GRN)
Page: `Procurement -> Goods Receipts`

Scenario A (full receipt):
1. Select PO.
2. For line, enter:
   - Received Qty: `10`
   - Accepted Qty: `10`
   - Rejected Qty: `0`
3. Save GRN.

Expected:
- PO line received quantity updates.
- PO status becomes `closed` when full quantity received.

Scenario B (partial receipt):
1. Enter Accepted Qty `6`.
2. Save.
Expected:
- PO status becomes `partially_received`.

## Step 4: Create Purchase Invoice
Page: `Procurement -> Purchase Invoices`

1. Click `Create Purchase Invoice`.
2. Select:
   - PO
   - Optional GRN link
   - Vendor
3. Add invoice line:
   - Billed Qty
   - Unit Rate
4. Save.

Match outcomes:
1. `matched`: qty/rate aligned with PO + received balance.
2. `variance`: rate differs from PO rate.
3. `blocked`: billed qty exceeds received-not-invoiced qty.

Important:
- `blocked` invoice cannot post to payable.

## Step 5: Post to Accounts Payable
From `Purchase Invoices`:
1. If invoice is not blocked, click `Post to AP` (or auto-post if enabled).

Then go to `Accounts -> Payables`:
1. Find payable created from invoice.
2. Settle payment when paid.

Expected:
- Payable outstanding decreases.
- On full payment status becomes `settled`.

## Common Mistakes and Fix
1. Vendor dropdown empty in PR:
   - PR can still be created without vendor.
   - Vendor is mandatory at PO stage, so create vendor before PO.
2. Failed to fetch purchase requests:
   - Procurement migrations not applied or backend not restarted.
   - Run backend migrations and restart backend.
3. Invoice blocked:
   - Billed qty is more than received qty.
   - Correct billed qty or create remaining GRN first.
4. Custom item from PR not appearing in PO auto-fill:
   - PO requires master-linked item.
   - Create item in `Masters` and update PR line to master item before PO creation.

## Quick Practice Checklist
- Create 1 PR.
- Create 1 PO from that PR.
- Create 1 full GRN.
- Create 1 matched invoice and post to AP.
- Settle payable in accounts.

If all done, your procurement flow is working correctly.
