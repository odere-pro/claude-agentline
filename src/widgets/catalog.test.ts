import { describe, expect, it } from "vitest";

import { WIDGET_CATALOG, WIDGET_CATEGORIES, widgetMeta } from "./catalog.js";
import { registerAllBuiltins } from "./index.js";
import { WidgetRegistry } from "./registry.js";

function builtinRegistry(): WidgetRegistry {
  const r = new WidgetRegistry();
  registerAllBuiltins(r);
  return r;
}

const CATEGORY_SET = new Set<string>(WIDGET_CATEGORIES);
const DESCRIPTION_MAX = 80;

describe("WIDGET_CATALOG", () => {
  it("has exactly one entry per built-in widget type", () => {
    const registered = new Set(builtinRegistry().list());
    const catalogued = new Set(Object.keys(WIDGET_CATALOG));
    const missing = [...registered].filter((t) => !catalogued.has(t)).sort();
    const extra = [...catalogued].filter((t) => !registered.has(t)).sort();
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("covers all 53 shipped widgets", () => {
    expect(Object.keys(WIDGET_CATALOG)).toHaveLength(53);
    expect(builtinRegistry().size()).toBe(53);
  });

  it("every entry has a non-empty description of at most 80 chars", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      expect(meta.name.trim(), `${type}: name`).not.toBe("");
      expect(meta.description.trim(), `${type}: description`).not.toBe("");
      expect(meta.description.length, `${type}: description length`).toBeLessThanOrEqual(
        DESCRIPTION_MAX,
      );
    }
  });

  it("every entry has a known category", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      expect(CATEGORY_SET.has(meta.category), `${type}: category ${meta.category}`).toBe(true);
    }
  });

  it("entries are frozen", () => {
    expect(Object.isFrozen(WIDGET_CATALOG)).toBe(true);
    for (const meta of Object.values(WIDGET_CATALOG)) {
      expect(Object.isFrozen(meta)).toBe(true);
    }
  });
});

describe("widgetMeta", () => {
  it("returns the entry for a known type", () => {
    expect(widgetMeta("git-branch")).toEqual({
      name: "Git branch",
      description: "Current branch, or short SHA when detached",
      category: "git",
    });
  });

  it("returns undefined for an unknown type", () => {
    expect(widgetMeta("does-not-exist")).toBeUndefined();
  });
});

describe("WidgetRegistry.listMeta", () => {
  it("returns a catalogued entry per built-in, sorted by type", () => {
    const r = builtinRegistry();
    const entries = r.listMeta();
    expect(entries).toHaveLength(r.size());
    expect(entries.map((e) => e.type)).toEqual([...r.list()]);
    for (const e of entries) {
      const meta = WIDGET_CATALOG[e.type];
      expect(meta).toBeDefined();
      expect(e).toEqual({ type: e.type, ...meta });
    }
  });

  it("skips registered types that have no catalogue entry", () => {
    const r = new WidgetRegistry();
    r.register({ type: "fixture-only", render: () => ({ text: "x" }) });
    expect(r.listMeta()).toEqual([]);
  });
});
