# Construction ERP - Company Operations Guide (Hindi)

## डॉक्यूमेंट कंट्रोल
- डॉक्यूमेंट ID: `ERP-OPS-GUIDE-HI-001`
- वर्ज़न: `1.1`
- तारीख: `2026-04-17`
- उपयोगकर्ता: कंपनी ओनर, मैनेजर, HR/Admin, सुपरवाइज़र, साइट इंजीनियर

## 1. उद्देश्य
यह गाइड कंपनी की टीम को ERP सिस्टम को सही, सुरक्षित और प्रोफेशनल तरीके से चलाने के लिए बनाई गई है।

## 2. सिस्टम से मिलने वाले मुख्य लाभ
- रोज़ाना ऑपरेशन और प्रोजेक्ट की स्पष्ट विज़िबिलिटी
- डिस्पैच से प्रिंट तक नियंत्रित बिलिंग फ्लो
- मास्टर डेटा की क्वालिटी और टैक्स कम्प्लायंस
- रेट, ऑर्डर और एक्सेप्शन पर बेहतर कंट्रोल
- ऑडिट लॉग के माध्यम से जवाबदेही

## 3. रोल के हिसाब से जिम्मेदारियां
### Super Admin
- सभी मॉड्यूल पर पूर्ण नियंत्रण
- अंतिम अनुमोदन और सिस्टम पॉलिसी

### Manager
- ऑपरेशन + कमर्शियल कंट्रोल
- डिस्पैच, रेट, मास्टर क्वालिटी मॉनिटरिंग

### HR/Admin
- कर्मचारी और लॉगिन प्रबंधन
- मास्टर/एडमिन अपडेट में सपोर्ट

### Crusher Supervisor
- ऑपरेशनल रिपोर्टिंग और डिस्पैच विज़िबिलिटी
- संवेदनशील एडमिन सेक्शन में सीमित बदलाव अधिकार

### Site Engineer
- प्रोजेक्ट रिपोर्टिंग और साइट विज़िबिलिटी
- संवेदनशील एडमिन सेक्शन में सीमित बदलाव अधिकार

## 4. Go-Live सेटअप का सही क्रम
1. कंपनी ओनर ऑनबोर्डिंग
2. कंपनी प्रोफाइल और लोगो सेटअप
3. कर्मचारी और लॉगिन बनाना
4. Masters सेटअप:
   - Plants & Units
   - Sub Plants & Units
   - Materials
   - Shifts
   - Vehicle Types
5. Vendors और Parties सेटअप
6. Transport Rates और Party Material Rates सेटअप
7. Party Orders बनाना
8. Vehicles लिंक करना
9. ट्रायल डिस्पैच और प्रिंट टेस्ट
10. Audit Logs और Dashboard वैलिडेशन

### Tenant Onboarding कंट्रोल SOP (अनिवार्य)
- onboarding केवल internal टीम द्वारा logged-in `super_admin` से किया जाए
- onboarding menu/route केवल platform-owner tenant configuration में ही दिखेगा
- हर onboarding रन में valid bootstrap secret (`x-bootstrap-secret`) आवश्यक है
- bootstrap secret को client ऑपरेशन users के साथ साझा न करें
- onboarding के बाद credentials सिर्फ secure channel से दें
- tenant activation से पहले first login और mandatory password change verify करें
- onboarding approval reference internal tracker में रिकॉर्ड करें

## 5. Daily SOP (रोज़ का काम)
### सुबह
- Dashboard और Exception देखना
- Plant/Project रिपोर्ट एंट्री की जांच
- Dispatch readiness चेक

### दिन में
- Dispatch create/update करना
- Party order linkage सही रखना
- Pending/blocked records मॉनिटर करना

### दिन के अंत में
- लंबित रिकॉर्ड क्लोज़ करना
- प्रिंट और बिलिंग फ़ील्ड जांचना
- Audit logs में संवेदनशील बदलाव देखना

## 6. Masters उपयोग के नियम
- डुप्लिकेट material code/name न रखें
- HSN/SAC खाली न छोड़ें (टैक्स-फेसिंग मैटेरियल के लिए)
- कम से कम 1 active shift, vehicle type, sub plant/unit रखें
- Workspace Health में diagnostics नियमित चलाएं

## 7. Commercial Control SOP
- रेट्स और ऑर्डर्स को approved sheet से match रखें
- Transport rate और Material selling rate अलग रखें
- Required billing fields पूरे होने से पहले dispatch complete न करें

## 8. Company Profile और Print Control
- कंपनी का legal नाम और tax details सही रखें
- approved logo ही उपयोग करें
- profile बदलने के बाद print output validate करें

## 9. Weekly Checklist
1. डुप्लिकेट master entries चेक
2. missing HSN/SAC चेक
3. active shifts/vehicle/sub-units चेक
4. rates और orders consistency चेक
5. audit log review

## 10. Month-End Checklist
1. dispatch reconciliation
2. commercial exceptions closure
3. party order pending review
4. tax fields और print header check
5. manager/super admin sign-off

## 11. Issue Escalation
### Level 1 (Operations Lead)
- data entry issues

### Level 2 (Manager/Admin)
- role/access या process conflicts

### Level 3 (Technical Team)
- app/API errors, deployment issues

Escalation में यह जानकारी दें:
- user role
- module/page
- error message
- time + screenshot

विस्तृत troubleshooting दस्तावेज़:
- `docs/operations-section-wise-troubleshooting.md`
- `docs/operations-section-wise-troubleshooting-hi.md`
- `docs/developer-new-client-handover-quickstart.md`
- `docs/developer-new-client-handover-quickstart-hi.md`

## 12. Security Rules
- credentials शेयर न करें
- role-based discipline follow करें
- कर्मचारी exit पर access तुरंत disable करें
- mandatory password change समय पर करें

## 13. Go-Live Acceptance
- role access validated
- एक full dispatch lifecycle सफल
- masters diagnostics acceptable
- audit trail verified

## 14. Sign-off
- Operations Owner:
- Admin Owner:
- Technical Owner:
- Go-live Date:
- Final Status: PASS / HOLD
