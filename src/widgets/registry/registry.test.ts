import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerAllBuiltins } from "../index.js";
import { defineWidget } from "../widget.js";
import {
  WidgetRegistry,
  WidgetTypeAlreadyRegistered,
  WidgetTypeNotRegistered,
  defaultRegistry,
  resetDefaultRegistry,
} from "./registry.js";

const noop = defineWidget("noop", () => ({ text: "noop" }));
const second = defineWidget("second", () => ({ text: "second" }));

describe("WidgetRegistry", () => {
  it("registers and retrieves a widget", () => {
    const r = new WidgetRegistry();
    r.register(noop);
    expect(r.get("noop")).toBe(noop);
    expect(r.has("noop")).toBe(true);
    expect(r.size()).toBe(1);
  });

  it("throws WidgetTypeAlreadyRegistered on duplicate type", () => {
    const r = new WidgetRegistry();
    r.register(noop);
    expect(() => r.register(noop)).toThrow(WidgetTypeAlreadyRegistered);
  });

  it("require throws WidgetTypeNotRegistered for unknown type", () => {
    const r = new WidgetRegistry();
    expect(() => r.require("missing")).toThrow(WidgetTypeNotRegistered);
  });

  it("get returns undefined for unknown type", () => {
    const r = new WidgetRegistry();
    expect(r.get("missing")).toBeUndefined();
    expect(r.has("missing")).toBe(false);
  });

  it("registerAll registers each def in order", () => {
    const r = new WidgetRegistry();
    r.registerAll([noop, second]);
    expect(r.list()).toEqual(["noop", "second"]);
  });

  it("list returns sorted type names for stable enumeration", () => {
    const r = new WidgetRegistry();
    r.registerAll([second, noop]);
    expect(r.list()).toEqual(["noop", "second"]);
  });
});

describe("defaultRegistry / resetDefaultRegistry", () => {
  beforeEach(() => {
    resetDefaultRegistry();
  });

  afterEach(() => {
    resetDefaultRegistry();
  });

  it("returns the same lazily-created singleton across calls", () => {
    expect(defaultRegistry()).toBe(defaultRegistry());
  });

  it("resetDefaultRegistry forces a fresh instance on next call", () => {
    const first = defaultRegistry();
    resetDefaultRegistry();
    expect(defaultRegistry()).not.toBe(first);
  });

  it("grows from empty after registerAllBuiltins and stays size-consistent", () => {
    const registry = defaultRegistry();
    const before = registry.size();
    registerAllBuiltins(registry);
    const after = registry.size();

    expect(after).toBeGreaterThan(before);
    expect(after).toBe(registry.list().length);
  });
});

describe("defineWidget", () => {
  it("freezes the def", () => {
    expect(Object.isFrozen(noop)).toBe(true);
  });

  it("rejects empty type", () => {
    expect(() => defineWidget("", () => ({ text: "x" }))).toThrow(/non-empty/);
    expect(() => defineWidget("   ", () => ({ text: "x" }))).toThrow(/non-empty/);
  });
});
