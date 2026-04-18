const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listReceivables,
  markDispatchReadyForFinance,
  createReceivableFromDispatch,
  settleReceivable,
} = require("./accounts_receivable.service");

const listReceivablesController = async (req, res) => {
  try {
    const data = await listReceivables({
      companyId: req.companyId,
      status: req.query.status,
      partyId: req.query.partyId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load receivables");
  }
};

const markDispatchReadyController = async (req, res) => {
  try {
    const data = await markDispatchReadyForFinance({
      companyId: req.companyId,
      dispatchId: req.params.dispatchId,
      financeNotes: req.body?.financeNotes,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.dispatch.mark_ready",
      actorUserId: req.user?.userId || null,
      targetType: "dispatch_report",
      targetId: req.params.dispatchId,
      companyId: req.companyId || null,
      details: {
        financeStatus: data.financeStatus,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Dispatch marked ready for finance posting",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to mark dispatch ready for finance");
  }
};

const createFromDispatchController = async (req, res) => {
  try {
    const data = await createReceivableFromDispatch({
      companyId: req.companyId,
      dispatchId: req.params.dispatchId,
      dueDate: req.body?.dueDate,
      notes: req.body?.notes,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.receivable.created_from_dispatch",
      actorUserId: req.user?.userId || null,
      targetType: "receivable",
      targetId: data.receivable?.id || null,
      companyId: req.companyId || null,
      details: {
        dispatchId: req.params.dispatchId,
        voucherId: data.voucher?.id || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Receivable created from dispatch successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create receivable from dispatch");
  }
};

const settleReceivableController = async (req, res) => {
  try {
    const data = await settleReceivable({
      companyId: req.companyId,
      receivableId: req.params.id,
      amount: req.body?.amount,
      settlementDate: req.body?.settlementDate,
      referenceNumber: req.body?.referenceNumber,
      notes: req.body?.notes,
      bankLedgerId: req.body?.bankLedgerId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.receivable.settled",
      actorUserId: req.user?.userId || null,
      targetType: "receivable",
      targetId: req.params.id,
      companyId: req.companyId || null,
      details: {
        amount: req.body?.amount,
        settlementId: data.settlement?.id || null,
        voucherId: data.voucher?.id || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Receivable settled successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to settle receivable");
  }
};

module.exports = {
  listReceivablesController,
  markDispatchReadyController,
  createFromDispatchController,
  settleReceivableController,
};
