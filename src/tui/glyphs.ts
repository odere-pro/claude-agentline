/**
 * Editor-chrome glyphs: small visual flourishes used only inside the
 * `agentline config` TUI (the selection brackets, the active-row marker,
 * the "+ add widget" cell, the gutter, family icons in the picker).
 *
 * Statusline-widget glyphs (Nerd Font icons on the rendered statusline)
 * are a separate concern — see the opt-in `config.glyphs` layer.
 *
 * Pure data + a selector. Lives under `src/tui/` so it never enters
 * `dist/cli.mjs` (§1.2 N3).
 */

import type { WidgetFamily } from "../widgets/catalog.js";

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
  /** Family icons shown in the group picker (Phase 3 wires this in). */
  readonly family: Readonly<Record<WidgetFamily, string>>;
}

const UNICODE: EditorGlyphs = Object.freeze({
  selectionOpen: "‹",
  selectionClose: "›",
  activeRow: "▸",
  gutter: "│",
  addCell: "＋ add widget",
  family: Object.freeze({
    session: "⌂",
    tokens: "◇",
    context: "▤",
    "rate-limits": "◔",
    git: "⎇",
    time: "◷",
    custom: "⚙",
  }) as Readonly<Record<WidgetFamily, string>>,
});

const ASCII: EditorGlyphs = Object.freeze({
  selectionOpen: "[",
  selectionClose: "]",
  activeRow: ">",
  gutter: "|",
  addCell: "+ add widget",
  family: Object.freeze({
    session: "[s]",
    tokens: "[t]",
    context: "[c]",
    "rate-limits": "[r]",
    git: "[g]",
    time: "[T]",
    custom: "[x]",
  }) as Readonly<Record<WidgetFamily, string>>,
});

export interface GlyphPickOptions {
  /** Override; primarily for tests. */
  readonly unicode?: boolean;
  /** Env to inspect; defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Pick the glyph set. Defaults to Unicode; degrades to ASCII when
 * `NO_UNICODE` is set or the locale doesn't look Unicode-capable. The
 * editor honours the same hints the render path does so a host that
 * can't render Unicode boxes / glyphs cleanly stays legible.
 */
export function pickGlyphs(opts: GlyphPickOptions = {}): EditorGlyphs {
  if (opts.unicode === true) return UNICODE;
  if (opts.unicode === false) return ASCII;
  const env = opts.env ?? process.env;
  if (env.NO_UNICODE === "1" || env.AGENTLINE_GLYPHS === "ascii") return ASCII;
  // Heuristic: most macOS/Linux terminals support Unicode by default; only
  // back off when LANG/LC_ALL clearly aren't UTF.
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? "";
  if (locale && !/utf-?8/i.test(locale)) return ASCII;
  return UNICODE;
}
