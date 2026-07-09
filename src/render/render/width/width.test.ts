/**
 * Unit tests for terminal width detection.
 */

import { describe, it, expect } from "vitest";
import {
  detectTerminalWidth,
  detectTerminalWidthInfo,
  FALLBACK_WIDTH,
  NO_WRAP_WIDTH,
  type WidthSource,
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
