import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../theme/index.js";
import type { Cell } from "../widgets/cell.js";

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
