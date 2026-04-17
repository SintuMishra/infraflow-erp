const { getAuditLogs } = require("./audit_logs.service");
const { sendControllerError } = require("../../utils/http.util");

const getAuditLogsController = async (req, res) => {
  try {
    const data = await getAuditLogs({
      companyId: req.companyId || null,
      action: req.query.action || "",
      targetType: req.query.targetType || "",
      search: req.query.search || "",
      startDate: req.query.startDate || "",
      endDate: req.query.endDate || "",
      page: req.query.page || 1,
      limit: req.query.limit || 100,
    });

    return res.status(200).json({
      success: true,
      data: data.items,
      meta: {
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.total
          ? Math.ceil(data.total / data.limit)
          : 0,
        summary: data.summary,
        facets: data.facets,
      },
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load audit logs");
  }
};

module.exports = {
  getAuditLogsController,
};
