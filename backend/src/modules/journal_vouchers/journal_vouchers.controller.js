const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listJournalVouchers,
  createJournalVoucher,
  postJournalVoucher,
  reverseJournalVoucher,
} = require("./journal_vouchers.service");

const listJournalVouchersController = async (req, res) => {
  try {
    const data = await listJournalVouchers({
      companyId: req.companyId,
      voucherType: req.query.voucherType,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
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

const createJournalVoucherController = async (req, res) => {
  try {
    const data = await createJournalVoucher({
      companyId: req.companyId,
      voucherType: req.body.voucherType,
      voucherDate: req.body.voucherDate,
      accountingPeriodId: req.body.accountingPeriodId,
      approvalStatus: req.body.approvalStatus,
      narration: req.body.narration,
      sourceModule: req.body.sourceModule || "journal_vouchers",
      sourceRecordId: req.body.sourceRecordId || null,
      lines: req.body.lines,
      createdByUserId: req.user?.userId || null,
      autoPost: Boolean(req.body.autoPost),
    });

    await recordAuditEvent({
      action: "finance.journal_voucher.created",
      actorUserId: req.user?.userId || null,
      targetType: "voucher",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        voucherNumber: data.voucherNumber,
        voucherType: data.voucherType,
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

const postJournalVoucherController = async (req, res) => {
  try {
    const data = await postJournalVoucher({
      companyId: req.companyId,
      voucherId: req.params.id,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.journal_voucher.posted",
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

const reverseJournalVoucherController = async (req, res) => {
  try {
    const data = await reverseJournalVoucher({
      companyId: req.companyId,
      voucherId: req.params.id,
      voucherDate: req.body.voucherDate,
      narration: req.body.narration,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.journal_voucher.reversed",
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

module.exports = {
  listJournalVouchersController,
  createJournalVoucherController,
  postJournalVoucherController,
  reverseJournalVoucherController,
};
