const crypto = require("node:crypto");

const env = require("../../config/env");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  bootstrapCompanyOwner,
  createManagedCompanyBillingInvoice,
  listManagedCompanies,
  listManagedCompanyBillingInvoices,
  permanentlyDeleteManagedCompany,
  setManagedCompanyAccessStatus,
  updateManagedCompanyBillingProfile,
  updateManagedCompanyProfile,
} = require("./onboarding.service");

const isMatchingBootstrapSecret = (providedSecret, configuredSecret) => {
  const providedBuffer = Buffer.from(String(providedSecret || "").trim(), "utf8");
  const configuredBuffer = Buffer.from(String(configuredSecret || "").trim(), "utf8");

  if (providedBuffer.length === 0 || providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, configuredBuffer);
};

const recordOnboardingAudit = async ({
  action,
  req,
  companyId = null,
  details = {},
}) => {
  await recordAuditEvent({
    action,
    targetType: "onboarding",
    targetId: companyId,
    companyId,
    details: {
      companyName: String(req.body?.companyName || "").trim() || null,
      ownerFullName: String(req.body?.ownerFullName || "").trim() || null,
      requestId: req.requestId || null,
      ...details,
    },
  });
};

const bootstrapCompanyOwnerController = async (req, res) => {
  try {
    const actorCompanyId = Number(req.companyId || req.user?.companyId || 0) || null;
    const platformOwnerCompanyId =
      Number(env.platformOwnerCompanyId || 0) || null;

    if (platformOwnerCompanyId !== null && actorCompanyId !== platformOwnerCompanyId) {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_forbidden_company_scope",
        req,
        details: {
          actorCompanyId,
          platformOwnerCompanyId,
        },
      });

      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can bootstrap new tenant companies.",
      });
    }

    if (!env.onboardingBootstrapSecret) {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_unavailable",
        req,
      });

      return res.status(503).json({
        success: false,
        message:
          "Onboarding bootstrap is not enabled on this environment",
      });
    }

    const providedSecret = String(
      req.headers["x-bootstrap-secret"] || ""
    ).trim();

    if (!isMatchingBootstrapSecret(providedSecret, env.onboardingBootstrapSecret)) {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_secret_rejected",
        req,
      });

      return res.status(403).json({
        success: false,
        message: "Invalid bootstrap secret",
      });
    }

    const data = await bootstrapCompanyOwner(req.body);

    await recordOnboardingAudit({
      action: "onboarding.company_owner_bootstrapped",
      req,
      companyId: data.company?.id || null,
      details: {
        companyCode: data.company?.companyCode || null,
        ownerEmployeeId: data.owner?.employeeId || null,
        ownerUsername: data.owner?.username || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Company and owner bootstrapped successfully",
      data,
    });
  } catch (error) {
    if (error.message === "COMPANY_FOUNDATION_MISSING") {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_failed_foundation_missing",
        req,
      });

      return res.status(500).json({
        success: false,
        message:
          "Multi-company foundation is missing. Apply company migrations before onboarding customers.",
      });
    }

    if (error.message === "COMPANY_SCOPE_INCOMPLETE") {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_failed_scope_incomplete",
        req,
      });

      return res.status(500).json({
        success: false,
        message:
          "Company-scoped tables are incomplete. Finish company scope migration before onboarding customers.",
      });
    }

    if (error.message === "INVALID_ONBOARDING_PAYLOAD") {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_failed_invalid_payload",
        req,
      });

      return res.status(400).json({
        success: false,
        message:
          "companyName, ownerFullName, and ownerDesignation are required",
      });
    }

    if (error.message === "COMPANY_ALREADY_EXISTS") {
      await recordOnboardingAudit({
        action: "onboarding.bootstrap_failed_duplicate_company",
        req,
      });

      return res.status(409).json({
        success: false,
        message:
          "A company with the same name already exists. Use a distinct legal company name or activate the existing tenant.",
      });
    }

    await recordOnboardingAudit({
      action: "onboarding.bootstrap_failed_unexpected",
      req,
      details: {
        errorMessage: error.message || "Unexpected onboarding failure",
      },
    });

    return sendControllerError(
      req,
      res,
      error,
      "Failed to bootstrap company owner"
    );
  }
};

const assertPlatformOwnerControlScope = async (req, action) => {
  const actorCompanyId = Number(req.companyId || req.user?.companyId || 0) || null;
  const platformOwnerCompanyId =
    Number(env.platformOwnerCompanyId || 0) || null;

  if (platformOwnerCompanyId !== null && actorCompanyId !== platformOwnerCompanyId) {
    await recordOnboardingAudit({
      action,
      req,
      details: {
        actorCompanyId,
        platformOwnerCompanyId,
      },
    });

    const error = new Error("FORBIDDEN_PLATFORM_OWNER_SCOPE");
    error.statusCode = 403;
    throw error;
  }
};

