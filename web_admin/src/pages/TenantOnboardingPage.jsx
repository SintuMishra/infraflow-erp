import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10,15}$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const STATE_CODE_PATTERN = /^\d{1,2}$/;
const PINCODE_PATTERN = /^\d{6}$/;

const INITIAL_FORM = {
  bootstrapSecret: "",
  companyName: "",
  branchName: "",
  ownerFullName: "",
  ownerMobileNumber: "",
  ownerDesignation: "",
  ownerDepartment: "Admin",
  ownerJoiningDate: "",
  companyProfile: {
    email: "",
    mobile: "",
    addressLine1: "",
    city: "",
    stateName: "",
    stateCode: "",
    pincode: "",
    gstin: "",
    pan: "",
  },
};

const INITIAL_PROFILE_FORM = {
  fullName: "",
  mobileNumber: "",
  email: "",
  emergencyContactNumber: "",
  address: "",
  department: "",
  designation: "",
};

const INITIAL_INVOICE_DRAFT = {
  invoiceDate: "",
  periodStartDate: "",
  periodEndDate: "",
  dueDate: "",
  subscriptionPlan: "",
  planAmount: "",
  outstandingAmount: "",
  currencyCode: "INR",
  paymentReference: "",
  paymentTerms: "",
  notes: "",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function TenantOnboardingPage() {
  const { currentUser, updateSession } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdTenant, setCreatedTenant] = useState(null);
  const [createdTenantRequestId, setCreatedTenantRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [showInactiveCompanies, setShowInactiveCompanies] = useState(false);
  const [managedCompanies, setManagedCompanies] = useState([]);
  const [managedCompaniesError, setManagedCompaniesError] = useState("");
  const [managedCompaniesLoading, setManagedCompaniesLoading] = useState(false);
  const [managedCompanyEdits, setManagedCompanyEdits] = useState({});
  const [managedCompanyAccessReason, setManagedCompanyAccessReason] = useState({});
  const [managedCompanyActionId, setManagedCompanyActionId] = useState(null);
  const [managedCompanyActionType, setManagedCompanyActionType] = useState("");
  const [managedCompaniesSuccess, setManagedCompaniesSuccess] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("all");
  const [clientBillingStatusFilter, setClientBillingStatusFilter] = useState("all");
  const [showClientList, setShowClientList] = useState(true);
  const [expandedCompanyCards, setExpandedCompanyCards] = useState({});
  const [managedCompanyDeleteDrafts, setManagedCompanyDeleteDrafts] = useState({});
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [companyInvoices, setCompanyInvoices] = useState({});
  const [selfProfileForm, setSelfProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [selfProfileLoading, setSelfProfileLoading] = useState(false);
  const [selfProfileSaving, setSelfProfileSaving] = useState(false);
  const [selfProfileError, setSelfProfileError] = useState("");
  const [selfProfileSuccess, setSelfProfileSuccess] = useState("");
  const [safetyChecks, setSafetyChecks] = useState({
    legalNameVerified: false,
    ownerIdentityVerified: false,
    secureDeliveryConfirmed: false,
  });

  const managedCompanyCountLabel = useMemo(() => {
    const activeCount = managedCompanies.filter((company) => company.isActive).length;
    const inactiveCount = managedCompanies.length - activeCount;

    return `${managedCompanies.length} total | ${activeCount} active | ${inactiveCount} suspended`;
  }, [managedCompanies]);

  const visibleManagedCompanies = useMemo(() => {
    return managedCompanies.filter((company) => {
      if (clientStatusFilter === "active" && !company.isActive) {
        return false;
      }
      if (clientStatusFilter === "suspended" && company.isActive) {
        return false;
      }
      const billingStatus = String(company.billingStatus || "active").toLowerCase();
      if (clientBillingStatusFilter !== "all" && billingStatus !== clientBillingStatusFilter) {
        return false;
      }
      return true;
    });
  }, [managedCompanies, clientStatusFilter, clientBillingStatusFilter]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCompanyProfileChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      companyProfile: {
        ...prev.companyProfile,
        [name]: value,
      },
    }));
  };

  const handleSafetyCheckChange = (event) => {
    const { name, checked } = event.target;
    setSafetyChecks((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const validateForm = () => {
    if (!String(form.bootstrapSecret || "").trim()) {
      return "Bootstrap secret is required";
    }

    if (!String(form.companyName || "").trim()) {
      return "Company name is required";
    }

    if (!String(form.ownerFullName || "").trim()) {
      return "Owner full name is required";
    }

    if (!String(form.ownerDesignation || "").trim()) {
      return "Owner designation is required";
    }

    if (
      form.ownerJoiningDate &&
      !ISO_DATE_ONLY_PATTERN.test(String(form.ownerJoiningDate).trim())
    ) {
      return "Owner joining date must use YYYY-MM-DD format";
    }

    if (
      form.companyProfile.email &&
      !EMAIL_PATTERN.test(String(form.companyProfile.email).trim())
    ) {
      return "Company email must be a valid email address";
    }

    if (
      form.ownerMobileNumber &&
      !MOBILE_PATTERN.test(String(form.ownerMobileNumber).trim())
    ) {
      return "Owner mobile number must contain 10-15 digits";
    }

    if (
      form.companyProfile.mobile &&
      !MOBILE_PATTERN.test(String(form.companyProfile.mobile).trim())
    ) {
      return "Company mobile must contain 10-15 digits";
    }

    if (
      form.companyProfile.stateCode &&
      !STATE_CODE_PATTERN.test(String(form.companyProfile.stateCode).trim())
    ) {
      return "State code must be 1-2 digits";
    }

    if (
      form.companyProfile.pincode &&
      !PINCODE_PATTERN.test(String(form.companyProfile.pincode).trim())
    ) {
      return "Pincode must be 6 digits";
    }

    if (
      form.companyProfile.gstin &&
      !GSTIN_PATTERN.test(String(form.companyProfile.gstin).trim().toUpperCase())
    ) {
      return "GSTIN must be valid";
    }

    if (
      form.companyProfile.pan &&
      !PAN_PATTERN.test(String(form.companyProfile.pan).trim().toUpperCase())
    ) {
      return "PAN must be valid";
    }

    if (!Object.values(safetyChecks).every(Boolean)) {
      return "Complete all operator verification checks before bootstrapping the tenant";
    }

    return "";
  };

  const clearSensitiveResult = () => {
    setCreatedTenant(null);
    setCreatedTenantRequestId("");
    setSuccess("");
  };

  const loadSelfProfile = useCallback(async () => {
    setSelfProfileLoading(true);
    setSelfProfileError("");
    try {
      const response = await api.get("/auth/me");
      const data = response.data?.data || {};
      setSelfProfileForm({
        fullName: data.fullName || "",
        mobileNumber: data.mobileNumber || "",
        email: data.email || "",
        emergencyContactNumber: data.emergencyContactNumber || "",
        address: data.address || "",
        department: data.department || "",
        designation: data.designation || "",
      });
    } catch (err) {
      setSelfProfileError(
        err?.response?.data?.message || "Failed to load your profile."
      );
    } finally {
      setSelfProfileLoading(false);
    }
  }, []);

  const hydrateManagedCompanyEdits = useCallback((companies) => {
    const nextEdits = {};
    const nextInvoiceDrafts = {};
    companies.forEach((company) => {
      nextEdits[company.id] = {
        companyName: company.companyName || "",
        branchName: company.branchName || "",
        companyEmail: company.companyEmail || "",
        companyMobile: company.companyMobile || "",
        billingStatus: String(company.billingStatus || "active").toLowerCase(),
        billingCycle: String(company.billingCycle || "monthly").toLowerCase(),
        customCycleLabel: company.customCycleLabel || "",
        customCycleDays:
          company.customCycleDays === null || company.customCycleDays === undefined
            ? ""
            : String(company.customCycleDays),
        subscriptionPlan: company.subscriptionPlan || "",
        planAmount:
          company.planAmount === null || company.planAmount === undefined
            ? ""
            : String(company.planAmount),
        outstandingAmount:
          company.outstandingAmount === null || company.outstandingAmount === undefined
            ? ""
            : String(company.outstandingAmount),
        currencyCode: company.currencyCode || "INR",
        nextDueDate: company.nextDueDate ? String(company.nextDueDate).slice(0, 10) : "",
        graceUntilDate: company.graceUntilDate
          ? String(company.graceUntilDate).slice(0, 10)
          : "",
        lastPaymentDate: company.lastPaymentDate
          ? String(company.lastPaymentDate).slice(0, 10)
          : "",
        paymentReference: company.paymentReference || "",
        paymentTerms: company.paymentTerms || "",
        internalNotes: company.internalNotes || "",
      };
      nextInvoiceDrafts[company.id] = {
        ...INITIAL_INVOICE_DRAFT,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: company.nextDueDate ? String(company.nextDueDate).slice(0, 10) : "",
        subscriptionPlan: company.subscriptionPlan || "",
        planAmount:
          company.planAmount === null || company.planAmount === undefined
            ? ""
            : String(company.planAmount),
        outstandingAmount:
          company.outstandingAmount === null || company.outstandingAmount === undefined
            ? ""
            : String(company.outstandingAmount),
        currencyCode: company.currencyCode || "INR",
        paymentReference: company.paymentReference || "",
        paymentTerms: company.paymentTerms || "",
      };
    });
    setManagedCompanyEdits(nextEdits);
    setInvoiceDrafts(nextInvoiceDrafts);
    setExpandedCompanyCards((prev) => {
      const nextExpandedCards = {};
      companies.forEach((company) => {
        nextExpandedCards[company.id] = prev[company.id] ?? true;
      });
      return nextExpandedCards;
    });
  }, []);

  const loadManagedCompanies = useCallback(async () => {
    setManagedCompaniesLoading(true);
    setManagedCompaniesError("");

    try {
      const normalizedSearch = String(companyFilter || "").trim();
      const normalizedStatus = String(clientStatusFilter || "all").toLowerCase();
      const normalizedBillingStatus = String(clientBillingStatusFilter || "all").toLowerCase();
      const shouldIncludeInactive =
        Boolean(showInactiveCompanies) || normalizedStatus === "suspended";

      const response = await api.get("/onboarding/companies", {
        params: {
          search: normalizedSearch,
          includeInactive: shouldIncludeInactive,
          status: normalizedStatus,
          billingStatus: normalizedBillingStatus,
        },
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setManagedCompanies(rows);
      hydrateManagedCompanyEdits(rows);
    } catch (err) {
      setManagedCompaniesError(
        err?.response?.data?.message ||
          "Failed to load managed client companies."
      );
    } finally {
      setManagedCompaniesLoading(false);
    }
  }, [
    companyFilter,
    clientBillingStatusFilter,
    clientStatusFilter,
    hydrateManagedCompanyEdits,
    showInactiveCompanies,
  ]);

  useEffect(() => {
    loadManagedCompanies();
  }, [loadManagedCompanies]);

  useEffect(() => {
    loadSelfProfile();
  }, [loadSelfProfile]);

  const loadCompanyInvoices = useCallback(async (companyId) => {
    try {
      const response = await api.get(`/onboarding/companies/${companyId}/invoices`, {
        params: { limit: 50 },
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setCompanyInvoices((prev) => ({
        ...prev,
        [companyId]: rows,
      }));
    } catch {
      setCompanyInvoices((prev) => ({
        ...prev,
        [companyId]: [],
      }));
    }
  }, []);

  const handleManagedCompanyEditChange = (companyId, key, value) => {
    setManagedCompanyEdits((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || { companyName: "", branchName: "" }),
        [key]: value,
      },
    }));
  };

  const handleInvoiceDraftChange = (companyId, key, value) => {
    setInvoiceDrafts((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || INITIAL_INVOICE_DRAFT),
        [key]: value,
      },
    }));
  };

  const handleManagedCompanySave = async (companyId) => {
    const draft = managedCompanyEdits[companyId];

    if (!draft || !String(draft.companyName || "").trim()) {
      setManagedCompaniesError("Company name is required to save client profile.");
      return;
    }

    const normalizedEmail = String(draft.companyEmail || "").trim();
    const normalizedMobile = String(draft.companyMobile || "").trim();
    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
      setManagedCompaniesError("Company email must be a valid email address.");
      return;
    }

    if (normalizedMobile && !MOBILE_PATTERN.test(normalizedMobile)) {
      setManagedCompaniesError("Company mobile must contain 10-15 digits.");
      return;
    }

    setManagedCompanyActionId(companyId);
    setManagedCompanyActionType("profile");
    setManagedCompaniesError("");
    setManagedCompaniesSuccess("");

    try {
      await api.patch(`/onboarding/companies/${companyId}`, {
        companyName: String(draft.companyName || "").trim(),
        branchName: String(draft.branchName || "").trim(),
        companyEmail: normalizedEmail,
        companyMobile: normalizedMobile,
      });
      await loadManagedCompanies();
      setManagedCompaniesSuccess("Client profile updated successfully.");
    } catch (err) {
      setManagedCompaniesError(
        err?.response?.data?.message || "Failed to save client company profile."
      );
    } finally {
      setManagedCompanyActionId(null);
      setManagedCompanyActionType("");
    }
  };

  const handleManagedCompanyAccessToggle = async (company) => {
    const targetStatus = !company.isActive;
    const reasonInput = String(managedCompanyAccessReason[company.id] || "").trim();
    const actionLabel = targetStatus ? "reactivate" : "suspend";

    if (!targetStatus && !reasonInput) {
      setManagedCompaniesError("Reason is required before suspending a client company.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        targetStatus
          ? `Reactivate login access for ${company.companyCode}?`
          : `Suspend login access for ${company.companyCode}?`
      )
    ) {
      return;
    }

    setManagedCompanyActionId(company.id);
    setManagedCompanyActionType(actionLabel);
    setManagedCompaniesError("");
    setManagedCompaniesSuccess("");

    try {
      await api.patch(`/onboarding/companies/${company.id}/access`, {
        isActive: targetStatus,
        reason: reasonInput,
      });
      setManagedCompanyAccessReason((prev) => ({
        ...prev,
        [company.id]: "",
      }));
      await loadManagedCompanies();
      setManagedCompaniesSuccess(
        targetStatus
          ? "Client login access reactivated successfully."
          : "Client login access suspended successfully."
      );
    } catch (err) {
      setManagedCompaniesError(
        err?.response?.data?.message ||
          "Failed to update client company access status."
      );
    } finally {
      setManagedCompanyActionId(null);
      setManagedCompanyActionType("");
    }
  };

  const handleManagedCompanyBillingSave = async (companyId) => {
    const draft = managedCompanyEdits[companyId];

    if (!draft) {
      return;
    }

    if (
      draft.currencyCode &&
      !/^[A-Z]{3}$/.test(String(draft.currencyCode).trim().toUpperCase())
    ) {
      setManagedCompaniesError("Currency must be a 3-letter ISO code (e.g. INR).");
      return;
    }

    if (
      draft.billingCycle === "custom" &&
      !String(draft.customCycleLabel || "").trim() &&
      !String(draft.customCycleDays || "").trim()
    ) {
      setManagedCompaniesError(
        "Custom billing cycle needs a manual label or cycle days."
      );
      return;
    }

    setManagedCompanyActionId(companyId);
    setManagedCompanyActionType("billing");
    setManagedCompaniesError("");
    setManagedCompaniesSuccess("");

    try {
      await api.patch(`/onboarding/companies/${companyId}/billing`, {
        billingStatus: draft.billingStatus,
        billingCycle: draft.billingCycle,
        customCycleLabel: draft.customCycleLabel,
        customCycleDays: draft.customCycleDays,
        subscriptionPlan: draft.subscriptionPlan,
        planAmount: draft.planAmount,
        outstandingAmount: draft.outstandingAmount,
        currencyCode: draft.currencyCode,
        nextDueDate: draft.nextDueDate || null,
        graceUntilDate: draft.graceUntilDate || null,
        lastPaymentDate: draft.lastPaymentDate || null,
        paymentReference: draft.paymentReference,
        paymentTerms: draft.paymentTerms,
        internalNotes: draft.internalNotes,
      });
      await loadManagedCompanies();
      setManagedCompaniesSuccess("Client billing profile updated successfully.");
    } catch (err) {
      setManagedCompaniesError(
        err?.response?.data?.message || "Failed to save client billing profile."
      );
    } finally {
      setManagedCompanyActionId(null);
      setManagedCompanyActionType("");
    }
  };

  const formatInvoiceAmount = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const buildInvoiceLoadingHtml = ({ company }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Preparing Invoice...</title>
    <style>
      body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: linear-gradient(135deg, #ecfeff 0%, #ffffff 52%, #fefce8 100%); color: #0f172a; }
      .shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(720px, 100%); border-radius: 20px; border: 1px solid rgba(15, 23, 42, 0.1); background: rgba(255, 255, 255, 0.9); padding: 24px; box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12); }
      h1 { margin: 0 0 10px; font-size: 22px; }
      p { margin: 0; color: #475569; line-height: 1.7; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <h1>Preparing invoice PDF preview...</h1>
        <p>${escapeHtml(company?.companyName || "Client company")} invoice is being generated and saved.</p>
      </div>
    </div>
  </body>
</html>
  `.trim();

  const buildInvoicePrintHtml = ({
    company,
    invoice,
    companyProfile = null,
    issuerProfile = null,
  }) => {
    const amount = formatInvoiceAmount(invoice?.totalAmount);
    const planAmount = formatInvoiceAmount(invoice?.planAmount);
    const outstandingAmount = formatInvoiceAmount(invoice?.outstandingAmount);
    const invoiceNumber = escapeHtml(invoice?.invoiceNumber || "Billing Invoice");
    const invoiceDate = escapeHtml(invoice?.invoiceDate || "-");
    const dueDate = escapeHtml(invoice?.dueDate || "-");
    const periodStartDate = escapeHtml(invoice?.periodStartDate || "-");
    const periodEndDate = escapeHtml(invoice?.periodEndDate || "-");
    const companyName = escapeHtml(companyProfile?.companyName || company?.companyName || "-");
    const companyCode = escapeHtml(company?.companyCode || "-");
    const branchName = escapeHtml(companyProfile?.branchName || company?.branchName || "-");
    const billToGstin = escapeHtml(
      companyProfile?.gstin || company?.companyGstin || "-"
    );
    const billToPan = escapeHtml(companyProfile?.pan || company?.companyPan || "-");
    const billToEmail = escapeHtml(
      companyProfile?.email || company?.companyEmail || "-"
    );
    const billToMobile = escapeHtml(
      companyProfile?.mobile || company?.companyMobile || "-"
    );
    const billToAddress = escapeHtml(
      [
        companyProfile?.addressLine1 || company?.companyAddressLine1 || "",
        companyProfile?.city || company?.companyCity || "",
        companyProfile?.stateName || company?.companyStateName || "",
        companyProfile?.pincode || company?.companyPincode || "",
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ") || "-"
    );
    const issuerName = escapeHtml(
      issuerProfile?.companyName || "SinSoftware Solutions"
    );
    const issuerBranch = escapeHtml(issuerProfile?.branchName || "-");
    const issuerGstin = escapeHtml(issuerProfile?.gstin || "-");
    const issuerPan = escapeHtml(issuerProfile?.pan || "-");
    const issuerEmail = escapeHtml(issuerProfile?.email || "-");
    const issuerMobile = escapeHtml(issuerProfile?.mobile || "-");
    const issuerLogoUrl = String(issuerProfile?.logoUrl || "").trim();
    const hasIssuerLogo = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(issuerLogoUrl);
    const issuerAddress = escapeHtml(
      [
        issuerProfile?.addressLine1 || "",
        issuerProfile?.city || "",
        issuerProfile?.stateName || "",
        issuerProfile?.pincode || "",
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ") || "-"
    );
    const billingCycle = escapeHtml(invoice?.billingCycle || "-");
    const billingStatus = escapeHtml(invoice?.billingStatus || "-");
    const currencyCode = escapeHtml(invoice?.currencyCode || "INR");
    const subscriptionPlan = escapeHtml(invoice?.subscriptionPlan || "-");
    const paymentReference = escapeHtml(invoice?.paymentReference || "-");
    const paymentTerms = escapeHtml(invoice?.paymentTerms || "-");
    const notes = escapeHtml(invoice?.notes || "-");
    const escapedIssuerLogoUrl = hasIssuerLogo ? escapeHtml(issuerLogoUrl) : "";

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${invoiceNumber}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color: #0f172a; background: linear-gradient(150deg, #eff6ff 0%, #ffffff 58%, #ecfeff 100%); }
      .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 22px; background: rgba(255,255,255,0.95); }
      .row { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; }
      .muted { color: #475569; font-size: 12px; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      h2 { margin: 0 0 14px; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
      th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
      .right { text-align: right; }
      .total { font-weight: 700; background: #f1f5f9; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin-top: 16px; }
      .partyGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .partyCard { border: 1px solid #dbeafe; border-radius: 12px; padding: 12px; background: #f8fbff; }
      .partyTitle { margin: 0 0 8px; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; }
      .headerIdentity { display: flex; align-items: center; gap: 12px; }
      .issuerLogo { width: 70px; height: 70px; object-fit: contain; border: 1px solid #dbeafe; border-radius: 10px; background: #ffffff; padding: 6px; flex-shrink: 0; }
      .issuerLogoFallback { width: 70px; height: 70px; border: 1px dashed #cbd5e1; border-radius: 10px; display: grid; place-items: center; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; background: #ffffff; flex-shrink: 0; }
      .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
      .value { font-size: 14px; color: #0f172a; font-weight: 600; margin-top: 2px; }
      .toolbar { margin-bottom: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
      .toolbar button { border: 1px solid #cbd5e1; background: #ffffff; border-radius: 10px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
      @media print {
        .toolbar { display: none; }
        body { margin: 0; background: #ffffff; }
        .card { border: none; border-radius: 0; }
        .issuerLogo, .issuerLogoFallback { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Print / Save PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
    <div class="card">
      <div class="row">
        <div>
          <div class="headerIdentity">
            ${
              hasIssuerLogo
                ? `<img class="issuerLogo" src="${escapedIssuerLogoUrl}" alt="Issuer logo" />`
                : `<div class="issuerLogoFallback">No Logo</div>`
            }
            <div>
              <h1>Client Billing Invoice</h1>
              <p class="muted">Subscription and outstanding summary</p>
            </div>
          </div>
        </div>
        <div>
          <div><strong>${invoiceNumber}</strong></div>
          <div class="muted">Invoice Date: ${invoiceDate}</div>
          <div class="muted">Due Date: ${dueDate}</div>
        </div>
      </div>
      <h2>${companyName}</h2>
      <div class="grid">
        <div>
          <div class="label">Company Code</div>
          <div class="value">${companyCode}</div>
        </div>
        <div>
          <div class="label">Branch</div>
          <div class="value">${branchName}</div>
        </div>
        <div>
          <div class="label">Billing Cycle</div>
          <div class="value">${billingCycle}</div>
        </div>
        <div>
          <div class="label">Billing Status</div>
          <div class="value">${billingStatus}</div>
        </div>
        <div>
          <div class="label">Period Start</div>
          <div class="value">${periodStartDate}</div>
        </div>
        <div>
          <div class="label">Period End</div>
          <div class="value">${periodEndDate}</div>
        </div>
      </div>
      <div class="partyGrid">
        <div class="partyCard">
          <p class="partyTitle">Issuer</p>
          <div class="label">Name</div><div class="value">${issuerName}</div>
          <div class="label">Branch</div><div class="value">${issuerBranch}</div>
          <div class="label">Address</div><div class="value">${issuerAddress}</div>
          <div class="label">GSTIN / PAN</div><div class="value">${issuerGstin} / ${issuerPan}</div>
          <div class="label">Contact</div><div class="value">${issuerMobile} | ${issuerEmail}</div>
        </div>
        <div class="partyCard">
          <p class="partyTitle">Bill To</p>
          <div class="label">Company</div><div class="value">${companyName}</div>
          <div class="label">Branch</div><div class="value">${branchName}</div>
          <div class="label">Address</div><div class="value">${billToAddress}</div>
          <div class="label">GSTIN / PAN</div><div class="value">${billToGstin} / ${billToPan}</div>
          <div class="label">Contact</div><div class="value">${billToMobile} | ${billToEmail}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Reference</th>
            <th class="right">Amount (${currencyCode})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Subscription Plan Charge</td>
            <td>${subscriptionPlan}</td>
            <td class="right">${planAmount}</td>
          </tr>
          <tr>
            <td>Outstanding Carry Forward</td>
            <td>${paymentReference}</td>
            <td class="right">${outstandingAmount}</td>
          </tr>
          <tr class="total">
            <td colspan="2">Total Payable</td>
            <td class="right">${amount}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted" style="margin-top: 14px;">
        Payment Terms: ${paymentTerms}
      </p>
      <p class="muted">Notes: ${notes}</p>
    </div>
    <script>
      window.addEventListener("load", () => {
        setTimeout(() => {
          window.print();
        }, 180);
      });
    </script>
  </body>
</html>
    `.trim();
  };

  const writePopupHtml = (popup, html) => {
    if (!popup || popup.closed) {
      return false;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    return true;
  };

  const openInvoicePdfWindow = ({
    popup,
    company,
    invoice,
    companyProfile,
    issuerProfile,
  }) => {
    if (
      !writePopupHtml(
        popup,
        buildInvoicePrintHtml({ company, invoice, companyProfile, issuerProfile })
      )
    ) {
      setManagedCompaniesError(
        "Invoice preview window was closed before rendering. Please generate again."
      );
      return;
    }
    popup.focus();
  };

  const openInvoicePreviewWindow = (company) => {
    const popup = window.open("", "_blank", "width=980,height=760");
    if (!popup) {
      setManagedCompaniesError(
        "Popup was blocked. Allow popups and retry to generate PDF."
      );
      return null;
    }

    writePopupHtml(popup, buildInvoiceLoadingHtml({ company }));
    popup.focus();
    return popup;
  };

  const handleGenerateInvoice = async (company) => {
    const draft = invoiceDrafts[company.id] || INITIAL_INVOICE_DRAFT;
    const invoicePopup = openInvoicePreviewWindow(company);
    if (!invoicePopup) {
      return;
    }

    setManagedCompanyActionId(company.id);
    setManagedCompanyActionType("invoice");
    setManagedCompaniesError("");
    setManagedCompaniesSuccess("");
    try {
      const response = await api.post(`/onboarding/companies/${company.id}/invoices`, {
        invoiceDate: draft.invoiceDate || null,
        periodStartDate: draft.periodStartDate || null,
        periodEndDate: draft.periodEndDate || null,
        dueDate: draft.dueDate || null,
        subscriptionPlan: draft.subscriptionPlan,
        planAmount: draft.planAmount,
        outstandingAmount: draft.outstandingAmount,
        currencyCode: draft.currencyCode,
        paymentReference: draft.paymentReference,
        paymentTerms: draft.paymentTerms,
        notes: draft.notes,
      });
      const payload = response.data?.data || {};
      await loadCompanyInvoices(company.id);
      setManagedCompaniesSuccess("Billing invoice generated and saved successfully.");
      if (payload.invoice) {
        openInvoicePdfWindow({
          popup: invoicePopup,
          company,
          invoice: payload.invoice,
          companyProfile: payload.companyProfile || null,
          issuerProfile: payload.issuerProfile || null,
        });
      } else if (!invoicePopup.closed) {
        invoicePopup.close();
      }
    } catch (err) {
      if (!invoicePopup.closed) {
        writePopupHtml(
          invoicePopup,
          `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#b91c1c;"><h2>Invoice generation failed</h2><p>${escapeHtml(
            err?.response?.data?.message || "Unable to generate billing invoice."
          )}</p></body></html>`
        );
      }
      setManagedCompaniesError(
        err?.response?.data?.message || "Failed to generate billing invoice."
      );
    } finally {
      setManagedCompanyActionId(null);
      setManagedCompanyActionType("");
    }
  };

  const handlePermanentCompanyDelete = async (company) => {
    const draft = managedCompanyDeleteDrafts[company.id] || {};
    const reason = String(draft.reason || "").trim();
    if (!reason) {
      setManagedCompaniesError(
        "Add a clear deletion reason before permanent delete."
      );
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `This will permanently delete ${company.companyCode} and all linked company data. Continue?`
      )
    ) {
      return;
    }
    setManagedCompanyActionId(company.id);
    setManagedCompanyActionType("delete");
    setManagedCompaniesError("");
    setManagedCompaniesSuccess("");
    try {
      await api.delete(`/onboarding/companies/${company.id}/permanent`, {
        data: {
          reason,
        },
      });
      setManagedCompaniesSuccess("Client company permanently deleted.");
      await loadManagedCompanies();
    } catch (err) {
      setManagedCompaniesError(
        err?.response?.data?.message || "Failed to permanently delete client company."
      );
    } finally {
      setManagedCompanyActionId(null);
      setManagedCompanyActionType("");
    }
  };

  const handleSelfProfileSave = async () => {
    setSelfProfileSaving(true);
    setSelfProfileError("");
    setSelfProfileSuccess("");
    try {
      const response = await api.patch("/auth/me/profile", selfProfileForm);
      const profile = response.data?.data || {};
      updateSession({
        user: {
          ...(currentUser || {}),
          ...profile,
        },
      });
      setSelfProfileSuccess("Your owner profile has been updated.");
    } catch (err) {
      setSelfProfileError(
        err?.response?.data?.message || "Failed to update your profile."
      );
    } finally {
      setSelfProfileSaving(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const isReadyToSubmit =
    !submitting &&
    Object.values(safetyChecks).every(Boolean) &&
    String(form.bootstrapSecret || "").trim() &&
    String(form.companyName || "").trim() &&
    String(form.ownerFullName || "").trim() &&
    String(form.ownerDesignation || "").trim();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatedTenant(null);
    setCreatedTenantRequestId("");

    const validationMessage = validateForm();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        companyName: String(form.companyName || "").trim(),
        branchName: String(form.branchName || "").trim(),
        ownerFullName: String(form.ownerFullName || "").trim(),
        ownerMobileNumber: String(form.ownerMobileNumber || "").trim(),
        ownerDesignation: String(form.ownerDesignation || "").trim(),
        ownerDepartment: String(form.ownerDepartment || "").trim(),
        ownerJoiningDate: form.ownerJoiningDate || null,
        companyProfile: Object.fromEntries(
          Object.entries(form.companyProfile).map(([key, value]) => [
            key,
            String(value || "").trim(),
          ])
        ),
      };

      const response = await api.post("/onboarding/bootstrap-company-owner", payload, {
        headers: {
          "x-bootstrap-secret": String(form.bootstrapSecret || "").trim(),
        },
      });

      setCreatedTenant(response.data?.data || null);
      setCreatedTenantRequestId(response.headers?.["x-request-id"] || "");
      setSuccess(
        "Tenant onboarded successfully. Share the generated owner credentials through a secure internal channel and require an immediate password change on first login."
      );
      setForm(() => ({
        ...INITIAL_FORM,
        bootstrapSecret: "",
        ownerDepartment: "Admin",
      }));
      setSafetyChecks({
        legalNameVerified: false,
        ownerIdentityVerified: false,
        secureDeliveryConfirmed: false,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to bootstrap the new tenant. Review the payload and bootstrap secret."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Tenant Onboarding"
      subtitle="Premium control center for client onboarding, billing, access, and owner governance"
    >
      <div style={styles.pageBackdrop}>
        <div style={styles.stack}>
        <SectionCard title="Production Bootstrap Flow">
          <div style={styles.heroPanel}>
            <div style={styles.heroCopy}>
              <span style={styles.badge}>Internal Ops Only</span>
              <h2 style={styles.heroTitle}>Create a tenant the safe way.</h2>
              <p style={styles.heroText}>
                Activate verified client companies with audit-safe onboarding, disciplined billing,
                and reliable access controls.
              </p>
            </div>

            <div style={styles.heroChecklist}>
              <div style={styles.checkItem}>Atomic company, profile, owner employee, and login creation</div>
              <div style={styles.checkItem}>Duplicate company-name protection with conflict handling</div>
              <div style={styles.checkItem}>Owner credentials returned once for controlled handoff</div>
            </div>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {success ? <div style={styles.success}>{success}</div> : null}

          <form onSubmit={handleSubmit} style={styles.formStack}>
            <div>
              <p style={styles.sectionTitle}>Access Control</p>
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.label}>Bootstrap Secret</span>
                  <input
                    type="password"
                    name="bootstrapSecret"
                    value={form.bootstrapSecret}
                    onChange={handleFieldChange}
                    placeholder="Protected onboarding secret"
                    autoComplete="off"
                    style={styles.input}
                    required
                  />
                </label>
              </div>
            </div>

            <div>
              <p style={styles.sectionTitle}>Operator Verification</p>
              <div style={styles.verificationGrid}>
                <label style={styles.checkCard}>
                  <input
                    type="checkbox"
                    name="legalNameVerified"
                    checked={safetyChecks.legalNameVerified}
                    onChange={handleSafetyCheckChange}
                    style={styles.checkbox}
                  />
                  <div>
                    <span style={styles.checkTitle}>Legal company name verified</span>
                    <p style={styles.checkText}>
                      I have confirmed the exact tenant company name to avoid duplicate or ambiguous records.
                    </p>
                  </div>
                </label>

                <label style={styles.checkCard}>
                  <input
                    type="checkbox"
                    name="ownerIdentityVerified"
                    checked={safetyChecks.ownerIdentityVerified}
                    onChange={handleSafetyCheckChange}
                    style={styles.checkbox}
                  />
                  <div>
                    <span style={styles.checkTitle}>Owner identity verified</span>
                    <p style={styles.checkText}>
                      I have validated the owner name, designation, and contact details with an approved source.
                    </p>
                  </div>
                </label>

                <label style={styles.checkCard}>
                  <input
                    type="checkbox"
                    name="secureDeliveryConfirmed"
                    checked={safetyChecks.secureDeliveryConfirmed}
                    onChange={handleSafetyCheckChange}
                    style={styles.checkbox}
                  />
                  <div>
                    <span style={styles.checkTitle}>Secure credential delivery planned</span>
                    <p style={styles.checkText}>
                      I know how the generated credentials will be handed to the owner without exposing them in public channels.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <p style={styles.sectionTitle}>Tenant Identity</p>
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.label}>Company Name</span>
                  <input
                    name="companyName"
                    value={form.companyName}
                    onChange={handleFieldChange}
                    placeholder="Apex Build Infra Pvt Ltd"
                    style={styles.input}
                    required
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Branch Name</span>
                  <input
                    name="branchName"
                    value={form.branchName}
                    onChange={handleFieldChange}
                    placeholder="Head Office"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Company Email</span>
                  <input
                    type="email"
                    name="email"
                    value={form.companyProfile.email}
                    onChange={handleCompanyProfileChange}
                    placeholder="ops@apexbuildinfra.com"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Company Mobile</span>
                  <input
                    name="mobile"
                    value={form.companyProfile.mobile}
                    onChange={handleCompanyProfileChange}
                    placeholder="9876543210"
                    style={styles.input}
                  />
                </label>
                <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                  <span style={styles.label}>Address Line 1</span>
                  <input
                    name="addressLine1"
                    value={form.companyProfile.addressLine1}
                    onChange={handleCompanyProfileChange}
                    placeholder="Registered office / billing address"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>City</span>
                  <input
                    name="city"
                    value={form.companyProfile.city}
                    onChange={handleCompanyProfileChange}
                    placeholder="Lucknow"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>State Name</span>
                  <input
                    name="stateName"
                    value={form.companyProfile.stateName}
                    onChange={handleCompanyProfileChange}
                    placeholder="Uttar Pradesh"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>State Code</span>
                  <input
                    name="stateCode"
                    value={form.companyProfile.stateCode}
                    onChange={handleCompanyProfileChange}
                    placeholder="09"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Pincode</span>
                  <input
                    name="pincode"
                    value={form.companyProfile.pincode}
                    onChange={handleCompanyProfileChange}
                    placeholder="226001"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>GSTIN</span>
                  <input
                    name="gstin"
                    value={form.companyProfile.gstin}
                    onChange={handleCompanyProfileChange}
                    placeholder="09ABCDE1234F1Z5"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>PAN</span>
                  <input
                    name="pan"
                    value={form.companyProfile.pan}
                    onChange={handleCompanyProfileChange}
                    placeholder="ABCDE1234F"
                    style={styles.input}
                  />
                </label>
              </div>
            </div>

            <div>
              <p style={styles.sectionTitle}>Owner Identity</p>
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.label}>Owner Full Name</span>
                  <input
                    name="ownerFullName"
                    value={form.ownerFullName}
                    onChange={handleFieldChange}
                    placeholder="Amit Sharma"
                    style={styles.input}
                    required
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Owner Mobile Number</span>
                  <input
                    name="ownerMobileNumber"
                    value={form.ownerMobileNumber}
                    onChange={handleFieldChange}
                    placeholder="9999999999"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Designation</span>
                  <input
                    name="ownerDesignation"
                    value={form.ownerDesignation}
                    onChange={handleFieldChange}
                    placeholder="Managing Director"
                    style={styles.input}
                    required
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Department</span>
                  <input
                    name="ownerDepartment"
                    value={form.ownerDepartment}
                    onChange={handleFieldChange}
                    placeholder="Admin"
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Joining Date</span>
                  <input
                    type="date"
                    name="ownerJoiningDate"
                    value={form.ownerJoiningDate}
                    onChange={handleFieldChange}
                    style={styles.input}
                  />
                </label>
              </div>
            </div>

            <div style={styles.actionRow}>
              <button type="submit" disabled={!isReadyToSubmit} style={styles.button}>
                {submitting ? "Bootstrapping Tenant..." : "Bootstrap Tenant"}
              </button>
              <p style={styles.actionHint}>
                Use only for approved, verified client companies.
              </p>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Owner Profile Management">
          {selfProfileError ? <div style={styles.error}>{selfProfileError}</div> : null}
          {selfProfileSuccess ? <div style={styles.success}>{selfProfileSuccess}</div> : null}
          <div style={styles.grid}>
            <label style={styles.field}>
              <span style={styles.label}>Full Name</span>
              <input
                value={selfProfileForm.fullName}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                style={styles.input}
                placeholder="Platform owner name"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Mobile Number</span>
              <input
                value={selfProfileForm.mobileNumber}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, mobileNumber: event.target.value }))
                }
                style={styles.input}
                placeholder="10-15 digits"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Email</span>
              <input
                value={selfProfileForm.email}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, email: event.target.value }))
                }
                style={styles.input}
                placeholder="owner@sinsoftware.in"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Emergency Contact</span>
              <input
                value={selfProfileForm.emergencyContactNumber}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({
                    ...prev,
                    emergencyContactNumber: event.target.value,
                  }))
                }
                style={styles.input}
                placeholder="10-15 digits"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Department</span>
              <input
                value={selfProfileForm.department}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, department: event.target.value }))
                }
                style={styles.input}
                placeholder="Admin"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Designation</span>
              <input
                value={selfProfileForm.designation}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, designation: event.target.value }))
                }
                style={styles.input}
                placeholder="Platform Owner"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Address</span>
              <textarea
                value={selfProfileForm.address}
                onChange={(event) =>
                  setSelfProfileForm((prev) => ({ ...prev, address: event.target.value }))
                }
                style={styles.textArea}
                placeholder="Owner contact address"
                disabled={selfProfileLoading || selfProfileSaving}
              />
            </label>
          </div>
          <div style={styles.clientActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleSelfProfileSave}
              disabled={selfProfileLoading || selfProfileSaving}
            >
              {selfProfileSaving ? "Saving Profile..." : "Save My Profile"}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Client Access Control">
          <div style={styles.controlHeaderRow}>
            <div style={styles.controlHeaderCopy}>
              <p style={styles.controlHeaderText}>
                Manage client companies after sale, edit identity details, and suspend access when commercial dues are unresolved.
              </p>
              <p style={styles.controlHeaderMeta}>{managedCompanyCountLabel}</p>
            </div>

            <div style={styles.controlActions}>
              <label style={styles.controlField}>
                <span style={styles.controlLabel}>Search company</span>
                <input
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  placeholder="Name, code, or branch"
                  style={styles.input}
                />
              </label>
              <label style={styles.controlField}>
                <span style={styles.controlLabel}>Client status</span>
                <select
                  value={clientStatusFilter}
                  onChange={(event) => setClientStatusFilter(event.target.value)}
                  style={styles.input}
                >
                  <option value="all">all</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
              </label>
              <label style={styles.controlField}>
                <span style={styles.controlLabel}>Billing status</span>
                <select
                  value={clientBillingStatusFilter}
                  onChange={(event) => setClientBillingStatusFilter(event.target.value)}
                  style={styles.input}
                >
                  <option value="all">all</option>
                  <option value="trial">trial</option>
                  <option value="active">active</option>
                  <option value="overdue">overdue</option>
                  <option value="grace">grace</option>
                  <option value="on_hold">on_hold</option>
                  <option value="suspended">suspended</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <label style={styles.controlToggle}>
                <input
                  type="checkbox"
                  checked={showInactiveCompanies}
                  onChange={(event) => setShowInactiveCompanies(event.target.checked)}
                  style={styles.checkbox}
                />
                Include suspended
              </label>
              <button
                type="button"
                onClick={loadManagedCompanies}
                style={styles.secondaryButton}
              >
                Refresh List
              </button>
              <button
                type="button"
                onClick={() => setShowClientList((prev) => !prev)}
                style={styles.secondaryButton}
              >
                {showClientList ? "Hide Client List" : "Show Client List"}
              </button>
            </div>
          </div>

          {managedCompaniesError ? (
            <div style={styles.error}>{managedCompaniesError}</div>
          ) : null}
          {managedCompaniesSuccess ? (
            <div style={styles.success}>{managedCompaniesSuccess}</div>
          ) : null}

          {managedCompaniesLoading ? (
            <p style={styles.controlHelperText}>Loading managed client companies...</p>
          ) : null}

          {!managedCompaniesLoading && visibleManagedCompanies.length === 0 ? (
            <p style={styles.controlHelperText}>
              No client companies found for the current filters.
            </p>
          ) : null}

          {!managedCompaniesLoading && showClientList && visibleManagedCompanies.length > 0 ? (
            <div style={styles.clientList}>
              {visibleManagedCompanies.map((company) => {
                const draft = managedCompanyEdits[company.id] || {
                  companyName: company.companyName || "",
                  branchName: company.branchName || "",
                };
                const deleteDraft = managedCompanyDeleteDrafts[company.id] || {
                  reason: "",
                };
                const invoiceDraft = invoiceDrafts[company.id] || INITIAL_INVOICE_DRAFT;
                const invoices = companyInvoices[company.id] || [];
                const isExpanded = expandedCompanyCards[company.id] ?? true;
                const isBusy = managedCompanyActionId === company.id;

                return (
                  <div key={company.id} style={styles.clientCard}>
                    <div style={styles.clientCardTop}>
                      <div>
                        <p style={styles.clientCode}>{company.companyCode}</p>
                        <p style={styles.clientOwnerMeta}>
                          Owner: {company.ownerFullName || "-"} | Login: {company.ownerUsername || "-"}
                        </p>
                      </div>
                      <span
                        style={
                          company.isActive
                            ? styles.statusBadgeActive
                            : styles.statusBadgeSuspended
                        }
                      >
                        {company.isActive ? "Active" : "Suspended"}
                      </span>
                    </div>

                    <div style={styles.clientActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => {
                          setExpandedCompanyCards((prev) => ({
                            ...prev,
                            [company.id]: !isExpanded,
                          }));
                          if (!companyInvoices[company.id]) {
                            loadCompanyInvoices(company.id);
                          }
                        }}
                      >
                        {isExpanded ? "Hide Details" : "Show Details"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <>

                    <div style={styles.clientEditGrid}>
                      <label style={styles.field}>
                        <span style={styles.label}>Company Name</span>
                        <input
                          value={draft.companyName}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "companyName",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Branch Name</span>
                        <input
                          value={draft.branchName}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "branchName",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Company Mobile</span>
                        <input
                          value={draft.companyMobile || ""}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "companyMobile",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="10-15 digits"
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Company Email</span>
                        <input
                          value={draft.companyEmail || ""}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "companyEmail",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="billing@company.com"
                        />
                      </label>
                    </div>

                    <div style={styles.clientMetaGrid}>
                      <span>Created: {formatDateTime(company.createdAt)}</span>
                      <span>Updated: {formatDateTime(company.updatedAt)}</span>
                      <span>Live Mobile: {company.companyMobile || "-"}</span>
                      <span>Live Email: {company.companyEmail || "-"}</span>
                    </div>

                    <div style={styles.clientBillingGrid}>
                      <label style={styles.field}>
                        <span style={styles.label}>Billing Status</span>
                        <select
                          value={draft.billingStatus}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "billingStatus",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        >
                          <option value="trial">trial</option>
                          <option value="active">active</option>
                          <option value="overdue">overdue</option>
                          <option value="grace">grace</option>
                          <option value="on_hold">on_hold</option>
                          <option value="suspended">suspended</option>
                          <option value="closed">closed</option>
                        </select>
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Billing Cycle</span>
                        <select
                          value={draft.billingCycle}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "billingCycle",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        >
                          <option value="weekly">weekly</option>
                          <option value="monthly">monthly</option>
                          <option value="quarterly">quarterly</option>
                          <option value="half_yearly">half_yearly</option>
                          <option value="yearly">yearly</option>
                          <option value="custom">custom</option>
                        </select>
                      </label>

                      {draft.billingCycle === "custom" ? (
                        <>
                          <label style={styles.field}>
                            <span style={styles.label}>Custom Cycle Label</span>
                            <input
                              value={draft.customCycleLabel || ""}
                              onChange={(event) =>
                                handleManagedCompanyEditChange(
                                  company.id,
                                  "customCycleLabel",
                                  event.target.value
                                )
                              }
                              style={styles.input}
                              placeholder="e.g. 45-day project cycle"
                            />
                          </label>
                          <label style={styles.field}>
                            <span style={styles.label}>Custom Cycle Days</span>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={draft.customCycleDays || ""}
                              onChange={(event) =>
                                handleManagedCompanyEditChange(
                                  company.id,
                                  "customCycleDays",
                                  event.target.value
                                )
                              }
                              style={styles.input}
                              placeholder="45"
                            />
                          </label>
                        </>
                      ) : null}

                      <label style={styles.field}>
                        <span style={styles.label}>Subscription Plan</span>
                        <input
                          value={draft.subscriptionPlan}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "subscriptionPlan",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="Gold Annual"
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Currency</span>
                        <input
                          value={draft.currencyCode}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "currencyCode",
                              event.target.value.toUpperCase()
                            )
                          }
                          style={styles.input}
                          maxLength={3}
                          placeholder="INR"
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Plan Amount</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.planAmount}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "planAmount",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="0.00"
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Outstanding Amount</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.outstandingAmount}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "outstandingAmount",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="0.00"
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Next Due Date</span>
                        <input
                          type="date"
                          value={draft.nextDueDate}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "nextDueDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Grace Until</span>
                        <input
                          type="date"
                          value={draft.graceUntilDate}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "graceUntilDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Last Payment Date</span>
                        <input
                          type="date"
                          value={draft.lastPaymentDate}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "lastPaymentDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Payment Reference</span>
                        <input
                          value={draft.paymentReference}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "paymentReference",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="UPI/NEFT Ref"
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Payment Terms</span>
                        <input
                          value={draft.paymentTerms}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "paymentTerms",
                              event.target.value
                            )
                          }
                          style={styles.input}
                          placeholder="Net 15 / Net 30"
                        />
                      </label>

                      <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                        <span style={styles.label}>Internal Notes</span>
                        <textarea
                          value={draft.internalNotes}
                          onChange={(event) =>
                            handleManagedCompanyEditChange(
                              company.id,
                              "internalNotes",
                              event.target.value
                            )
                          }
                          style={styles.textArea}
                          placeholder="Billing notes, collection history, contract reminders"
                        />
                      </label>
                    </div>

                    <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                      <span style={styles.label}>Access Action Reason (required for suspension)</span>
                      <input
                        value={managedCompanyAccessReason[company.id] || ""}
                        onChange={(event) =>
                          setManagedCompanyAccessReason((prev) => ({
                            ...prev,
                            [company.id]: event.target.value,
                          }))
                        }
                        style={styles.input}
                        placeholder="e.g. Invoice overdue beyond grace period"
                      />
                    </label>

                    <div style={styles.clientActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => handleManagedCompanySave(company.id)}
                        disabled={isBusy}
                      >
                        {isBusy && managedCompanyActionType === "profile"
                          ? "Saving Profile..."
                          : "Save Profile"}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => handleManagedCompanyBillingSave(company.id)}
                        disabled={isBusy}
                      >
                        {isBusy && managedCompanyActionType === "billing"
                          ? "Saving Billing..."
                          : "Save Billing"}
                      </button>
                      <button
                        type="button"
                        style={
                          company.isActive
                            ? styles.suspendButton
                            : styles.reactivateButton
                        }
                        onClick={() => handleManagedCompanyAccessToggle(company)}
                        disabled={isBusy}
                      >
                        {isBusy && managedCompanyActionType === "suspend"
                          ? "Suspending..."
                          : isBusy && managedCompanyActionType === "reactivate"
                          ? "Reactivating..."
                          : company.isActive
                          ? "Suspend Login Access"
                          : "Reactivate Login Access"}
                      </button>
                    </div>

                    <div style={styles.clientBillingGrid}>
                      <label style={styles.field}>
                        <span style={styles.label}>Invoice Date</span>
                        <input
                          type="date"
                          value={invoiceDraft.invoiceDate}
                          onChange={(event) =>
                            handleInvoiceDraftChange(
                              company.id,
                              "invoiceDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Period Start</span>
                        <input
                          type="date"
                          value={invoiceDraft.periodStartDate}
                          onChange={(event) =>
                            handleInvoiceDraftChange(
                              company.id,
                              "periodStartDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Period End</span>
                        <input
                          type="date"
                          value={invoiceDraft.periodEndDate}
                          onChange={(event) =>
                            handleInvoiceDraftChange(
                              company.id,
                              "periodEndDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Invoice Due Date</span>
                        <input
                          type="date"
                          value={invoiceDraft.dueDate}
                          onChange={(event) =>
                            handleInvoiceDraftChange(
                              company.id,
                              "dueDate",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                        <span style={styles.label}>Invoice Notes</span>
                        <textarea
                          value={invoiceDraft.notes}
                          onChange={(event) =>
                            handleInvoiceDraftChange(
                              company.id,
                              "notes",
                              event.target.value
                            )
                          }
                          style={styles.textArea}
                          placeholder="Special notes shown in billing invoice PDF"
                        />
                      </label>
                    </div>

                    <div style={styles.clientActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => handleGenerateInvoice(company)}
                        disabled={isBusy}
                      >
                        {isBusy && managedCompanyActionType === "invoice"
                          ? "Generating Invoice..."
                          : "Generate Invoice + PDF"}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => loadCompanyInvoices(company.id)}
                        disabled={isBusy}
                      >
                        Refresh Invoices
                      </button>
                    </div>

                    {invoices.length > 0 ? (
                      <div style={styles.clientMetaGrid}>
                        {invoices.slice(0, 5).map((invoice) => (
                          <span key={invoice.id}>
                            {invoice.invoiceNumber} | {invoice.invoiceDate} |{" "}
                            {invoice.currencyCode} {invoice.totalAmount}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.controlHelperText}>
                        No billing invoice generated yet for this client.
                      </p>
                    )}

                    <div style={styles.clientBillingGrid}>
                      <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                        <span style={styles.label}>Permanent Delete Reason</span>
                        <input
                          value={deleteDraft.reason || ""}
                          onChange={(event) =>
                            setManagedCompanyDeleteDrafts((prev) => ({
                              ...prev,
                              [company.id]: {
                                ...(prev[company.id] || {}),
                                reason: event.target.value,
                              },
                            }))
                          }
                          style={styles.input}
                          placeholder="Write business reason for irreversible deletion"
                        />
                      </label>
                    </div>

                    <div style={styles.clientActions}>
                      <button
                        type="button"
                        style={styles.suspendButton}
                        onClick={() => handlePermanentCompanyDelete(company)}
                        disabled={isBusy}
                      >
                        {isBusy && managedCompanyActionType === "delete"
                          ? "Deleting..."
                          : "Permanent Delete Client"}
                      </button>
                    </div>
                  </>
                ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </SectionCard>

        {createdTenant ? (
          <SectionCard title="Generated Owner Credentials">
            <div style={styles.credentialsPanel}>
              <div style={styles.credentialGrid}>
                <CredentialItem label="Company" value={createdTenant.company?.companyName} />
                <CredentialItem label="Company Code" value={createdTenant.company?.companyCode} />
                <CredentialItem label="Owner Employee Code" value={createdTenant.owner?.employeeCode} />
                <CredentialItem label="Username" value={createdTenant.owner?.username} />
                <CredentialItem
                  label="Temporary Password"
                  value={createdTenant.owner?.temporaryPassword}
                  sensitive
                />
                <CredentialItem label="Role" value={createdTenant.owner?.role} />
              </div>
              <p style={styles.credentialsNote}>
                Treat the temporary password as highly sensitive. Share it only with the approved
                company owner and require immediate rotation at first login.
              </p>
              <div style={styles.credentialsActions}>
                <button type="button" onClick={clearSensitiveResult} style={styles.secondaryButton}>
                  Clear Sensitive Output
                </button>
                {createdTenantRequestId ? (
                  <Link
                    to={`/audit-logs?targetType=onboarding&search=${encodeURIComponent(
                      createdTenantRequestId
                    )}`}
                    style={styles.auditLink}
                  >
                    Open Audit Trail
                  </Link>
                ) : null}
              </div>
            </div>
          </SectionCard>
        ) : null}

      </div>
    </div>
  </AppShell>
  );
}

function CredentialItem({ label, value, sensitive = false }) {
  return (
    <div style={styles.credentialCard}>
      <span style={styles.credentialLabel}>{label}</span>
      <span style={sensitive ? styles.credentialValueSensitive : styles.credentialValue}>
        {value || "-"}
      </span>
    </div>
  );
}

const styles = {
  pageBackdrop: {
    borderRadius: "28px",
    padding: "16px",
    background:
      "radial-gradient(circle at 0% 0%, rgba(14,116,144,0.16) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 100% 100%, rgba(245,158,11,0.14) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%)",
    border: "1px solid rgba(14, 116, 144, 0.12)",
    boxShadow: "0 22px 48px rgba(15, 23, 42, 0.07)",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  heroPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)",
    gap: "20px",
    padding: "24px",
    borderRadius: "22px",
    background:
      "linear-gradient(136deg, rgba(8,145,178,0.14) 0%, rgba(255,255,255,0.95) 42%, rgba(245,158,11,0.16) 100%)",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
    marginBottom: "18px",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  badge: {
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #0e7490 0%, #0f766e 100%)",
    color: "#f0fdfa",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.1,
    color: "#0f172a",
    letterSpacing: "-0.04em",
  },
  heroText: {
    margin: 0,
    color: "#334155",
    fontSize: "15px",
    lineHeight: 1.75,
    maxWidth: "760px",
  },
  heroChecklist: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  checkItem: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(14, 116, 144, 0.16)",
    color: "#1e293b",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: "600",
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  sectionTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "800",
    letterSpacing: "-0.01em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  input: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    background: "rgba(255,255,255,0.96)",
    padding: "13px 14px",
    fontSize: "14px",
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "14px",
  },
  button: {
    border: "none",
    borderRadius: "16px",
    padding: "14px 22px",
    background: "linear-gradient(135deg, #0e7490 0%, #0f766e 52%, #0369a1 100%)",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(14, 116, 144, 0.28)",
  },
  actionHint: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  verificationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  checkCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(14, 116, 144, 0.14)",
    cursor: "pointer",
  },
  checkbox: {
    marginTop: "2px",
    width: "16px",
    height: "16px",
    accentColor: "#0f766e",
    flexShrink: 0,
  },
  checkTitle: {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },
  checkText: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.65,
    color: "#475569",
  },
  error: {
    background: "linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  success: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  credentialsPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(14, 116, 144, 0.12)",
    background:
      "linear-gradient(160deg, rgba(240,249,255,0.8) 0%, rgba(255,255,255,0.9) 46%, rgba(255,251,235,0.85) 100%)",
  },
  credentialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  credentialCard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px",
    borderRadius: "18px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,242,234,0.95) 100%)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  credentialLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  credentialValue: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
    wordBreak: "break-word",
  },
  credentialValueSensitive: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#92400e",
    wordBreak: "break-word",
  },
  credentialsNote: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#475569",
  },
  credentialsActions: {
    display: "flex",
    justifyContent: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    border: "1px solid rgba(14, 116, 144, 0.18)",
    borderRadius: "14px",
    padding: "11px 16px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    color: "#0f172a",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
  },
  auditLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    padding: "11px 16px",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "13px",
    textDecoration: "none",
  },
  controlHeaderRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "14px",
    padding: "14px",
    borderRadius: "16px",
    background:
      "linear-gradient(120deg, rgba(240,249,255,0.9) 0%, rgba(255,255,255,0.96) 50%, rgba(255,251,235,0.9) 100%)",
    border: "1px solid rgba(14, 116, 144, 0.12)",
  },
  controlHeaderCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
    minWidth: "280px",
  },
  controlHeaderText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#475569",
  },
  controlHeaderMeta: {
    margin: 0,
    fontSize: "12px",
    color: "#0f766e",
    fontWeight: "700",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  controlActions: {
    display: "flex",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: "10px",
  },
  controlField: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "240px",
  },
  controlLabel: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  controlToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(14, 116, 144, 0.16)",
    background: "rgba(255,255,255,0.92)",
    fontSize: "13px",
    fontWeight: "600",
    color: "#334155",
  },
  controlHelperText: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
    lineHeight: 1.6,
  },
  clientList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  clientCard: {
    border: "1px solid rgba(14, 116, 144, 0.16)",
    borderRadius: "16px",
    background:
      "linear-gradient(160deg, rgba(240,249,255,0.88) 0%, rgba(255,255,255,0.94) 46%, rgba(255,251,235,0.84) 100%)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
  },
  clientCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    flexWrap: "wrap",
  },
  clientCode: {
    margin: 0,
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#0f766e",
  },
  clientOwnerMeta: {
    margin: "4px 0 0",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "#475569",
  },
  statusBadgeActive: {
    display: "inline-flex",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "rgba(22,163,74,0.12)",
    color: "#166534",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  statusBadgeSuspended: {
    display: "inline-flex",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "rgba(220,38,38,0.10)",
    color: "#b91c1c",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  clientEditGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "10px",
  },
  clientMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "8px 12px",
    fontSize: "12px",
    color: "#64748b",
  },
  clientBillingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  textArea: {
    width: "100%",
    minHeight: "88px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    background: "rgba(255,255,255,0.96)",
    padding: "13px 14px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
  },
  clientActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  suspendButton: {
    border: "1px solid rgba(220, 38, 38, 0.24)",
    borderRadius: "14px",
    padding: "11px 14px",
    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  reactivateButton: {
    border: "1px solid rgba(22, 163, 74, 0.24)",
    borderRadius: "14px",
    padding: "11px 14px",
    background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
};

export default TenantOnboardingPage;
