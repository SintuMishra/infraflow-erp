# Construction ERP - Section-wise Troubleshooting Playbook (Hindi)

## डॉक्यूमेंट कंट्रोल
- Document ID: `ERP-OPS-TS-HI-001`
- Version: `1.0`
- Date: `2026-04-17`

## उपयोग कैसे करें
1. जिस module में issue है, वही section खोलें।
2. symptom match करें।
3. दिए गए checks क्रम से करें।
4. resolve न हो तो escalation payload के साथ raise करें।

## Escalation Payload
- User role
- Module/page
- क्या action किया
- Exact error text
- Date/time
- Screenshot
- Request ID (अगर दिखे)

## 1. Login Issues
### “Invalid username or password”
- username/identifier verify करें
- password/caps lock check करें
- account active है या नहीं, admin से verify करें

### “Password change required”
- Change Password पूरा करें
- फिर login करें

### “Company scope mismatch”
- logout/login करें
- सही company account से login करें

## 2. Dashboard Issues
### Cards नहीं लोड हो रहे
- page refresh करें
- network/server status check करें
- technical team से health verify कराएं

### Data outdated लग रहा है
- source module में status/filter check करें
- save success confirm करें

## 3. Plant/Project Reports
### Submit नहीं हो रहा
- mandatory fields भरें
- date/plant/project सही चुनें
- role permission check करें

## 4. Dispatch Issues
### Completed नहीं हो रहा
- required billing fields भरें
- party order linkage check करें
- invoice/tax values validate करें

### Vehicle available नहीं है
- vehicle active है या नहीं
- current status busy तो नहीं
- vendor linkage verify करें

## 5. Dispatch Print Issues
### Company details/logo missing
- company profile save status check करें
- logo reload के बाद visible है या नहीं
- print दोबारा generate करें

### Print alignment खराब
- browser zoom 100% रखें
- standard A4 print setting use करें

## 6. Masters Issues
### View हो रहा है, edit नहीं
- यह role-based read-only हो सकता है (expected)
- admin से role confirm करें

### Duplicate या validation error
- duplicate name/code check करें
- GST range/HSN rule format check करें

### Diagnostics warnings
- missing HSN/SAC ठीक करें
- duplicate codes हटाएँ
- active shift/vehicle/sub-unit उपलब्ध रखें

## 7. Vendors / Parties
### Create/Edit blocked
- role permission check करें
- required fields भरें
- duplicate records verify करें

## 8. Rates Issues
### Dispatch में rate नहीं आ रहा
- rate record active है या नहीं
- plant/party/vendor/material mapping exact है या नहीं

### गलत rate लग रहा
- duplicate/overlap rates check करें
- पुराने rates deactivate करें

## 9. Party Orders
### Status change blocked
- linked dispatch restrictions check करें
- pending qty condition check करें

## 10. Vehicles
### Status update fail
- linked dispatch/order lock check करें
- references valid हैं या नहीं

## 11. Employees/Access
### Login create नहीं हो रहा
- employee active होना चाहिए
- role assignment allowed होना चाहिए

### Unauthorized redirect
- role entitlement check करें
- admin से access confirm करें

## 12. Company Profile
### Save fail
- legal/tax format validate करें
- logo size/format check करें

### Print में update reflect नहीं
- refresh करें
- save success message confirm करें

## 13. Audit Logs
### Activity नहीं दिख रही
- filters/date range check करें
- action successful था या नहीं confirm करें

## 14. Immediate Escalation Cases
P0/P1 raise करें अगर:
- सभी users login नहीं कर पा रहे
- dispatch critical flow पूरी तरह block है
- print invoicing के लिए unusable है
- company mismatch या security issue दिखे

## 15. First-Aid Steps
1. refresh
2. logout/login
3. role/active status verify
4. active record mapping check
5. minimal valid input से retry
6. screenshot + error के साथ escalation करें
