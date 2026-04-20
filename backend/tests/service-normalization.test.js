const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedModule = async (serviceRelativePath, dependencyRelativePath, mockExports, run) => {
  const servicePath = require.resolve(serviceRelativePath);
  const dependencyPath = require.resolve(dependencyRelativePath);

  const originalService = require.cache[servicePath];
  const originalDependency = require.cache[dependencyPath];

  require.cache[dependencyPath] = {
    id: dependencyPath,
    filename: dependencyPath,
    loaded: true,
    exports: mockExports,
  };

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originalService) {
      require.cache[servicePath] = originalService;
    }

    if (originalDependency) {
      require.cache[dependencyPath] = originalDependency;
    } else {
      delete require.cache[dependencyPath];
    }
  }
};

test("party service normalizes billing identity fields before insert", async () => {
  let capturedPayload = null;

  await withMockedModule(
    "../src/modules/parties/parties.service.js",
    "../src/modules/parties/parties.model.js",
    {
      getAllParties: async () => [],
      getPartyById: async () => null,
      insertParty: async (payload) => {
        capturedPayload = payload;
        return payload;
      },
      updateParty: async () => null,
      updatePartyStatus: async () => null,
    },
    async ({ createParty }) => {
      await createParty({
        partyName: "  Acme Infra  ",
        gstin: " 09abcde1234f1z5 ",
        pan: " abcde1234f ",
        mobileNumber: " 9876543210 ",
        stateCode: " 09 ",
        partyType: " Customer ",
      });
    }
  );

  assert.equal(capturedPayload.partyName, "Acme Infra");
  assert.equal(capturedPayload.gstin, "09ABCDE1234F1Z5");
  assert.equal(capturedPayload.pan, "ABCDE1234F");
  assert.equal(capturedPayload.mobileNumber, "9876543210");
  assert.equal(capturedPayload.stateCode, "09");
  assert.equal(capturedPayload.partyType, "customer");
});

test("party service rejects non-boolean status payload", async () => {
  await withMockedModule(
    "../src/modules/parties/parties.service.js",
    "../src/modules/parties/parties.model.js",
    {
      getAllParties: async () => [],
      getPartyById: async () => ({ id: 1, partyName: "Acme Infra" }),
      insertParty: async () => null,
      updateParty: async () => null,
      updatePartyStatus: async () => null,
    },
    async ({ changePartyStatus }) => {
      await assert.rejects(
        () => changePartyStatus(1, "yes"),
        /isActive must be provided as true or false/
      );
    }
  );
});

test("vendor service trims vendor payload before insert", async () => {
  let capturedPayload = null;

  await withMockedModule(
    "../src/modules/vendors/vendors.service.js",
    "../src/modules/vendors/vendors.model.js",
    {
      findAllVendors: async () => [],
      insertVendor: async (payload) => {
        capturedPayload = payload;
        return payload;
      },
      updateVendor: async () => null,
      updateVendorStatus: async () => null,
    },
    async ({ createVendor }) => {
      await createVendor({
        vendorName: "  Fast Logistics  ",
        vendorType: " Transporter ",
        contactPerson: "  Ravi  ",
        mobileNumber: " 9988776655 ",
        address: "  Kanpur Depot  ",
        companyId: 42,
      });
    }
  );

  assert.equal(capturedPayload.vendorName, "Fast Logistics");
  assert.equal(capturedPayload.vendorType, "Transporter");
  assert.equal(capturedPayload.contactPerson, "Ravi");
  assert.equal(capturedPayload.mobileNumber, "9988776655");
  assert.equal(capturedPayload.address, "Kanpur Depot");
  assert.equal(capturedPayload.companyId, 42);
});

test("vendor service returns not found when update target is missing", async () => {
  await withMockedModule(
    "../src/modules/vendors/vendors.service.js",
    "../src/modules/vendors/vendors.model.js",
    {
      findAllVendors: async () => [],
      insertVendor: async () => null,
      updateVendor: async () => null,
      updateVendorStatus: async () => null,
    },
    async ({ editVendor }) => {
      await assert.rejects(
        () =>
          editVendor({
            vendorId: 999,
            vendorName: "Fast Logistics",
            vendorType: "Transporter",
          }),
        /Vendor not found/
      );
    }
  );
});

