const {
  validateCreateVoucherInput,
  validateApproveVoucherInput,
  validateRejectVoucherInput,
  validateReverseVoucherInput,
} = require("../general_ledger/general_ledger.validation");

module.exports = {
  validateCreateJournalVoucherInput: validateCreateVoucherInput,
  validateApproveJournalVoucherInput: validateApproveVoucherInput,
  validateRejectJournalVoucherInput: validateRejectVoucherInput,
  validateReverseJournalVoucherInput: validateReverseVoucherInput,
};
