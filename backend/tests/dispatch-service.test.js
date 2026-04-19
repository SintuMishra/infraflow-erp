const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withDispatchServiceMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/dispatch/dispatch.service.js");
  const modelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const dbPath = require.resolve("../src/config/db.js");
  const companyPath = require.resolve(
    "../src/modules/company_profile/company_profile.service.js"
  );
  const partyPath = require.resolve("../src/modules/parties/parties.model.js");
  const partyOrderPath = require.resolve("../src/modules/party_orders/party_orders.model.js");

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    db: require.cache[dbPath],
    company: require.cache[companyPath],
    party: require.cache[partyPath],
    partyOrder: require.cache[partyOrderPath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findDispatchReportSummary: async () => ({}),
      generateDispatchInvoiceNumber: async () => "INV-20260415-0001",
      ...mocks.model,
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mocks.db,
  };
  require.cache[companyPath] = {
    id: companyPath,
    filename: companyPath,
    loaded: true,
    exports: mocks.company,
  };
  require.cache[partyPath] = {
    id: partyPath,
    filename: partyPath,
    loaded: true,
    exports: mocks.party,
  };
  require.cache[partyOrderPath] = {
    id: partyOrderPath,
    filename: partyOrderPath,
    loaded: true,
    exports:
      mocks.partyOrder ||
      {
        getAllPartyOrders: async () => [],
        getPartyOrderById: async () => null,
      },
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
    if (originals.db) require.cache[dbPath] = originals.db;
    else delete require.cache[dbPath];
    if (originals.company) require.cache[companyPath] = originals.company;
    else delete require.cache[companyPath];
    if (originals.party) require.cache[partyPath] = originals.party;
    else delete require.cache[partyPath];
    if (originals.partyOrder) require.cache[partyOrderPath] = originals.partyOrder;
    else delete require.cache[partyOrderPath];
  }
};

test("createDispatchReport computes commercials and intra-state GST from source data", async () => {
  let insertedPayload = null;
  const vehicleStatusUpdates = [];

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 101, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async ({ vehicleId, status }) => {
          vehicleStatusUpdates.push({ vehicleId, status });
        },
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Stone Dust",
          gstRate: 18,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: 44,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 100,
          royaltyMode: "per_ton",
          royaltyValue: 10,
          loadingCharge: 50,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          rateValue: 5,
          distanceKm: 30,
        }),
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "09" }),
      },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 30,
        otherCharge: 20,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 1000);
  assert.equal(insertedPayload.royaltyAmount, 100);
  assert.equal(insertedPayload.loadingCharge, 50);
  assert.equal(insertedPayload.transportCost, 150);
  assert.equal(insertedPayload.totalInvoiceValue, 1320);
  assert.equal(insertedPayload.invoiceValue, 1320);
  assert.equal(insertedPayload.gstRate, 18);
  assert.equal(insertedPayload.cgst, 118.8);
  assert.equal(insertedPayload.sgst, 118.8);
  assert.equal(insertedPayload.igst, 0);
  assert.equal(insertedPayload.totalWithGst, 1557.6);
  assert.deepEqual(vehicleStatusUpdates, [{ vehicleId: 3, status: "in_use" }]);
});

