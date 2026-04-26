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
  const conversionsPath = require.resolve(
    "../src/modules/material_unit_conversions/material_unit_conversions.service.js"
  );

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
    db: require.cache[dbPath],
    company: require.cache[companyPath],
    party: require.cache[partyPath],
    partyOrder: require.cache[partyOrderPath],
    conversions: require.cache[conversionsPath],
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

  require.cache[conversionsPath] = {
    id: conversionsPath,
    filename: conversionsPath,
    loaded: true,
    exports: mocks.conversions || {
      getUnitById: async (unitId) => ({
        id: Number(unitId),
        unitCode: Number(unitId) === 13 ? "BRASS" : "CFT",
        unitName: Number(unitId) === 13 ? "Brass" : "Cubic Feet",
        isActive: true,
      }),
      convertToTon: async (_materialId, quantity) => ({
        fromUnitId: 12,
        toUnitId: 1,
        conversionFactor: 0.044444,
        effectiveConversionFactor: 0.044444,
        conversionMethod: "density_based",
        conversionId: 41,
        originalConversionId: 41,
        calculatedQuantity: Number(quantity) * 0.044444,
      }),
      convertFromTon: async (_materialId, quantityTons, toUnitId) => ({
        fromUnitId: 1,
        toUnitId: Number(toUnitId),
        conversionFactor: Number(toUnitId) === 13 ? 0.3534 : 22.5,
        effectiveConversionFactor: Number(toUnitId) === 13 ? 0.3534 : 22.5,
        conversionMethod: "density_based",
        conversionId: Number(toUnitId) === 13 ? 42 : 41,
        originalConversionId: Number(toUnitId) === 13 ? 42 : 41,
        calculatedQuantity:
          Number(quantityTons) * (Number(toUnitId) === 13 ? 0.3534 : 22.5),
      }),
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
    if (originals.conversions) require.cache[conversionsPath] = originals.conversions;
    else delete require.cache[conversionsPath];
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
  assert.equal(insertedPayload.materialRateUnit, "per_ton");
  assert.equal(insertedPayload.materialRateUnitLabel, "ton");
  assert.equal(insertedPayload.materialRateUnitsPerTon, 1);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_ton");
  assert.equal(insertedPayload.billingUnitIdSnapshot, null);
  assert.equal(insertedPayload.billedQuantitySnapshot, 10);
  assert.equal(insertedPayload.billedRateSnapshot, 100);
  assert.equal(insertedPayload.royaltyAmount, 100);
  assert.equal(insertedPayload.loadingCharge, 50);
  assert.equal(insertedPayload.transportCost, 150);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_km");
  assert.equal(insertedPayload.transportUnitIdSnapshot, null);
  assert.equal(insertedPayload.transportQuantitySnapshot, 30);
  assert.equal(insertedPayload.totalInvoiceValue, 1320);
  assert.equal(insertedPayload.invoiceValue, 1320);
  assert.equal(insertedPayload.gstRate, 18);
  assert.equal(insertedPayload.cgst, 118.8);
  assert.equal(insertedPayload.sgst, 118.8);
  assert.equal(insertedPayload.igst, 0);
  assert.equal(insertedPayload.totalWithGst, 1557.6);
  assert.deepEqual(vehicleStatusUpdates, [{ vehicleId: 3, status: "in_use" }]);
});

test("createDispatchReport computes material amount from converted selling rate units", async () => {
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
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate 20mm",
          gstRate: 0,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 45,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
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
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialRatePerTon, 45);
  assert.equal(insertedPayload.materialRateUnit, "per_cft");
  assert.equal(insertedPayload.materialRateUnitLabel, "CFT");
  assert.equal(insertedPayload.materialRateUnitsPerTon, 22.5);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billedQuantitySnapshot, 225);
  assert.equal(insertedPayload.billedRateSnapshot, 45);
  assert.match(insertedPayload.conversionNotesSnapshot, /22\.5 billable units per ton/i);
  assert.equal(insertedPayload.materialAmount, 10125);
  assert.equal(insertedPayload.totalInvoiceValue, 10125);
});

