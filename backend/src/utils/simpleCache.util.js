const cacheStore = new Map();

const getCached = async (key, ttlMs, loader) => {
  const now = Date.now();
  const hit = cacheStore.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  cacheStore.set(key, {
    value,
    expiresAt: now + Math.max(Number(ttlMs) || 0, 0),
  });

  return value;
};

const deleteCached = (key) => {
  cacheStore.delete(key);
};

const invalidateCacheByPrefix = (prefix) => {
  const normalizedPrefix = String(prefix || "");

  for (const key of cacheStore.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      cacheStore.delete(key);
    }
  }
};

const buildCompanyScopedCachePrefix = (scope, companyId = null) =>
  `${String(scope || "global")}:${companyId === null || companyId === undefined ? "all" : companyId}:`;

module.exports = {
  getCached,
  deleteCached,
  invalidateCacheByPrefix,
  buildCompanyScopedCachePrefix,
};
