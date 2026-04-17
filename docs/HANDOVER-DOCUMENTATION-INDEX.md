# Construction ERP - Documentation Handover Index

## Document Control
- Document ID: `ERP-DOC-INDEX-001`
- Version: `1.2`
- Date: `2026-04-17`
- Owner: Project Technical Team

## Purpose
This index defines the official documentation pack for project handover and production operations.

## Primary Handover Packet
Use these as the first documents in handover communication:

1. `docs/CLIENT-HANDOVER-PACKET.md` (English)
2. `docs/CLIENT-HANDOVER-PACKET-HI.md` (Hindi)

## A. Developer / Technical Pack
Share with: engineering, DevOps, QA, support teams

1. `docs/developer-guide-professional.md`
- Primary technical reference
- architecture, modules, environment, deployment, testing, troubleshooting

2. `docs/developer-new-client-handover-quickstart.md`
- one-page onboarding and handover execution runbook for each new client tenant

3. `docs/developer-new-client-handover-quickstart-hi.md`
- Hindi quickstart runbook for bilingual technical handover teams

4. `docs/masters-role-uat-checklist.md`
- detailed role-by-role UAT for Masters

5. `docs/masters-uat-evidence-2026-04-17.md`
- latest executed UAT evidence snapshot

6. `docs/masters-release-checklist.md`
- pre-deploy, deploy, post-deploy and rollback checklist

7. `docs/go-live-first-7-days-checklist.md`
- hypercare and stabilization checklist for first 7 days

8. `docs/GO-LIVE-MASTER-CHECKLIST.md`
- final go/no-go gate for business + operations + technical sign-off

## B. Company / Client Pack
Share with: owner, management, operations, commercial, HR/admin

1. `docs/company-operations-guide-professional.md`
- primary client-facing operations SOP (English)

2. `docs/company-operations-guide-hi.md`
- Hindi operations guide for field/office users

3. `docs/operations-section-wise-troubleshooting.md`
- detailed section-by-section issue resolution (English)

4. `docs/operations-section-wise-troubleshooting-hi.md`
- detailed section-by-section issue resolution (Hindi)

## C. Legacy / Working Draft Files
These exist for drafting continuity and internal comparison:
- `docs/developer-guide.md`
- `docs/company-operations-guide.md`

Recommendation:
- for official handover, use the **professional** guides only.

## D. Handover Delivery Sequence (Recommended)
1. Share client handover packet (EN/HI) with leadership and operations owner.
2. Conduct walkthrough of role responsibilities and daily SOP.
3. Share developer pack with technical counterpart.
4. Execute go-live checklist and sign-off.
5. Run first-week hypercare checklist during Day 0-Day 7.

## E. Sign-off Matrix
- Business Owner Sign-off: ________
- Operations Owner Sign-off: ________
- Technical Owner Sign-off: ________
- Handover Date: ________
- Go-Live Decision: PASS / HOLD

## F. Versioning Rule
- Any production process or permission change must update:
  1. developer guide
  2. company operations guide
  3. release checklist (if deployment impact exists)
