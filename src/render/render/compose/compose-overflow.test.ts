/**
 * Tests for plain-mode line overflow (issue #304).
 *
 * A configured line always occupies exactly one physical row. The host paints
 * one terminal row per `\n`-separated segment of our stdout, so a composer
 * that wrapped overflow onto extra rows made the row count vary with content
 * width — and a row count that changes between refreshes is what leaves stale
 * statusline copies in the scrollback.
 *
 * Overflow is therefore elided at a cell boundary (never mid-cell) and marked
 * with a trailing ellipsis, so the elision is visible rather than silent.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { GlobalConfig, PowerlineConfig } from "../../../data/config/types.js";
import type { Cell } from "../../../widgets/cell/cell.js";

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

  // ── one configured line → exactly one physical row (issue #304) ─────────

  it("emits exactly one row per configured line, however far it overflows", () => {
    const cells = Array.from({ length: 30 }, (_, i) => cell(`w${String(i).padStart(2, "0")}`));
    const out = composeLines([cells], baseOptions({ width: 4 }));
    expect(out).toHaveLength(1);
  });

  it("row count is independent of terminal width — the anti-flapping invariant", () => {
    const lines = [
      ["alpha", "bravo", "charlie"].map((t) => cell(t)),
      ["delta", "echo", "foxtrot"].map((t) => cell(t)),
      ["golf", "hotel"].map((t) => cell(t)),
    ];
    for (const width of [8, 20, 40, 80, 200]) {
      const out = composeLines(lines, baseOptions({ width }));
      expect(out, `width=${width}`).toHaveLength(3);
    }
  });

  it("elides trailing cells that do not fit and marks it with an ellipsis", () => {
    const cells = ["aaaaa", "bbbbb", "ccccc", "ddddd"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 16 }));
    expect(out).toHaveLength(1);
    const text = lineText(out[0]);
    expect(text).toContain("aaaaa");
    expect(text).not.toContain("ddddd");
    expect(text).toMatch(/…$/);
  });

  it("never truncates a cell mid-text — elision happens at a cell boundary", () => {
    const cells = ["alpha", "gammagammagamma"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 12 }));
    const text = lineText(out[0]);
    expect(text).toContain("alpha");
    // `gammagammagamma` does not fit; it is dropped whole, never sliced.
    expect(text).not.toContain("gammagamma");
    expect(text).not.toMatch(/gam$|gamm$/);
  });

  it("keeps an oversized single cell rather than dropping it, and adds no ellipsis", () => {
    // The first cell is never dropped: better to overflow one cell (the host
    // clips it) than to render an empty row.
    const out = composeLines([[cell("xxxxxxxxxxxxxxxx")]], baseOptions({ width: 10 }));
    expect(out).toHaveLength(1);
    expect(lineText(out[0])).toBe("xxxxxxxxxxxxxxxx");
  });

  it("adds no ellipsis when everything fits", () => {
    const cells = ["a", "b"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 40 }));
    expect(lineText(out[0])).not.toContain("…");
  });

  it("still marks the elision when a lone oversized cell ate the whole budget", () => {
    // Regression: `cwd-path` alone exceeded the effective width, so `git-branch`
    // and `git-pr` were dropped with no marker at all — silent data loss.
    const cells = [cell("~/very/long/path/that/eats/the/whole/budget"), cell("branch"), cell("pr")];
    const out = composeLines([cells], baseOptions({ width: 20 }));
    expect(out).toHaveLength(1);
    const text = lineText(out[0]);
    expect(text).toContain("~/very/long/path");
    expect(text).not.toContain("branch");
    expect(text).toMatch(/…$/);
  });

  it("the composed row never exceeds the width once an ellipsis is added", () => {
    const cells = Array.from({ length: 10 }, (_, i) => cell(`cell${i}`));
    const width = 24;
    const out = composeLines([cells], baseOptions({ width }));
    expect([...lineText(out[0])].length).toBeLessThanOrEqual(width);
  });

  it("degrades the ellipsis to '...' when the host cannot render unicode", () => {
    const cells = ["aaaaa", "bbbbb", "ccccc", "ddddd"].map((t) => cell(t));
    const out = composeLines([cells], baseOptions({ width: 16, glyphSupport: "ascii" }));
    const text = lineText(out[0]);
    expect(text).toMatch(/\.\.\.$/);
    expect(text).not.toContain("…");
  });

  // ── configured-line budget ──────────────────────────────────────────────

  it("caps the number of configured lines at MAX_LINES", () => {
    const lines = Array.from({ length: 6 }, (_, i) => [cell(`line${i}`)]);
    const out = composeLines(lines, baseOptions({ width: 40 }));
    expect(out).toHaveLength(3);
    const joined = out.map(lineText).join("\n");
    expect(joined).toContain("line0");
    expect(joined).toContain("line2");
    expect(joined).not.toContain("line3");
  });

  it("an overflowing configured line does not starve later configured lines", () => {
    const overflowing = Array.from({ length: 8 }, (_, i) => cell(`big${i}`));
    const tail = [cell("git-branch")];
    const out = composeLines([overflowing, tail], baseOptions({ width: 8 }));
    expect(out).toHaveLength(2);
    expect(lineText(out[1])).toContain("git-branch");
  });

  // ── noWrap (width undetectable) ─────────────────────────────────────────

  it("noWrap keeps a configured line on a single row and elides nothing", () => {
    const cells = Array.from({ length: 12 }, (_, i) => cell(`cell${i}`));
    const out = composeLines([cells], baseOptions({ width: 4, noWrap: true }));
    expect(out).toHaveLength(1);
    const joined = lineText(out[0]);
    expect(joined).toContain("cell0");
    expect(joined).toContain("cell11");
    expect(joined).not.toContain("…");
  });

  it("noWrap collapses flex slots instead of filling to the sentinel width", () => {
    const cells = [cell("left"), cell("~", { flex: true }), cell("right")];
    const out = composeLines([cells], baseOptions({ width: 1_000_000, noWrap: true }));
    expect(out).toHaveLength(1);
    const joined = lineText(out[0]);
    expect(joined.length).toBeLessThan(50);
    expect(joined).toContain("left");
    expect(joined).toContain("right");
    expect(joined).not.toMatch(/~~~~/);
  });

  it("preserves cell styling on the cells that survive elision", () => {
    const cells = [
      cell("alpha", { fg: "red" }),
      cell("beta", { fg: "blue" }),
      cell("gamma", { fg: "green" }),
    ];
    const out = composeLines([cells], baseOptions({ width: 12 }));
    expect(out).toHaveLength(1);
    const reds = out[0]!.filter((s) => s.fg === "red");
    expect(reds.some((s) => s.text === "alpha")).toBe(true);
  });
});
