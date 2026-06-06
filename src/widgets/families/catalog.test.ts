import { describe, expect, it } from "vitest";

import {
  WIDGET_CATALOG,
  WIDGET_FAMILIES,
  activeVariantId,
  widgetMeta,
  widgetVariants,
} from "./catalog.js";
import { registerAllBuiltins } from "../index.js";
import { WidgetRegistry } from "../registry/registry.js";

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

  it("covers all 22 shipped widgets", () => {
    expect(Object.keys(WIDGET_CATALOG)).toHaveLength(22);
    expect(builtinRegistry().size()).toBe(22);
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
  it("declares variants for widgets that branch on an option (timers/account-email)", () => {
    expect(widgetVariants("account-email").map((v) => v.id)).toEqual([
      "full",
      "domain",
      "localpart",
    ]);
    expect(widgetVariants("current-session-reset-timer").map((v) => v.id)).toEqual([
      "short",
      "long",
      "clock",
      "at-24h",
      "at-12h",
      "at-seconds",
    ]);
    expect(widgetVariants("week-limit-timer").map((v) => v.id)).toEqual([
      "short",
      "long",
      "clock",
      "at-day-time",
      "at-24h",
      "at-12h",
    ]);
  });

  it("widgets without distinct rendering modes carry no variants", () => {
    expect(widgetVariants("git-branch")).toEqual([]);
    expect(widgetVariants("model")).toEqual([]);
    expect(widgetVariants("plan")).toEqual([]);
    expect(widgetVariants("context-percentage")).toEqual([]);
    expect(widgetVariants("session-weekly-usage")).toEqual([]);
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
    expect(activeVariantId("account-email", { mask: "domain" })).toBe("domain");
    expect(activeVariantId("account-email", { mask: "none" })).toBe("full");
    expect(activeVariantId("current-session-reset-timer", { format: "h:mma" })).toBe("at-12h");
    expect(activeVariantId("current-session-reset-timer", { format: "long" })).toBe("long");
    expect(activeVariantId("week-limit-timer", { format: "EEE D HH:mm" })).toBe("at-day-time");
  });

  it("ignores extra keys when matching (variant only constrains the keys it declares)", () => {
    expect(activeVariantId("current-session-reset-timer", { format: "clock", pad: 2 })).toBe(
      "clock",
    );
  });

  it("returns null when no variant matches", () => {
    expect(activeVariantId("account-email", { mask: "weird" })).toBeNull();
    expect(activeVariantId("account-email", undefined)).toBeNull(); // no variant key set
    expect(activeVariantId("git-worktree", {})).toBeNull(); // no variants defined
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
