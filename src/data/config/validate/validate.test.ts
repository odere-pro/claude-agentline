import { describe, it, expect } from "vitest";
import { validateConfig, ConfigValidationError } from "./validate.js";
import { DEFAULT_CONFIG } from "../defaults/defaults.js";

describe("validateConfig", () => {
  // ── unknown widget types must not discard the config (issue #311) ───────
  //
  // Retiring a widget type regenerates the schema's `widget.type` enum
  // (gate-28). Before this, a config still naming a retired type failed
  // validation outright and the user lost EVERY line, not just that cell —
  // the break PR #206 shipped for its eight retired types.

  it("accepts a config naming an unknown widget type", () => {
    // `context-bar` is one of the eight types PR #206 retired; a config
    // written before that upgrade must still load.
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "context-bar" }] }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("accepts a config naming the retired cost widgets (issue #305)", () => {
    // `cost-burn-rate` / `cost-efficiency` were retired for dividing by an
    // idle-inclusive wall clock. A config that still names them must keep
    // rendering every other cell.
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [
        {
          widgets: [
            { type: "model" },
            { type: "cost-burn-rate" },
            { type: "cost-usd" },
            { type: "cost-efficiency" },
          ],
        },
      ],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
    expect(cfg.lines[0]!.widgets).toHaveLength(4);
  });

  it("keeps the unknown widget in the config so the render can hide it", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "no-such-widget" }, { type: "model" }] }],
    };
    validateConfig(cfg);
    expect(cfg.lines[0]!.widgets.map((w) => w.type)).toEqual(["no-such-widget", "model"]);
  });

  it("still rejects a genuinely malformed config (unknown top-level key)", () => {
    const cfg = { ...DEFAULT_CONFIG, globel: { padding: 1 } };
    expect(() => validateConfig(cfg)).toThrow(ConfigValidationError);
  });

  it("still rejects a bad value elsewhere even when an unknown widget type is present", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      global: { ...DEFAULT_CONFIG.global, padding: "wide" },
      lines: [{ widgets: [{ type: "no-such-widget" }] }],
    };
    expect(() => validateConfig(cfg)).toThrow(ConfigValidationError);
  });

  it("reports only the real errors, not the tolerated widget-type ones", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      global: { ...DEFAULT_CONFIG.global, padding: "wide" },
      lines: [{ widgets: [{ type: "no-such-widget" }] }],
    };
    try {
      validateConfig(cfg);
      throw new Error("expected validateConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const e = err as ConfigValidationError;
      expect(e.errors.every((x) => !/\/widgets\/\d+\/type$/.test(x.instancePath))).toBe(true);
    }
  });

  it("accepts the default config", () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, mystery: 1 })).toThrowError(
      ConfigValidationError,
    );
  });

  it("rejects an invalid colour value", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", fg: "neon-pink" }] }],
    };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("accepts a hex colour", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", fg: "#ff8800" }] }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("accepts a colour:N index in range", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", bg: "colour:208" }] }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("rejects colour:N out of range", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", bg: "colour:999" }] }],
    };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("rejects empty lines array", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, lines: [] })).toThrowError(
      ConfigValidationError,
    );
  });

  it("accepts a line with no widgets (empty lines render blank)", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, lines: [{ widgets: [] }] })).not.toThrow();
  });

  it("accepts a partial families override", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      families: { git: { colour: "#00ff88" }, context: { glyph: "▣" } },
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("rejects an invalid family colour", () => {
    const cfg = { ...DEFAULT_CONFIG, families: { git: { colour: "neon-pink" } } };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("rejects an unknown family key", () => {
    const cfg = { ...DEFAULT_CONFIG, families: { bogus: { colour: "red" } } };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("accepts a translations table", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      language: "fr",
      translations: { fr: { "widget.default-label.reset-at": "fin à " } },
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });
});