const listManagedCompaniesController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_access_list_forbidden_scope");

    const includeInactive =
      String(req.query?.includeInactive || "")
        .trim()
        .toLowerCase() === "true";
    const status = String(req.query?.status || "all")
      .trim()
      .toLowerCase();
    const billingStatus = String(req.query?.billingStatus || "all")
      .trim()
      .toLowerCase();

    const data = await listManagedCompanies({
      search: req.query?.search || "",
      includeInactive,
      status,
      billingStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Managed client companies loaded successfully",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    return sendControllerError(req, res, error, "Failed to load managed client companies");
  }
};

const updateManagedCompanyController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_update_forbidden_scope");

    const data = await updateManagedCompanyProfile({
      companyId: req.params.companyId,
      companyName: req.body?.companyName,
      branchName: req.body?.branchName,
      companyEmail: req.body?.companyEmail,
      companyMobile: req.body?.companyMobile,
    });

    await recordOnboardingAudit({
      action: "onboarding.company_profile_updated_by_owner",
      req,
      companyId: data.company?.id || null,
      details: {
        companyCode: data.company?.companyCode || null,
        companyName: data.company?.companyName || null,
        branchName: data.companyProfile?.branchName || null,
        companyEmail: data.companyProfile?.email || null,
        companyMobile: data.companyProfile?.mobile || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Client company profile updated successfully",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_UPDATE") {
      return res.status(400).json({
        success: false,
        message: "companyId and companyName are required for client update",
      });
    }

    if (error.message === "COMPANY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Client company was not found",
      });
    }

    if (error.message === "COMPANY_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message:
          "A company with this legal name already exists. Use a distinct company name.",
      });
    }

    return sendControllerError(req, res, error, "Failed to update client company profile");
  }
};

const updateManagedCompanyAccessController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_access_update_forbidden_scope");

    const targetIsActive = req.body?.isActive;
    const reason = String(req.body?.reason || "").trim();
    const data = await setManagedCompanyAccessStatus({
      companyId: req.params.companyId,
      isActive: targetIsActive,
    });

    await recordOnboardingAudit({
      action: targetIsActive
        ? "onboarding.company_access_restored_by_owner"
        : "onboarding.company_access_suspended_by_owner",
      req,
      companyId: data.id || null,
      details: {
        companyCode: data.companyCode || null,
        companyName: data.companyName || null,
        isActive: Boolean(data.isActive),
        reason: reason || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: targetIsActive
        ? "Client company access has been restored"
        : "Client company access has been suspended",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_ACCESS") {
      return res.status(400).json({
        success: false,
        message: "companyId and isActive(boolean) are required",
      });
    }

    if (error.message === "COMPANY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Client company was not found",
      });
    }

    if (error.message === "PLATFORM_OWNER_COMPANY_CANNOT_BE_DISABLED") {
      return res.status(400).json({
        success: false,
        message: "Platform owner company cannot be disabled from client controls",
      });
    }

    return sendControllerError(req, res, error, "Failed to update client company access");
  }
};

const updateManagedCompanyBillingController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_billing_update_forbidden_scope");

    const data = await updateManagedCompanyBillingProfile({
      companyId: req.params.companyId,
      billingStatus: req.body?.billingStatus,
      subscriptionPlan: req.body?.subscriptionPlan,
      billingCycle: req.body?.billingCycle,
      customCycleLabel: req.body?.customCycleLabel,
      customCycleDays: req.body?.customCycleDays,
      planAmount: req.body?.planAmount,
      currencyCode: req.body?.currencyCode,
      outstandingAmount: req.body?.outstandingAmount,
      nextDueDate: req.body?.nextDueDate,
      graceUntilDate: req.body?.graceUntilDate,
      lastPaymentDate: req.body?.lastPaymentDate,
      paymentReference: req.body?.paymentReference,
      paymentTerms: req.body?.paymentTerms,
      internalNotes: req.body?.internalNotes,
      updatedByUserId: req.user?.userId || null,
    });

    await recordOnboardingAudit({
      action: "onboarding.company_billing_updated_by_owner",
      req,
      companyId: data.company?.id || null,
      details: {
        companyCode: data.company?.companyCode || null,
        companyName: data.company?.companyName || null,
        billingStatus: data.billing?.billingStatus || null,
        billingCycle: data.billing?.billingCycle || null,
        nextDueDate: data.billing?.nextDueDate || null,
        outstandingAmount: data.billing?.outstandingAmount || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Client billing profile updated successfully",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_BILLING_UPDATE") {
      return res.status(400).json({
        success: false,
        message: "companyId is required for billing update",
      });
    }

    if (error.message === "INVALID_BILLING_AMOUNT") {
      return res.status(400).json({
        success: false,
        message: "planAmount and outstandingAmount must be valid numbers",
      });
    }

    if (error.message === "INVALID_BILLING_GRACE_DATE") {
      return res.status(400).json({
        success: false,
        message: "graceUntilDate must be on or after nextDueDate",
      });
    }

    if (error.message === "INVALID_CUSTOM_BILLING_CYCLE") {
      return res.status(400).json({
        success: false,
        message:
          "customCycleDays must be an integer between 1 and 365 when custom cycle is used",
      });
    }

    if (error.message === "COMPANY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Client company was not found",
      });
    }

    return sendControllerError(req, res, error, "Failed to update client billing profile");
  }
};

