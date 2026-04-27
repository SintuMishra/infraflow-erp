const {
  ORDER_STATUSES,
  getAllPartyOrders,
  getPartyOrdersPage,
  getPartyOrderById,
  insertPartyOrder,
  updatePartyOrder,
  updatePartyOrderStatus,
  generatePartyOrderNumber,
} = require("./party_orders.model");
const { plantExists, materialExists } = require("../dispatch/dispatch.model");
const { getPartyById } = require("../parties/parties.model");
const {
  invalidateCacheByPrefix,
  buildCompanyScopedCachePrefix,
} = require("../../utils/simpleCache.util");

const buildValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const PRIVILEGED_STATUS_ROLES = ["super_admin", "manager"];

const validateMasterLinks = async ({ partyId, plantId, materialId, companyId }) => {
  const [party, plant, material] = await Promise.all([
    getPartyById(Number(partyId), companyId),
    plantExists(Number(plantId), companyId),
    materialExists(Number(materialId), companyId),
  ]);

  if (!party) {
    throw buildValidationError("Selected party does not exist");
  }

  if (!plant) {
    throw buildValidationError("Selected plant does not exist");
  }

  if (!material) {
    throw buildValidationError("Selected material does not exist");
  }

  return { party, plant, material };
};

const validateFulfillmentState = (order, status) => {
  if (status === "completed" && Number(order.pendingQuantityTons || 0) > 0) {
    throw buildValidationError(
      "Order cannot be marked completed while pending quantity is still left"
    );
  }
};

const buildOrderSnapshotForValidation = ({
  orderedQuantityTons,
  plannedQuantityTons = 0,
}) => ({
  pendingQuantityTons: Math.max(
    0,
    Number(orderedQuantityTons || 0) - Number(plannedQuantityTons || 0)
  ),
  plannedQuantityTons: Number(plannedQuantityTons || 0),
});

const hasFulfillmentStarted = (order) =>
  Number(order?.plannedQuantityTons || 0) > 0;

const isPrivilegedStatusActor = (actorRole) =>
  PRIVILEGED_STATUS_ROLES.includes(String(actorRole || ""));

const validateStatusTransitionPermissions = (existing, nextStatus, actorRole) => {
  if (!existing || existing.status === nextStatus) {
    return;
  }

  const fulfillmentStarted = hasFulfillmentStarted(existing);
  const isReopen =
    nextStatus === "open" &&
    ["completed", "cancelled"].includes(String(existing.status || ""));

  if (
    fulfillmentStarted &&
    nextStatus === "cancelled" &&
    !isPrivilegedStatusActor(actorRole)
  ) {
    throw buildValidationError(
      "Only managers or super admins can cancel an order after dispatch has been linked",
      403
    );
  }

  if (fulfillmentStarted && isReopen && !isPrivilegedStatusActor(actorRole)) {
    throw buildValidationError(
      "Only managers or super admins can reopen an order after dispatch has been linked",
      403
    );
  }
};

const validateLockedCommercialFields = (
  existing,
  { partyId, plantId, materialId }
) => {
  if (!hasFulfillmentStarted(existing)) {
    return;
  }

  if (String(existing.partyId) !== String(partyId)) {
    throw buildValidationError(
      "Party cannot be changed after dispatch has been linked to the order"
    );
  }

  if (String(existing.plantId) !== String(plantId)) {
    throw buildValidationError(
      "Plant cannot be changed after dispatch has been linked to the order"
    );
  }

  if (String(existing.materialId) !== String(materialId)) {
    throw buildValidationError(
      "Material cannot be changed after dispatch has been linked to the order"
    );
  }
};

const getOrders = async (companyId = null) => {
  return await getAllPartyOrders(companyId);
};

const getOrdersPage = async ({ companyId = null, page = 1, limit = 25 } = {}) =>
  getPartyOrdersPage({ companyId, page, limit });

const getOrderById = async (orderId, companyId = null, options = {}) => {
  const order = await getPartyOrderById(Number(orderId), companyId, options);

  if (!order) {
    throw buildValidationError("Party order not found", 404);
  }

  return order;
};

