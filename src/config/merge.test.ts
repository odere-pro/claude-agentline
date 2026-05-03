import { describe, it, expect } from "vitest";
import { deepMerge, mergeAll } from "./merge.js";

describe("deepMerge", () => {
  it("returns base when override is undefined", () => {
    expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("merges nested objects key-wise", () => {
    const base = { global: { padding: 1, separator: "|" }, theme: null };
    const ov = { global: { padding: 2 } };
    expect(deepMerge(base, ov)).toEqual({ global: { padding: 2, separator: "|" }, theme: null });
  });

  it("replaces arrays wholesale", () => {
    const base = { lines: [{ widgets: [{ type: "model" }] }] };
    const ov = { lines: [{ widgets: [{ type: "clock" }, { type: "git-branch" }] }] };
    expect(deepMerge(base, ov)).toEqual(ov);
  });

  it("treats null as a real overriding value", () => {
    expect(deepMerge({ theme: "nord" }, { theme: null })).toEqual({ theme: null });
  });

  it("ignores undefined keys in override", () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it("mergeAll applies layers left to right", () => {
    const merged = mergeAll(
      { a: 1, b: 2, c: 3 },
      { b: 20 },
      { c: 30 },
      { a: 100 },
    );
    expect(merged).toEqual({ a: 100, b: 20, c: 30 });
  });

  it("does not mutate Object.prototype via __proto__ key", () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":"yes"}}');
    deepMerge({}, malicious);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops constructor and prototype keys during merge", () => {
    const malicious = JSON.parse('{"constructor":{"prototype":{"polluted":"yes"}},"prototype":{"polluted":"yes"}}');
    const out = deepMerge<Record<string, unknown>>({}, malicious);
    expect(out.constructor).toBe(Object);
    expect(out.prototype).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops __proto__ even when nested deep in override", () => {
    const malicious = JSON.parse('{"global":{"__proto__":{"polluted":"yes"}}}');
    deepMerge({ global: { padding: 1 } }, malicious);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
