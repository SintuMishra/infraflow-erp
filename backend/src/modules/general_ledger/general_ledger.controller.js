const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listVoucherEntries,
  getVoucherWorkflowInbox,
  getFinancePolicySettings,
  updateFinancePolicySettings,
  getFinanceTransitionHistory,
  getVoucherEntryById,
  createVoucherEntry,
  submitVoucherEntry,
  approveVoucherEntry,
  rejectVoucherEntry,
  postVoucherEntry,
  reverseVoucherEntry,
  getLedgerBook,
} = require("./general_ledger.service");

const csvEscape = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const listVouchersController = async (req, res) => {
  try {
    const data = await listVoucherEntries({
      companyId: req.companyId,
      voucherType: req.query.voucherType,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search,
      limit: req.query.limit,
      page: req.query.page,
    });

    return res.status(200).json({
      success: true,
      data: data.items,
      meta: {
        total: data.total,
        page: data.page,
        limit: data.limit,
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load vouchers");
  }
};

const getVoucherByIdController = async (req, res) => {
  try {
    const data = await getVoucherEntryById({
      voucherId: req.params.id,
      companyId: req.companyId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load voucher");
  }
};

const getVoucherWorkflowInboxController = async (req, res) => {
  try {
    const data = await getVoucherWorkflowInbox({
      companyId: req.companyId,
      limit: req.query.limit,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load workflow inbox");
  }
};

const listFinanceTransitionHistoryController = async (req, res) => {
  try {
    const data = await getFinanceTransitionHistory({
      companyId: req.companyId,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      performedByUserId: req.query.performedByUserId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
      page: req.query.page,
    });

    if (String(req.query.format || "").trim().toLowerCase() === "csv") {
      const headers = [
        "id",
        "entityType",
        "entityId",
        "action",
        "fromState",
        "toState",
        "performedByUserId",
        "performedByDisplayName",
        "remarks",
        "createdAt",
      ];
      const csvRows = [headers.join(",")].concat(
        data.items.map((row) =>
          headers
            .map((key) => csvEscape(row[key]))
            .join(",")
        )
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"finance-transition-history-${new Date().toISOString().slice(0, 10)}.csv\"`
      );
      return res.status(200).send(csvRows.join("\n"));
    }

    return res.status(200).json({
      success: true,
      data: data.items,
      meta: {
        total: data.total,
        page: data.page,
        limit: data.limit,
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load finance transition history");
  }
};

const getFinancePolicySettingsController = async (req, res) => {
  try {
    const data = await getFinancePolicySettings({
      companyId: req.companyId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load finance policy settings");
  }
};

const updateFinancePolicySettingsController = async (req, res) => {
  try {
    const data = await updateFinancePolicySettings({
      companyId: req.companyId,
      userId: req.user?.userId || null,
      allowSubmitterSelfApproval: req.body?.allowSubmitterSelfApproval,
      allowMakerSelfApproval: req.body?.allowMakerSelfApproval,
      allowApproverSelfPosting: req.body?.allowApproverSelfPosting,
      allowMakerSelfPosting: req.body?.allowMakerSelfPosting,
      lastUpdateNotes: req.body?.lastUpdateNotes || "",
    });

    await recordAuditEvent({
      action: "finance.policy.updated",
      actorUserId: req.user?.userId || null,
      targetType: "finance_policy_controls",
      targetId: req.companyId || null,
      companyId: req.companyId || null,
      details: {
        allowSubmitterSelfApproval: data.allowSubmitterSelfApproval,
        allowMakerSelfApproval: data.allowMakerSelfApproval,
        allowApproverSelfPosting: data.allowApproverSelfPosting,
        allowMakerSelfPosting: data.allowMakerSelfPosting,
        lastUpdateNotes: data.lastUpdateNotes || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Finance policy settings updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update finance policy settings");
  }
};

const createVoucherController = async (req, res) => {
  try {
    const data = await createVoucherEntry({
      companyId: req.companyId,
      voucherType: req.body.voucherType,
      voucherDate: req.body.voucherDate,
      accountingPeriodId: req.body.accountingPeriodId,
      approvalStatus: req.body.approvalStatus,
      narration: req.body.narration,
      sourceModule: req.body.sourceModule,
      sourceRecordId: req.body.sourceRecordId,
      sourceEvent: req.body.sourceEvent,
      lines: req.body.lines,
      createdByUserId: req.user?.userId || null,
      autoPost: Boolean(req.body.autoPost),
    });

    await recordAuditEvent({
      action: "finance.voucher.created",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
        voucherType: data.voucherType,
        status: data.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Voucher created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create voucher");
  }
};

const postVoucherController = async (req, res) => {
  try {
    const data = await postVoucherEntry({
      voucherId: req.params.id,
      companyId: req.companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.voucher.posted",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Voucher posted successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to post voucher");
  }
};

const submitVoucherController = async (req, res) => {
  try {
    const data = await submitVoucherEntry({
      voucherId: req.params.id,
      companyId: req.companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.voucher.submitted",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Voucher submitted successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to submit voucher");
  }
};

const approveVoucherController = async (req, res) => {
  try {
    const data = await approveVoucherEntry({
      voucherId: req.params.id,
      companyId: req.companyId,
      userId: req.user?.userId || null,
      approvalNotes: req.body?.approvalNotes || "",
    });

    await recordAuditEvent({
      action: "finance.voucher.approved",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
        approvalNotes: req.body?.approvalNotes || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Voucher approved successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to approve voucher");
  }
};

const rejectVoucherController = async (req, res) => {
  try {
    const data = await rejectVoucherEntry({
      voucherId: req.params.id,
      companyId: req.companyId,
      userId: req.user?.userId || null,
      rejectionReason: req.body?.rejectionReason || "",
    });

    await recordAuditEvent({
      action: "finance.voucher.rejected",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
        rejectionReason: req.body?.rejectionReason || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Voucher rejected successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to reject voucher");
  }
};

const reverseVoucherController = async (req, res) => {
  try {
    const data = await reverseVoucherEntry({
      voucherId: req.params.id,
      companyId: req.companyId,
      voucherDate: req.body.voucherDate,
      narration: req.body.narration,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.voucher.reversed",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: req.params.id,
      companyId: req.companyId || null,
      details: {
        reversalVoucherId: data.reversalVoucher?.id || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Voucher reversed successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to reverse voucher");
  }
};

const getLedgerBookController = async (req, res) => {
  try {
    const data = await getLedgerBook({
      ledgerId: req.params.ledgerId,
      companyId: req.companyId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load ledger book");
  }
};

module.exports = {
  listVouchersController,
  getVoucherWorkflowInboxController,
  getFinancePolicySettingsController,
  updateFinancePolicySettingsController,
  listFinanceTransitionHistoryController,
  getVoucherByIdController,
  createVoucherController,
  submitVoucherController,
  approveVoucherController,
  rejectVoucherController,
  postVoucherController,
  reverseVoucherController,
  getLedgerBookController,
};