test("project service preserves company scope on create", async () => {
  const servicePath = require.resolve("../src/modules/projects/projects.service.js");
  const modelPath = require.resolve("../src/modules/projects/projects.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];

  let capturedPayload = null;

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllProjectReports: async () => ({ items: [], total: 0, page: 1, limit: 25 }),
      findProjectReportLookups: async () => ({}),
      findProjectReportSummary: async () => ({}),
      insertProjectReport: async (payload) => {
        capturedPayload = payload;
        return { id: 1, ...payload };
      },
      updateProjectReportById: async () => null,
      deleteProjectReportById: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 9, plantName: "HQ Plant" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createProjectReport } = require(servicePath);
    await createProjectReport({
      reportDate: "2026-04-17",
      plantId: 9,
      projectName: "  Flyover  ",
      siteName: "  Zone A  ",
      workDone: "  Initial setup  ",
      labourCount: 15,
      machineCount: 4,
      createdBy: 77,
      companyId: 88,
    });
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
  }

  assert.equal(capturedPayload.projectName, "Flyover");
  assert.equal(capturedPayload.siteName, "Zone A");
  assert.equal(capturedPayload.workDone, "Initial setup");
  assert.equal(capturedPayload.createdBy, 77);
  assert.equal(capturedPayload.companyId, 88);
});

test("plant service trims payload before insert", async () => {
  let capturedPayload = null;

  await withMockedModule(
    "../src/modules/plants/plants.service.js",
    "../src/modules/plants/plants.model.js",
    {
      findAllPlants: async () => [],
      insertPlant: async (payload) => {
        capturedPayload = payload;
        return payload;
      },
      updatePlant: async () => null,
      updatePlantStatus: async () => null,
    },
    async ({ createPlant }) => {
      await createPlant({
        plantName: "  Main Crusher  ",
        plantCode: "  MC01  ",
        plantType: " Crusher ",
        location: "  Yard A ",
        powerSourceType: " Diesel ",
        companyId: 42,
      });
    }
  );

  assert.equal(capturedPayload.plantName, "Main Crusher");
  assert.equal(capturedPayload.plantCode, "MC01");
  assert.equal(capturedPayload.plantType, "Crusher");
  assert.equal(capturedPayload.location, "Yard A");
  assert.equal(capturedPayload.powerSourceType, "diesel");
  assert.equal(capturedPayload.companyId, 42);
});

test("plant service returns not found when update target is missing", async () => {
  await withMockedModule(
    "../src/modules/plants/plants.service.js",
    "../src/modules/plants/plants.model.js",
    {
      findAllPlants: async () => [],
      insertPlant: async () => null,
      updatePlant: async () => null,
      updatePlantStatus: async () => null,
    },
    async ({ editPlant }) => {
      await assert.rejects(
        () =>
          editPlant({
            plantId: 999,
            plantName: "Main Crusher",
            plantType: "Crusher",
          }),
        /Plant not found/
      );
    }
  );
});

test("party material rate service normalizes payload fields before insert", async () => {
  let capturedPayload = null;

  const servicePath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const partiesModelPath = require.resolve("../src/modules/parties/parties.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];
  const originalPartiesModel = require.cache[partiesModelPath];

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      getAllRates: async () => [],
      insertRate: async (payload) => {
        capturedPayload = payload;
        return payload;
      },
      updateRate: async () => null,
      toggleStatus: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 1, plantName: "Main Plant" }),
      materialExists: async () => ({ id: 3, materialName: "Dust" }),
    },
  };

  require.cache[partiesModelPath] = {
    id: partiesModelPath,
    filename: partiesModelPath,
    loaded: true,
    exports: {
      getPartyById: async () => ({ id: 2, partyName: "ABC Infra" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createRate } = require(servicePath);
    await createRate({
      plantId: "1",
      partyId: "2",
      materialId: "3",
      ratePerTon: "1250",
      royaltyMode: " none ",
      royaltyValue: "",
      loadingCharge: " 20 ",
      notes: "  smoke note  ",
      companyId: 55,
    });
  } finally {
    delete require.cache[servicePath];
    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
    if (originalPartiesModel) require.cache[partiesModelPath] = originalPartiesModel;
    else delete require.cache[partiesModelPath];
  }

  assert.equal(capturedPayload.plantId, 1);
  assert.equal(capturedPayload.partyId, 2);
  assert.equal(capturedPayload.materialId, 3);
  assert.equal(capturedPayload.ratePerTon, 1250);
  assert.equal(capturedPayload.royaltyMode, "none");
  assert.equal(capturedPayload.royaltyValue, 0);
  assert.equal(capturedPayload.loadingCharge, 20);
  assert.equal(capturedPayload.notes, "smoke note");
  assert.equal(capturedPayload.companyId, 55);
  assert.equal(capturedPayload.tonsPerBrass, null);
});

