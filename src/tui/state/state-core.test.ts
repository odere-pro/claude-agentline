import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_OPTION_KEYS,
  MAX_LINES,
  clamp,
  isPickerMode,
  padToMaxLines,
  replaceAt,
  replaceLine,
} from "./state-core.js";

describe("clamp", () => {
  it("returns the value unchanged when within [low, high]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("returns low when value < low", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it("returns high when value > high", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("returns low when high < low (defensive)", () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
  it("handles equal bounds", () => {
    expect(clamp(5, 7, 7)).toBe(7);
  });
});

describe("padToMaxLines", () => {
  it("returns MAX_LINES entries when given fewer", () => {
    expect(padToMaxLines([]).length).toBe(MAX_LINES);
  });
  it("truncates lines exceeding MAX_LINES", () => {
    const many = Array.from({ length: MAX_LINES + 5 }, () => ({ widgets: [] }));
    expect(padToMaxLines(many).length).toBe(MAX_LINES);
  });
  it("clones widget arrays so the input is not aliased", () => {
    const original = [{ widgets: [{ type: "x" }] }];
    const padded = padToMaxLines(original);
    expect(padded[0]?.widgets).not.toBe(original[0]?.widgets);
    expect(padded[0]?.widgets[0]).toEqual({ type: "x" });
  });
  it("fills missing rows with an empty-widgets shape", () => {
    const padded = padToMaxLines([]);
    for (const row of padded) expect(row.widgets).toEqual([]);
  });
});

describe("replaceLine", () => {
  it("returns a new array with the indexed line replaced", () => {
    const lines = [{ widgets: [] }, { widgets: [{ type: "a" }] }, { widgets: [] }];
    const next = replaceLine(lines, 1, { widgets: [{ type: "b" }] });
    expect(next).not.toBe(lines);
    expect(next[1]).toEqual({ widgets: [{ type: "b" }] });
    expect(next[0]).toBe(lines[0]);
    expect(next[2]).toBe(lines[2]);
  });
});

describe("replaceAt", () => {
  it("returns a new array with the indexed element replaced", () => {
    const items = ["a", "b", "c"];
    const next = replaceAt(items, 1, "x");
    expect(next).toEqual(["a", "x", "c"]);
    expect(next).not.toBe(items);
  });
  it("appends safely when the index is at the end", () => {
    expect(replaceAt(["a", "b"], 2, "c")).toEqual(["a", "b", "c"]);
  });
});

describe("isPickerMode", () => {
  it("returns true for every picker mode", () => {
    expect(isPickerMode("picker-group")).toBe(true);
    expect(isPickerMode("picker-widget")).toBe(true);
    expect(isPickerMode("picker-search")).toBe(true);
    expect(isPickerMode("picker-variant")).toBe(true);
  });
  it("returns false for edit mode", () => {
    expect(isPickerMode("edit")).toBe(false);
  });
});

describe("FORBIDDEN_OPTION_KEYS", () => {
  it("forbids the three reserved property keys", () => {
    expect(FORBIDDEN_OPTION_KEYS.has("__proto__")).toBe(true);
    expect(FORBIDDEN_OPTION_KEYS.has("constructor")).toBe(true);
    expect(FORBIDDEN_OPTION_KEYS.has("prototype")).toBe(true);
  });
  it("allows ordinary option keys", () => {
    expect(FORBIDDEN_OPTION_KEYS.has("threshold")).toBe(false);
    expect(FORBIDDEN_OPTION_KEYS.has("colour")).toBe(false);
  });
});