test("createDispatchReport computes basis-driven loading and preserves manual loading override", async () => {
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
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Stone Dust",
          gstRate: 0,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 100,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 25,
          loadingChargeBasis: "per_ton",
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
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        loadingCharge: 400,
        loadingChargeManual: true,
      });
    }
  );

  assert.equal(insertedPayload.loadingChargeBasis, "per_ton");
  assert.equal(insertedPayload.loadingChargeRate, 25);
  assert.equal(insertedPayload.loadingCharge, 400);
  assert.equal(insertedPayload.loadingChargeIsManual, true);
  assert.equal(insertedPayload.totalInvoiceValue, 1400);
});

test("createDispatchReport preserves converted selling rate precision in dispatch snapshot", async () => {
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
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate 20mm",
          gstRate: 0,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 1800,
          rateUnit: "per_brass",
          rateUnitLabel: "brass",
          rateUnitsPerTon: 0.3534,
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
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialRateUnit, "per_brass");
  assert.equal(insertedPayload.materialRateUnitsPerTon, 0.3534);
  assert.equal(insertedPayload.materialAmount, 6361.2);
});

test("createDispatchReport rounds per_trip selling rate billing up to full trips", async () => {
  let insertedPayload = null;

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
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({
          id: 2,
          materialName: "Aggregate 20mm",
          gstRate: 0,
        }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 2500,
          rateUnit: "per_trip",
          rateUnitLabel: "trip",
          rateUnitsPerTon: 0.1,
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
        destinationName: "Site A",
        quantityTons: 15,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialRateUnit, "per_trip");
  assert.equal(insertedPayload.materialRateUnitsPerTon, 0.1);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_trip");
  assert.equal(insertedPayload.billedQuantitySnapshot, 2);
  assert.equal(insertedPayload.materialAmount, 5000);
  assert.equal(insertedPayload.totalInvoiceValue, 5000);
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
    {
      plantId: 1,
      partyId: 5,
      materialId: 2,
      companyId: 77,
      effectiveDate: "2026-04-15",
    },
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
  assert.equal(insertedPayload.royaltyTonsPerBrass, 2.5);
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

test("createDispatchReport keeps legacy quantityTons flow unchanged", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 201, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Stone Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 10);
  assert.equal(insertedPayload.enteredQuantity, null);
  assert.equal(insertedPayload.enteredUnitId, null);
  assert.equal(insertedPayload.quantitySource, null);
  assert.equal(insertedPayload.conversionId, null);
});

test("createDispatchReport normalizes manual_volume dispatch from CFT to TON", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 202, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
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
      conversions: {
        convertToTon: async () => ({
          fromUnitId: 12,
          toUnitId: 1,
          conversionFactor: 0.044444,
          effectiveConversionFactor: 0.044444,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 10,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        enteredQuantity: 225,
        enteredUnitId: 12,
        quantitySource: "manual_volume",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 10);
  assert.equal(insertedPayload.enteredQuantity, 225);
  assert.equal(insertedPayload.enteredUnitId, 12);
  assert.equal(insertedPayload.quantitySource, "manual_volume");
  assert.equal(insertedPayload.conversionFactorToTon, 0.044444);
  assert.equal(insertedPayload.conversionId, 41);
  assert.equal(insertedPayload.conversionMethodSnapshot, "density_based");
});

test("createDispatchReport stores manual_weight dispatch directly in tons", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 203, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 12,
        quantitySource: "manual_weight",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 12);
  assert.equal(insertedPayload.quantitySource, "manual_weight");
  assert.equal(insertedPayload.conversionFactorToTon, 1);
});

test("createDispatchReport stores weighbridge dispatch directly in tons", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 204, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 14,
        quantitySource: "weighbridge",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 14);
  assert.equal(insertedPayload.quantitySource, "weighbridge");
  assert.equal(insertedPayload.conversionMethodSnapshot, "weighbridge");
});

test("createDispatchReport derives vehicle_capacity dispatch from vehicle capacity", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 205, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 14,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantitySource: "vehicle_capacity",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 14);
  assert.equal(insertedPayload.quantitySource, "vehicle_capacity");
  assert.equal(insertedPayload.sourceVehicleCapacityTons, 14);
});

