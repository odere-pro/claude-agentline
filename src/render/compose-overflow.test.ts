/**
 * Tests for plain-mode line overflow (Phase 2 item 8).
 *
 * The composer must wrap trailing cells onto a new line when the
 * composed width exceeds `options.width` rather than truncating
 * mid-cell, and the total output line count must stay bounded by
 * `MAX_LINES`.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/index.js";
import type { GlobalConfig, PowerlineConfig } from "../config/types.js";
import type { Cell } from "../widgets/cell.js";

import { composeLines, type ComposeOptions } from "./compose.js";

const cell = (text: string, overrides: Partial<Cell> = {}): Cell => ({
  text,
  ...overrides,
});

const baseGlobal: GlobalConfig = DEFAULT_CONFIG.global;

const baseOptions = (
  overrides: Partial<ComposeOptions> = {},
  pwl: Partial<PowerlineConfig> = {},
): ComposeOptions => ({
  global: baseGlobal,
  powerline: { ...DEFAULT_CONFIG.powerline, ...pwl },
  theme: null,
  width: 40,
  glyphSupport: "nerd",
  ...overrides,
});

function lineText(line: { text: string }[] | undefined): string {
  return (line ?? []).map((s) => s.text).join("");
}

describe("composeLines (plain mode, overflow)", () => {
  it("keeps a single short line intact when it fits", () => {
    const cells = ["alpha", "beta"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 40 }));
    expect(out).toHaveLength(1);
    expect(lineText(out[0])).toMatch(/alpha/);
    expect(lineText(out[0])).toMatch(/beta$/);
  });

  it("wraps trailing cells onto a second line when width is exceeded", () => {
    /*
     * 4 cells of width 5, with separator " | " (3 chars) between them, in a
     * 16-character window: line 1 packs two, line 2 packs the rest.
     */
    const cells = ["aaaaa", "bbbbb", "ccccc", "ddddd"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 16 }));
    expect(out.length).toBeGreaterThan(1);
    expect(lineText(out[0])).toContain("aaaaa");
    expect(lineText(out[0])).toContain("bbbbb");
    expect(lineText(out[0])).not.toContain("ccccc");
    const tail = out.slice(1).map(lineText).join("\n");
    expect(tail).toContain("ccccc");
    expect(tail).toContain("ddddd");
  });

  it("never truncates a cell mid-text", () => {
    const cells = ["alpha", "beta", "gammagammagamma", "delta"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 20 }));
    const joined = out.map(lineText).join("");
    expect(joined).toContain("alpha");
    expect(joined).toContain("beta");
    expect(joined).toContain("gammagammagamma");
    expect(joined).toContain("delta");
  });

  it("keeps an oversized single cell on its own line rather than dropping it", () => {
    const cells = [cell("xxxxxxxxxxxxxxxx")]; // 16 wide
    const out = composeLines([cells], baseOptions({ width: 10 }));
    expect(out).toHaveLength(1);
    expect(lineText(out[0])).toBe("xxxxxxxxxxxxxxxx");
  });

  it("caps total output lines at MAX_LINES even with extreme overflow", () => {
    const cells = Array.from({ length: 30 }, (_, i) => cell(`w${String(i).padStart(2, "0")}`));
    const out = composeLines([cells], baseOptions({ width: 4 }));
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("does not wrap when only the first cell exceeds width (no second cell to bump)", () => {
    const out = composeLines([[cell("just-one-very-long-cell")]], baseOptions({ width: 5 }));
    expect(out).toHaveLength(1);
    expect(lineText(out[0])).toBe("just-one-very-long-cell");
  });

  it("preserves cell styling across the wrap", () => {
    const cells = [
      cell("alpha", { fg: "red" }),
      cell("beta", { fg: "blue" }),
      cell("gamma", { fg: "green" }),
    ];
    const out = composeLines([cells], baseOptions({ width: 10 }));
    expect(out.length).toBeGreaterThanOrEqual(2);
    const reds = out.flatMap((segs) => segs.filter((s) => s.fg === "red"));
    const blues = out.flatMap((segs) => segs.filter((s) => s.fg === "blue"));
    const greens = out.flatMap((segs) => segs.filter((s) => s.fg === "green"));
    expect(reds.some((s) => s.text === "alpha")).toBe(true);
    expect(blues.some((s) => s.text === "beta")).toBe(true);
    expect(greens.some((s) => s.text === "gamma")).toBe(true);
  });
});
