import { describe, expect, it } from "vitest";

import { HIDDEN_CELL, isHidden, plainCell } from "./cell.js";

describe("HIDDEN_CELL", () => {
  it("is frozen and hidden", () => {
    expect(HIDDEN_CELL.hidden).toBe(true);
    expect(HIDDEN_CELL.text).toBe("");
    expect(Object.isFrozen(HIDDEN_CELL)).toBe(true);
  });
});

describe("plainCell", () => {
  it("constructs a frozen, plain cell", () => {
    const c = plainCell("hi");
    expect(c).toEqual({ text: "hi" });
    expect(Object.isFrozen(c)).toBe(true);
  });
});

describe("isHidden", () => {
  it("returns true for HIDDEN_CELL", () => {
    expect(isHidden(HIDDEN_CELL)).toBe(true);
  });

  it("returns false for a visible cell", () => {
    expect(isHidden({ text: "x" })).toBe(false);
  });
});
