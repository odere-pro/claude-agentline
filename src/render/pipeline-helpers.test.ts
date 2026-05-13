/**
 * Consolidated test surface for the small pipeline preprocessing
 * helpers under `src/render/` (PR E3 — test rationalisation).
 *
 * Each `describe` block scopes to one module:
 *
 *   - `plainSegment`        from `./segment.js`
 *   - `detectColourDepth`   from `./colour-depth.js`
 *   - `detectTerminalWidth` + `applyWidthMode` from `./width.js`
 *
 * Each helper is small and pure; previously their per-file tests sat
 * in `segment.test.ts` (2 cases), `colour-depth.test.ts` (8) and
 * `width.test.ts` (10) — combined here to thin the test-file count
 * without changing any individual assertion.
 */
import { describe, expect, it } from "vitest";

import { detectColourDepth } from "./colour-depth.js";
import { plainSegment } from "./segment.js";
import {
  applyWidthMode,
  DEFAULT_COMPACT_THRESHOLD,
  detectTerminalWidth,
  FALLBACK_WIDTH,
} from "./width.js";

describe("plainSegment", () => {
  it("returns the exact text supplied", () => {
    expect(plainSegment("hello").text).toBe("hello");
    expect(plainSegment("").text).toBe("");
  });

  it("leaves style fields undefined", () => {
    const s = plainSegment("x");
    expect(s.fg).toBeUndefined();
    expect(s.bg).toBeUndefined();
    expect(s.bold).toBeUndefined();
    expect(s.italic).toBeUndefined();
  });
});

describe("detectColourDepth", () => {
  it("recognises COLORTERM=truecolor", () => {
    expect(detectColourDepth({ env: { COLORTERM: "truecolor", TERM: "xterm-256color" } })).toBe(
      "truecolor",
    );
  });

  it("recognises COLORTERM=24bit (case-insensitive)", () => {
    expect(detectColourDepth({ env: { COLORTERM: "24BIT", TERM: "xterm" } })).toBe("truecolor");
  });

  it("recognises *-256color TERM as 256", () => {
    expect(detectColourDepth({ env: { TERM: "screen-256color" } })).toBe("256");
    expect(detectColourDepth({ env: { TERM: "tmux-256color" } })).toBe("256");
  });

  it("recognises xterm-kitty as 256", () => {
    expect(detectColourDepth({ env: { TERM: "xterm-kitty" } })).toBe("256");
  });

  it("recognises common 16-colour TERMs", () => {
    expect(detectColourDepth({ env: { TERM: "xterm" } })).toBe("16");
    expect(detectColourDepth({ env: { TERM: "screen" } })).toBe("16");
    expect(detectColourDepth({ env: { TERM: "vt100" } })).toBe("16");
  });

  it("treats dumb terminal as none", () => {
    expect(detectColourDepth({ env: { TERM: "dumb" } })).toBe("none");
  });

  it("treats missing TERM as none", () => {
    expect(detectColourDepth({ env: {} })).toBe("none");
  });

  it("falls back to 16 for unknown TERMs", () => {
    expect(detectColourDepth({ env: { TERM: "weirdterm-x" } })).toBe("16");
  });
});

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
