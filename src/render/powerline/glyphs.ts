/**
 * Powerline glyph sets (§5.1).
 *
 * Two sets ship in the binary:
 *
 *   - `NERD_FONT_GLYPHS` — the canonical Nerd Font triangle / arrow
 *     pair ``–`` (hardRight, softRight, hardLeft, softLeft).
 *   - `ASCII_GLYPHS` — the deterministic fallback used when a Nerd
 *     Font is not present (`>` / `<`). Doctor (D05) emits a warning;
 *     the bin still renders.
 *
 * `resolveGlyphs(config, useAscii)` produces a final glyph set by
 * layering the user's `powerline.glyphs` overrides on top of either
 * the Nerd Font or the ASCII set. Caller decides which base set
 * applies (env detection lives in `detect.ts`).
 */

import type { PowerlineGlyphs } from "../../data/config/types.js";

/**
 * Each field is either a single glyph or an array of glyphs indexed by
 * chevron position (see `pickIndexed` in `./transform.ts` — clamp, not
 * cycle, so the last entry repeats once the array is exhausted).
 */
export interface PowerlineGlyphSet {
  readonly hardRight: string | readonly string[];
  readonly softRight: string | readonly string[];
  readonly hardLeft: string | readonly string[];
  readonly softLeft: string | readonly string[];
}

export const NERD_FONT_GLYPHS: PowerlineGlyphSet = Object.freeze({
  hardRight: "",
  softRight: "",
  hardLeft: "",
  softLeft: "",
});

export const ASCII_GLYPHS: PowerlineGlyphSet = Object.freeze({
  hardRight: ">",
  softRight: ">",
  hardLeft: "<",
  softLeft: "<",
});

export function resolveGlyphs(
  overrides: PowerlineGlyphs | undefined,
  useAscii: boolean,
): PowerlineGlyphSet {
  const base = useAscii ? ASCII_GLYPHS : NERD_FONT_GLYPHS;
  if (!overrides) return base;
  return Object.freeze({
    hardRight: overrides.hardRight ?? base.hardRight,
    softRight: overrides.softRight ?? base.softRight,
    hardLeft: overrides.hardLeft ?? base.hardLeft,
    softLeft: overrides.softLeft ?? base.softLeft,
  });
}
