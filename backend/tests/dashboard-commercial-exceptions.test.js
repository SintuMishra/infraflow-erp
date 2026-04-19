const test = require("node:test");
const assert = require("node:assert/strict");
const { formatDateOnly } = require("../src/utils/date.util");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withDashboardCommercialMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/dashboard/dashboard.service.js");
  const dbPath = require.resolve("../src/config/db.js");
  const companyScopePath = require.resolve("../src/utils/companyScope.util.js");
  const partyOrdersPath = require.resolve("../src/modules/party_orders/party_orders.model.js");
  const dispatchPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const ratesPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const partiesPath = require.resolve("../src/modules/parties/parties.model.js");

  const originals = {
    service: require.cache[servicePath],
    db: require.cache[dbPath],
    companyScope: require.cache[companyScopePath],
    partyOrders: require.cache[partyOrdersPath],
    dispatch: require.cache[dispatchPath],
    rates: require.cache[ratesPath],
    parties: require.cache[partiesPath],
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      pool: {
        query:
          mocks.db?.query ||
          (async () => ({
            rows: [],
          })),
      },
    },
  };
  require.cache[companyScopePath] = {
    id: companyScopePath,
    filename: companyScopePath,
    loaded: true,
    exports: {
      hasColumn: mocks.companyScope?.hasColumn || (async () => true),
      tableExists: mocks.companyScope?.tableExists || (async () => true),
    },
  };
  require.cache[partyOrdersPath] = {
    id: partyOrdersPath,
    filename: partyOrdersPath,
    loaded: true,
    exports: mocks.partyOrders,
  };
  require.cache[dispatchPath] = {
    id: dispatchPath,
    filename: dispatchPath,
    loaded: true,
    exports: mocks.dispatch,
  };
  require.cache[ratesPath] = {
    id: ratesPath,
    filename: ratesPath,
    loaded: true,
    exports: mocks.rates,
  };
  require.cache[partiesPath] = {
    id: partiesPath,
    filename: partiesPath,
    loaded: true,
    exports: mocks.parties,
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originals.service) require.cache[servicePath] = originals.service;
    if (originals.db) require.cache[dbPath] = originals.db;
    else delete require.cache[dbPath];
    if (originals.companyScope) require.cache[companyScopePath] = originals.companyScope;
    else delete require.cache[companyScopePath];
    if (originals.partyOrders) require.cache[partyOrdersPath] = originals.partyOrders;
    else delete require.cache[partyOrdersPath];
    if (originals.dispatch) require.cache[dispatchPath] = originals.dispatch;
    else delete require.cache[dispatchPath];
    if (originals.rates) require.cache[ratesPath] = originals.rates;
    else delete require.cache[ratesPath];
    if (originals.parties) require.cache[partiesPath] = originals.parties;
    else delete require.cache[partiesPath];
  }
};

test("getCommercialExceptions builds summary and filtered queue from commercial datasets", async () => {
  const today = formatDateOnly(new Date());
  const overdueTargetDate = new Date(`${today}T00:00:00.000Z`);
  overdueTargetDate.setUTCDate(overdueTargetDate.getUTCDate() - 2);
  const overdueDateValue = formatDateOnly(overdueTargetDate);

  await withDashboardCommercialMocks(
    {
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: overdueDateValue,
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 10,
          },
          {
            id: 2,
            orderNumber: "PO-002",
            orderDate: "2026-04-15",
            targetDispatchDate: "2099-12-31",
            partyId: 102,
            partyName: "Buildwell",
            plantId: 12,
            plantName: "Beta Plant",
            materialId: 22,
            materialName: "Dust",
            status: "open",
            pendingQuantityTons: 30,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: today,
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
          {
            id: 10,
            dispatchDate: today,
            partyId: 102,
            partyName: "Buildwell",
            plantId: 12,
            plantName: "Beta Plant",
            materialId: 22,
            materialName: "Dust",
            quantityTons: 15,
            status: "completed",
            partyOrderId: 2,
            invoiceNumber: "",
            invoiceDate: null,
            ewbNumber: "",
            ewbDate: null,
            ewbValidUpto: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [
          { id: 101, partyName: "Acme Infra" },
          { id: 102, partyName: "Buildwell" },
        ],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        exceptionType: "unlinked_dispatch",
      });

      assert.equal(result.summary.openOrdersCount, 2);
      assert.equal(result.summary.pendingQuantity, 80);
      assert.equal(result.summary.inTransitQuantity, 10);
      assert.equal(result.summary.dispatchAgainstOrdersToday, 15);
      assert.equal(result.summary.unlinkedDispatchesCount, 1);
      assert.equal(result.summary.incompleteClosuresCount, 1);
      assert.equal(result.summary.partiesWithNoActiveRatesCount, 1);
      assert.equal(result.summary.reviewedCount, 0);
      assert.equal(result.summary.assignedCount, 0);
      assert.equal(result.summary.unassignedCount, 4);
      assert.equal(result.meta.filteredCount, 1);
      assert.equal(result.items[0].exceptionType, "unlinked_dispatch");
      assert.match(result.summary.priorityAlerts[0], /overdue/i);
    }
  );
});