test("dispatch service forwards company scope through list, read, create, and status flows", async () => {
  const calls = {
    findAllDispatchReports: [],
    findDispatchById: [],
    plantExists: [],
    materialExists: [],
    vehicleExists: [],
    getPartyById: [],
    getCompanyProfile: [],
    findActivePartyMaterialRate: [],
    findActiveTransportRate: [],
    findDispatchReportSummary: [],
    generateDispatchInvoiceNumber: [],
    insertDispatchReport: [],
    updateDispatchStatusById: [],
    setVehicleOperationalStatus: [],
  };

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async (filters) => {
          calls.findAllDispatchReports.push(filters);
          return {
            items: [],
            total: 0,
            page: Number(filters.page || 1),
            limit: Number(filters.limit || 25),
          };
        },
        findDispatchReportSummary: async (filters) => {
          calls.findDispatchReportSummary.push(filters);
          return {};
        },
        findDispatchById: async (reportId, db, companyId) => {
          calls.findDispatchById.push({ reportId, companyId });

          if (reportId === 501) {
            return {
              id: 501,
              status: "pending",
              vehicleId: 3,
              quantityTons: 12,
              invoiceNumber: "INV-501",
              invoiceDate: "2026-04-15",
              totalInvoiceValue: 1800,
            };
          }

          return {
            id: reportId,
            status: "pending",
            vehicleId: 3,
            quantityTons: 10,
          };
        },
        insertDispatchReport: async (payload) => {
          calls.insertDispatchReport.push(payload);
          return { id: 401, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async ({
          reportId,
          status,
          invoiceNumber,
          invoiceDate,
          companyId,
        }) => {
          calls.updateDispatchStatusById.push({
            reportId,
            status,
            invoiceNumber,
            invoiceDate,
            companyId,
          });
          return { id: reportId, status };
        },
        generateDispatchInvoiceNumber: async ({ dispatchDate, companyId }) => {
          calls.generateDispatchInvoiceNumber.push({ dispatchDate, companyId });
          return "INV-20260415-0099";
        },
        setVehicleOperationalStatus: async ({ vehicleId, status, companyId }) => {
          calls.setVehicleOperationalStatus.push({ vehicleId, status, companyId });
        },
        plantExists: async (plantId, companyId) => {
          calls.plantExists.push({ plantId, companyId });
          return { id: plantId, plantName: "Alpha Plant" };
        },
        materialExists: async (materialId, companyId) => {
          calls.materialExists.push({ materialId, companyId });
          return {
            id: materialId,
            materialName: "GSB",
            gstRate: 18,
          };
        },
        vehicleExists: async (vehicleId, companyId) => {
          calls.vehicleExists.push({ vehicleId, companyId });
          return {
            id: vehicleId,
            vehicleNumber: "UP32AB1234",
            plantId: 1,
            vendorId: 44,
            status: "active",
            vehicleCapacityTons: 20,
          };
        },
        findActivePartyMaterialRate: async (payload) => {
          calls.findActivePartyMaterialRate.push(payload);
          return {
            id: 11,
            ratePerTon: 100,
            royaltyMode: "per_ton",
            royaltyValue: 10,
            loadingCharge: 50,
          };
        },
        findActiveTransportRate: async (payload) => {
          calls.findActiveTransportRate.push(payload);
          return {
            id: 22,
            rateType: "per_km",
            rateValue: 5,
            distanceKm: 30,
          };
        },
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async (companyId) => {
          calls.getCompanyProfile.push(companyId);
          return { stateCode: "09" };
        },
      },
      party: {
        getPartyById: async (partyId, companyId) => {
          calls.getPartyById.push({ partyId, companyId });
          return { id: partyId, stateCode: "09" };
        },
      },
    },
    async ({
      getDispatchReports,
      getDispatchReportById,
      createDispatchReport,
      updateDispatchStatus,
    }) => {
      await getDispatchReports({ companyId: 77 });
      await getDispatchReportById(301, 77);

      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 30,
        otherCharge: 20,
        companyId: 77,
      });

      await updateDispatchStatus({
        reportId: 501,
        status: "completed",
        companyId: 77,
      });
    }
  );

  assert.deepEqual(calls.findAllDispatchReports, [
    {
      companyId: 77,
      search: "",
      plantId: null,
      partyId: null,
      materialId: null,
      linkedOrderFilter: "",
      sourceType: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
      limit: 25,
    },
  ]);
  assert.deepEqual(calls.findDispatchReportSummary, [
    {
      companyId: 77,
      search: "",
      plantId: null,
      partyId: null,
      materialId: null,
      linkedOrderFilter: "",
      sourceType: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
      limit: 25,
    },
  ]);
  assert.deepEqual(calls.findDispatchById, [
    { reportId: 301, companyId: 77 },
    { reportId: 501, companyId: 77 },
  ]);
  assert.deepEqual(calls.plantExists, [{ plantId: 1, companyId: 77 }]);
  assert.deepEqual(calls.materialExists, [{ materialId: 2, companyId: 77 }]);
  assert.deepEqual(calls.vehicleExists, [{ vehicleId: 3, companyId: 77 }]);
  assert.deepEqual(calls.getPartyById, [{ partyId: 5, companyId: 77 }]);
  assert.deepEqual(calls.getCompanyProfile, [77]);
  assert.deepEqual(calls.findActivePartyMaterialRate, [
    { plantId: 1, partyId: 5, materialId: 2, companyId: 77 },
  ]);
  assert.deepEqual(calls.findActiveTransportRate, [
    { plantId: 1, vendorId: 44, materialId: 2, companyId: 77 },
  ]);
  assert.equal(calls.insertDispatchReport[0].companyId, 77);
  assert.deepEqual(calls.generateDispatchInvoiceNumber, []);
  assert.deepEqual(calls.updateDispatchStatusById, [
    {
      reportId: 501,
      status: "completed",
      invoiceNumber: "INV-501",
      invoiceDate: "2026-04-15",
      companyId: 77,
    },
  ]);
  assert.deepEqual(calls.setVehicleOperationalStatus, [
    { vehicleId: 3, status: "in_use", companyId: 77 },
    { vehicleId: 3, status: "active", companyId: 77 },
  ]);
});

