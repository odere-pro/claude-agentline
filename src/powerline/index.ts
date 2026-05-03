/**
 * Powerline module entry point (§5.1).
 *
 *   - `applyPowerline` turns a single line of widget cells into a
 *     flat segment list with chevrons + adjoining colours.
 *   - `applyPowerlineLines` adds the multi-line concerns: autoAlign
 *     and continueColors.
 *   - `resolveGlyphs` produces the active glyph set from the user's
 *     `powerline.glyphs` overrides + the host glyph-support level.
 *   - `detectGlyphSupport` reads the env to choose Nerd-Font vs
 *     ASCII glyphs at render time.
 *
 * The render-path entry point is filesystem- and network-free.
 */

export {
  applyPowerline,
  applyPowerlineLines,
  type PowerlineTransformOptions,
} from "./transform.js";
export {
  ASCII_GLYPHS,
  NERD_FONT_GLYPHS,
  resolveGlyphs,
  type PowerlineGlyphSet,
} from "./glyphs.js";
export { detectGlyphSupport, type GlyphSupport } from "./detect.js";
