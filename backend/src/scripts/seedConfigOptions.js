const { pool, withTransaction, closePool } = require("../config/db");
const { hasColumn, tableExists } = require("../utils/companyScope.util");
const {
  CONFIG_TYPES,
  OPTION_TYPE_LABELS,
  TYPE_METADATA,
  buildDetectedTypes,
  buildDuplicatePlan,
  buildInsertActions,
  buildComparableSet,
  getScopeKey,
  getScopeLabel,
  getStoredText,
  normalizeComparableText,
} = require("./lib/configOptionSeed");

const EXECUTE_FLAG = "--execute";

const getActiveCompanies = async (db = pool) => {
  if (!(await tableExists("companies", db))) {
    return [{ companyId: null, scopeLabel: "global" }];
  }

  const result = await db.query(
    `
    SELECT id AS "companyId"
    FROM companies
    WHERE is_active = TRUE
    ORDER BY id ASC
    `
  );

  if (!result.rows.length) {
    return [{ companyId: null, scopeLabel: "global" }];
  }

  return result.rows.map((row) => ({
    companyId:
      row.companyId !== null && row.companyId !== undefined
        ? Number(row.companyId)
        : null,
    scopeLabel: getScopeLabel(
      row.companyId !== null && row.companyId !== undefined
        ? Number(row.companyId)
        : null
    ),
  }));
};

const fetchConfigOptions = async (db = pool) => {
  const hasCompany = await hasColumn("master_config_options", "company_id", db);
  const result = await db.query(
    `
    SELECT
      id,
      ${hasCompany ? `company_id AS "companyId",` : `NULL::BIGINT AS "companyId",`}
      config_type AS "configType",
      option_label AS "optionLabel",
      option_value AS "optionValue",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM master_config_options
    ORDER BY
      ${hasCompany ? `company_id ASC NULLS FIRST,` : ""}
      config_type ASC,
      sort_order ASC,
      option_label ASC,
      id ASC
    `
  );

  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    companyId:
      row.companyId !== null && row.companyId !== undefined
        ? Number(row.companyId)
        : null,
    sortOrder: Number(row.sortOrder || 0),
    isActive: Boolean(row.isActive),
  }));
};

const fetchConfigTypesInCode = async () => CONFIG_TYPES;

const fetchExistingConfigTypes = async (rows) =>
  Array.from(new Set(rows.map((row) => String(row.configType || "").trim()).filter(Boolean))).sort();

const fetchReferenceCounts = async ({ existingRows, db = pool }) => {
  const rowById = new Map(existingRows.map((row) => [row.id, row]));
  const countsByRowId = new Map(existingRows.map((row) => [row.id, 0]));
  const breakdownByRowId = new Map(existingRows.map((row) => [row.id, []]));

  for (const type of CONFIG_TYPES) {
    const meta = TYPE_METADATA[type];
    if (!meta?.referenceTargets?.length) {
      continue;
    }

    const rowsOfType = existingRows.filter((row) => row.configType === type);
    if (!rowsOfType.length) {
      continue;
    }

    const scopeMap = new Map();
    rowsOfType.forEach((row) => {
      const scopeKey = getScopeKey(row.companyId);
      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, []);
      }
      scopeMap.get(scopeKey).push(row);
    });

    for (const target of meta.referenceTargets) {
      if (!(await tableExists(target.tableName, db))) {
        continue;
      }

      if (!(await hasColumn(target.tableName, target.columnName, db))) {
        continue;
      }

      const targetHasCompany = await hasColumn(target.tableName, "company_id", db);

      for (const [scopeKey, scopedRows] of scopeMap.entries()) {
        const companyId =
          scopeKey === "global" ? null : Number(scopeKey.replace("company:", ""));
        const params = [];
        let companyClause = "";

        if (targetHasCompany && companyId !== null) {
          params.push(companyId);
          companyClause = `AND company_id = $${params.length}`;
        } else if (targetHasCompany && companyId === null) {
          companyClause = `AND company_id IS NULL`;
        }

        const result = await db.query(
          `
          SELECT
            LOWER(BTRIM(${target.columnName})) AS "normalizedText",
            COUNT(*)::int AS "count"
          FROM ${target.tableName}
          WHERE COALESCE(BTRIM(${target.columnName}), '') <> ''
          ${companyClause}
          GROUP BY LOWER(BTRIM(${target.columnName}))
          `,
          params
        );

        const countsByText = new Map(
          result.rows.map((row) => [String(row.normalizedText || ""), Number(row.count || 0)])
        );

        scopedRows.forEach((row) => {
          const seenTexts = new Set();
          [row.optionLabel, row.optionValue, getStoredText(type, row)].forEach((value) => {
            buildComparableSet(value).forEach((item) => {
              if (seenTexts.has(item)) {
                return;
              }
              seenTexts.add(item);
              const count = Number(countsByText.get(item) || 0);
              if (count <= 0) {
                return;
              }

              countsByRowId.set(row.id, Number(countsByRowId.get(row.id) || 0) + count);
              breakdownByRowId.get(row.id).push({
                tableName: target.tableName,
                columnName: target.columnName,
                companyId,
                matchText: item,
                count,
                canonicalStoredText: null,
              });
            });
          });
        });
      }
    }
  }

  return {
    countsByRowId,
    breakdownByRowId,
    rowById,
  };
};