test("createDispatchReport respects manual invoice override and inter-state GST", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 102, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate",
          gstRate: 5,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 25,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 80,
          royaltyMode: "fixed",
          royaltyValue: 200,
          loadingCharge: 75,
        }),
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "27" }),
      },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Site B",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        invoiceValue: 9999,
        invoiceNumber: "INV-102",
        invoiceDate: "2026-04-15",
        billingNotes: "Manual commercial correction",
        status: "completed",
      });
    }
  );

  assert.equal(insertedPayload.totalInvoiceValue, 9999);
  assert.equal(insertedPayload.invoiceValue, 9999);
  assert.equal(insertedPayload.cgst, 0);
  assert.equal(insertedPayload.sgst, 0);
  assert.equal(insertedPayload.igst, 499.95);
  assert.equal(insertedPayload.totalWithGst, 10498.95);
});

test("createDispatchReport computes per_brass royalty using tons-per-brass conversion", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 120, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate",
          gstRate: 5,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 25,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 80,
          royaltyMode: "per_brass",
          royaltyValue: 200,
          tonsPerBrass: 2.5,
          loadingCharge: 75,
        }),
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "09" }),
      },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Site B",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.royaltyAmount, 800);
  assert.equal(insertedPayload.totalInvoiceValue, 1675);
});

test("createDispatchReport requires billing notes for manual taxable override", async () => {
  await assert.rejects(
    async () =>
      withDispatchServiceMocks(
        {
          model: {
            findAllDispatchReports: async () => [],
            findDispatchById: async () => null,
            insertDispatchReport: async () => null,
            updateDispatchReportById: async () => null,
            updateDispatchStatusById: async () => null,
            setVehicleOperationalStatus: async () => {},
            plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
            materialExists: async () => ({
              id: 2,
              materialName: "Aggregate",
              gstRate: 18,
            }),
            vehicleExists: async () => ({
              id: 3,
              vehicleNumber: "UP32AB1234",
              plantId: 1,
              vendorId: 44,
              status: "active",
              vehicleCapacityTons: 25,
            }),
            findActivePartyMaterialRate: async () => ({
              id: 11,
              ratePerTon: 100,
              royaltyMode: "none",
              royaltyValue: 0,
              loadingCharge: 0,
            }),
            findActiveTransportRate: async () => null,
          },
          db: {
            withTransaction: async (work) => work({}),
          },
          company: {
            getCompanyProfile: async () => ({ stateCode: "09" }),
          },
          party: {
            getPartyById: async () => ({ id: 5, stateCode: "09" }),
          },
        },
        async ({ createDispatchReport }) => {
          await createDispatchReport({
            dispatchDate: "2026-04-15",
            sourceType: "Plant",
            destinationName: "Site B",
            quantityTons: 10,
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
            invoiceValue: 9999,
            invoiceNumber: "INV-103",
            invoiceDate: "2026-04-15",
            status: "completed",
          });
        }
      ),
    /Billing notes are required/i
  );
});

