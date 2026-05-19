/**
 * Family identity — the single source of truth for what a widget family
 * *looks like*: its inline glyph (with an ASCII degradation) and its
 * accent colour. Every surface that paints a family — the picker, the
 * search list, the editor preview, the editor's placed-widget rows, and
 * the live statusline — resolves through this one map so a widget reads
 * the same everywhere it appears.
 *
 * Render-safe by construction: imports are type-only except the
 * `unicodeCapable` helper in `src/lib/`. Nothing here reaches into
 * `src/tui/`, so the render path can consume it without dragging Ink in
 * (§1.2 N3 / gate-19).
 */

import { unicodeCapable, type UnicodeEnvOptions } from "../lib/unicode-env.js";
import type { Colour } from "../theme/colours.js";
import type { WidgetFamily } from "./catalog/types.js";

export interface FamilyIdentity {
  /** Inline glyph shown next to a widget of this family (Unicode). */
  readonly glyph: string;
  /** ASCII stand-in used when the host can't render Unicode cleanly. */
  readonly glyphAscii: string;
  /** Accent colour for the family. Ink 8-colour names degrade cleanly. */
  readonly colour: Colour;
}

/**
 * Built-in defaults. Glyphs are thin single-cell marks (the `context`
 * entry is `◰`, not the old `▤` which rendered as a solid tofu block on
 * common terminal fonts). Colours are the family accents the picker,
 * preview and live render all paint a family's widgets with.
 */
export const DEFAULT_FAMILY_IDENTITY: Readonly<Record<WidgetFamily, FamilyIdentity>> =
  Object.freeze({
    session: Object.freeze({ glyph: "⌂", glyphAscii: "[s]", colour: "blue" }),
    tokens: Object.freeze({ glyph: "◇", glyphAscii: "[t]", colour: "yellow" }),
    context: Object.freeze({ glyph: "◰", glyphAscii: "[c]", colour: "magenta" }),
    "rate-limits": Object.freeze({ glyph: "◔", glyphAscii: "[r]", colour: "red" }),
    git: Object.freeze({ glyph: "⎇", glyphAscii: "[g]", colour: "green" }),
  }) as Readonly<Record<WidgetFamily, FamilyIdentity>>;

/** A family's identity with the glyph already degraded for the host. */
export interface ResolvedFamilyIdentity {
  readonly glyph: string;
  readonly colour: Colour;
}

/**
 * Resolve a family's glyph + colour. `override` is the per-family
 * `config.families` patch (any subset of glyph / glyphAscii / colour)
 * layered over the built-in defaults; the resulting glyph is then
 * degraded to its ASCII stand-in when the host isn't Unicode-capable.
 */
export function resolveFamilyIdentity(
  family: WidgetFamily,
  opts: UnicodeEnvOptions = {},
  override?: Partial<FamilyIdentity>,
): ResolvedFamilyIdentity {
  const base = DEFAULT_FAMILY_IDENTITY[family];
  const glyph = override?.glyph ?? base.glyph;
  const glyphAscii = override?.glyphAscii ?? base.glyphAscii;
  const colour = override?.colour ?? base.colour;
  return { glyph: unicodeCapable(opts) ? glyph : glyphAscii, colour };
}