const attachCanonicalTextsToCleanup = ({ cleanupActions, rowById }) =>
  cleanupActions.map((action) => {
    if (action.action !== "merge_references_and_delete") {
      return action;
    }

    const row = rowById.get(action.id);
    const canonicalRow = rowById.get(action.canonicalId);
    if (!row || !canonicalRow) {
      return action;
    }

    const type = action.configType;
    const canonicalStoredText = getStoredText(type, canonicalRow);
    const matchTexts = new Set();
    [row.optionLabel, row.optionValue, getStoredText(type, row)].forEach((value) => {
      buildComparableSet(value).forEach((item) => matchTexts.add(item));
    });

    return {
      ...action,
      canonicalStoredText,
      referenceUpdates: (action.referenceUpdates || []).map((entry) => ({
        ...entry,
        canonicalStoredText,
        matchTexts: Array.from(matchTexts),
      })),
    };
  });

const buildPlan = async (db = pool) => {
  const [scopes, existingRows, codeTypes] = await Promise.all([
    getActiveCompanies(db),
    fetchConfigOptions(db),
    fetchConfigTypesInCode(),
  ]);
  const existingTypes = await fetchExistingConfigTypes(existingRows);
  const { countsByRowId, breakdownByRowId, rowById } = await fetchReferenceCounts({
    existingRows,
    db,
  });
  const { actions: insertActions, skipped } = buildInsertActions({
    existingRows,
    scopes,
  });
  const duplicatePlan = buildDuplicatePlan({
    existingRows,
    referenceCountsByRowId: countsByRowId,
    referenceBreakdownByRowId: breakdownByRowId,
  });

  return {
    detectedTypes: buildDetectedTypes({
      codeTypes,
      existingTypes,
    }),
    existingTypes,
    scopes,
    existingRows,
    insertActions,
    skippedDuplicates: skipped,
    duplicateGroups: duplicatePlan.duplicateGroups,
    cleanupActions: attachCanonicalTextsToCleanup({
      cleanupActions: duplicatePlan.cleanupActions,
      rowById,
    }),
    assumptions: [
      "Config options are seeded per active company because master_config_options is company-scoped in this schema.",
      "Global config-option rows are not used by the current masters service when company-scoped rows exist.",
      "description and is_system_default are not persisted because master_config_options does not support those columns in the current schema.",
      "material_hsn_rule rows persist keyword pattern in option_label and HSN/SAC code in option_value; GST rate and priority are reported in dry-run metadata only.",
      "procurement_item_category is limited to categories compatible with current purchase-line CHECK constraints.",
      "Duplicate cleanup updates exact text references only when a safe canonical replacement string is available.",
    ],
  };
};

const insertConfigOption = async (client, action) => {
  await client.query(
    `
    INSERT INTO master_config_options (
      config_type,
      option_label,
      option_value,
      sort_order,
      is_active,
      company_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      action.configType,
      action.optionLabel,
      action.optionValue || action.optionLabel,
      Number(action.sortOrder || 0),
      true,
      action.companyId,
    ]
  );
};

const applyReferenceUpdates = async (client, action) => {
  for (const update of action.referenceUpdates || []) {
    const targetTableHasCompany = await hasColumn(update.tableName, "company_id", client);
    const params = [action.canonicalStoredText];
    const conditions = [];

    const matchTexts = update.matchTexts || [];
    const textConditions = matchTexts.map((text) => {
      params.push(text);
      return `LOWER(BTRIM(${update.columnName})) = $${params.length}`;
    });

    if (textConditions.length) {
      conditions.push(`(${textConditions.join(" OR ")})`);
    }

    if (targetTableHasCompany && update.companyId !== null) {
      params.push(update.companyId);
      conditions.push(`company_id = $${params.length}`);
    } else if (targetTableHasCompany && update.companyId === null) {
      conditions.push(`company_id IS NULL`);
    }

    if (!conditions.length) {
      continue;
    }

    await client.query(
      `
      UPDATE ${update.tableName}
      SET ${update.columnName} = $1
      WHERE ${conditions.join(" AND ")}
      `,
      params
    );
  }
};

const applyCleanupAction = async (client, action) => {
  if (action.action === "merge_references_and_delete") {
    await applyReferenceUpdates(client, action);
    await client.query(`DELETE FROM master_config_options WHERE id = $1`, [action.id]);
    return;
  }

  if (action.action === "delete") {
    await client.query(`DELETE FROM master_config_options WHERE id = $1`, [action.id]);
    return;
  }

  if (action.action === "deactivate") {
    await client.query(
      `
      UPDATE master_config_options
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [action.id]
    );
  }
};

const summarizePlan = (plan) => ({
  detectedTypes: plan.detectedTypes.map((configType) => ({
    configType,
    label: OPTION_TYPE_LABELS[configType] || configType,
  })),
  insertActions: plan.insertActions,
  skippedDuplicates: plan.skippedDuplicates,
  duplicateGroups: plan.duplicateGroups,
  cleanupActions: plan.cleanupActions,
  assumptions: plan.assumptions,
});

const run = async () => {
  const execute = process.argv.includes(EXECUTE_FLAG);
  const plan = await buildPlan(pool);

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          success: true,
          mode: "dry-run",
          command: "npm run seed:config-options",
          executeCommand: "npm run seed:config-options -- --execute",
          ...summarizePlan(plan),
        },
        null,
        2
      )
    );
    return;
  }

  await withTransaction(async (client) => {
    for (const action of plan.insertActions) {
      await insertConfigOption(client, action);
    }

    for (const action of plan.cleanupActions) {
      await applyCleanupAction(client, action);
    }
  });

  const finalPlan = await buildPlan(pool);

  console.log(
    JSON.stringify(
      {
        success: true,
        mode: "execute",
        insertedCount: plan.insertActions.length,
        cleanupCount: plan.cleanupActions.length,
        remainingInsertActions: finalPlan.insertActions.length,
        ...summarizePlan(finalPlan),
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          success: false,
          message: error?.message || String(error),
          code: error?.code || null,
          stack: error?.stack || null,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