test("createDispatchReport auto-generates invoice number and defaults invoice date on completion", async () => {
  let insertedPayload = null;
  const generatedInvoiceCalls = [];

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 104, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        generateDispatchInvoiceNumber: async ({ dispatchDate, companyId }) => {
          generatedInvoiceCalls.push({ dispatchDate, companyId });
          return "INV-20260415-0007";
        },
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate",
          gstRate: 18,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: 44,
          status: "active",
          vehicleCapacityTons: 25,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 100,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "09" }),
      },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Completion Gate Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        status: "completed",
      });
    }
  );

  assert.equal(insertedPayload.invoiceNumber, "INV-20260415-0007");
  assert.equal(insertedPayload.invoiceDate, "2026-04-15");
  assert.deepEqual(generatedInvoiceCalls, [
    { dispatchDate: "2026-04-15", companyId: null },
  ]);
});

test("createDispatchReport rounds GST values to two decimals for invoice math", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 103, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate",
          gstRate: 18,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: 44,
          status: "active",
          vehicleCapacityTons: 25,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 100.155,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          rateValue: 2.335,
          distanceKm: 3,
        }),
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "09" }),
      },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-15",
        sourceType: "Plant",
        destinationName: "Rounded Site",
        quantityTons: 1.5,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 3,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 150.23);
  assert.equal(insertedPayload.transportCost, 7.01);
  assert.equal(insertedPayload.totalInvoiceValue, 157.24);
  assert.equal(insertedPayload.cgst, 14.15);
  assert.equal(insertedPayload.sgst, 14.15);
  assert.equal(insertedPayload.totalWithGst, 185.54);
});

test("updateDispatchStatus moves linked vehicle back to active when leaving pending", async () => {
  const vehicleStatusUpdates = [];

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async (id) => ({
          id,
          status: "pending",
          vehicleId: 3,
          quantityTons: 12,
          invoiceNumber: "INV-200",
          invoiceDate: "2026-04-15",
          totalInvoiceValue: 1500,
        }),
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async ({ reportId, status }) => ({
          id: reportId,
          status,
        }),
        setVehicleOperationalStatus: async ({ vehicleId, status }) => {
          vehicleStatusUpdates.push({ vehicleId, status });
        },
        plantExists: async () => null,
        materialExists: async () => null,
        vehicleExists: async () => ({
          id: 3,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => null,
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({}),
      },
      party: {
        getPartyById: async () => null,
      },
    },
    async ({ updateDispatchStatus }) => {
      const result = await updateDispatchStatus({
        reportId: 77,
        status: "completed",
      });

      assert.equal(result.status, "completed");
    }
  );

  assert.deepEqual(vehicleStatusUpdates, [{ vehicleId: 3, status: "active" }]);
});

