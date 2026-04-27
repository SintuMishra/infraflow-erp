const cacheStore = new Map();

export async function getCachedResource(key, ttlMs, loader) {
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
}

export function invalidateCachedResource(key) {
  cacheStore.delete(key);
}

export function invalidateCachedResourceByPrefix(prefix) {
  const normalizedPrefix = String(prefix || "");
  for (const key of cacheStore.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      cacheStore.delete(key);
    }
  }
}
