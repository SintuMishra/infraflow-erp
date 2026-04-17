# Construction ERP - Developer Quick Start (Hindi) for New Client Handover

## डॉक्यूमेंट कंट्रोल
- Document ID: `ERP-DEV-QUICKSTART-HI-001`
- Version: `1.0`
- Date: `2026-04-17`
- Audience: Implementation Engineer, DevOps, Technical Support
- Classification: Internal Technical

## उद्देश्य
हर नए क्लाइंट tenant के onboarding और secure handover के लिए इस one-page checklist का उपयोग करें।

## 1) प्री-सेटअप (Tenant बनाने से पहले)
1. signed commercial agreement और legal company name verify करें।
2. target go-live date, support contacts और escalation owner confirm करें।
3. production env verify करें:
- `ONBOARDING_BOOTSTRAP_SECRET` configured है
- `PLATFORM_OWNER_COMPANY_ID` आपकी platform-owner tenant id पर set है
- frontend `VITE_PLATFORM_OWNER_COMPANY_ID` backend owner id से match करता है
- DB migrations updated हैं (`npm run migrate`)
- backup + restore readiness available है (snapshot + PITR)
4. owner-lock verification चलाएं:
- `cd backend && npm run verify:owner-lock`

## 2) Tenant Bootstrap (Internal Team Only)
1. Tenant Onboarding screen खोलें (सिर्फ internal team)।
2. exact legal company name और verified owner details दर्ज करें।
3. `x-bootstrap-secret` के साथ bootstrap चलाएं।
4. generated values secure note में रिकॉर्ड करें:
- company code
- owner username
- temporary password
5. onboarding event का audit log verify करें।
6. handover के लिए company login URL तैयार करें:
- `/client-login/{companyCode}` (उदाहरण: `/client-login/ACME_ROCK`)
- fallback entry page `/client-login` भी शेयर करें जहां company code manual दर्ज किया जा सके

## 3) Secure Credential Handover
1. username/password सिर्फ approved secure channel से share करें।
2. username और password अलग माध्यम से share करना बेहतर है।
3. owner से first login के बाद immediate password change करवाएं।
4. password-change completion confirm करें।
5. owner portal अलग रखें:
- internal owner access URL: `/owner-login`
- client operational users को owner URL share न करें

## 4) Baseline Configuration (Day 0)
1. Company Profile: legal details, GST/PAN, print header validation।
2. Masters: plants/units, materials, vehicles, mandatory references।
3. Users/Roles: manager/hr/ops accounts setup as per org chart।
4. Commercial: parties, rates, order flow readiness।
5. Dispatch print: logo + company details professional print check।

## 5) UAT और Sign-off
1. role-wise UAT execute करें (`super_admin`, `manager`, `hr`, read-only role)।
2. एक full flow run करें:
- order -> dispatch -> closure -> print -> audit visibility
3. critical findings close करें।
4. UAT evidence capture करके sign-off लें।

## 6) Go-Live Execution
1. go-live window और expected impact पहले announce करें।
2. pre-release backup snapshot लें।
3. final checks करें:
- backend health/ready
- frontend build active
- auth + company-scope validation
4. client users के लिए operations enable करें।

## 7) First 7-Day Hypercare
1. daily dashboard + commercial exceptions review।
2. daily audit review (sensitive actions)।
3. P0/P1 issues same-day resolve करें।
4. issue log में RCA + fix release reference maintain करें।

## 7A) Client Billing और Access Control (Owner Only)
1. `Tenant Onboarding` में `Client Access Control` सेक्शन खोलें।
2. company name/code से client खोजें और identity fields verify करें।
3. payment overdue होने पर:
- `Suspend Login Access` क्लिक करें
- reason दर्ज करें (audit trail के लिए)
4. payment clear होने पर:
- `Reactivate Login Access` क्लिक करें
- optional note दर्ज करें
5. outcome verify करें:
- suspended client `/client-login/{companyCode}` से login न कर सके
- सभी access changes audit logs में trace हों

## 8) Safe Update Rules (No Data Loss)
1. forward-only migrations follow करें।
2. backward-compatible rollout prefer करें।
3. production में destructive ad-hoc SQL न चलाएं।
4. release के बाद critical data counts verify करें।
5. severe issue पर app rollback करें; DB rollback सिर्फ pre-planned strategy से करें।

## 9) Client Handover Package
1. `docs/CLIENT-HANDOVER-PACKET.md` / `docs/CLIENT-HANDOVER-PACKET-HI.md`
2. `docs/company-operations-guide-professional.md`
3. `docs/company-operations-guide-hi.md`
4. support escalation matrix
5. signed UAT + go-live record

## 10) Completion Gate (All YES Required)
- Tenant isolation verified: YES/NO
- Secure credential handover done: YES/NO
- First login password changed: YES/NO
- Business + Ops + Technical sign-off done: YES/NO
- Backup/restore readiness verified: YES/NO
- Day 0-7 hypercare owner assigned: YES/NO
