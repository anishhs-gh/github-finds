import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Conf before importing cache so the module uses the mock
vi.mock("conf", () => {
  const store = new Map<string, unknown>();
  return {
    default: class MockConf {
      get(key: string) { return store.get(key); }
      set(key: string, value: unknown) { store.set(key, value); }
      delete(key: string) { store.delete(key); }
      clear() { store.clear(); }
    },
  };
});

// Import after mock is set up
const { cacheGet, cacheSet, cacheClear, cacheKey, isCached } = await import("../../src/utils/cache.js");

describe("cacheKey", () => {
  it("joins parts with ::", () => {
    expect(cacheKey("a", "b", "c")).toBe("a::b::c");
  });

  it("filters out undefined and null", () => {
    expect(cacheKey("a", undefined, null, "b")).toBe("a::b");
  });

  it("converts numbers to strings", () => {
    expect(cacheKey("page", 2)).toBe("page::2");
  });
});

describe("cacheGet / cacheSet", () => {
  beforeEach(() => cacheClear());

  it("returns null for a missing key", () => {
    expect(cacheGet("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    cacheSet("key1", { hello: "world" });
    expect(cacheGet("key1")).toEqual({ hello: "world" });
  });

  it("returns null for an expired entry", () => {
    // Set an entry with an artificially old timestamp
    // We need to bypass cacheSet's auto-timestamp, so we call cacheSet
    // then manipulate time via vi.useFakeTimers
    vi.useFakeTimers();
    cacheSet("expiring", [1, 2, 3]);

    // Advance time beyond 5-minute TTL
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Because conf is mocked, we need to manually insert an expired entry
    // Reset and insert directly via cacheSet with time already moved
    cacheClear();
    // cacheSet writes Date.now() which is now 6 mins ahead — then we go 6 more
    cacheSet("expiring", [1, 2, 3]);
    vi.advanceTimersByTime(6 * 60 * 1000);

    expect(cacheGet("expiring")).toBeNull();
    vi.useRealTimers();
  });

  it("stores and retrieves different types", () => {
    cacheSet("str", "hello");
    cacheSet("num", 42);
    cacheSet("arr", [1, 2, 3]);
    expect(cacheGet("str")).toBe("hello");
    expect(cacheGet("num")).toBe(42);
    expect(cacheGet<number[]>("arr")).toEqual([1, 2, 3]);
  });
});

describe("isCached", () => {
  beforeEach(() => cacheClear());

  it("returns false for missing key", () => {
    expect(isCached("missing")).toBe(false);
  });

  it("returns true for a fresh cached key", () => {
    cacheSet("fresh", "data");
    expect(isCached("fresh")).toBe(true);
  });
});

describe("cacheClear", () => {
  it("removes all entries", () => {
    cacheSet("a", 1);
    cacheSet("b", 2);
    cacheClear();
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBeNull();
  });
});