test("createDispatchReport throws clear error when manual_volume conversion is missing", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
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
      conversions: {
        convertToTon: async () => {
          throw new Error("No active conversion found for selected material and units");
        },
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await assert.rejects(
        () =>
          createDispatchReport({
            dispatchDate: "2026-04-26",
            sourceType: "Plant",
            destinationName: "Site A",
            enteredQuantity: 225,
            enteredUnitId: 12,
            quantitySource: "manual_volume",
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
          }),
        /No active conversion/i
      );
    }
  );
});

test("createDispatchReport throws clear error when vehicle capacity is missing for estimation", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: null,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await assert.rejects(
        () =>
          createDispatchReport({
            dispatchDate: "2026-04-26",
            sourceType: "Plant",
            destinationName: "Site A",
            quantitySource: "vehicle_capacity",
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
          }),
        /missing capacity/i
      );
    }
  );
});

test("createDispatchReport keeps legacy material billing unchanged when new rate fields are absent", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 301, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          ratePerTon: 45,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 10125);
  assert.equal(insertedPayload.billedQuantitySnapshot, 225);
  assert.equal(insertedPayload.billedRateSnapshot, 45);
});

test("createDispatchReport calculates per_unit CFT billing from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 302, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_unit",
          rateUnitId: 12,
          pricePerUnit: 38,
          ratePerTon: 38,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      conversions: {
        getUnitById: async () => ({
          id: 12,
          unitCode: "CFT",
          unitName: "Cubic Feet",
          isActive: true,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 12,
          conversionFactor: 22.5,
          effectiveConversionFactor: 22.5,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 225,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 8550);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billingUnitIdSnapshot, 12);
  assert.equal(insertedPayload.billedQuantitySnapshot, 225);
  assert.equal(insertedPayload.billedRateSnapshot, 38);
});

test("createDispatchReport calculates per_unit BRASS billing from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 303, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_unit",
          rateUnitId: 13,
          pricePerUnit: 3600,
          ratePerTon: 3600,
          rateUnit: "per_brass",
          rateUnitLabel: "brass",
          rateUnitsPerTon: 0.3534,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      conversions: {
        getUnitById: async () => ({
          id: 13,
          unitCode: "BRASS",
          unitName: "Brass",
          isActive: true,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 13,
          conversionFactor: 0.3534,
          effectiveConversionFactor: 0.3534,
          conversionMethod: "density_based",
          conversionId: 42,
          originalConversionId: 42,
          calculatedQuantity: 3.534,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 12722.4);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billingUnitIdSnapshot, 13);
  assert.equal(insertedPayload.billedQuantitySnapshot, 3.534);
  assert.equal(insertedPayload.billedRateSnapshot, 3600);
});

test("createDispatchReport calculates billingBasis per_ton from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 304, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Metal", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_ton",
          pricePerUnit: 950,
          ratePerTon: 950,
          rateUnit: "per_ton",
          rateUnitLabel: "ton",
          rateUnitsPerTon: 1,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 9500);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_ton");
  assert.equal(insertedPayload.billedQuantitySnapshot, 10);
  assert.equal(insertedPayload.billedRateSnapshot, 950);
});

test("createDispatchReport calculates fixed billingBasis from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 305, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Service Mix", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "fixed",
          pricePerUnit: 5000,
          ratePerTon: 5000,
          rateUnit: "per_ton",
          rateUnitLabel: "ton",
          rateUnitsPerTon: 1,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.materialAmount, 5000);
  assert.equal(insertedPayload.billingBasisSnapshot, "fixed");
  assert.equal(insertedPayload.billedQuantitySnapshot, 1);
  assert.equal(insertedPayload.billedRateSnapshot, 5000);
});

test("createDispatchReport throws clear error for per_unit billing when conversion is missing", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_unit",
          rateUnitId: 12,
          pricePerUnit: 38,
          ratePerTon: 38,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      conversions: {
        convertFromTon: async () => {
          throw new Error("No active material conversion found");
        },
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await assert.rejects(
        () =>
          createDispatchReport({
            dispatchDate: "2026-04-26",
            sourceType: "Plant",
            destinationName: "Site A",
            quantityTons: 10,
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
          }),
        /No active material conversion/i
      );
    }
  );
});

