const { pool } = require("../config/db");

const defaultSchemaCache = {
  columns: new Map(),
  tables: new Map(),
};
const schemaCacheByDb = new WeakMap();
const requiredScopedTables = [
  "company_profile",
  "employees",
  "users",
  "plant_master",
  "vendor_master",
  "party_master",
  "master_config_options",
  "crusher_units",
  "material_master",
  "shift_master",
  "vehicle_type_master",
  "crusher_daily_reports",
  "project_daily_reports",
  "vehicles",
  "equipment_logs",
  "transport_rates",
  "party_material_rates",
  "party_orders",
  "dispatch_reports",
  "account_groups",
  "chart_of_accounts",
  "ledgers",
  "financial_years",
  "accounting_periods",
  "vouchers",
  "voucher_lines",
  "receivables",
  "payables",
  "settlements",
  "bank_accounts",
  "finance_posting_rules",
  "finance_source_links",
];

const getSchemaCache = (db = pool) => {
  if (db === pool) {
    return defaultSchemaCache;
  }

  const existing = schemaCacheByDb.get(db);
  if (existing) {
    return existing;
  }

  const cache = {
    columns: new Map(),
    tables: new Map(),
  };
  schemaCacheByDb.set(db, cache);
  return cache;
};

const hasColumn = async (tableName, columnName, db = pool) => {
  const cache = getSchemaCache(db);
  const cacheKey = `${tableName}:${columnName}`;

  if (cache.columns.has(cacheKey)) {
    return cache.columns.get(cacheKey);
  }

  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS "exists"
    `,
    [tableName, columnName]
  );

  const exists = Boolean(result.rows[0]?.exists);
  cache.columns.set(cacheKey, exists);
  return exists;
};

const tableExists = async (tableName, db = pool) => {
  const cache = getSchemaCache(db);

  if (cache.tables.has(tableName)) {
    return cache.tables.get(tableName);
  }

  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS "exists"
    `,
    [tableName]
  );

  const exists = Boolean(result.rows[0]?.exists);
  cache.tables.set(tableName, exists);
  return exists;
};

const verifyCompanyScopeFoundation = async (db = pool) => {
  const companyTableExists = await tableExists("companies", db);

  if (!companyTableExists) {
    return;
  }

  const missingScopedTables = [];

  for (const tableName of requiredScopedTables) {
    if (!(await tableExists(tableName, db))) {
      continue;
    }

    if (!(await hasColumn(tableName, "company_id", db))) {
      missingScopedTables.push(tableName);
    }
  }

  if (missingScopedTables.length > 0) {
    throw new Error(
      `Company scope migration is incomplete. Missing company_id column on: ${missingScopedTables.join(
        ", "
      )}`
    );
  }
};

const resetCompanyScopeCache = () => {
  defaultSchemaCache.columns.clear();
  defaultSchemaCache.tables.clear();
};

const normalizeCompanyId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

module.exports = {
  hasColumn,
  resetCompanyScopeCache,
  tableExists,
  verifyCompanyScopeFoundation,
  normalizeCompanyId,
};
