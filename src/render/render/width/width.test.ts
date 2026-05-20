/**
 * Unit tests for terminal width detection and width-mode application.
 */

import { describe, it, expect } from "vitest";
import {
  detectTerminalWidth,
  detectTerminalWidthInfo,
  applyWidthMode,
  FALLBACK_WIDTH,
  NO_WRAP_WIDTH,
  type WidthSource,
  type WidthModeOptions,
} from "./width.js";

describe("detectTerminalWidth", () => {
  it("reads COLUMNS from environment", () => {
    const source: WidthSource = {
      env: { COLUMNS: "120" },
    };
    expect(detectTerminalWidth(source)).toBe(120);
  });

  it("ignores non-numeric COLUMNS", () => {
    const source: WidthSource = {
      env: { COLUMNS: "abc" },
    };
    expect(detectTerminalWidth(source)).toBe(FALLBACK_WIDTH);
  });

  it("ignores zero or negative COLUMNS", () => {
    const source: WidthSource = {
      env: { COLUMNS: "0" },
    };
    expect(detectTerminalWidth(source)).toBe(FALLBACK_WIDTH);

    const source2: WidthSource = {
      env: { COLUMNS: "-5" },
    };
    expect(detectTerminalWidth(source2)).toBe(FALLBACK_WIDTH);
  });

  it("falls back to stream.columns if COLUMNS is not set", () => {
    const source: WidthSource = {
      env: {},
      stream: { columns: 200 },
    };
    expect(detectTerminalWidth(source)).toBe(200);
  });

  it("prefers COLUMNS over stream.columns", () => {
    const source: WidthSource = {
      env: { COLUMNS: "100" },
      stream: { columns: 200 },
    };
    expect(detectTerminalWidth(source)).toBe(100);
  });

  it("ignores stream.columns if not an integer", () => {
    const source: WidthSource = {
      env: {},
      stream: { columns: 120.5 },
    };
    expect(detectTerminalWidth(source)).toBe(FALLBACK_WIDTH);
  });

  it("uses fallback when no source available", () => {
    const source: WidthSource = {
      env: {},
    };
    expect(detectTerminalWidth(source)).toBe(FALLBACK_WIDTH);
  });

  it("trims and parses COLUMNS with whitespace", () => {
    const source: WidthSource = {
      env: { COLUMNS: "  150  " },
    };
    expect(detectTerminalWidth(source)).toBe(150);
  });
});

describe("detectTerminalWidthInfo", () => {
  it("reports detected:true for COLUMNS", () => {
    expect(detectTerminalWidthInfo({ env: { COLUMNS: "120" } })).toEqual({
      width: 120,
      detected: true,
    });
  });

  it("reports detected:true for a tty stream", () => {
    expect(detectTerminalWidthInfo({ env: {}, stream: { columns: 200 } })).toEqual({
      width: 200,
      detected: true,
    });
  });

  it("reports detected:false with fallback width when nothing is available", () => {
    expect(detectTerminalWidthInfo({ env: {} })).toEqual({
      width: FALLBACK_WIDTH,
      detected: false,
    });
  });

  it("reports detected:false when COLUMNS is unparseable", () => {
    expect(detectTerminalWidthInfo({ env: { COLUMNS: "abc" } })).toEqual({
      width: FALLBACK_WIDTH,
      detected: false,
    });
  });

  it("NO_WRAP_WIDTH is large enough that no real line can exceed it", () => {
    expect(NO_WRAP_WIDTH).toBeGreaterThan(100_000);
  });
});

describe("applyWidthMode", () => {
  const defaultOptions: WidthModeOptions = {
    mode: "full",
    compactThreshold: 120,
  };

  it("applies full mode", () => {
    const result = applyWidthMode(100, defaultOptions);
    expect(result.effectiveWidth).toBe(100);
    expect(result.isCompact).toBe(true);
    expect(result.detectedWidth).toBe(100);
  });

  it("applies full-minus-40 mode", () => {
    const result = applyWidthMode(150, {
      ...defaultOptions,
      mode: "full-minus-40",
    });
    expect(result.effectiveWidth).toBe(110); // 150 - 40
    expect(result.isCompact).toBe(false); // 150 >= 120
    expect(result.detectedWidth).toBe(150);
  });

  it("applies full-until-compact mode", () => {
    const result = applyWidthMode(100, {
      ...defaultOptions,
      mode: "full-until-compact",
    });
    expect(result.effectiveWidth).toBe(100);
    expect(result.isCompact).toBe(true);
    expect(result.detectedWidth).toBe(100);
  });

  it("never returns negative effective width", () => {
    const result = applyWidthMode(30, {
      ...defaultOptions,
      mode: "full-minus-40",
    });
    expect(result.effectiveWidth).toBe(1); // max(1, 30 - 40)
  });

  it("never returns zero effective width", () => {
    const result = applyWidthMode(1, {
      ...defaultOptions,
      mode: "full",
    });
    expect(result.effectiveWidth).toBe(1); // max(1, 1)
  });

  it("detects compact based on threshold", () => {
    const threshold = 100;
    const result1 = applyWidthMode(99, {
      ...defaultOptions,
      compactThreshold: threshold,
    });
    expect(result1.isCompact).toBe(true);

    const result2 = applyWidthMode(100, {
      ...defaultOptions,
      compactThreshold: threshold,
    });
    expect(result2.isCompact).toBe(false);

    const result3 = applyWidthMode(101, {
      ...defaultOptions,
      compactThreshold: threshold,
    });
    expect(result3.isCompact).toBe(false);
  });

  it("uses default compact threshold for invalid options", () => {
    // Invalid compactThreshold should be ignored and DEFAULT_COMPACT_THRESHOLD (60) used
    const result = applyWidthMode(50, {
      mode: "full",
      compactThreshold: -10,
    });
    expect(result.isCompact).toBe(true); // 50 < 60 (DEFAULT_COMPACT_THRESHOLD)
  });
});
