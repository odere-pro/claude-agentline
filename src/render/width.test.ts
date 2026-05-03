import { describe, expect, it } from "vitest";

import {
  applyWidthMode,
  DEFAULT_COMPACT_THRESHOLD,
  detectTerminalWidth,
  FALLBACK_WIDTH,
} from "./width.js";

describe("detectTerminalWidth", () => {
  it("uses COLUMNS env when set to a positive integer", () => {
    expect(detectTerminalWidth({ env: { COLUMNS: "150" } })).toBe(150);
  });

  it("ignores empty / non-numeric / non-positive COLUMNS", () => {
    expect(detectTerminalWidth({ env: { COLUMNS: "" } })).toBe(FALLBACK_WIDTH);
    expect(detectTerminalWidth({ env: { COLUMNS: "abc" } })).toBe(FALLBACK_WIDTH);
    expect(detectTerminalWidth({ env: { COLUMNS: "0" } })).toBe(FALLBACK_WIDTH);
    expect(detectTerminalWidth({ env: { COLUMNS: "-5" } })).toBe(FALLBACK_WIDTH);
  });

  it("falls back to stream.columns when env is unset", () => {
    expect(detectTerminalWidth({ env: {}, stream: { columns: 120 } })).toBe(120);
  });

  it("falls back to 80 when nothing else is available", () => {
    expect(detectTerminalWidth({ env: {} })).toBe(FALLBACK_WIDTH);
  });

  it("prefers env over stream", () => {
    expect(detectTerminalWidth({ env: { COLUMNS: "100" }, stream: { columns: 200 } })).toBe(100);
  });
});

describe("applyWidthMode", () => {
  it("'full' returns the detected width", () => {
    expect(applyWidthMode(120, { mode: "full", compactThreshold: 60 })).toEqual({
      effectiveWidth: 120,
      isCompact: false,
      detectedWidth: 120,
    });
  });

  it("'full-minus-40' subtracts 40", () => {
    expect(applyWidthMode(120, { mode: "full-minus-40", compactThreshold: 60 })).toEqual({
      effectiveWidth: 80,
      isCompact: false,
      detectedWidth: 120,
    });
  });

  it("flags compact when below threshold", () => {
    const result = applyWidthMode(40, { mode: "full-until-compact", compactThreshold: 60 });
    expect(result.isCompact).toBe(true);
  });

  it("clamps effective width to >= 1", () => {
    const result = applyWidthMode(20, { mode: "full-minus-40", compactThreshold: 60 });
    expect(result.effectiveWidth).toBe(1);
  });

  it("guards against invalid compactThreshold", () => {
    const result = applyWidthMode(80, { mode: "full", compactThreshold: -1 });
    expect(result.isCompact).toBe(80 < DEFAULT_COMPACT_THRESHOLD);
  });
});
