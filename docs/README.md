# Construction ERP Documentation Hub

## Document Control
- Hub ID: `ERP-DOC-HUB-001`
- Version: `2.0`
- Date: `2026-04-18`
- Status: `Official`
- Owner: Product + Engineering

## Purpose
This hub is the single entry point for all project documentation. It removes ambiguity between working drafts and official handover documents.

## How To Use This Hub
1. Start with **Core Handover Set**.
2. Open only the guide matching your role.
3. Use **Evidence and Checklists** before go-live.
4. Treat **Legacy/Archive** docs as historical context only.

## Core Handover Set (Official)

### Business and Operations
1. `docs/CLIENT-HANDOVER-PACKET.md`
2. `docs/CLIENT-HANDOVER-PACKET-HI.md`
3. `docs/user-manual-bilingual-professional.md`
4. `docs/company-operations-guide-professional.md`
5. `docs/company-operations-guide-hi.md`
6. `docs/finance-accounts-guide.md`
7. `docs/role-permission-guide.md`

### Technical and Implementation
1. `docs/developer-guide-professional.md`
2. `docs/system-architecture-module-guide.md`
3. `docs/developer-new-client-handover-quickstart.md`
4. `docs/developer-new-client-handover-quickstart-hi.md`
5. `docs/COMPANY-HIERARCHY-SAFE-UPGRADE-PLAN-2026-04-26.md`

### Deployment and Runtime
1. `docs/low-cost-production-deployment.md`
2. `docs/oracle-cloud-free-tier-deployment-runbook.md`
3. `docs/finance-concurrency-docker-runbook.md`
4. `docs/RENDER-BACKEND-VERCEL-FRONTEND-FREE-DEMO-PLAN-2026-04-22.md`

### Go-Live and Stabilization
1. `docs/GO-LIVE-MASTER-CHECKLIST.md`
2. `docs/go-live-first-7-days-checklist.md`
3. `docs/faq-troubleshooting-reference.md`
4. `docs/operations-section-wise-troubleshooting.md`
5. `docs/operations-section-wise-troubleshooting-hi.md`
6. `docs/COMPANY-HIERARCHY-SAFE-UPGRADE-PLAN-2026-04-26.md`

### UAT and Evidence
1. `docs/masters-role-uat-checklist.md`
2. `docs/masters-release-checklist.md`
3. `docs/masters-uat-evidence-2026-04-17.md`
4. `docs/finance-uat-flow-2026-04-18.md`
5. `docs/finance-production-hardening-report-2026-04-18.md`
6. `docs/finance-rollout-evidence-2026-04-18.md`

### Phase-1 Expansion Planning
1. `docs/PHASE1-ERP-EXPANSION-ROADMAP-2026-04-22.md`
2. `docs/PHASE1-SPRINT-BACKLOG-2026-04-22.md`
3. `docs/PHASE1-SPRINT-BACKLOG-IMPORT-2026-04-22.csv`
4. `docs/PHASE2-PROCUREMENT-IMPLEMENTATION-REPORT-2026-04-22.md`
5. `docs/ERP-COMPLETE-GAP-AUDIT-2026-04-22.md`
6. `docs/PROCUREMENT-UAT-GO-LIVE-CHECKLIST-2026-04-22.md`
7. `docs/PROCUREMENT-TRAINING-MODE-QUICKSTART-2026-04-22.md`

## Legacy / Archive (Not Primary)
These are retained for reference continuity and backward links:
- `docs/company-operations-guide.md`
- `docs/developer-guide.md`

Rule:
- Do not use legacy files for new onboarding or sign-off decisions.
- Use the professional/canonical guides listed above.

## Quality Standard for Documentation Updates
Every new or edited document must:
- include document control block (ID, version, date, status)
- clearly state target audience and purpose
- avoid duplicate scope of another official guide
- identify whether it is official or legacy
- remain consistent with implemented backend/frontend behavior
