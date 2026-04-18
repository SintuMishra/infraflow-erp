const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMastersServiceMocks = async (mocks, run) => {
  const servicePath = require.resolve("../src/modules/masters/masters.service.js");
  const modelPath = require.resolve("../src/modules/masters/masters.model.js");

  const originals = {
    service: require.cache[servicePath],
    model: require.cache[modelPath],
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: mocks.model,
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
  }
};

test("getMasterData forwards company scope to all master lookups", async () => {
  const calls = {
    crusherUnits: [],
    materials: [],
    shifts: [],
    vehicleTypes: [],
    configOptions: [],
  };

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async (companyId) => {
          calls.crusherUnits.push(companyId);
          return [{ id: 1, unitName: "Crusher A" }];
        },
        findMaterials: async (companyId) => {
          calls.materials.push(companyId);
          return [{ id: 2, materialName: "Stone Dust", gstRate: 5 }];
        },
        findShifts: async (companyId) => {
          calls.shifts.push(companyId);
          return [{ id: 3, shiftName: "Morning" }];
        },
        findVehicleTypes: async (companyId) => {
          calls.vehicleTypes.push(companyId);
          return [{ id: 4, typeName: "Tipper" }];
        },
        findConfigOptions: async (companyId) => {
          calls.configOptions.push(companyId);
          return [
            { id: 5, configType: "plant_type", optionLabel: "Plant" },
            { id: 6, configType: "vehicle_category", optionLabel: "Heavy" },
          ];
        },
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ getMasterData }) => {
      const data = await getMasterData(44);

      assert.equal(data.crusherUnits.length, 1);
      assert.equal(data.materials.length, 1);
      assert.equal(data.shifts.length, 1);
      assert.equal(data.vehicleTypes.length, 1);
      assert.equal(data.configOptions.plantTypes.length, 1);
      assert.equal(data.configOptions.vehicleCategories.length, 1);
      assert.equal(data.configOptions.materialHsnRules.length, 0);
    }
  );

  assert.deepEqual(calls.crusherUnits, [44]);
  assert.deepEqual(calls.materials, [44]);
  assert.deepEqual(calls.shifts, [44]);
  assert.deepEqual(calls.vehicleTypes, [44]);
  assert.deepEqual(calls.configOptions, [44]);
});

test("createMaterial normalizes GST rate and preserves companyId", async () => {
  let insertedPayload = null;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async (payload) => {
          insertedPayload = payload;
          return payload;
        },
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ createMaterial }) => {
      await createMaterial({
        materialName: "  GSB  ",
        materialCode: " GSB-01 ",
        hsnSacCode: " 2517 ",
        category: " Road ",
        unit: " tons ",
        gstRate: "18",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.materialName, "GSB");
  assert.equal(insertedPayload.materialCode, "GSB-01");
  assert.equal(insertedPayload.hsnSacCode, "2517");
  assert.equal(insertedPayload.category, "Road");
  assert.equal(insertedPayload.unit, "tons");
  assert.equal(insertedPayload.gstRate, 18);
  assert.equal(insertedPayload.companyId, 44);
});

test("createMaterial auto-fills HSN/SAC for known aggregate materials when left blank", async () => {
  let insertedPayload = null;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async (payload) => {
          insertedPayload = payload;
          return payload;
        },
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ createMaterial }) => {
      await createMaterial({
        materialName: "40mm Aggregate",
        materialCode: "MAT60",
        category: "Aggregate",
        unit: "tons",
        gstRate: "5",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.hsnSacCode, "2517");
});

test("createMaterial prefers configurable HSN auto-rules when a matching rule exists", async () => {
  let insertedPayload = null;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [
          {
            id: 91,
            configType: "material_hsn_rule",
            optionLabel: "murum",
            optionValue: "2505",
            isActive: true,
          },
        ],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async (payload) => {
          insertedPayload = payload;
          return payload;
        },
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ createMaterial }) => {
      await createMaterial({
        materialName: "Murum",
        materialCode: "MUR",
        category: "Road Material",
        unit: "tons",
        gstRate: "5",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.hsnSacCode, "2505");
});

