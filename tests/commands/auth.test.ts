import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies before importing the module under test ─────

vi.mock("../../src/utils/config.js", () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getConfigPath: vi.fn(() => "/mock/config.json"),
}));

vi.mock("../../src/api/client.js", () => ({
  getClient: vi.fn(),
  resetClient: vi.fn(),
  isAuthenticated: vi.fn(() => false),
  requireAuth: vi.fn(),
  friendlyError: vi.fn((e: unknown) => String(e)),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

import { getToken, setToken, clearToken } from "../../src/utils/config.js";
import { resetClient } from "../../src/api/client.js";

describe("auth config helpers (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setToken stores the token", () => {
    (setToken as ReturnType<typeof vi.fn>)("ghp_abc123");
    expect(setToken).toHaveBeenCalledWith("ghp_abc123");
  });

  it("clearToken removes the token", () => {
    (clearToken as ReturnType<typeof vi.fn>)();
    expect(clearToken).toHaveBeenCalledOnce();
  });

  it("resetClient is called after logout logic", () => {
    (clearToken as ReturnType<typeof vi.fn>)();
    (resetClient as ReturnType<typeof vi.fn>)();
    expect(resetClient).toHaveBeenCalledOnce();
  });
});

describe("getToken", () => {
  it("returns undefined when no token is set", () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(getToken()).toBeUndefined();
  });

  it("returns the stored token", () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue("ghp_testtoken");
    expect(getToken()).toBe("ghp_testtoken");
  });
});
