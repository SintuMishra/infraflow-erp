const COMPANY_MODULE_KEYS = Object.freeze([
  "operations",
  "commercial",
  "procurement",
  "accounts",
]);

const DEFAULT_COMPANY_MODULES = Object.freeze([...COMPANY_MODULE_KEYS]);

const COMPANY_MODULE_PRESETS = Object.freeze({
  full_erp: DEFAULT_COMPANY_MODULES,
  procurement_accounts: ["procurement", "accounts"],
  procurement_only: ["procurement"],
  accounts_only: ["accounts"],
});

const normalizeCompanyModuleKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeCompanyModules = (
  value,
  fallback = DEFAULT_COMPANY_MODULES
) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
    ? value.split(",")
    : [];

  const seen = new Set();
  const normalized = [];

  for (const entry of source) {
    const moduleKey = normalizeCompanyModuleKey(entry);

    if (!COMPANY_MODULE_KEYS.includes(moduleKey) || seen.has(moduleKey)) {
      continue;
    }

    seen.add(moduleKey);
    normalized.push(moduleKey);
  }

  if (normalized.length === 0) {
    return [...fallback];
  }

  return normalized;
};

const buildCompanyModuleFlags = (enabledModules) => {
  const normalizedModules = normalizeCompanyModules(enabledModules);

  return COMPANY_MODULE_KEYS.reduce((flags, moduleKey) => {
    flags[moduleKey] = normalizedModules.includes(moduleKey);
    return flags;
  }, {});
};

const hasCompanyModule = (enabledModules, moduleKey) => {
  return normalizeCompanyModules(enabledModules).includes(
    normalizeCompanyModuleKey(moduleKey)
  );
};

module.exports = {
  COMPANY_MODULE_KEYS,
  COMPANY_MODULE_PRESETS,
  DEFAULT_COMPANY_MODULES,
  buildCompanyModuleFlags,
  hasCompanyModule,
  normalizeCompanyModuleKey,
  normalizeCompanyModules,
};
