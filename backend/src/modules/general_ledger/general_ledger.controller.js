const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listVoucherEntries,
  getVoucherEntryById,
  createVoucherEntry,
  postVoucherEntry,
  reverseVoucherEntry,
  getLedgerBook,
} = require("./general_ledger.service");

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
  getVoucherByIdController,
  createVoucherController,
  postVoucherController,
  reverseVoucherController,
  getLedgerBookController,
};
