const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const { createReceipt, getReceipt, listReceipts } = require("./goods_receipts.service");

const resolveScopedCompanyId = (req) =>
  normalizeCompanyId(req.companyId ?? req.user?.companyId ?? req.headers["x-company-id"]);

const getAllGoodsReceipts = async (req, res) => {
  try {
    const data = await listReceipts({
      companyId: resolveScopedCompanyId(req),
      status: req.query?.status,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch goods receipts");
  }
};

const getGoodsReceiptDetails = async (req, res) => {
  try {
    const data = await getReceipt({
      id: req.params.id,
      companyId: resolveScopedCompanyId(req),
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to fetch goods receipt");
  }
};

const addGoodsReceipt = async (req, res) => {
  try {
    const companyId = resolveScopedCompanyId(req);
    const data = await createReceipt({
      ...req.body,
      companyId,
      userId: req.user?.userId || null,
    });

    await recordAuditEvent({
      action: "goods_receipt.created",
      actorUserId: req.user?.userId || null,
      targetType: "goods_receipt",
      targetId: data.id,
      companyId,
      details: {
        grnNumber: data.grnNumber,
        purchaseOrderId: data.purchaseOrderId,
        vendorId: data.vendorId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Goods receipt created successfully",
      data,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to create goods receipt");
  }
};

module.exports = {
  addGoodsReceipt,
  getAllGoodsReceipts,
  getGoodsReceiptDetails,
};
