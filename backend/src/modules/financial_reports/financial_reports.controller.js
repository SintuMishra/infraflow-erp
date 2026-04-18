const { sendControllerError } = require("../../utils/http.util");
const {
  getTrialBalanceReport,
  getLedgerReport,
  getPartyLedgerReport,
  getReceivableAgeingReport,
  getPayableAgeingReport,
  getCashBookReport,
  getBankBookReport,
  getVoucherRegisterReport,
} = require("./financial_reports.service");

const trialBalanceController = async (req, res) => {
  try {
    const data = await getTrialBalanceReport({
      companyId: req.companyId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load trial balance");
  }
};

const ledgerReportController = async (req, res) => {
  try {
    const data = await getLedgerReport({
      companyId: req.companyId,
      ledgerId: req.query.ledgerId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load ledger report");
  }
};

const partyLedgerReportController = async (req, res) => {
  try {
    const data = await getPartyLedgerReport({
      companyId: req.companyId,
      partyId: req.query.partyId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load party ledger report");
  }
};

const receivableAgeingController = async (req, res) => {
  try {
    const data = await getReceivableAgeingReport({
      companyId: req.companyId,
      asOfDate: req.query.asOfDate,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load receivable ageing report");
  }
};

const payableAgeingController = async (req, res) => {
  try {
    const data = await getPayableAgeingReport({
      companyId: req.companyId,
      asOfDate: req.query.asOfDate,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load payable ageing report");
  }
};

const cashBookController = async (req, res) => {
  try {
    const data = await getCashBookReport({
      companyId: req.companyId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load cash book");
  }
};

const bankBookController = async (req, res) => {
  try {
    const data = await getBankBookReport({
      companyId: req.companyId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load bank book");
  }
};

const voucherRegisterController = async (req, res) => {
  try {
    const data = await getVoucherRegisterReport({
      companyId: req.companyId,
      voucherType: req.query.voucherType,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load voucher register");
  }
};

module.exports = {
  trialBalanceController,
  ledgerReportController,
  partyLedgerReportController,
  receivableAgeingController,
  payableAgeingController,
  cashBookController,
  bankBookController,
  voucherRegisterController,
};
