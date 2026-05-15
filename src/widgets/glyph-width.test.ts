/**
 * Guard the Nerd-Font glyph entries so they stay renderable in
 * standard monospace terminals (Phase 2 item 11).
 *
 * `agentline` does not bundle a wcwidth implementation; the runtime
 * pre-pends a glyph and trusts the terminal to render the cell at
 * whichever width the font reports. The test enforces the simpler
 * invariants we *can* check from source: every glyph is a single
 * codepoint and lives inside the Unicode Private Use Area (Nerd-Font
 * v3 ships exclusively in the BMP PUA `U+E000..U+F8FF` and the
 * Supplementary PUA-A range `U+F0000..U+FFFFD`).
 *
 * Catching a stray emoji sequence or a width-0 zero-joiner here is
 * cheaper than chasing a rendering bug back from a screenshot.
 */

import { describe, it, expect } from "vitest";

import { WIDGET_CATALOG } from "./catalog.js";

const BMP_PUA_START = 0xe000;
const BMP_PUA_END = 0xf8ff;
const SUPP_PUA_A_START = 0xf0000;
const SUPP_PUA_A_END = 0xffffd;

function inPua(codepoint: number): boolean {
  return (
    (codepoint >= BMP_PUA_START && codepoint <= BMP_PUA_END) ||
    (codepoint >= SUPP_PUA_A_START && codepoint <= SUPP_PUA_A_END)
  );
}

describe("catalogue glyphs", () => {
  it("are each exactly one codepoint", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      if (!meta.glyph) continue;
      /*
       * Spread iterates by codepoint so multi-codepoint emoji sequences
       * (e.g. ZWJ joins, variation selectors) raise the length above 1.
       */
      expect([...meta.glyph], `${type} glyph must be one codepoint`).toHaveLength(1);
    }
  });

  it("live inside the Nerd Font PUA ranges", () => {
    for (const [type, meta] of Object.entries(WIDGET_CATALOG)) {
      if (!meta.glyph) continue;
      const cp = meta.glyph.codePointAt(0);
      expect(cp, `${type} glyph codepoint`).toBeDefined();
      expect(
        inPua(cp as number),
        `${type} glyph U+${(cp as number).toString(16).padStart(4, "0").toUpperCase()} must sit in the Nerd Font PUA`,
      ).toBe(true);
    }
  });
});
