const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const {
  listAccountGroups,
  createAccountGroup,
  listChartOfAccounts,
  createChartOfAccount,
  listLedgers,
  createLedger,
  listFinancialYears,
  createFinancialYear,
  createAccountingPeriod,
  bootstrapDefaultAccounts,
  syncPartyAndVendorLedgers,
} = require("./accounts_masters.service");

const listAccountGroupsController = async (req, res) => {
  try {
    const data = await listAccountGroups({ companyId: req.companyId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load account groups");
  }
};

const createAccountGroupController = async (req, res) => {
  try {
    const data = await createAccountGroup({ companyId: req.companyId, ...req.body });
    await recordAuditEvent({
      action: "finance.account_group.created",
      actorUserId: req.user?.userId || null,
      targetType: "account_group",
      targetId: data.id,
      companyId: req.companyId || null,
      details: { groupCode: data.groupCode, groupName: data.groupName },
    });

    return res.status(201).json({ success: true, message: "Account group created", data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create account group");
  }
};

const listChartOfAccountsController = async (req, res) => {
  try {
    const data = await listChartOfAccounts({
      companyId: req.companyId,
      accountType: req.query.accountType,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load chart of accounts");
  }
};

const createChartOfAccountController = async (req, res) => {
  try {
    const data = await createChartOfAccount({ companyId: req.companyId, ...req.body });
    await recordAuditEvent({
      action: "finance.chart_of_account.created",
      actorUserId: req.user?.userId || null,
      targetType: "chart_of_account",
      targetId: data.id,
      companyId: req.companyId || null,
      details: { accountCode: data.accountCode, accountName: data.accountName },
    });

    return res.status(201).json({ success: true, message: "Chart of account created", data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create chart of account");
  }
};

const listLedgersController = async (req, res) => {
  try {
    const data = await listLedgers({
      companyId: req.companyId,
      accountId: req.query.accountId,
      partyId: req.query.partyId,
      vendorId: req.query.vendorId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load ledgers");
  }
};

const createLedgerController = async (req, res) => {
  try {
    const data = await createLedger({ companyId: req.companyId, ...req.body });

    await recordAuditEvent({
      action: "finance.ledger.created",
      actorUserId: req.user?.userId || null,
      targetType: "ledger",
      targetId: data.id,
      companyId: req.companyId || null,
      details: { ledgerCode: data.ledgerCode, ledgerName: data.ledgerName },
    });

    return res.status(201).json({ success: true, message: "Ledger created", data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create ledger");
  }
};

const listFinancialYearsController = async (req, res) => {
  try {
    const data = await listFinancialYears({ companyId: req.companyId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load financial years");
  }
};

const createFinancialYearController = async (req, res) => {
  try {
    const data = await createFinancialYear({ companyId: req.companyId, ...req.body });

    await recordAuditEvent({
      action: "finance.financial_year.created",
      actorUserId: req.user?.userId || null,
      targetType: "financial_year",
      targetId: data.id,
      companyId: req.companyId || null,
      details: { fyCode: data.fyCode, fyName: data.fyName },
    });

    return res.status(201).json({ success: true, message: "Financial year created", data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create financial year");
  }
};

const createAccountingPeriodController = async (req, res) => {
  try {
    const data = await createAccountingPeriod({ companyId: req.companyId, ...req.body });

    await recordAuditEvent({
      action: "finance.accounting_period.created",
      actorUserId: req.user?.userId || null,
      targetType: "accounting_period",
      targetId: data.id,
      companyId: req.companyId || null,
      details: { periodCode: data.periodCode, periodName: data.periodName },
    });

    return res.status(201).json({ success: true, message: "Accounting period created", data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create accounting period");
  }
};

const bootstrapFinanceDefaultsController = async (req, res) => {
  try {
    const data = await bootstrapDefaultAccounts({
      companyId: req.companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "finance.bootstrap.defaults",
      actorUserId: req.user?.userId || null,
      targetType: "finance",
      companyId: req.companyId || null,
      details: data,
    });

    return res.status(200).json({
      success: true,
      message: data.created
        ? "Finance defaults initialized"
        : "Finance defaults already initialized",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to bootstrap finance defaults");
  }
};

const syncPartyVendorLedgersController = async (req, res) => {
  try {
    const data = await syncPartyAndVendorLedgers({ companyId: req.companyId });

    await recordAuditEvent({
      action: "finance.ledger.sync_parties_vendors",
      actorUserId: req.user?.userId || null,
      targetType: "finance",
      companyId: req.companyId || null,
      details: data,
    });

    return res.status(200).json({
      success: true,
      message: "Party and vendor ledgers synchronized",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to sync party/vendor ledgers");
  }
};

module.exports = {
  listAccountGroupsController,
  createAccountGroupController,
  listChartOfAccountsController,
  createChartOfAccountController,
  listLedgersController,
  createLedgerController,
  listFinancialYearsController,
  createFinancialYearController,
  createAccountingPeriodController,
  bootstrapFinanceDefaultsController,
  syncPartyVendorLedgersController,
};