test("createCrusherUnit normalizes plant-linked unit payload for typed reporting", async () => {
  let insertedPayload = null;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async (payload) => {
          insertedPayload = payload;
          return payload;
        },
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ createCrusherUnit }) => {
      await createCrusherUnit({
        unitName: "  RMC Line A ",
        unitCode: " RMC-A ",
        location: " Yard 2 ",
        plantType: " RMC ",
        powerSourceType: " electric ",
        companyId: 44,
      });
    }
  );

  assert.equal(insertedPayload.unitName, "RMC Line A");
  assert.equal(insertedPayload.unitCode, "RMC-A");
  assert.equal(insertedPayload.location, "Yard 2");
  assert.equal(insertedPayload.plantType, "RMC");
  assert.equal(insertedPayload.powerSourceType, "electric");
  assert.equal(insertedPayload.companyId, 44);
});

test("getMasterHealthCheck reports missing HSN/SAC and duplicate active material codes", async () => {
  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [{ id: 1, isActive: true }],
        findMaterials: async () => [
          {
            id: 10,
            materialName: "40mm Aggregate",
            materialCode: "AGG-40",
            hsnSacCode: "",
            isActive: true,
          },
          {
            id: 11,
            materialName: "20mm Aggregate",
            materialCode: "AGG-40",
            hsnSacCode: "2517",
            isActive: true,
          },
        ],
        findShifts: async () => [{ id: 2, isActive: true }],
        findVehicleTypes: async () => [{ id: 3, isActive: true }],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ getMasterHealthCheck }) => {
      const health = await getMasterHealthCheck(44);

      assert.equal(health.counts.materialsMissingHsnSac, 1);
      assert.ok(
        health.issues.some((issue) => issue.code === "materials_missing_hsn_sac")
      );
      assert.ok(
        health.issues.some((issue) => issue.code === "duplicate_active_material_codes")
      );
    }
  );
});

test("autoFillMissingMaterialHsnSac updates inferred missing HSN/SAC materials", async () => {
  const updatedPayloads = [];

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [
          {
            id: 20,
            materialName: "10mm Aggregate",
            materialCode: "AGG-10",
            hsnSacCode: "",
            category: "Aggregate",
            isActive: true,
          },
          {
            id: 21,
            materialName: "Unknown Item",
            materialCode: "UNK-01",
            hsnSacCode: "",
            category: "Misc",
            isActive: true,
          },
        ],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async ({ id, hsnSacCode }) => {
          updatedPayloads.push({ id, hsnSacCode });
          return { id, materialName: "10mm Aggregate", hsnSacCode, isActive: true };
        },
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ autoFillMissingMaterialHsnSac }) => {
      const result = await autoFillMissingMaterialHsnSac(44);
      assert.equal(result.candidateCount, 2);
      assert.equal(result.updatedCount, 1);
      assert.equal(result.skippedCount, 1);
      assert.equal(updatedPayloads[0].id, 20);
      assert.equal(updatedPayloads[0].hsnSacCode, "2517");
    }
  );
});

test("createMaterial rejects duplicate material codes within same company scope", async () => {
  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [
          {
            id: 10,
            materialName: "Existing Aggregate",
            materialCode: "AGG-40",
            category: "Aggregate",
            unit: "tons",
            gstRate: 5,
            isActive: true,
          },
        ],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ createMaterial }) => {
      await assert.rejects(
        createMaterial({
          materialName: "New Aggregate",
          materialCode: "agg-40",
          category: "Aggregate",
          unit: "tons",
          gstRate: "5",
          companyId: 44,
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          return true;
        }
      );
    }
  );
});