test("createDispatchReport stores correct snapshots for unit-aware fixed and per_unit billing", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 306, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_unit",
          rateUnitId: 12,
          pricePerUnit: 38,
          ratePerTon: 38,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      conversions: {
        getUnitById: async () => ({
          id: 12,
          unitCode: "CFT",
          unitName: "Cubic Feet",
          isActive: true,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 12,
          conversionFactor: 22.5,
          effectiveConversionFactor: 22.5,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 225,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Site A",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billingUnitIdSnapshot, 12);
  assert.equal(insertedPayload.billedQuantitySnapshot, 225);
  assert.equal(insertedPayload.billedRateSnapshot, 38);
  assert.match(insertedPayload.conversionNotesSnapshot, /converted 10 ton to 225 cft/i);
});

test("createDispatchReport keeps legacy transport calculation unchanged when unit-aware fields are absent", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 307, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          rateValue: 5,
          distanceKm: 30,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Legacy Transport Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 30,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 150);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_km");
  assert.equal(insertedPayload.transportUnitIdSnapshot, null);
  assert.equal(insertedPayload.transportQuantitySnapshot, 30);
});

test("createDispatchReport calculates per_unit CFT transport from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 308, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_ton",
          billingBasis: "per_unit",
          rateUnitId: 12,
          rateValue: 4,
          minimumCharge: null,
        }),
      },
      conversions: {
        getUnitById: async () => ({
          id: 12,
          unitCode: "CFT",
          unitName: "Cubic Feet",
          isActive: true,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 12,
          conversionFactor: 22.5,
          effectiveConversionFactor: 22.5,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 225,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Unit Transport Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 900);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.transportUnitIdSnapshot, 12);
  assert.equal(insertedPayload.transportQuantitySnapshot, 225);
  assert.equal(insertedPayload.transportRateValue, 4);
});

test("createDispatchReport calculates per_ton transport from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 309, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          billingBasis: "per_ton",
          rateValue: 55,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Ton Transport Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 30,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 550);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_ton");
  assert.equal(insertedPayload.transportUnitIdSnapshot, null);
  assert.equal(insertedPayload.transportQuantitySnapshot, 10);
});

test("createDispatchReport calculates per_trip transport from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 310, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          billingBasis: "per_trip",
          rateValue: 1800,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Trip Transport Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 80,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 1800);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_trip");
  assert.equal(insertedPayload.transportQuantitySnapshot, 1);
});

test("createDispatchReport calculates per_km transport from unit-aware rate", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 311, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_trip",
          billingBasis: "per_km",
          rateValue: 12,
          distanceKm: 15,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "KM Transport Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 18,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 216);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_km");
  assert.equal(insertedPayload.transportUnitIdSnapshot, null);
  assert.equal(insertedPayload.transportQuantitySnapshot, 18);
});

test("createDispatchReport applies minimum transport charge for unit-aware transport", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 312, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          billingBasis: "per_ton",
          rateValue: 15,
          minimumCharge: 200,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Minimum Charge Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.transportCost, 200);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_ton");
  assert.equal(insertedPayload.transportQuantitySnapshot, 10);
});

test("createDispatchReport throws clear error for per_unit transport when conversion is missing", async () => {
  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async () => null,
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_ton",
          billingBasis: "per_unit",
          rateUnitId: 12,
          rateValue: 4,
        }),
      },
      conversions: {
        convertFromTon: async () => {
          throw new Error("No active material conversion found");
        },
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await assert.rejects(
        () =>
          createDispatchReport({
            dispatchDate: "2026-04-26",
            sourceType: "Plant",
            destinationName: "Missing Transport Conversion Site",
            quantityTons: 10,
            createdBy: 1,
            plantId: 1,
            materialId: 2,
            vehicleId: 3,
            partyId: 5,
          }),
        /No active material conversion/i
      );
    }
  );
});