test("updateDispatchStatus auto-generates invoice header details when completing", async () => {
  let updatedPayload = null;
  const generatedInvoiceCalls = [];

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async (id) => ({
          id,
          status: "pending",
          vehicleId: 3,
          quantityTons: 12,
          dispatchDate: "2026-04-16",
          invoiceNumber: "",
          invoiceDate: "",
          totalInvoiceValue: 1500,
        }),
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async (payload) => {
          updatedPayload = payload;
          return { id: payload.reportId, status: payload.status };
        },
        generateDispatchInvoiceNumber: async ({ dispatchDate, companyId }) => {
          generatedInvoiceCalls.push({ dispatchDate, companyId });
          return "INV-20260416-0003";
        },
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => null,
        materialExists: async () => null,
        vehicleExists: async () => ({
          id: 3,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => null,
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({}),
      },
      party: {
        getPartyById: async () => null,
      },
    },
    async ({ updateDispatchStatus }) => {
      const result = await updateDispatchStatus({
        reportId: 90,
        status: "completed",
      });

      assert.equal(result.status, "completed");
    }
  );

  assert.deepEqual(generatedInvoiceCalls, [
    { dispatchDate: "2026-04-16", companyId: null },
  ]);
  assert.deepEqual(updatedPayload, {
    reportId: 90,
    status: "completed",
    invoiceNumber: "INV-20260416-0003",
    invoiceDate: "2026-04-16",
    companyId: null,
  });
});

test("updateDispatchStatus rejects pending move when linked vehicle is unavailable", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async (id) => ({
          id,
          status: "completed",
          vehicleId: 3,
          quantityTons: 8,
        }),
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => null,
        materialExists: async () => null,
        vehicleExists: async () => ({
          id: 3,
          status: "maintenance",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => null,
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({}),
      },
      party: {
        getPartyById: async () => null,
      },
    },
    async ({ updateDispatchStatus }) => {
      await assert.rejects(
        () =>
          updateDispatchStatus({
            reportId: 88,
            status: "pending",
          }),
        /not available for dispatch/i
      );
    }
  );
});

test("updateDispatchStatus rejects pending move when linked order quantity is already exhausted", async () => {
  let partyOrderLookups = 0;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async (id) => ({
          id,
          status: "cancelled",
          vehicleId: 3,
          quantityTons: 12,
          partyOrderId: 91,
          plantId: 1,
          materialId: 2,
          partyId: 5,
        }),
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => null,
        materialExists: async () => null,
        vehicleExists: async () => ({
          id: 3,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => null,
        findActiveTransportRate: async () => null,
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({}),
      },
      party: {
        getPartyById: async () => null,
      },
      partyOrder: {
        getPartyOrderById: async () => {
          partyOrderLookups += 1;
          return {
            id: 91,
            partyId: 5,
            plantId: 1,
            materialId: 2,
            status: "open",
            pendingQuantityTons: 8,
          };
        },
      },
    },
    async ({ updateDispatchStatus }) => {
      await assert.rejects(
        () =>
          updateDispatchStatus({
            reportId: 89,
            status: "pending",
          }),
        /pending order quantity/i
      );
    }
  );

  assert.equal(partyOrderLookups, 1);
});

test("createDispatchReport requires a party order when matching pending orders exist", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => {},
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Stone Dust",
          gstRate: 18,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: 44,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 100,
          royaltyMode: "per_ton",
          royaltyValue: 10,
          loadingCharge: 50,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          rateValue: 5,
          distanceKm: 30,
        }),
      },
      db: {
        withTransaction: async (work) => work({}),
      },
      company: {
        getCompanyProfile: async () => ({ stateCode: "09" }),
      },
      party: {
        getPartyById: async () => ({ id: 5, stateCode: "09" }),
      },
      partyOrder: {
        getPartyOrderById: async () => null,
        getAllPartyOrders: async () => [
          {
            id: 91,
            partyId: 5,
            plantId: 1,
            materialId: 2,
            status: "open",
            pendingQuantityTons: 380,
          },
        ],
      },
    },
    async ({ createDispatchReport }) => {
      await assert.rejects(
        () =>
          createDispatchReport({
            dispatchDate: "2026-04-15",
            sourceType: "Plant",
            destinationName: "Site A",
            quantityTons: 10,
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
            distanceKm: 30,
            otherCharge: 20,
          }),
        /select a party order/i
      );
    }
  );
});
