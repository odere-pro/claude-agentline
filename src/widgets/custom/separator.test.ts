import { describe, expect, it } from "vitest";

import type { WidgetContext } from "../context.js";
import { SEPARATOR_CYCLE, separatorWidget, flexSeparatorWidget } from "./separator.js";

const ctx = {} as WidgetContext;

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

describe("flexSeparatorWidget", () => {
  it("returns cell with flex: true", () => {
    const cell = flexSeparatorWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.flex).toBe(true);
  });

  it("returns space when no fill option is provided", () => {
    const cell = flexSeparatorWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe(" ");
  });

  it("uses the specified fill character", () => {
    const cell = flexSeparatorWidget.render(ctx, { options: { fill: "·" }, rawValue: false });
    expect(cell.text).toBe("·");
  });

  it("clamps multi-character fill to first character", () => {
    const cell = flexSeparatorWidget.render(ctx, { options: { fill: "-~" }, rawValue: false });
    expect(cell.text).toBe("-");
  });
});