test("createDispatchReport stores correct transport snapshots for unit-aware transport", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 313, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_trip",
          billingBasis: "per_unit",
          rateUnitId: 12,
          rateValue: 4.5,
          minimumCharge: 0,
        }),
      },
      conversions: {
        getUnitById: async () => ({
          id: 12,
          unitCode: "CFT",
          unitName: "Cubic Feet",
          isActive: true,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 12,
          conversionFactor: 22.5,
          effectiveConversionFactor: 22.5,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 225,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Transport Snapshot Site",
        quantityTons: 10,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.transportRateType, "per_trip");
  assert.equal(insertedPayload.transportRateValue, 4.5);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.transportUnitIdSnapshot, 12);
  assert.equal(insertedPayload.transportQuantitySnapshot, 225);
  assert.equal(insertedPayload.transportCost, 1012.5);
});

test("createDispatchReport handles manual volume CFT dispatch with per_unit billing and per_trip transport", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 314, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          billingBasis: "per_unit",
          rateUnitId: 12,
          pricePerUnit: 38,
          ratePerTon: 38,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          billingBasis: "per_trip",
          rateValue: 1500,
        }),
      },
      conversions: {
        getUnitById: async () => ({
          id: 12,
          unitCode: "CFT",
          unitName: "Cubic Feet",
          isActive: true,
        }),
        convertToTon: async () => ({
          fromUnitId: 12,
          toUnitId: 1,
          conversionFactor: 0.044444,
          effectiveConversionFactor: 0.044444,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 10,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 12,
          conversionFactor: 22.5,
          effectiveConversionFactor: 22.5,
          conversionMethod: "density_based",
          conversionId: 41,
          originalConversionId: 41,
          calculatedQuantity: 225,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Manual Volume CFT Site",
        enteredQuantity: 225,
        enteredUnitId: 12,
        quantitySource: "manual_volume",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 10);
  assert.equal(insertedPayload.enteredQuantity, 225);
  assert.equal(insertedPayload.enteredUnitId, 12);
  assert.equal(insertedPayload.materialAmount, 8550);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billedQuantitySnapshot, 225);
  assert.equal(insertedPayload.transportBasisSnapshot, "per_trip");
  assert.equal(insertedPayload.transportQuantitySnapshot, 1);
  assert.equal(insertedPayload.transportCost, 1500);
  assert.equal(insertedPayload.totalInvoiceValue, 10050);
});

