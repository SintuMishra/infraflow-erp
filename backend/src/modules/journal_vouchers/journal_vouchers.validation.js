const { validateCreateVoucherInput, validateReverseVoucherInput } = require("../general_ledger/general_ledger.validation");

module.exports = {
  validateCreateJournalVoucherInput: validateCreateVoucherInput,
  validateReverseJournalVoucherInput: validateReverseVoucherInput,
};
