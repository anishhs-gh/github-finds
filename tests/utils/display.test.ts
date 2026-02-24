import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  truncate,
  pluralize,
  formatDate,
  formatDateTime,
  stateBadge,
} from "../../src/utils/display.js";

describe("truncate", () => {
  it("returns the string unchanged when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis when over limit", () => {
    const result = truncate("hello world", 8);
    expect(result).toHaveLength(8);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns empty string for empty input", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("handles string exactly at limit without truncating", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });
});

describe("pluralize", () => {
  it("uses singular form for n=1", () => {
    expect(pluralize(1, "repo")).toBe("1 repo");
  });

  it("uses plural form for n=0", () => {
    expect(pluralize(0, "repo")).toBe("0 repos");
  });

  it("uses plural form for n>1", () => {
    expect(pluralize(42, "commit")).toBe("42 commits");
  });
});

describe("formatDate", () => {
  it("returns — for null input", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns — for undefined input", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/15/);
  });
});

describe("formatDateTime", () => {
  it("returns — for null input", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("includes time component for valid input", () => {
    const result = formatDateTime("2024-06-20T14:30:00Z");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jun/);
  });
});

describe("stateBadge", () => {
  it("renders OPEN in green", () => {
    const badge = stateBadge("open");
    expect(badge).toContain("OPEN");
  });

  it("renders CLOSED in red", () => {
    const badge = stateBadge("closed");
    expect(badge).toContain("CLOSED");
  });

  it("renders MERGED in magenta", () => {
    const badge = stateBadge("merged");
    expect(badge).toContain("MERGED");
  });

  it("renders SUCCESS in green", () => {
    const badge = stateBadge("success");
    expect(badge).toContain("SUCCESS");
  });

  it("renders FAILURE in red", () => {
    const badge = stateBadge("failure");
    expect(badge).toContain("FAILURE");
  });

  it("uppercases unknown states", () => {
    const badge = stateBadge("queued");
    expect(badge).toContain("QUEUED");
  });
});
