/**
 * Widget registry-to-catalog parity test.
 *
 * Ensures that every widget in WIDGET_CATALOG is registered in defaultRegistry,
 * and vice versa. This prevents silent mismatches where a widget is catalogued
 * but never registered, or vice versa.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WIDGET_CATALOG, WIDGET_CATEGORIES } from "../../src/widgets/catalog.js";
import {
  defaultRegistry,
  resetDefaultRegistry,
  registerAllBuiltins,
} from "../../src/widgets/index.js";

const CATEGORIES: ReadonlySet<string> = new Set(WIDGET_CATEGORIES);

describe("Widget registry-catalog parity", () => {
  beforeEach(() => {
    resetDefaultRegistry();
  });

  afterEach(() => {
    resetDefaultRegistry();
  });

  it("initializes default registry with all built-in widgets", () => {
    const registry = defaultRegistry();
    registerAllBuiltins(registry);

    const registryTypes = new Set(registry.list());
    const catalogTypes = new Set(Object.keys(WIDGET_CATALOG));

    expect(registryTypes.size).toBeGreaterThan(0);
    expect(catalogTypes.size).toBeGreaterThan(0);
  });

  it("has no widgets in registry that are not in catalog", () => {
    const registry = defaultRegistry();
    registerAllBuiltins(registry);

    const registryTypes = registry.list();
    const catalogTypes = Object.keys(WIDGET_CATALOG);
    const catalogSet = new Set(catalogTypes);

    for (const type of registryTypes) {
      expect(catalogSet.has(type)).toBe(true);
    }
  });

  it("has no widgets in catalog that are not in registry", () => {
    // Cross-check against the registry, not against the catalog itself.
    // The previous loop iterated `Object.keys(WIDGET_CATALOG)` and asserted
    // each value was defined — a no-op against `Object.keys`'s own output.
    const registry = defaultRegistry();
    registerAllBuiltins(registry);

    const registryTypes = new Set(registry.list());

    for (const type of Object.keys(WIDGET_CATALOG)) {
      expect(registryTypes.has(type)).toBe(true);
    }
  });

  it("lists metadata for all registered widgets", () => {
    const registry = defaultRegistry();
    registerAllBuiltins(registry);

    const meta = registry.listMeta();
    const registryTypes = new Set(registry.list());

    expect(meta.length).toBeGreaterThan(0);
    expect(meta.length).toBeLessThanOrEqual(registryTypes.size);

    for (const entry of meta) {
      expect(registryTypes.has(entry.type)).toBe(true);
      // Empty strings would have satisfied the prior `toBeDefined()`
      // checks — assert non-empty content + a known category instead.
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(CATEGORIES.has(entry.category)).toBe(true);
    }
  });

  it("maintains registry size consistency after register", () => {
    const registry = defaultRegistry();
    const before = registry.size();
    registerAllBuiltins(registry);
    const after = registry.size();

    expect(after).toBeGreaterThan(before);
    expect(after).toBe(registry.list().length);
  });
});
