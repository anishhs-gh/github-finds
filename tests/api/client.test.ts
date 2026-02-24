import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/config.js", () => ({
  getToken: vi.fn(),
}));

// We need to re-import client fresh for each test since it caches the instance
import { getToken } from "../../src/utils/config.js";

describe("isAuthenticated", () => {
  beforeEach(() => vi.resetModules());

  it("returns false when no token is stored", async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const { isAuthenticated } = await import("../../src/api/client.js");
    expect(isAuthenticated()).toBe(false);
  });

  it("returns true when a token is stored", async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue("ghp_token123");
    const { isAuthenticated } = await import("../../src/api/client.js");
    expect(isAuthenticated()).toBe(true);
  });
});

describe("friendlyError", () => {
  beforeEach(() => vi.resetModules());

  it("handles 401 errors", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    const err = Object.assign(new Error("Bad credentials"), { status: 401 });
    expect(friendlyError(err)).toContain("ghf auth login");
  });

  it("handles 404 errors", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    const err = Object.assign(new Error("Not Found"), { status: 404 });
    expect(friendlyError(err)).toContain("404");
    expect(friendlyError(err)).toContain("owner/repo");
  });

  it("handles 403 rate limit errors", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    const err = Object.assign(new Error("rate limit exceeded"), { status: 403, response: { data: { message: "API rate limit exceeded" } } });
    expect(friendlyError(err)).toContain("rate limit");
  });

  it("handles 422 validation errors", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    const err = Object.assign(new Error("Validation Failed"), { status: 422, response: { data: { message: "Validation Failed" } } });
    const result = friendlyError(err);
    expect(result).toContain("422");
  });

  it("returns message for plain errors", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    const err = new Error("network timeout");
    expect(friendlyError(err)).toBe("network timeout");
  });

  it("handles non-Error values", async () => {
    const { friendlyError } = await import("../../src/api/client.js");
    expect(friendlyError("something went wrong")).toBe("something went wrong");
  });
});