test("party material rate service keeps tonsPerBrass for per_brass mode", async () => {
  let capturedPayload = null;

  const servicePath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const partiesModelPath = require.resolve("../src/modules/parties/parties.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];
  const originalPartiesModel = require.cache[partiesModelPath];

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      getAllRates: async () => [],
      insertRate: async (payload) => {
        capturedPayload = payload;
        return payload;
      },
      updateRate: async () => null,
      toggleStatus: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 1, plantName: "Main Plant" }),
      materialExists: async () => ({ id: 3, materialName: "Dust" }),
    },
  };

  require.cache[partiesModelPath] = {
    id: partiesModelPath,
    filename: partiesModelPath,
    loaded: true,
    exports: {
      getPartyById: async () => ({ id: 2, partyName: "ABC Infra" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createRate } = require(servicePath);
    await createRate({
      plantId: "1",
      partyId: "2",
      materialId: "3",
      ratePerTon: "1250",
      royaltyMode: " per_brass ",
      royaltyValue: "80",
      tonsPerBrass: "2.83",
      loadingCharge: "0",
    });
  } finally {
    delete require.cache[servicePath];
    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
    if (originalPartiesModel) require.cache[partiesModelPath] = originalPartiesModel;
    else delete require.cache[partiesModelPath];
  }

  assert.equal(capturedPayload.royaltyMode, "per_brass");
  assert.equal(capturedPayload.tonsPerBrass, 2.83);
});

test("party material rate service rejects non-boolean status payload", async () => {
  await withMockedModule(
    "../src/modules/party_material_rates/party_material_rates.service.js",
    "../src/modules/party_material_rates/party_material_rates.model.js",
    {
      getAllRates: async () => [],
      insertRate: async () => null,
      updateRate: async () => null,
      toggleStatus: async () => null,
    },
    async ({ changeStatus }) => {
      await assert.rejects(
        () => changeStatus(1, "yes", 10),
        /isActive must be provided as true or false/
      );
    }
  );
});

test("party material rate service rejects creation when linked masters are missing", async () => {
  const servicePath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.service.js"
  );
  const modelPath = require.resolve(
    "../src/modules/party_material_rates/party_material_rates.model.js"
  );
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");
  const partiesModelPath = require.resolve("../src/modules/parties/parties.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];
  const originalPartiesModel = require.cache[partiesModelPath];

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      getAllRates: async () => [],
      insertRate: async () => {
        throw new Error("insert should not run when links are missing");
      },
      updateRate: async () => null,
      toggleStatus: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => null,
      materialExists: async () => ({ id: 3, materialName: "Dust" }),
    },
  };

  require.cache[partiesModelPath] = {
    id: partiesModelPath,
    filename: partiesModelPath,
    loaded: true,
    exports: {
      getPartyById: async () => ({ id: 2, partyName: "ABC Infra" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createRate } = require(servicePath);
    await assert.rejects(
      () =>
        createRate({
          plantId: 1,
          partyId: 2,
          materialId: 3,
          ratePerTon: 1200,
          royaltyMode: "none",
          companyId: 44,
        }),
      /Selected plant does not exist/
    );
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
    if (originalPartiesModel) require.cache[partiesModelPath] = originalPartiesModel;
    else delete require.cache[partiesModelPath];
  }
});

test("company profile service normalizes tax identifiers before save", async () => {
  let capturedPayload = null;

  await withMockedModule(
    "../src/modules/company_profile/company_profile.service.js",
    "../src/modules/company_profile/company_profile.model.js",
    {
      getActiveCompanyProfile: async () => null,
      upsertCompanyProfile: async (payload) => {
        capturedPayload = payload;
        return { id: 1, ...payload };
      },
    },
    async ({ saveCompanyProfile }) => {
      await saveCompanyProfile(
        {
          companyName: "  Apex Infra  ",
          logoUrl: "  data:image/png;base64,AAAA  ",
          gstin: " 27abcde1234f1z5 ",
          pan: " abcde1234f ",
          ifscCode: " hdfc0001234 ",
        },
        4
      );
    }
  );

  assert.equal(capturedPayload.companyName, "Apex Infra");
  assert.equal(capturedPayload.logoUrl, "data:image/png;base64,AAAA");
  assert.equal(capturedPayload.gstin, "27ABCDE1234F1Z5");
  assert.equal(capturedPayload.pan, "ABCDE1234F");
  assert.equal(capturedPayload.ifscCode, "HDFC0001234");
});