test("createDispatchReport handles manual volume BRASS dispatch with per_unit BRASS billing", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 315, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Dust", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 20,
        }),
        findActivePartyMaterialRate: async () => ({
          id: 11,
          billingBasis: "per_unit",
          rateUnitId: 13,
          pricePerUnit: 3600,
          ratePerTon: 3600,
          rateUnit: "per_brass",
          rateUnitLabel: "brass",
          rateUnitsPerTon: 0.3534,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => null,
      },
      conversions: {
        getUnitById: async () => ({
          id: 13,
          unitCode: "BRASS",
          unitName: "Brass",
          isActive: true,
        }),
        convertToTon: async () => ({
          fromUnitId: 13,
          toUnitId: 1,
          conversionFactor: 2.829654,
          effectiveConversionFactor: 2.829654,
          conversionMethod: "density_based",
          conversionId: 42,
          originalConversionId: 42,
          calculatedQuantity: 10,
        }),
        convertFromTon: async () => ({
          fromUnitId: 1,
          toUnitId: 13,
          conversionFactor: 0.3534,
          effectiveConversionFactor: 0.3534,
          conversionMethod: "density_based",
          conversionId: 42,
          originalConversionId: 42,
          calculatedQuantity: 3.534,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Manual Volume BRASS Site",
        enteredQuantity: 3.534,
        enteredUnitId: 13,
        quantitySource: "manual_volume",
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 10);
  assert.equal(insertedPayload.enteredQuantity, 3.534);
  assert.equal(insertedPayload.enteredUnitId, 13);
  assert.equal(insertedPayload.quantitySource, "manual_volume");
  assert.equal(insertedPayload.materialAmount, 12722.4);
  assert.equal(insertedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(insertedPayload.billingUnitIdSnapshot, 13);
  assert.equal(insertedPayload.billedQuantitySnapshot, 3.534);
  assert.equal(insertedPayload.billedRateSnapshot, 3600);
});

test("createDispatchReport derives trip_estimate dispatch quantity from trip count and vehicle capacity", async () => {
  let insertedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async () => null,
        insertDispatchReport: async (payload) => {
          insertedPayload = payload;
          return { id: 316, ...payload };
        },
        updateDispatchReportById: async () => null,
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
        vehicleExists: async () => ({
          id: 3,
          vehicleNumber: "UP32AB1234",
          plantId: 1,
          vendorId: null,
          status: "active",
          vehicleCapacityTons: 14,
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
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ createDispatchReport }) => {
      await createDispatchReport({
        dispatchDate: "2026-04-26",
        sourceType: "Plant",
        destinationName: "Trip Estimate Site",
        quantitySource: "trip_estimate",
        enteredQuantity: 3,
        createdBy: 1,
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
      });
    }
  );

  assert.equal(insertedPayload.quantityTons, 42);
  assert.equal(insertedPayload.enteredQuantity, 3);
  assert.equal(insertedPayload.quantitySource, "trip_estimate");
  assert.equal(insertedPayload.sourceVehicleCapacityTons, 14);
  assert.equal(insertedPayload.totalInvoiceValue, 4200);
});

test("editDispatchReport keeps legacy snapshots stable when editing an old dispatch", async () => {
  let updatedPayload = null;

  await withDispatchServiceMocks(
    {
      model: {
        findAllDispatchReports: async () => [],
        findDispatchById: async (id) => ({
          id,
          status: "pending",
          vehicleId: 3,
          quantityTons: 10,
          dispatchDate: "2026-04-20",
          totalInvoiceValue: 10275,
          invoiceValue: 10275,
          billingBasisSnapshot: "per_unit",
          transportBasisSnapshot: "per_km",
        }),
        insertDispatchReport: async () => null,
        updateDispatchReportById: async (payload) => {
          updatedPayload = payload;
          return { id: payload.reportId, ...payload };
        },
        updateDispatchStatusById: async () => null,
        setVehicleOperationalStatus: async () => null,
        plantExists: async () => ({ id: 1, plantName: "Alpha Plant" }),
        materialExists: async () => ({ id: 2, materialName: "Aggregate", gstRate: 0 }),
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
          ratePerTon: 45,
          rateUnit: "per_cft",
          rateUnitLabel: "CFT",
          rateUnitsPerTon: 22.5,
          royaltyMode: "none",
          royaltyValue: 0,
          loadingCharge: 0,
        }),
        findActiveTransportRate: async () => ({
          id: 22,
          rateType: "per_km",
          rateValue: 5,
          distanceKm: 30,
        }),
      },
      db: { withTransaction: async (work) => work({}) },
      company: { getCompanyProfile: async () => ({ stateCode: "09" }) },
      party: { getPartyById: async () => ({ id: 5, stateCode: "09" }) },
    },
    async ({ editDispatchReport }) => {
      await editDispatchReport({
        reportId: 401,
        dispatchDate: "2026-04-20",
        sourceType: "Plant",
        destinationName: "Legacy Edited Site",
        quantityTons: 10,
        remarks: "Edited without unit-aware changes",
        plantId: 1,
        materialId: 2,
        vehicleId: 3,
        partyId: 5,
        distanceKm: 30,
        companyId: null,
      });
    }
  );

  assert.equal(updatedPayload.quantityTons, 10);
  assert.equal(updatedPayload.enteredQuantity, null);
  assert.equal(updatedPayload.enteredUnitId, null);
  assert.equal(updatedPayload.quantitySource, null);
  assert.equal(updatedPayload.billingBasisSnapshot, "per_unit");
  assert.equal(updatedPayload.billedQuantitySnapshot, 225);
  assert.equal(updatedPayload.billedRateSnapshot, 45);
  assert.equal(updatedPayload.transportBasisSnapshot, "per_km");
  assert.equal(updatedPayload.transportQuantitySnapshot, 30);
  assert.equal(updatedPayload.transportCost, 150);
  assert.equal(updatedPayload.totalInvoiceValue, 10275);
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
