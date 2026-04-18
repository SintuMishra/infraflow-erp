const {
  listVoucherEntries,
  createVoucherEntry,
  postVoucherEntry,
  reverseVoucherEntry,
} = require("../general_ledger/general_ledger.service");

const JOURNAL_TYPES = ["journal", "payment", "receipt", "contra"];

const listJournalVouchers = async ({ companyId, voucherType = "", ...rest }) => {
  const normalizedType = String(voucherType || "").trim().toLowerCase();

  if (normalizedType && !JOURNAL_TYPES.includes(normalizedType)) {
    const error = new Error("voucherType must be one of journal/payment/receipt/contra");
    error.statusCode = 400;
    throw error;
  }

  return listVoucherEntries({
    companyId,
    voucherType: normalizedType || undefined,
    ...rest,
  });
};

const createJournalVoucher = async ({ companyId, voucherType, ...payload }) => {
  const normalizedType = String(voucherType || "").trim().toLowerCase();
  if (!JOURNAL_TYPES.includes(normalizedType)) {
    const error = new Error("voucherType must be one of journal/payment/receipt/contra");
    error.statusCode = 400;
    throw error;
  }

  return createVoucherEntry({
    companyId,
    voucherType: normalizedType,
    ...payload,
  });
};

const postJournalVoucher = async ({ companyId, voucherId, userId }) =>
  postVoucherEntry({ companyId, voucherId, userId });

const reverseJournalVoucher = async ({
  companyId,
  voucherId,
  voucherDate,
  narration,
  userId,
}) =>
  reverseVoucherEntry({
    companyId,
    voucherId,
    voucherDate,
    narration,
    userId,
  });

module.exports = {
  listJournalVouchers,
  createJournalVoucher,
  postJournalVoucher,
  reverseJournalVoucher,
};
