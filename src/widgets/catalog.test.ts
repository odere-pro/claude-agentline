import { describe, expect, it } from "vitest";

import {
  WIDGET_CATALOG,
  WIDGET_FAMILIES,
  activeVariantId,
  widgetMeta,
  widgetVariants,
} from "./catalog.js";
import { registerAllBuiltins } from "./index.js";
import { WidgetRegistry } from "./registry.js";

function builtinRegistry(): WidgetRegistry {
  const r = new WidgetRegistry();
  registerAllBuiltins(r);
  return r;
}

const FAMILY_SET = new Set<string>(WIDGET_FAMILIES);
const DESCRIPTION_MAX = 80;

describe("WIDGET_CATALOG", () => {
  it("has exactly one entry per built-in widget type", () => {
    const registered = new Set(builtinRegistry().list());
    const catalogued = new Set(Object.keys(WIDGET_CATALOG));
    const missing = [...registered].filter((t) => !catalogued.has(t)).sort();
    const extra = [...catalogued].filter((t) => !registered.has(t)).sort();
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("covers all 42 shipped widgets", () => {
    expect(Object.keys(WIDGET_CATALOG)).toHaveLength(42);
    expect(builtinRegistry().size()).toBe(42);
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

  it("every entry has a known family", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      expect(FAMILY_SET.has(meta.family), `${type}: family ${meta.family}`).toBe(true);
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
  it("returns the entry for a known type without variants", () => {
    expect(widgetMeta("git-branch")).toMatchObject({
      name: "Git branch",
      description: "Current branch, or short SHA when detached",
      family: "git",
    });
  });

  it("returns undefined for an unknown type", () => {
    expect(widgetMeta("does-not-exist")).toBeUndefined();
  });
});

describe("WIDGET_CATALOG — variants", () => {
  it("declares variants for widgets that branch on an option (skills/usage/clock/timers/uptime/account-email)", () => {
    expect(widgetVariants("skills").map((v) => v.id)).toEqual(["count", "list", "last"]);
    expect(widgetVariants("session-usage").map((v) => v.id)).toEqual([
      "percent",
      "bar",
      "short-bar",
    ]);
    expect(widgetVariants("account-email").map((v) => v.id)).toEqual([
      "full",
      "domain",
      "localpart",
    ]);
    expect(widgetVariants("block-reset-timer").map((v) => v.id)).toEqual([
      "short",
      "long",
      "clock",
    ]);
    expect(widgetVariants("block-reset-at").map((v) => v.id)).toEqual([
      "time-24h",
      "time-12h",
      "seconds",
    ]);
    expect(widgetVariants("weekly-reset-timer").map((v) => v.id)).toEqual([
      "short",
      "long",
      "clock",
    ]);
    expect(widgetVariants("weekly-reset-at").map((v) => v.id)).toEqual([
      "time-24h",
      "time-12h",
      "seconds",
    ]);
    expect(widgetVariants("uptime-session").map((v) => v.id)).toEqual(["short", "long", "clock"]);
    expect(widgetVariants("uptime-block").map((v) => v.id)).toEqual(["short", "long", "clock"]);
    expect(widgetVariants("clock").length).toBeGreaterThanOrEqual(2);
  });

  it("widgets without distinct rendering modes carry no variants", () => {
    expect(widgetVariants("git-branch")).toEqual([]);
    expect(widgetVariants("model")).toEqual([]);
    expect(widgetVariants("context-length")).toEqual([]);
    expect(widgetVariants("does-not-exist")).toEqual([]);
  });

  it("variant ids are unique within a widget and every variant has a non-empty label", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      const variants = meta.variants ?? [];
      const ids = variants.map((v) => v.id);
      expect(new Set(ids).size, `${type}: duplicate variant ids`).toBe(ids.length);
      for (const variant of variants) {
        expect(variant.id.trim().length, `${type}/${variant.id}: id`).toBeGreaterThan(0);
        expect(variant.label.trim().length, `${type}/${variant.id}: label`).toBeGreaterThan(0);
        expect(Object.isFrozen(variant.options), `${type}/${variant.id}: options frozen`).toBe(
          true,
        );
      }
    }
  });
});

describe("activeVariantId", () => {
  it("recognises the active variant from a widget's options", () => {
    expect(activeVariantId("skills", { variant: "list" })).toBe("list");
    expect(activeVariantId("skills", { variant: "count" })).toBe("count");
    expect(activeVariantId("session-usage", { display: "bar" })).toBe("bar");
    expect(activeVariantId("block-reset-timer", { format: "long" })).toBe("long");
    expect(activeVariantId("clock", { format: "%H:%M" })).toBe("time-24h");
  });

  it("ignores extra keys when matching (variant only constrains the keys it declares)", () => {
    expect(activeVariantId("session-usage", { display: "bar", barWidth: 8 })).toBe("bar");
  });

  it("returns null when no variant matches", () => {
    expect(activeVariantId("skills", { variant: "weird" })).toBeNull();
    expect(activeVariantId("skills", undefined)).toBeNull(); // no variant key set
    expect(activeVariantId("git-branch", {})).toBeNull(); // no variants defined
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
