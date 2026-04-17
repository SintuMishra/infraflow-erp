const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withPartyOrdersServiceMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/party_orders/party_orders.service.js");
  const modelPath = require.resolve("../src/modules/party_orders/party_orders.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const partiesModelPath = require.resolve("../src/modules/parties/parties.model.js");

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    dispatchModel: require.cache[dispatchModelPath],
    partiesModel: require.cache[partiesModelPath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: mocks.model,
  };
  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: mocks.dispatchModel,
  };
  require.cache[partiesModelPath] = {
    id: partiesModelPath,
    filename: partiesModelPath,
    loaded: true,
    exports: mocks.partiesModel,
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originals.service) require.cache[servicePath] = originals.service;
    if (originals.model) require.cache[modelPath] = originals.model;
    else delete require.cache[modelPath];
    if (originals.dispatchModel) {
      require.cache[dispatchModelPath] = originals.dispatchModel;
    } else {
      delete require.cache[dispatchModelPath];
    }
    if (originals.partiesModel) {
      require.cache[partiesModelPath] = originals.partiesModel;
    } else {
      delete require.cache[partiesModelPath];
    }
  }
};

const baseModelMocks = {
  ORDER_STATUSES: ["open", "completed", "cancelled"],
  getAllPartyOrders: async () => [],
  getPartyOrderById: async () => null,
  generatePartyOrderNumber: async () => "PO-20260416-0001",
  insertPartyOrder: async () => {
    throw new Error("insertPartyOrder should be mocked in test");
  },
  updatePartyOrder: async () => {
    throw new Error("updatePartyOrder should be mocked in test");
  },
  updatePartyOrderStatus: async () => {
    throw new Error("updatePartyOrderStatus should be mocked in test");
  },
};

const baseDispatchModelMocks = {
  plantExists: async () => ({ id: 11, plantName: "Alpha Plant" }),
  materialExists: async () => ({ id: 22, materialName: "20mm Aggregate" }),
};

const basePartiesModelMocks = {
  getPartyById: async () => ({ id: 33, partyName: "Acme Infra" }),
};

test("createOrder rejects completed status while full quantity is still pending before insert", async () => {
  let insertCalled = false;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        insertPartyOrder: async () => {
          insertCalled = true;
          return { id: 1 };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ createOrder }) => {
      await assert.rejects(
        () =>
          createOrder({
            orderNumber: "PO-001",
            orderDate: "2026-04-16",
            partyId: 33,
            plantId: 11,
            materialId: 22,
            orderedQuantityTons: 50,
            status: "completed",
          }),
        /cannot be marked completed/i
      );
    }
  );

  assert.equal(insertCalled, false);
});

test("editOrder rejects completed status when pending quantity would still remain before update", async () => {
  let updateCalled = false;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 9,
          status: "open",
          partyId: 33,
          plantId: 11,
          materialId: 22,
          plannedQuantityTons: 40,
        }),
        updatePartyOrder: async () => {
          updateCalled = true;
          return { id: 9 };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ editOrder }) => {
      await assert.rejects(
        () =>
          editOrder(9, {
            orderNumber: "PO-009",
            orderDate: "2026-04-16",
            partyId: 33,
            plantId: 11,
            materialId: 22,
            orderedQuantityTons: 50,
            status: "completed",
          }),
        /cannot be marked completed/i
      );
    }
  );

  assert.equal(updateCalled, false);
});

test("createOrder auto-generates order number when user leaves it blank", async () => {
  let insertedPayload = null;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        generatePartyOrderNumber: async () => "PO-20260416-0007",
        insertPartyOrder: async (payload) => {
          insertedPayload = payload;
          return { id: 7, ...payload };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ createOrder }) => {
      await createOrder({
        orderNumber: "",
        orderDate: "2026-04-16",
        partyId: 33,
        plantId: 11,
        materialId: 22,
        orderedQuantityTons: 500,
        status: "open",
      });
    }
  );

  assert.equal(insertedPayload.orderNumber, "PO-20260416-0007");
});

