import { describe, expect, it } from "vitest";

import { DEFAULT_COMPACT_THRESHOLD, DEFAULT_CONFIG } from "./defaults.js";

describe("DEFAULT_CONFIG", () => {
  it("pins schema version to 1", () => {
    expect(DEFAULT_CONFIG.version).toBe(1);
  });

  it("ships exactly one line with one widget (the model)", () => {
    expect(DEFAULT_CONFIG.lines).toHaveLength(1);
    expect(DEFAULT_CONFIG.lines[0]?.widgets).toEqual([{ type: "model" }]);
  });

  it("disables Powerline by default", () => {
    expect(DEFAULT_CONFIG.powerline.enabled).toBe(false);
  });

  it("uses full-minus-40 width mode with the shared compact threshold", () => {
    expect(DEFAULT_CONFIG.terminalWidth.mode).toBe("full-minus-40");
    expect(DEFAULT_CONFIG.terminalWidth.compactThreshold).toBe(DEFAULT_COMPACT_THRESHOLD);
  });

  it("DEFAULT_COMPACT_THRESHOLD is a sane positive integer", () => {
    expect(Number.isInteger(DEFAULT_COMPACT_THRESHOLD)).toBe(true);
    expect(DEFAULT_COMPACT_THRESHOLD).toBeGreaterThan(0);
  });

  it("seeds keymap as an empty object (user opt-in)", () => {
    expect(DEFAULT_CONFIG.keymap).toEqual({});
  });

  it("defaults language to en with empty families/translations overrides", () => {
    expect(DEFAULT_CONFIG.language).toBe("en");
    expect(DEFAULT_CONFIG.families).toEqual({});
    expect(DEFAULT_CONFIG.translations).toEqual({});
  });

  it("global defaults match documented spec values", () => {
    expect(DEFAULT_CONFIG.global).toMatchObject({
      padding: 1,
      separator: "|",
      inheritColors: false,
      bold: false,
      italic: false,
      minimalist: false,
      overrideFg: null,
      overrideBg: null,
    });
  });
});
