import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/index.js";
import type { StdinPayload } from "../stdin/index.js";

import { HIDDEN_CELL } from "./cell.js";
import { frozenClock } from "./clock.js";
import type { WidgetContext } from "./context.js";
import { WidgetRegistry } from "./registry.js";
import { renderWidget, WidgetTypeMissingError } from "./render-widget.js";
import { defineWidget, type WidgetSettings } from "./widget.js";
import { widgetGlyph } from "./catalog.js";

const stdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T00:00:00Z"),
    env: {},
    ...overrides,
  };
}

const echo = defineWidget<{ text?: string; label?: string }>("echo", (_ctx, s) => {
  const text = s.options.text ?? "echo";
  const label = s.rawValue ? "" : (s.options.label ?? "");
  return { text: `${label}${text}`, fg: "red" };
});

describe("renderWidget", () => {
  it("returns HIDDEN_CELL when config.hidden is true", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo", hidden: true }, makeCtx());
    expect(cell).toBe(HIDDEN_CELL);
  });

  it("returns HIDDEN_CELL for unknown widget when not strict", () => {
    const r = new WidgetRegistry();
    const cell = renderWidget(r, { type: "missing" }, makeCtx());
    expect(cell).toBe(HIDDEN_CELL);
  });

  it("throws WidgetTypeMissingError for unknown widget when strict", () => {
    const r = new WidgetRegistry();
    expect(() =>
      renderWidget(r, { type: "missing" }, makeCtx(), { strict: true }),
    ).toThrow(WidgetTypeMissingError);
  });

  it("passes options and rawValue through to the widget", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(
      r,
      { type: "echo", rawValue: false, options: { text: "hi", label: "L:" } },
      makeCtx(),
    );
    expect(cell.text).toBe("L:hi");
    const raw = renderWidget(
      r,
      { type: "echo", rawValue: true, options: { text: "hi", label: "L:" } },
      makeCtx(),
    );
    expect(raw.text).toBe("hi");
  });

  it("config.fg overrides widget fg", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo", fg: "#112233" }, makeCtx());
    expect(cell.fg).toBe("#112233");
  });

  it("config.fg=null is treated as 'no override' (widget default wins)", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo", fg: null }, makeCtx());
    expect(cell.fg).toBe("red");
  });

  it("preserves widget fg when no config override is set", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo" }, makeCtx());
    expect(cell.fg).toBe("red");
  });

  it("merged defaults to 'off' when neither widget nor config sets it", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo" }, makeCtx());
    expect(cell.merged).toBe("off");
  });

  it("config.merged overrides the widget's merge mode", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(
      r,
      { type: "echo", merged: "merge-no-padding" },
      makeCtx(),
    );
    expect(cell.merged).toBe("merge-no-padding");
  });

  it("widget-emitted hidden cell collapses to HIDDEN_CELL", () => {
    const r = new WidgetRegistry();
    r.register(defineWidget("vanish", () => ({ text: "", hidden: true })));
    expect(renderWidget(r, { type: "vanish" }, makeCtx())).toBe(HIDDEN_CELL);
  });

  it("returned cell is frozen", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo" }, makeCtx());
    expect(Object.isFrozen(cell)).toBe(true);
  });
});

describe("glyph layer", () => {
  function ctxWithGlyphs(mode: "off" | "nerd-font"): WidgetContext {
    return makeCtx({ config: { ...DEFAULT_CONFIG, glyphs: mode } });
  }

  it("does not prepend a glyph when config.glyphs is 'off' (default)", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(r, { type: "echo", options: { text: "hi" } }, makeCtx());
    expect(cell.text).toBe("hi");
  });

  it("prepends the catalogued glyph + thin space when config.glyphs is 'nerd-font'", () => {
    const r = new WidgetRegistry();
    // `echo` is a fixture type with no catalogue glyph, so we register a
    // widget under a real catalogue type to exercise the lookup.
    r.register(defineWidget("git-branch", () => ({ text: "main" })));
    const glyph = widgetGlyph("git-branch");
    expect(glyph).toBeTruthy();
    const cell = renderWidget(r, { type: "git-branch" }, ctxWithGlyphs("nerd-font"));
    expect(cell.text).toBe(`${glyph}\u2009main`);
  });

  it("leaves widgets without a catalogue glyph unchanged in nerd-font mode", () => {
    const r = new WidgetRegistry();
    r.register(echo);
    const cell = renderWidget(
      r,
      { type: "echo", options: { text: "hi" } },
      ctxWithGlyphs("nerd-font"),
    );
    expect(cell.text).toBe("hi");
  });

  it("leaves flex cells alone (their text is the fill character)", () => {
    const r = new WidgetRegistry();
    r.register(defineWidget("test-flex", () => ({ text: " ", flex: true })));
    const cell = renderWidget(r, { type: "test-flex" }, ctxWithGlyphs("nerd-font"));
    expect(cell.text).toBe(" ");
    expect(cell.flex).toBe(true);
  });

  it("leaves empty cells unchanged", () => {
    const r = new WidgetRegistry();
    r.register(defineWidget("git-branch", () => ({ text: "" })));
    const cell = renderWidget(r, { type: "git-branch" }, ctxWithGlyphs("nerd-font"));
    expect(cell.text).toBe("");
  });
});

describe("widget contract integration", () => {
  it("accepts an empty options block when widget declares typed options", () => {
    const r = new WidgetRegistry();
    const widget = defineWidget<{ a?: string }>("typed", (_, s: WidgetSettings<{ a?: string }>) => ({
      text: s.options.a ?? "default",
    }));
    r.register(widget);
    expect(renderWidget(r, { type: "typed" }, makeCtx()).text).toBe("default");
    expect(renderWidget(r, { type: "typed", options: { a: "ok" } }, makeCtx()).text).toBe("ok");
  });
});
