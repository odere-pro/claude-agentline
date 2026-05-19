import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../../data/theme/index.js";
import type { Cell } from "../../widgets/cell.js";

import { ASCII_GLYPHS, NERD_FONT_GLYPHS, resolveGlyphs } from "./glyphs.js";
import { applyPowerline, applyPowerlineLines } from "./transform.js";

const cell = (overrides: Partial<Cell>): Cell => ({ text: "", ...overrides });

describe("resolveGlyphs", () => {
  it("returns ASCII glyphs when useAscii=true", () => {
    expect(resolveGlyphs(undefined, true)).toBe(ASCII_GLYPHS);
  });

  it("returns Nerd Font glyphs by default", () => {
    expect(resolveGlyphs(undefined, false)).toBe(NERD_FONT_GLYPHS);
  });

  it("layers user overrides on top", () => {
    const merged = resolveGlyphs({ hardRight: "#" }, false);
    expect(merged.hardRight).toBe("#");
    expect(merged.softRight).toBe(NERD_FONT_GLYPHS.softRight);
  });
});

describe("applyPowerline", () => {
  const baseOpts = {
    glyphs: ASCII_GLYPHS,
    theme: null,
  };

  it("returns no segments for an empty / all-hidden line", () => {
    expect(applyPowerline([], baseOpts)).toEqual([]);
    expect(applyPowerline([cell({ hidden: true })], baseOpts)).toEqual([]);
  });

  it("skips flex cells (no-op in Powerline mode)", () => {
    const segs = applyPowerline(
      [cell({ text: "a", bg: "red" }), cell({ flex: true }), cell({ text: "b", bg: "blue" })],
      baseOpts,
    );
    // Two cells (a, b) joined by one chevron; no flex segment
    expect(segs).toHaveLength(3);
    expect(segs[0]?.text).toBe(" a ");
    expect(segs[2]?.text).toBe(" b ");
  });

  it("inserts chevrons with adjoining colour rule", () => {
    const segs = applyPowerline(
      [cell({ text: "a", bg: "red" }), cell({ text: "b", bg: "blue" })],
      baseOpts,
    );
    expect(segs).toHaveLength(3);
    const chev = segs[1];
    expect(chev?.text).toBe(">");
    expect(chev?.fg).toBe("red");
    expect(chev?.bg).toBe("blue");
  });

  it("uses cell.fg for the chevron when adjacent cells share a bg", () => {
    const segs = applyPowerline(
      [cell({ text: "a", bg: "red", fg: "yellow" }), cell({ text: "b", bg: "red", fg: "white" })],
      baseOpts,
    );
    expect(segs).toHaveLength(3);
    const chev = segs[1];
    expect(chev?.fg).toBe("yellow");
    expect(chev?.bg).toBe("red");
  });

  it("falls back to cell.bg for the chevron when same-bg cell has no fg", () => {
    const segs = applyPowerline(
      [cell({ text: "a", bg: "red" }), cell({ text: "b", bg: "red" })],
      baseOpts,
    );
    expect(segs).toHaveLength(3);
    const chev = segs[1];
    expect(chev?.fg).toBe("red");
    expect(chev?.bg).toBe("red");
  });

  it("indexes hardRight glyph arrays by chevron position", () => {
    const glyphs = { ...ASCII_GLYPHS, hardRight: ["A", "B", "C"] };
    const segs = applyPowerline(
      [
        cell({ text: "1", bg: "red" }),
        cell({ text: "2", bg: "blue" }),
        cell({ text: "3", bg: "green" }),
        cell({ text: "4", bg: "yellow" }),
      ],
      { ...baseOpts, glyphs },
    );
    // 4 cells + 3 chevrons = 7 segments
    expect(segs).toHaveLength(7);
    expect(segs[1]?.text).toBe("A");
    expect(segs[3]?.text).toBe("B");
    expect(segs[5]?.text).toBe("C");
  });

  it("clamps hardRight glyph arrays — last entry repeats once exhausted", () => {
    const glyphs = { ...ASCII_GLYPHS, hardRight: ["A", "B"] };
    const segs = applyPowerline(
      [
        cell({ text: "1", bg: "red" }),
        cell({ text: "2", bg: "blue" }),
        cell({ text: "3", bg: "green" }),
        cell({ text: "4", bg: "yellow" }),
        cell({ text: "5", bg: "magenta" }),
      ],
      { ...baseOpts, glyphs },
    );
    // 5 cells + 4 chevrons; idx 0 → A, idx 1 → B, idx 2..3 → B (clamp)
    expect(segs[1]?.text).toBe("A");
    expect(segs[3]?.text).toBe("B");
    expect(segs[5]?.text).toBe("B");
    expect(segs[7]?.text).toBe("B");
  });

  it("string glyphs keep working unchanged when no array is configured", () => {
    const segs = applyPowerline([cell({ text: "a", bg: "red" }), cell({ text: "b", bg: "blue" })], {
      ...baseOpts,
      glyphs: { ...ASCII_GLYPHS, hardRight: "#" },
    });
    expect(segs[1]?.text).toBe("#");
  });

  it("emits caps when configured", () => {
    const segs = applyPowerline([cell({ text: "a", bg: "red" })], {
      ...baseOpts,
      capStart: "[",
      capEnd: "]",
    });
    expect(segs[0]?.text).toBe("[");
    expect(segs[0]?.bg).toBe("red");
    expect(segs[segs.length - 1]?.text).toBe("]");
    expect(segs[segs.length - 1]?.fg).toBe("red");
  });

  it("falls back to bg-section role when cell.bg is missing", () => {
    const segs = applyPowerline([cell({ text: "x" })], baseOpts);
    expect(segs[0]?.bg).toBe(DEFAULT_PALETTE["bg-section"]);
  });

  it("merge-no-padding suppresses left padding", () => {
    const segs = applyPowerline(
      [cell({ text: "x", bg: "red", merged: "merge-no-padding" })],
      baseOpts,
    );
    expect(segs[0]?.text).toBe("x ");
  });
});

