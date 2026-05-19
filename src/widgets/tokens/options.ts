/**
 * Shared option parsing for token widgets. Every reset-axis
 * widget declares `options.reset` (§7.3); a missing or unrecognised
 * value falls back to `session` so the renderer can never crash on a
 * typo. The directional glyphs used by the merged `tokens` /
 * `token-speed` widgets are resolved here too so both stay in sync.
 */

import type { ResetAxis } from "../../data/tokens/index.js";

const VALID_AXES: ReadonlySet<ResetAxis> = new Set<ResetAxis>([
  "session",
  "block",
  "day",
  "week",
  "model",
  "effort",
]);

export function resolveResetAxis(value: unknown): ResetAxis {
  if (typeof value !== "string") return "session";
  return VALID_AXES.has(value as ResetAxis) ? (value as ResetAxis) : "session";
}

/** Input flows in (↓), output flows out (↑). Mirrors `git-ahead-behind`. */
export const DEFAULT_INPUT_GLYPH = "↓";
export const DEFAULT_OUTPUT_GLYPH = "↑";

export interface DirectionGlyphOptions {
  readonly inputGlyph?: string;
  readonly outputGlyph?: string;
}

/** Resolve the input/output glyph pair, falling back to the defaults. */
export function resolveGlyphs(options: DirectionGlyphOptions): {
  readonly inGlyph: string;
  readonly outGlyph: string;
} {
  return {
    inGlyph: options.inputGlyph ?? DEFAULT_INPUT_GLYPH,
    outGlyph: options.outputGlyph ?? DEFAULT_OUTPUT_GLYPH,
  };
}