test("getMasterHealthCheck flags missing active shifts and invalid GST rates", async () => {
  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [{ id: 1, isActive: true }],
        findMaterials: async () => [
          {
            id: 99,
            materialName: "Bad GST Material",
            materialCode: "BAD-01",
            hsnSacCode: "2517",
            gstRate: 120,
            isActive: true,
          },
        ],
        findShifts: async () => [],
        findVehicleTypes: async () => [{ id: 3, isActive: true }],
        findConfigOptions: async () => [
          {
            id: 11,
            configType: "plant_type",
            optionLabel: "Crusher",
            optionValue: "Crusher",
            isActive: true,
          },
          {
            id: 12,
            configType: "power_source",
            optionLabel: "Diesel",
            optionValue: "diesel",
            isActive: true,
          },
        ],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
      },
    },
    async ({ getMasterHealthCheck }) => {
      const health = await getMasterHealthCheck(44);
      assert.equal(health.counts.materialsInvalidGstRate, 1);
      assert.ok(health.issues.some((issue) => issue.code === "invalid_material_gst_rate"));
      assert.ok(health.issues.some((issue) => issue.code === "no_active_shifts"));
    }
  );
});

test("toggleMaterial blocks deactivation when material is referenced", async () => {
  let statusUpdateCalled = false;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => {
          statusUpdateCalled = true;
          return null;
        },
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
        getMaterialUsageSummary: async () => ({
          totalReferences: 3,
          usage: [{ label: "dispatch reports", count: 3 }],
        }),
        getVehicleTypeUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getCrusherUnitUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getShiftUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
      },
    },
    async ({ toggleMaterial }) => {
      await assert.rejects(
        toggleMaterial({
          id: 91,
          isActive: false,
          companyId: 44,
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.match(error.message, /Cannot deactivate material/i);
          assert.equal(error.code, "MASTER_IN_USE");
          return true;
        }
      );
    }
  );

  assert.equal(statusUpdateCalled, false);
});

test("toggleVehicleType allows activation even when references exist", async () => {
  let updatePayload = null;

  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async (payload) => {
          updatePayload = payload;
          return { id: payload.id, isActive: payload.isActive };
        },
        getMaterialUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getVehicleTypeUsageSummary: async () => ({
          totalReferences: 5,
          usage: [{ label: "vehicles", count: 5 }],
        }),
        getCrusherUnitUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getShiftUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
      },
    },
    async ({ toggleVehicleType }) => {
      const result = await toggleVehicleType({
        id: 33,
        isActive: true,
        companyId: 44,
      });

      assert.equal(result.id, 33);
      assert.equal(result.isActive, true);
    }
  );

  assert.deepEqual(updatePayload, {
    id: 33,
    isActive: true,
    companyId: 44,
  });
});

test("toggleShift blocks deactivation when shift is referenced", async () => {
  await withMastersServiceMocks(
    {
      model: {
        findCrusherUnits: async () => [],
        findMaterials: async () => [],
        findShifts: async () => [],
        findVehicleTypes: async () => [],
        findConfigOptions: async () => [],
        insertConfigOption: async () => null,
        updateConfigOption: async () => null,
        setConfigOptionStatus: async () => null,
        insertCrusherUnit: async () => null,
        insertMaterial: async () => null,
        insertShift: async () => null,
        insertVehicleType: async () => null,
        updateCrusherUnit: async () => null,
        updateMaterial: async () => null,
        updateShift: async () => null,
        updateVehicleType: async () => null,
        setCrusherUnitStatus: async () => null,
        setMaterialStatus: async () => null,
        setMaterialHsnSacCode: async () => null,
        setShiftStatus: async () => null,
        setVehicleTypeStatus: async () => null,
        getMaterialUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getVehicleTypeUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getCrusherUnitUsageSummary: async () => ({ totalReferences: 0, usage: [] }),
        getShiftUsageSummary: async () => ({
          totalReferences: 2,
          usage: [{ label: "project daily reports", count: 2 }],
        }),
      },
    },
    async ({ toggleShift }) => {
      await assert.rejects(
        toggleShift({
          id: 17,
          isActive: false,
          companyId: 44,
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.match(error.message, /Cannot deactivate shift/i);
          return true;
        }
      );
    }
  );
});
