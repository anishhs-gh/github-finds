import Conf from "conf";

interface CacheEntry {
  data: unknown;
  ts: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Separate conf store for cache so it never mixes with auth config
const store = new Conf<Record<string, CacheEntry>>({
  projectName: "ghf-cache",
  clearInvalidConfig: true,
});

export function cacheGet<T>(key: string): T | null {
  try {
    const entry = store.get(key) as CacheEntry | undefined;
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, data: unknown): void {
  try {
    store.set(key, { data, ts: Date.now() });
  } catch {
    // Non-fatal — cache write failures should never break the CLI
  }
}

export function cacheClear(): void {
  store.clear();
}

/** Build a consistent cache key from URL segments and params */
export function cacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  return parts
    .filter((p) => p !== undefined && p !== null)
    .map(String)
    .join("::");
}

/** Returns true if a cache entry exists and is still fresh */
export function isCached(key: string): boolean {
  return cacheGet(key) !== null;
}
