const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const {
  createInvoice,
  getInvoice,
  listInvoices,
  postInvoiceToPayables,
} = require("./purchase_invoices.service");

const resolveScopedCompanyId = (req) =>
  normalizeCompanyId(req.companyId ?? req.user?.companyId ?? req.headers["x-company-id"]);

const getAllPurchaseInvoices = async (req, res) => {
  try {
    const data = await listInvoices({
      companyId: resolveScopedCompanyId(req),
      status: req.query?.status,
      matchStatus: req.query?.matchStatus,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase invoices");
  }
};

const getPurchaseInvoiceDetails = async (req, res) => {
  try {
    const data = await getInvoice({
      id: req.params.id,
      companyId: resolveScopedCompanyId(req),
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch purchase invoice");
  }
};

const addPurchaseInvoice = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await createInvoice({
      ...req.body,
      companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_invoice.created",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_invoice",
      targetId: data.id,
      companyId,
      details: {
        invoiceNumber: data.invoiceNumber,
        purchaseOrderId: data.purchaseOrderId,
        matchStatus: data.matchStatus,
        payableId: data.payableId || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Purchase invoice created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create purchase invoice");
  }
};

const postPurchaseInvoiceController = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await postInvoiceToPayables({
      id: req.params.id,
      companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "purchase_invoice.posted",
      actorUserId: req.user?.userId || null,
      targetType: "purchase_invoice",
      targetId: data.id,
      companyId,
      details: {
        payableId: data.payableId || null,
        status: data.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase invoice posted to accounts payable",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to post purchase invoice");
  }
};

module.exports = {
  addPurchaseInvoice,
  getAllPurchaseInvoices,
  getPurchaseInvoiceDetails,
  postPurchaseInvoiceController,
};
