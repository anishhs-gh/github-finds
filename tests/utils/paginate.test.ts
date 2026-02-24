import { describe, it, expect } from "vitest";
import { DEFAULT_PER_PAGE } from "../../src/utils/paginate.js";

describe("DEFAULT_PER_PAGE", () => {
  it("is 30", () => {
    expect(DEFAULT_PER_PAGE).toBe(30);
  });
});
