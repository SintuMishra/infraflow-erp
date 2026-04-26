const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDetectedTypes,
  buildDuplicatePlan,
  buildInsertActions,
  buildOptionKey,
  getStoredText,
  normalizeComparableText,
} = require("../src/scripts/lib/configOptionSeed");

test("normalizeComparableText folds case, punctuation, and plurals", () => {
  assert.equal(normalizeComparableText(" Trucks "), "truck");
  assert.equal(normalizeComparableText("Metric Tons"), "metric ton");
  assert.equal(normalizeComparableText("Ready-Mix Concrete (RMC)"), "ready mix concrete rmc");
});

test("buildInsertActions skips similar existing options and inserts only missing ones", () => {
  const result = buildInsertActions({
    scopes: [{ companyId: 2 }],
    existingRows: [
      {
        id: 1,
        companyId: 2,
        configType: "plant_type",
        optionLabel: "Crushing Plant",
        optionValue: "CP",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 2,
        companyId: 2,
        configType: "power_source",
        optionLabel: "electricity",
        optionValue: "electricity",
        sortOrder: 1,
        isActive: true,
      },
    ],
  });

  const plantInsert = result.actions.find(
    (item) =>
      item.companyId === 2 &&
      item.configType === "plant_type" &&
      item.optionLabel === "Screening Plant"
  );
  const crusherInsert = result.actions.find(
    (item) =>
      item.companyId === 2 &&
      item.configType === "plant_type" &&
      item.optionLabel === "Crusher Plant"
  );
  const powerSkip = result.skipped.find(
    (item) =>
      item.companyId === 2 &&
      item.configType === "power_source" &&
      item.optionLabel === "Grid Electricity"
  );

  assert.ok(plantInsert);
  assert.equal(crusherInsert, undefined);
  assert.ok(powerSkip);
});

test("buildOptionKey maps similar values to the same canonical seed key", () => {
  const left = buildOptionKey("power_source", {
    id: 1,
    optionLabel: "Electricity (Grid)",
    optionValue: "EGRID",
  });
  const right = buildOptionKey("power_source", {
    id: 2,
    optionLabel: "electricity",
    optionValue: "electricity",
  });

  assert.equal(left, right);
});

test("buildDuplicatePlan prefers exact seeded canonical option over legacy duplicate", () => {
  const existingRows = [
    {
      id: 10,
      companyId: 2,
      configType: "power_source",
      optionLabel: "Electricity (Grid)",
      optionValue: "EGRID",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 11,
      companyId: 2,
      configType: "power_source",
      optionLabel: "electricity",
      optionValue: "electricity",
      sortOrder: 5,
      isActive: true,
    },
  ];

  const countsByRowId = new Map([
    [10, 0],
    [11, 4],
  ]);
  const breakdownByRowId = new Map([
    [10, []],
    [
      11,
      [
        {
          tableName: "plant_master",
          columnName: "power_source_type",
          companyId: 2,
          matchText: "electricity",
          count: 4,
        },
      ],
    ],
  ]);

  const plan = buildDuplicatePlan({
    existingRows,
    referenceCountsByRowId: countsByRowId,
    referenceBreakdownByRowId: breakdownByRowId,
  });

  assert.equal(plan.duplicateGroups.length, 1);
  assert.equal(plan.duplicateGroups[0].canonicalId, 11);
  assert.deepEqual(plan.cleanupActions, [
    {
      action: "delete",
      companyId: 2,
      configType: "power_source",
      id: 10,
      canonicalId: 11,
      optionLabel: "Electricity (Grid)",
      optionValue: "EGRID",
      reason: "unused_duplicate",
    },
  ]);
});

test("buildDuplicatePlan can migrate references from legacy unit code to seeded canonical unit", () => {
  const existingRows = [
    {
      id: 19,
      companyId: 2,
      configType: "material_unit",
      optionLabel: "Bags (Legacy BGS)",
      optionValue: "BGS",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 69,
      companyId: 2,
      configType: "material_unit",
      optionLabel: "Bag",
      optionValue: "BAG",
      sortOrder: 2,
      isActive: true,
    },
  ];

  const countsByRowId = new Map([
    [19, 2],
    [69, 0],
  ]);
  const breakdownByRowId = new Map([
    [
      19,
      [
        {
          tableName: "material_master",
          columnName: "unit",
          companyId: 2,
          matchText: "bgs",
          count: 2,
        },
      ],
    ],
    [69, []],
  ]);

  const plan = buildDuplicatePlan({
    existingRows,
    referenceCountsByRowId: countsByRowId,
    referenceBreakdownByRowId: breakdownByRowId,
  });

  assert.equal(plan.duplicateGroups.length, 1);
  assert.equal(plan.duplicateGroups[0].canonicalId, 69);
  assert.deepEqual(plan.cleanupActions, [
    {
      action: "merge_references_and_delete",
      companyId: 2,
      configType: "material_unit",
      id: 19,
      canonicalId: 69,
      optionLabel: "Bags (Legacy BGS)",
      optionValue: "BGS",
      canonicalStoredText: "BAG",
      referenceUpdates: [
        {
          tableName: "material_master",
          columnName: "unit",
          companyId: 2,
          matchText: "bgs",
          count: 2,
        },
      ],
      reason: "duplicate_with_safe_text_reference_updates",
    },
  ]);
});

test("buildDetectedTypes includes extra option types found in code or data", () => {
  const detected = buildDetectedTypes({
    codeTypes: ["procurement_item_category"],
    existingTypes: ["custom_type", "power_source"],
  });

  assert.ok(detected.includes("procurement_item_category"));
  assert.ok(detected.includes("custom_type"));
  assert.ok(detected.includes("power_source"));
});

test("getStoredText follows type-specific persistence rules", () => {
  assert.equal(
    getStoredText("power_source", {
      optionLabel: "Grid Electricity",
      optionValue: "electricity",
    }),
    "electricity"
  );

  assert.equal(
    getStoredText("material_category", {
      optionLabel: "Aggregate",
      optionValue: "AGG",
    }),
    "Aggregate"
  );
});
