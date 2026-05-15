import { describe, expect, it } from "vitest";

import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";
import { CUSTOM_WIDGETS, registerCustomWidgets } from "./index.js";
import { SEPARATOR_CYCLE, separatorWidget } from "./separator.js";

const ctx = {} as WidgetContext;

describe("registerCustomWidgets", () => {
  it("registers the custom widget family", () => {
    const r = new WidgetRegistry();
    registerCustomWidgets(r);
    expect(r.size()).toBe(2);
    expect([...r.list()].sort()).toEqual(["osc-link", "separator"]);
    expect(Object.isFrozen(CUSTOM_WIDGETS)).toBe(true);
  });
});

describe("SEPARATOR_CYCLE", () => {
  it("has exactly 5 elements", () => {
    expect(SEPARATOR_CYCLE).toHaveLength(5);
  });

  it("contains the spec characters in order", () => {
    expect([...SEPARATOR_CYCLE]).toEqual(["|", "-", ",", "·", "␣"]);
  });

  it("each element is a single character", () => {
    for (const c of SEPARATOR_CYCLE) {
      expect([...c]).toHaveLength(1);
    }
  });
});

describe("separatorWidget", () => {
  it("returns '|' when no char option is provided", () => {
    const cell = separatorWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("|");
  });

  it("returns the specified char", () => {
    const cell = separatorWidget.render(ctx, { options: { char: "x" }, rawValue: false });
    expect(cell.text).toBe("x");
  });

  it("clamps multi-character string to first character", () => {
    const cell = separatorWidget.render(ctx, { options: { char: "abc" }, rawValue: false });
    expect(cell.text).toBe("a");
  });

  it("returns '|' when char is empty string", () => {
    const cell = separatorWidget.render(ctx, { options: { char: "" }, rawValue: false });
    expect(cell.text).toBe("|");
  });

  it("handles emoji as a single code point", () => {
    const cell = separatorWidget.render(ctx, { options: { char: "🚀" }, rawValue: false });
    expect(cell.text).toBe("🚀");
  });
});
