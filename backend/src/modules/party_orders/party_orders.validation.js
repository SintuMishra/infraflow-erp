const { ORDER_STATUSES } = require("./party_orders.model");

const validatePartyOrderPayload = (req, res, next) => {
  const {
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    status,
  } = req.body;

  if (
    !orderDate ||
    !partyId ||
    !plantId ||
    !materialId ||
    orderedQuantityTons === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "orderDate, partyId, plantId, materialId, and orderedQuantityTons are required",
    });
  }

  if (Number(orderedQuantityTons) <= 0) {
    return res.status(400).json({
      success: false,
      message: "orderedQuantityTons must be greater than 0",
    });
  }

  if (status && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid party order status",
    });
  }

  next();
};

const validatePartyOrderStatusPayload = (req, res, next) => {
  if (!req.body.status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  if (!ORDER_STATUSES.includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid party order status",
    });
  }

  next();
};

module.exports = {
  validatePartyOrderPayload,
  validatePartyOrderStatusPayload,
};