const listManagedCompanyBillingInvoicesController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_invoice_list_forbidden_scope");

    const data = await listManagedCompanyBillingInvoices({
      companyId: req.params.companyId,
      limit: req.query?.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Client billing invoices loaded successfully",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_BILLING_INVOICE_OPERATION") {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required",
      });
    }

    return sendControllerError(req, res, error, "Failed to load client billing invoices");
  }
};

const createManagedCompanyBillingInvoiceController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_invoice_create_forbidden_scope");

    const data = await createManagedCompanyBillingInvoice({
      companyId: req.params.companyId,
      invoiceDate: req.body?.invoiceDate,
      periodStartDate: req.body?.periodStartDate,
      periodEndDate: req.body?.periodEndDate,
      dueDate: req.body?.dueDate,
      subscriptionPlan: req.body?.subscriptionPlan,
      planAmount: req.body?.planAmount,
      outstandingAmount: req.body?.outstandingAmount,
      currencyCode: req.body?.currencyCode,
      notes: req.body?.notes,
      paymentReference: req.body?.paymentReference,
      paymentTerms: req.body?.paymentTerms,
      generatedByUserId: req.user?.userId || null,
    });

    await recordOnboardingAudit({
      action: "onboarding.company_billing_invoice_generated_by_owner",
      req,
      companyId: data.company?.id || null,
      details: {
        companyCode: data.company?.companyCode || null,
        companyName: data.company?.companyName || null,
        invoiceNumber: data.invoice?.invoiceNumber || null,
        invoiceDate: data.invoice?.invoiceDate || null,
        totalAmount: data.invoice?.totalAmount || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Client billing invoice generated successfully",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_BILLING_INVOICE_OPERATION") {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required for invoice generation",
      });
    }

    if (error.message === "INVALID_BILLING_INVOICE_PERIOD") {
      return res.status(400).json({
        success: false,
        message: "periodEndDate must be on or after periodStartDate",
      });
    }

    if (error.message === "INVALID_BILLING_AMOUNT") {
      return res.status(400).json({
        success: false,
        message: "planAmount and outstandingAmount must be valid numbers",
      });
    }

    if (error.message === "BILLING_INVOICE_FOUNDATION_MISSING") {
      return res.status(500).json({
        success: false,
        message: "Billing invoice table is missing. Run latest DB migrations first.",
      });
    }

    if (error.message === "COMPANY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Client company was not found",
      });
    }

    return sendControllerError(req, res, error, "Failed to generate client billing invoice");
  }
};

const permanentlyDeleteManagedCompanyController = async (req, res) => {
  try {
    await assertPlatformOwnerControlScope(req, "onboarding.company_permanent_delete_forbidden_scope");

    const reason = String(req.body?.reason || "").trim();
    const data = await permanentlyDeleteManagedCompany({
      companyId: req.params.companyId,
      deletedByUserId: req.user?.userId || null,
    });

    await recordOnboardingAudit({
      action: "onboarding.company_permanently_deleted_by_owner",
      req,
      companyId: data.company?.id || null,
      details: {
        companyCode: data.company?.companyCode || null,
        companyName: data.company?.companyName || null,
        reason: reason || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Client company has been permanently deleted",
      data,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN_PLATFORM_OWNER_SCOPE") {
      return res.status(403).json({
        success: false,
        message:
          "Only the platform owner account can manage client companies.",
      });
    }

    if (error.message === "INVALID_MANAGED_COMPANY_DELETE") {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required",
      });
    }

    if (error.message === "PLATFORM_OWNER_COMPANY_CANNOT_BE_DELETED") {
      return res.status(400).json({
        success: false,
        message: "Platform owner company cannot be permanently deleted",
      });
    }

    if (error.message === "COMPANY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Client company was not found",
      });
    }

    return sendControllerError(req, res, error, "Failed to permanently delete client company");
  }
};

module.exports = {
  bootstrapCompanyOwnerController,
  createManagedCompanyBillingInvoiceController,
  isMatchingBootstrapSecret,
  listManagedCompanyBillingInvoicesController,
  listManagedCompaniesController,
  permanentlyDeleteManagedCompanyController,
  recordOnboardingAudit,
  updateManagedCompanyAccessController,
  updateManagedCompanyBillingController,
  updateManagedCompanyController,
};