test("editOrder rejects party change once dispatch has already been linked", async () => {
  let updateCalled = false;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 9,
          status: "open",
          partyId: 33,
          plantId: 11,
          materialId: 22,
          plannedQuantityTons: 10,
        }),
        updatePartyOrder: async () => {
          updateCalled = true;
          return { id: 9 };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: {
        getPartyById: async (partyId) => ({ id: partyId, partyName: "Any Party" }),
      },
    },
    async ({ editOrder }) => {
      await assert.rejects(
        () =>
          editOrder(9, {
            orderNumber: "PO-009",
            orderDate: "2026-04-16",
            partyId: 44,
            plantId: 11,
            materialId: 22,
            orderedQuantityTons: 60,
            status: "open",
          }),
        /party cannot be changed/i
      );
    }
  );

  assert.equal(updateCalled, false);
});

test("editOrder allows safe updates after fulfillment has started when structure stays the same", async () => {
  let updatedPayload = null;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 9,
          status: "open",
          orderNumber: "PO-009",
          partyId: 33,
          plantId: 11,
          materialId: 22,
          plannedQuantityTons: 10,
        }),
        updatePartyOrder: async (_orderId, payload) => {
          updatedPayload = payload;
          return { id: 9, ...payload };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ editOrder }) => {
      await editOrder(9, {
        orderNumber: "PO-009",
        orderDate: "2026-04-16",
        partyId: 33,
        plantId: 11,
        materialId: 22,
        orderedQuantityTons: 75,
        targetDispatchDate: "2026-04-20",
        remarks: "Increase balance for revised requirement",
        status: "open",
      });
    }
  );

  assert.equal(updatedPayload.partyId, 33);
  assert.equal(updatedPayload.plantId, 11);
  assert.equal(updatedPayload.materialId, 22);
  assert.equal(updatedPayload.orderedQuantityTons, 75);
  assert.equal(updatedPayload.targetDispatchDate, "2026-04-20");
});

test("changeOrderStatus rejects cancellation of linked-dispatch order for non-privileged role", async () => {
  let updateCalled = false;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 13,
          status: "open",
          plannedQuantityTons: 20,
          pendingQuantityTons: 0,
        }),
        updatePartyOrderStatus: async () => {
          updateCalled = true;
          return { id: 13, status: "cancelled" };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ changeOrderStatus }) => {
      await assert.rejects(
        () =>
          changeOrderStatus(13, "cancelled", {
            updatedBy: 7,
            actorRole: "hr",
          }),
        /only managers or super admins can cancel/i
      );
    }
  );

  assert.equal(updateCalled, false);
});

test("changeOrderStatus allows privileged cancellation of linked-dispatch order", async () => {
  let updatedStatus = null;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 13,
          status: "open",
          plannedQuantityTons: 20,
          pendingQuantityTons: 0,
        }),
        updatePartyOrderStatus: async (_orderId, status) => {
          updatedStatus = status;
          return { id: 13, status };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ changeOrderStatus }) => {
      await changeOrderStatus(13, "cancelled", {
        updatedBy: 2,
        actorRole: "manager",
      });
    }
  );

  assert.equal(updatedStatus, "cancelled");
});

test("changeOrderStatus rejects reopening linked-dispatch order for non-privileged role", async () => {
  let updateCalled = false;

  await withPartyOrdersServiceMocks(
    {
      model: {
        ...baseModelMocks,
        getPartyOrderById: async () => ({
          id: 21,
          status: "completed",
          plannedQuantityTons: 12,
          pendingQuantityTons: 0,
        }),
        updatePartyOrderStatus: async () => {
          updateCalled = true;
          return { id: 21, status: "open" };
        },
      },
      dispatchModel: baseDispatchModelMocks,
      partiesModel: basePartiesModelMocks,
    },
    async ({ changeOrderStatus }) => {
      await assert.rejects(
        () =>
          changeOrderStatus(21, "open", {
            updatedBy: 7,
            actorRole: "hr",
          }),
        /only managers or super admins can reopen/i
      );
    }
  );

  assert.equal(updateCalled, false);
});
