/**
 * Editor-chrome glyphs: the selection brackets, active-row marker,
 * "+ add widget" cell and gutter — decorative editor UI that never
 * reaches the rendered statusline. The per-family icons are *not* local
 * data: they are projected from the single family-identity source of
 * truth (`src/widgets/family-identity.ts`) so the picker shows exactly
 * the glyph the widget carries everywhere else.
 *
 * Pure data + a selector. Lives under `src/tui/` so it never enters
 * `dist/cli.mjs` (§1.2 N3).
 */

import { unicodeCapable } from "../lib/unicode-env.js";
import { DEFAULT_FAMILY_IDENTITY } from "../widgets/family-identity.js";
import type { WidgetFamily } from "../widgets/catalog.js";

const familyGlyphs = (key: "glyph" | "glyphAscii"): Readonly<Record<WidgetFamily, string>> =>
  Object.freeze(
    Object.fromEntries(
      (Object.keys(DEFAULT_FAMILY_IDENTITY) as WidgetFamily[]).map((family) => [
        family,
        DEFAULT_FAMILY_IDENTITY[family][key],
      ]),
    ) as Record<WidgetFamily, string>,
  );

export interface EditorGlyphs {
  /** Wraps the selected widget in the preview. */
  readonly selectionOpen: string;
  readonly selectionClose: string;
  /** Marks the active row in the gutter. */
  readonly activeRow: string;
  /** Right-aligned vertical bar in each row's left gutter. */
  readonly gutter: string;
  /** Body of the "+ add widget" cell. */
  readonly addCell: string;
  /** Family icons shown in the group picker (from family-identity). */
  readonly family: Readonly<Record<WidgetFamily, string>>;
}

const UNICODE: EditorGlyphs = Object.freeze({
  selectionOpen: "‹",
  selectionClose: "›",
  activeRow: "▸",
  gutter: "│",
  addCell: "＋ add widget",
  family: familyGlyphs("glyph"),
});

const ASCII: EditorGlyphs = Object.freeze({
  selectionOpen: "[",
  selectionClose: "]",
  activeRow: ">",
  gutter: "|",
  addCell: "+ add widget",
  family: familyGlyphs("glyphAscii"),
});

export interface GlyphPickOptions {
  /** Override; primarily for tests. */
  readonly unicode?: boolean;
  /** Env to inspect; defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Pick the glyph set. Defaults to Unicode; degrades to ASCII when the
 * host doesn't look Unicode-capable. The editor honours the same
 * `unicodeCapable` heuristic the render path does so a host that can't
 * render Unicode boxes / glyphs cleanly stays legible on both surfaces.
 */
export function pickGlyphs(opts: GlyphPickOptions = {}): EditorGlyphs {
  return unicodeCapable(opts) ? UNICODE : ASCII;
}