test(
  "getCommercialExceptions hides reviewed items by default and includes them when requested",
  { concurrency: false },
  async () => {
  const reviewedAt = new Date().toISOString();

  await withDashboardCommercialMocks(
    {
      db: {
        query: async () => ({
          rows: [
            {
              id: 801,
              createdAt: reviewedAt,
              details: {
                exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                actorName: "Ops Manager",
                notes: "Already assigned for correction",
              },
            },
          ],
        }),
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const hiddenResult = await getCommercialExceptions(77, {
        exceptionType: "unlinked_dispatch",
      });
      const visibleResult = await getCommercialExceptions(77, {
        exceptionType: "unlinked_dispatch",
        includeReviewed: true,
      });

      assert.equal(hiddenResult.items.length, 0);
      assert.equal(hiddenResult.summary.reviewedCount, 1);
      assert.equal(hiddenResult.summary.escalatedReviewedCount, 0);
      assert.equal(hiddenResult.summary.assignedCount, 0);
      assert.equal(visibleResult.items.length, 1);
      assert.equal(visibleResult.items[0].isReviewed, true);
      assert.equal(visibleResult.items[0].reviewedByName, "Ops Manager");
    }
  );
});

test("getCommercialExceptions supports reviewed-only slices for dashboard follow-up views", async () => {
  await withDashboardCommercialMocks(
    {
      db: {
        query: async () => ({
          rows: [
            {
              id: 801,
              createdAt: "2026-04-16T10:00:00.000Z",
              details: {
                exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                actorName: "Ops Manager",
                notes: "Already assigned for correction",
              },
            },
          ],
        }),
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        includeReviewed: true,
        reviewedOnly: true,
      });

      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].isReviewed, true);
      assert.equal(result.meta.filteredTotalCount, 1);
      assert.equal(result.meta.reviewedOnly, true);
    }
  );
});

test("getCommercialExceptions flags reviewed exceptions that remain unresolved for two days", async () => {
  await withDashboardCommercialMocks(
    {
      db: {
        query: async () => ({
          rows: [
            {
              id: 901,
              createdAt: "2026-04-12T10:00:00.000Z",
              details: {
                exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                actorName: "Ops Manager",
                notes: "Waiting for transport desk correction",
              },
            },
          ],
        }),
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        exceptionType: "unlinked_dispatch",
        includeReviewed: true,
      });

      assert.equal(result.summary.escalatedReviewedCount, 1);
      assert.equal(result.summary.escalatedUnassignedCount, 1);
      assert.equal(result.items[0].isReviewed, true);
      assert.equal(result.items[0].isEscalated, true);
      assert.equal(result.items[0].reviewAgeDays >= 2, true);
    }
  );
});

test("getCommercialExceptions includes latest assignee details from audit-backed assignment events", async () => {
  let auditQueryCount = 0;

  await withDashboardCommercialMocks(
    {
      db: {
        query: async (_queryText, params = []) => {
          auditQueryCount += 1;

          if (String(params[0] || "").toLowerCase() === "commercial_exception.assigned") {
            return {
              rows: [
                {
                  id: 950,
                  createdAt: "2026-04-16T11:00:00.000Z",
                  details: {
                    exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                    assigneeEmployeeId: 301,
                    assigneeName: "Amit Singh",
                    assigneeEmployeeCode: "OPS-301",
                  },
                },
              ],
            };
          }

          return { rows: [] };
        },
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        exceptionType: "unlinked_dispatch",
        includeReviewed: true,
      });

      assert.equal(result.summary.assignedCount, 1);
      assert.equal(result.summary.unassignedCount, 0);
      assert.equal(result.summary.ownerSummary.length, 1);
      assert.equal(result.summary.ownerSummary[0].assignedCount, 1);
      assert.equal(result.items[0].assigneeEmployeeId, 301);
      assert.equal(result.items[0].assigneeName, "Amit Singh");
      assert.equal(result.items[0].assigneeEmployeeCode, "OPS-301");
    }
  );
});