const createOrder = async ({
  orderNumber,
  orderDate,
  partyId,
  plantId,
  materialId,
  orderedQuantityTons,
  targetDispatchDate,
  remarks,
  status,
  createdBy,
  updatedBy,
  companyId,
}) => {
  if (!ORDER_STATUSES.includes(status || "open")) {
    throw buildValidationError("Invalid order status");
  }

  await validateMasterLinks({
    partyId,
    plantId,
    materialId,
    companyId: companyId || null,
  });

  validateFulfillmentState(
    buildOrderSnapshotForValidation({
      orderedQuantityTons,
    }),
    status || "open"
  );

  const manualOrderNumber = String(orderNumber || "").trim();
  let generatedOrderNumber =
    manualOrderNumber ||
    (await generatePartyOrderNumber({
      orderDate,
      companyId: companyId || null,
    }));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await insertPartyOrder({
        orderNumber: generatedOrderNumber,
        orderDate,
        partyId: Number(partyId),
        plantId: Number(plantId),
        materialId: Number(materialId),
        orderedQuantityTons: Number(orderedQuantityTons),
        targetDispatchDate: targetDispatchDate || null,
        remarks,
        status: status || "open",
        createdBy,
        updatedBy,
        companyId: companyId || null,
      });
      invalidateCacheByPrefix(buildCompanyScopedCachePrefix("party-orders", companyId || null));
      return created;
    } catch (error) {
      if (error.code !== "23505" || manualOrderNumber) {
        throw error;
      }

      generatedOrderNumber = await generatePartyOrderNumber({
        orderDate,
        companyId: companyId || null,
      });
    }
  }

  throw buildValidationError(
    "Could not generate a unique order number. Please try again."
  );
};

const editOrder = async (
  orderId,
  {
    orderNumber,
    orderDate,
    partyId,
    plantId,
    materialId,
    orderedQuantityTons,
    targetDispatchDate,
    remarks,
    status,
    updatedBy,
    companyId,
  }
) => {
  const existing = await getOrderById(orderId, companyId || null);

  if (!ORDER_STATUSES.includes(status || existing.status || "open")) {
    throw buildValidationError("Invalid order status");
  }

  await validateMasterLinks({
    partyId,
    plantId,
    materialId,
    companyId: companyId || null,
  });

  validateLockedCommercialFields(existing, {
    partyId,
    plantId,
    materialId,
  });

  if (Number(orderedQuantityTons) < Number(existing.plannedQuantityTons || 0)) {
    throw buildValidationError(
      "Ordered quantity cannot be reduced below already planned dispatch quantity"
    );
  }

  validateFulfillmentState(
    buildOrderSnapshotForValidation({
      orderedQuantityTons,
      plannedQuantityTons: existing.plannedQuantityTons,
    }),
    status || existing.status || "open"
  );

  const updated = await updatePartyOrder(Number(orderId), {
    orderNumber: String(orderNumber || "").trim() || existing.orderNumber,
    orderDate,
    partyId: Number(partyId),
    plantId: Number(plantId),
    materialId: Number(materialId),
    orderedQuantityTons: Number(orderedQuantityTons),
    targetDispatchDate: targetDispatchDate || null,
    remarks,
    status: status || existing.status || "open",
    updatedBy,
    companyId: companyId || null,
  });

  if (!updated) {
    throw buildValidationError("Party order not found", 404);
  }

  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("party-orders", companyId || null));
  return updated;
};

const changeOrderStatus = async (
  orderId,
  status,
  { updatedBy, companyId, actorRole } = {}
) => {
  if (!ORDER_STATUSES.includes(status)) {
    throw buildValidationError("Invalid order status");
  }

  const existing = await getOrderById(orderId, companyId || null);
  validateStatusTransitionPermissions(existing, status, actorRole);
  validateFulfillmentState(existing, status);

  const updated = await updatePartyOrderStatus(Number(orderId), status, {
    updatedBy: updatedBy || null,
    companyId: companyId || null,
  });

  if (!updated) {
    throw buildValidationError("Party order not found", 404);
  }

  invalidateCacheByPrefix(buildCompanyScopedCachePrefix("party-orders", companyId || null));
  return updated;
};

module.exports = {
  getOrders,
  getOrdersPage,
  getOrderById,
  createOrder,
  editOrder,
  changeOrderStatus,
};