test("crusher service computes total expense from expense components", async () => {
  const servicePath = require.resolve("../src/modules/crusher/crusher.service.js");
  const modelPath = require.resolve("../src/modules/crusher/crusher.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];

  let capturedPayload = null;

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllCrusherReports: async () => ({ items: [], total: 0, page: 1, limit: 25 }),
      findCrusherReportSummary: async () => ({}),
      findCrusherReportLookups: async () => ({}),
      insertCrusherReport: async (payload) => {
        capturedPayload = payload;
        return { id: 1, ...payload };
      },
      updateCrusherReportById: async () => null,
      deleteCrusherReportById: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 4, plantName: "Main Crusher" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createCrusherReport } = require(servicePath);
    await createCrusherReport({
      reportDate: "2026-04-17",
      plantId: 4,
      dieselCost: 1000,
      electricityCost: 500,
      labourExpense: 200,
      maintenanceExpense: 300,
      otherExpense: 50,
      totalExpense: 9999,
      createdBy: 7,
      companyId: 88,
    });
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
  }

  assert.equal(capturedPayload.totalExpense, 2050);
});

test("crusher service derives diesel/electricity costs from usage and rates", async () => {
  const servicePath = require.resolve("../src/modules/crusher/crusher.service.js");
  const modelPath = require.resolve("../src/modules/crusher/crusher.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];

  let capturedPayload = null;

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllCrusherReports: async () => ({ items: [], total: 0, page: 1, limit: 25 }),
      findCrusherReportSummary: async () => ({}),
      findCrusherReportLookups: async () => ({}),
      insertCrusherReport: async () => null,
      updateCrusherReportById: async (payload) => {
        capturedPayload = payload;
        return { id: payload.id, ...payload };
      },
      deleteCrusherReportById: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 5, plantName: "Hybrid Unit" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { editCrusherReport } = require(servicePath);
    await editCrusherReport({
      id: 42,
      reportDate: "2026-04-17",
      plantId: 5,
      dieselUsed: 100,
      dieselRatePerLitre: 90,
      electricityKwh: 200,
      electricityRatePerKwh: 8,
      labourExpense: 500,
      maintenanceExpense: 250,
      otherExpense: 50,
      companyId: 88,
    });
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
  }

  assert.equal(capturedPayload.dieselCost, 9000);
  assert.equal(capturedPayload.electricityCost, 1600);
  assert.equal(capturedPayload.totalExpense, 11400);
});

test("crusher service rejects breakdown hours above machine hours", async () => {
  const servicePath = require.resolve("../src/modules/crusher/crusher.service.js");
  const modelPath = require.resolve("../src/modules/crusher/crusher.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllCrusherReports: async () => ({ items: [], total: 0, page: 1, limit: 25 }),
      findCrusherReportSummary: async () => ({}),
      findCrusherReportLookups: async () => ({}),
      insertCrusherReport: async () => null,
      updateCrusherReportById: async () => null,
      deleteCrusherReportById: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 5, plantName: "Hybrid Unit" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createCrusherReport } = require(servicePath);
    await assert.rejects(
      () =>
        createCrusherReport({
          reportDate: "2026-04-17",
          plantId: 5,
          machineHours: 8,
          breakdownHours: 10,
          companyId: 88,
        }),
      /Breakdown hours cannot exceed machine hours/
    );
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
  }
});

test("crusher service rejects dispatch above opening stock + production", async () => {
  const servicePath = require.resolve("../src/modules/crusher/crusher.service.js");
  const modelPath = require.resolve("../src/modules/crusher/crusher.model.js");
  const dispatchModelPath = require.resolve("../src/modules/dispatch/dispatch.model.js");

  const originalService = require.cache[servicePath];
  const originalModel = require.cache[modelPath];
  const originalDispatchModel = require.cache[dispatchModelPath];

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findAllCrusherReports: async () => ({ items: [], total: 0, page: 1, limit: 25 }),
      findCrusherReportSummary: async () => ({}),
      findCrusherReportLookups: async () => ({}),
      insertCrusherReport: async () => null,
      updateCrusherReportById: async () => null,
      deleteCrusherReportById: async () => null,
    },
  };

  require.cache[dispatchModelPath] = {
    id: dispatchModelPath,
    filename: dispatchModelPath,
    loaded: true,
    exports: {
      plantExists: async () => ({ id: 5, plantName: "Hybrid Unit" }),
    },
  };

  delete require.cache[servicePath];

  try {
    const { createCrusherReport } = require(servicePath);
    await assert.rejects(
      () =>
        createCrusherReport({
          reportDate: "2026-04-17",
          plantId: 5,
          openingStockTons: 75,
          productionTons: 240,
          dispatchTons: 320,
          companyId: 88,
        }),
      /Dispatch tons cannot exceed opening stock \+ production tons/
    );
  } finally {
    delete require.cache[servicePath];

    if (originalService) require.cache[servicePath] = originalService;
    if (originalModel) require.cache[modelPath] = originalModel;
    else delete require.cache[modelPath];
    if (originalDispatchModel) require.cache[dispatchModelPath] = originalDispatchModel;
    else delete require.cache[dispatchModelPath];
  }
});