test("getCommercialExceptions filters by assigned employee id", async () => {
  let auditQueryCount = 0;

  await withDashboardCommercialMocks(
    {
      db: {
        query: async (_queryText, params = []) => {
          auditQueryCount += 1;

          if (String(params[0] || "").toLowerCase() === "commercial_exception.assigned") {
            return {
              rows: [
                {
                  id: 951,
                  createdAt: "2026-04-16T11:00:00.000Z",
                  details: {
                    exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                    assigneeEmployeeId: 301,
                    assigneeName: "Amit Singh",
                    assigneeEmployeeCode: "OPS-301",
                  },
                },
              ],
            };
          }

          return { rows: [] };
        },
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const matching = await getCommercialExceptions(77, {
        assignedEmployeeId: 301,
        includeReviewed: true,
      });
      const nonMatching = await getCommercialExceptions(77, {
        assignedEmployeeId: 999,
        includeReviewed: true,
      });

      assert.equal(matching.items.length, 1);
      assert.equal(nonMatching.items.length, 0);
      assert.equal(matching.meta.assignedEmployeeId, "301");
    }
  );
});

test("getCommercialExceptions paginates filtered exception queue metadata", async () => {
  await withDashboardCommercialMocks(
    {
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2026-04-12",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 10,
          },
          {
            id: 2,
            orderNumber: "PO-002",
            orderDate: "2026-04-11",
            targetDispatchDate: "2026-04-13",
            partyId: 102,
            partyName: "Buildwell",
            plantId: 12,
            plantName: "Beta Plant",
            materialId: 22,
            materialName: "Dust",
            status: "open",
            pendingQuantityTons: 30,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [],
      },
      rates: {
        getAllRates: async () => [],
      },
      parties: {
        getAllParties: async () => [
          { id: 101, partyName: "Acme Infra" },
          { id: 102, partyName: "Buildwell" },
        ],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        exceptionType: "active_order_missing_rate",
        page: 2,
        limit: 1,
      });

      assert.equal(result.meta.filteredTotalCount, 2);
      assert.equal(result.meta.filteredCount, 1);
      assert.equal(result.meta.currentPage, 2);
      assert.equal(result.meta.totalPages, 2);
      assert.equal(result.meta.hasPreviousPage, true);
      assert.equal(result.meta.hasNextPage, false);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].reference, "PO-001");
    }
  );
});

test("getCommercialExceptions reports SLA-breached counts and owner accountability", async () => {
  let auditQueryCount = 0;
  const today = formatDateOnly(new Date());
  const overdueTargetDate = new Date(`${today}T00:00:00.000Z`);
  overdueTargetDate.setUTCDate(overdueTargetDate.getUTCDate() - 7);
  const overdueDateValue = formatDateOnly(overdueTargetDate);

  const recentOrderDate = new Date(`${today}T00:00:00.000Z`);
  recentOrderDate.setUTCDate(recentOrderDate.getUTCDate() - 1);
  const recentOrderDateValue = formatDateOnly(recentOrderDate);

  const futureDispatchDate = new Date(`${today}T00:00:00.000Z`);
  futureDispatchDate.setUTCDate(futureDispatchDate.getUTCDate() + 1);
  const futureDispatchDateValue = formatDateOnly(futureDispatchDate);

  await withDashboardCommercialMocks(
    {
      db: {
        query: async (_queryText, params = []) => {
          auditQueryCount += 1;

          if (String(params[0] || "").toLowerCase() === "commercial_exception.assigned") {
            return {
              rows: [
                {
                  id: 990,
                  createdAt: "2026-04-16T11:00:00.000Z",
                  details: {
                    exceptionKey: "overdue_order:1:2026-04-10:PO-001",
                    assigneeEmployeeId: 301,
                    assigneeName: "Amit Singh",
                    assigneeEmployeeCode: "OPS-301",
                  },
                },
              ],
            };
          }

          return { rows: [] };
        },
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-08",
            targetDispatchDate: overdueDateValue,
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
          {
            id: 2,
            orderNumber: "PO-002",
            orderDate: recentOrderDateValue,
            targetDispatchDate: futureDispatchDateValue,
            partyId: 102,
            partyName: "Buildwell",
            plantId: 12,
            plantName: "Beta Plant",
            materialId: 22,
            materialName: "Dust",
            status: "open",
            pendingQuantityTons: 30,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: today,
            partyId: 102,
            partyName: "Buildwell",
            plantId: 12,
            plantName: "Beta Plant",
            materialId: 22,
            materialName: "Dust",
            quantityTons: 15,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 102,
            plantId: 12,
            materialId: 22,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [
          { id: 101, partyName: "Acme Infra" },
          { id: 102, partyName: "Buildwell" },
        ],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        includeReviewed: true,
      });

      assert.equal(result.summary.slaBreachedCount, 2);
      assert.equal(result.summary.slaBreachedUnassignedCount, 2);
      assert.equal(result.items[0].exceptionType, "unlinked_dispatch");
      assert.equal(
        result.items.find((item) => item.exceptionType === "overdue_order")?.isSlaBreached,
        true
      );
      assert.equal(
        result.items.find((item) => item.exceptionType === "unlinked_dispatch")?.isSlaBreached,
        false
      );
      assert.equal(
        result.items.find((item) => item.exceptionType === "active_order_missing_rate")
          ?.isSlaBreached,
        true
      );
      assert.equal(Array.isArray(result.summary.ownerSummary), true);
      assert.match(result.summary.priorityAlerts.join(" "), /crossed SLA/i);
    }
  );
});

