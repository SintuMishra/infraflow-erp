const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listPayables,
  createPayable,
  settlePayable,
} = require("./accounts_payable.service");

const listPayablesController = async (req, res) => {
  try {
    const data = await listPayables({
      companyId: req.companyId,
      status: req.query.status,
      vendorId: req.query.vendorId,
      partyId: req.query.partyId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load payables");
  }
};

const createPayableController = async (req, res) => {
  try {
    const data = await createPayable({
      companyId: req.companyId,
      partyId: req.body?.partyId,
      vendorId: req.body?.vendorId,
      referenceNumber: req.body?.referenceNumber,
      billDate: req.body?.billDate,
      dueDate: req.body?.dueDate,
      amount: req.body?.amount,
      notes: req.body?.notes,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.payable.created",
      actorUserId: req.user?.userId || null,
      targetType: "payable",
      targetId: data.payable?.id || null,
      companyId: req.companyId || null,
      details: {
        voucherId: data.voucher?.id || null,
        referenceNumber: req.body?.referenceNumber || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Payable created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create payable");
  }
};

const settlePayableController = async (req, res) => {
  try {
    const data = await settlePayable({
      companyId: req.companyId,
      payableId: req.params.id,
      amount: req.body?.amount,
      settlementDate: req.body?.settlementDate,
      referenceNumber: req.body?.referenceNumber,
      notes: req.body?.notes,
      bankLedgerId: req.body?.bankLedgerId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.payable.settled",
      actorUserId: req.user?.userId || null,
      targetType: "payable",
      targetId: req.params.id,
      companyId: req.companyId || null,
      details: {
        settlementId: data.settlement?.id || null,
        voucherId: data.voucher?.id || null,
        amount: req.body?.amount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payable settled successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to settle payable");
  }
};

module.exports = {
  listPayablesController,
  createPayableController,
  settlePayableController,
};
