const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listBankAccounts,
  createBankAccount,
  updateBankAccountStatus,
  createCashBankVoucher,
} = require("./cash_bank.service");

const listBankAccountsController = async (req, res) => {
  try {
    const data = await listBankAccounts({
      companyId: req.companyId,
      activeOnly: String(req.query.activeOnly || "").trim().toLowerCase() === "true",
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load bank accounts");
  }
};

const createBankAccountController = async (req, res) => {
  try {
    const data = await createBankAccount({
      companyId: req.companyId,
      ...req.body,
    });

    await recordAuditEvent({
      action: "finance.bank_account.created",
      actorUserId: req.user?.userId || null,
      targetType: "bank_account",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        accountName: data.accountName,
        bankName: data.bankName,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Bank account created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create bank account");
  }
};

const updateBankAccountStatusController = async (req, res) => {
  try {
    const data = await updateBankAccountStatus({
      companyId: req.companyId,
      bankAccountId: req.params.id,
      isActive: req.body?.isActive,
      isDefault: Object.prototype.hasOwnProperty.call(req.body || {}, "isDefault")
        ? req.body.isDefault
        : null,
    });

    await recordAuditEvent({
      action: "finance.bank_account.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "bank_account",
      targetId: data.id,
      companyId: req.companyId || null,
      details: {
        isActive: data.isActive,
        isDefault: data.isDefault,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bank account updated successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update bank account");
  }
};

const createCashBankVoucherController = async (req, res) => {
  try {
    const data = await createCashBankVoucher({
      companyId: req.companyId,
      voucherType: req.body?.voucherType,
      voucherDate: req.body?.voucherDate,
      amount: req.body?.amount,
      cashOrBankAccountId: req.body?.cashOrBankAccountId,
      cashOrBankLedgerId: req.body?.cashOrBankLedgerId,
      counterAccountId: req.body?.counterAccountId,
      counterLedgerId: req.body?.counterLedgerId,
      partyId: req.body?.partyId,
      vendorId: req.body?.vendorId,
      narration: req.body?.narration,
      userId: req.user?.userId || null,
      autoPost: req.body?.autoPost !== false,
    });

    await recordAuditEvent({
      action: "finance.cash_bank.voucher_created",
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
      message: "Cash/Bank voucher created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create cash/bank voucher");
  }
};

module.exports = {
  listBankAccountsController,
  createBankAccountController,
  updateBankAccountStatusController,
  createCashBankVoucherController,
};