test("getCommercialExceptions rejects invalid exceptionType filter", async () => {
  await withDashboardCommercialMocks(
    {
      partyOrders: { getAllPartyOrders: async () => [] },
      dispatch: { findAllDispatchReports: async () => [] },
      rates: { getAllRates: async () => [] },
      parties: { getAllParties: async () => [] },
    },
    async ({ getCommercialExceptions }) => {
      await assert.rejects(
        () =>
          getCommercialExceptions(77, {
            exceptionType: "bad_type",
          }),
        /INVALID_COMMERCIAL_EXCEPTION_FILTERS/
      );
    }
  );
});

test("getCommercialExceptions rejects invalid date range filter", async () => {
  await withDashboardCommercialMocks(
    {
      partyOrders: { getAllPartyOrders: async () => [] },
      dispatch: { findAllDispatchReports: async () => [] },
      rates: { getAllRates: async () => [] },
      parties: { getAllParties: async () => [] },
    },
    async ({ getCommercialExceptions }) => {
      await assert.rejects(
        () =>
          getCommercialExceptions(77, {
            dateFrom: "2026-04-20",
            dateTo: "2026-04-10",
          }),
        /INVALID_COMMERCIAL_EXCEPTION_FILTERS/
      );
    }
  );
});

test("getCommercialExceptions enforces reviewedOnly by forcing includeReviewed in meta", async () => {
  await withDashboardCommercialMocks(
    {
      db: {
        query: async () => ({
          rows: [
            {
              id: 801,
              createdAt: "2026-04-16T10:00:00.000Z",
              details: {
                exceptionKey: "unlinked_dispatch:9:2026-04-16:Dispatch #9",
                actorName: "Ops Manager",
                notes: "Already assigned for correction",
              },
            },
          ],
        }),
      },
      partyOrders: {
        getAllPartyOrders: async () => [
          {
            id: 1,
            orderNumber: "PO-001",
            orderDate: "2026-04-10",
            targetDispatchDate: "2099-12-31",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            status: "open",
            pendingQuantityTons: 50,
            inProgressQuantityTons: 0,
          },
        ],
      },
      dispatch: {
        findAllDispatchReports: async () => [
          {
            id: 9,
            dispatchDate: "2026-04-16",
            partyId: 101,
            partyName: "Acme Infra",
            plantId: 11,
            plantName: "Alpha Plant",
            materialId: 21,
            materialName: "GSB",
            quantityTons: 20,
            status: "pending",
            partyOrderId: null,
          },
        ],
      },
      rates: {
        getAllRates: async () => [
          {
            id: 91,
            partyId: 101,
            plantId: 11,
            materialId: 21,
            isActive: true,
          },
        ],
      },
      parties: {
        getAllParties: async () => [{ id: 101, partyName: "Acme Infra" }],
      },
    },
    async ({ getCommercialExceptions }) => {
      const result = await getCommercialExceptions(77, {
        reviewedOnly: true,
      });

      assert.equal(result.meta.reviewedOnly, true);
      assert.equal(result.meta.includeReviewed, true);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].isReviewed, true);
    }
  );
});