describe("applyPowerlineLines", () => {
  const opts = {
    glyphs: ASCII_GLYPHS,
    theme: null,
    autoAlign: false,
    continueColors: false,
  };

  it("renders multi-line independently when autoAlign / continueColors are off", () => {
    const lines = applyPowerlineLines(
      [[cell({ text: "abc", bg: "red" })], [cell({ text: "z", bg: "blue" })]],
      opts,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]?.[0]?.text).toBe(" abc ");
    expect(lines[1]?.[0]?.text).toBe(" z ");
  });

  it("autoAlign pads shorter lines on the right with the line's last bg", () => {
    const lines = applyPowerlineLines(
      [[cell({ text: "abc", bg: "red" })], [cell({ text: "z", bg: "blue" })]],
      { ...opts, autoAlign: true },
    );
    const line2 = lines[1];
    if (!line2) throw new Error("expected line 2");
    const tail = line2[line2.length - 1];
    expect(tail?.bg).toBe("blue");
    expect(tail?.text.length).toBeGreaterThan(0);
    // Total widths should match
    const w0 = lines[0]?.reduce((n, s) => n + s.text.length, 0) ?? 0;
    const w1 = line2.reduce((n, s) => n + s.text.length, 0);
    expect(w0).toBe(w1);
  });

  it("cycles caps.start across lines (3 entries, 3 lines)", () => {
    const lines = applyPowerlineLines(
      [
        [cell({ text: "a", bg: "red" })],
        [cell({ text: "b", bg: "red" })],
        [cell({ text: "c", bg: "red" })],
      ],
      { ...opts, capStart: ["[", "<", "{"] },
    );
    expect(lines[0]?.[0]?.text).toBe("[");
    expect(lines[1]?.[0]?.text).toBe("<");
    expect(lines[2]?.[0]?.text).toBe("{");
  });

  it("cycles caps.start across more lines than entries (4 lines, 2 entries)", () => {
    const lines = applyPowerlineLines(
      [
        [cell({ text: "a", bg: "red" })],
        [cell({ text: "b", bg: "red" })],
        [cell({ text: "c", bg: "red" })],
        [cell({ text: "d", bg: "red" })],
      ],
      { ...opts, capStart: ["A", "B"] },
    );
    expect(lines[0]?.[0]?.text).toBe("A");
    expect(lines[1]?.[0]?.text).toBe("B");
    expect(lines[2]?.[0]?.text).toBe("A");
    expect(lines[3]?.[0]?.text).toBe("B");
  });

  it("cycles caps.end the same way as caps.start", () => {
    const lines = applyPowerlineLines(
      [[cell({ text: "a", bg: "red" })], [cell({ text: "b", bg: "red" })]],
      { ...opts, capEnd: ["X", "Y"] },
    );
    const tail0 = lines[0]?.at(-1);
    const tail1 = lines[1]?.at(-1);
    expect(tail0?.text).toBe("X");
    expect(tail1?.text).toBe("Y");
  });

  it("single-string caps still work with multi-line input (regression)", () => {
    const lines = applyPowerlineLines(
      [[cell({ text: "a", bg: "red" })], [cell({ text: "b", bg: "red" })]],
      { ...opts, capStart: "[", capEnd: "]" },
    );
    expect(lines[0]?.[0]?.text).toBe("[");
    expect(lines[1]?.[0]?.text).toBe("[");
    expect(lines[0]?.at(-1)?.text).toBe("]");
    expect(lines[1]?.at(-1)?.text).toBe("]");
  });

  it("continueColors threads next line's first bg into the prior end-cap", () => {
    const lines = applyPowerlineLines(
      [[cell({ text: "a", bg: "red" })], [cell({ text: "b", bg: "blue" })]],
      { ...opts, continueColors: true, capEnd: ">" },
    );
    const line0 = lines[0];
    if (!line0) throw new Error("expected line 0");
    const cap = line0[line0.length - 1];
    expect(cap?.text).toBe(">");
    expect(cap?.fg).toBe("red");
    expect(cap?.bg).toBe("blue");
  });
});
