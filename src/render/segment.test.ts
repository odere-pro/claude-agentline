import { describe, expect, it } from "vitest";

import { plainSegment } from "./segment.js";

describe("plainSegment", () => {
  it("returns the exact text supplied", () => {
    expect(plainSegment("hello").text).toBe("hello");
    expect(plainSegment("").text).toBe("");
  });

  it("leaves style fields undefined", () => {
    const s = plainSegment("x");
    expect(s.fg).toBeUndefined();
    expect(s.bg).toBeUndefined();
    expect(s.bold).toBeUndefined();
    expect(s.italic).toBeUndefined();
  });
});
