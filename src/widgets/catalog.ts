/**
 * Widget catalogue — human-readable metadata for every built-in widget.
 *
 * The render-path contract (`WidgetDef = { type, render }`) stays minimal:
 * the renderer never needs a widget's display name. Metadata lives here, in
 * one auditable place, keyed by the same `type` string the registry uses.
 * `family` mirrors the source-tree family (`src/widgets/<family>/`).
 *
 * The catalogue is split across `src/widgets/catalog/<family>.ts` files
 * (one per `WIDGET_FAMILIES` entry); this module composes them into
 * `WIDGET_CATALOG`, layers in the optional `WIDGET_GLYPHS` table, and
 * exports the lookup helpers. Types and the small `entry` / `v` builders
 * live in `./catalog/types.ts` so each family file can pull from one
 * place without a circular dependency on the composition root.
 *
 * Invariants (enforced by `catalog.test.ts`):
 *   - every built-in registered type has exactly one entry here;
 *   - no entry names a type that is not a built-in;
 *   - every `description` is non-empty and ≤ 80 characters;
 *   - every `family` is one of `WIDGET_FAMILIES`.
 */

import { CONTEXT_CATALOG } from "./catalog/context.js";
import { CUSTOM_CATALOG } from "./catalog/custom.js";
import { GIT_CATALOG } from "./catalog/git.js";
import { RATE_LIMITS_CATALOG } from "./catalog/rate-limits.js";
import { SESSION_CATALOG } from "./catalog/session.js";
import { TIME_CATALOG } from "./catalog/time.js";
import { TOKENS_CATALOG } from "./catalog/tokens.js";
import type { WidgetMeta, WidgetVariant } from "./catalog/types.js";

export {
  FAMILY_COLOR,
  WIDGET_FAMILIES,
  type WidgetFamily,
  type WidgetMeta,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "./catalog/types.js";

/**
 * Glyph mode codepoints, kept in a separate table so the family files
 * stay scannable. Codepoints are Nerd Font v3 PUA — they only render
 * correctly in a terminal whose font ships those ranges (which is exactly
 * why `config.glyphs` defaults to `"off"`). Add entries opportunistically;
 * widgets without a glyph here are unaffected by the mode toggle.
 */
const WIDGET_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  // Session
  model: "", // nf-md-robot
  "account-email": "", // nf-fa-envelope
  skills: "", // nf-fa-puzzle_piece
  "thinking-effort": "", // nf-fa-bolt
  "session-name": "", // nf-fa-user

  // Tokens
  "tokens-total": "", // nf-fa-calculator
  "tokens-input": "", // nf-fa-arrow_down
  "tokens-output": "", // nf-fa-arrow_up
  "tokens-cached": "", // nf-md-database
  "input-speed": "", // nf-fa-rocket
  "output-speed": "",
  "total-speed": "",

  // Context
  "context-length": "", // nf-fa-tasks
  "context-percentage": "", // nf-fa-tachometer
  "context-percentage-usable": "",
  "context-bar": "", // nf-fa-bar_chart

  // Rate limits
  "session-usage": "", // nf-fa-percent
  "block-reset-timer": "", // nf-fa-refresh
  "block-reset-at": "",
  "weekly-reset-timer": "",
  "weekly-reset-at": "",

  // Git
  "git-branch": "", // nf-pl-branch
  "git-sha": "", // nf-oct-git_commit
  "git-worktree": "", // nf-fa-folder
  "git-changes": "", // nf-md-pencil
  "git-staged": "", // nf-fa-plus
  "git-unstaged": "",
  "git-untracked": "", // nf-fa-question
  "git-conflicts": "", // nf-fa-warning
  "git-ahead-behind": "", // nf-fa-arrows_h
  "git-upstream": "",
  "git-origin-repo": "",
  "git-pr": "", // nf-oct-git_pull_request

  // Time
  clock: "",
  "uptime-session": "", // nf-fa-hourglass_half
  "uptime-block": "",
});

const BASE_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  ...SESSION_CATALOG,
  ...TOKENS_CATALOG,
  ...CONTEXT_CATALOG,
  ...RATE_LIMITS_CATALOG,
  ...GIT_CATALOG,
  ...TIME_CATALOG,
  ...CUSTOM_CATALOG,
});

function applyGlyphs(
  base: Readonly<Record<string, WidgetMeta>>,
  glyphs: Readonly<Record<string, string>>,
): Readonly<Record<string, WidgetMeta>> {
  const out: Record<string, WidgetMeta> = {};
  for (const [type, meta] of Object.entries(base)) {
    const glyph = glyphs[type];
    out[type] = glyph ? Object.freeze({ ...meta, glyph }) : meta;
  }
  return Object.freeze(out);
}

/** Canonical metadata for every built-in widget, keyed by `type`. */
export const WIDGET_CATALOG: Readonly<Record<string, WidgetMeta>> = applyGlyphs(
  BASE_CATALOG,
  WIDGET_GLYPHS,
);

/** Look up a widget's metadata by `type`. */
export function widgetMeta(type: string): WidgetMeta | undefined {
  return WIDGET_CATALOG[type];
}

/** Catalogue glyph for `type`, or `undefined` when none is registered. */
export function widgetGlyph(type: string): string | undefined {
  return WIDGET_CATALOG[type]?.glyph;
}

/** Variants for `type`, or an empty list when the widget has no variants. */
export function widgetVariants(type: string): readonly WidgetVariant[] {
  return WIDGET_CATALOG[type]?.variants ?? [];
}

/**
 * Best-guess "which variant am I currently on?" given the widget's `options`.
 * Match is by full-equality on every key the variant declares; partial matches
 * (variant declares `{display:"bar"}`, current options is
 * `{display:"bar", barWidth:8}`) still match. Returns `null` when no variant
 * fits — e.g. options has been hand-edited away from any catalogued shape.
 */
export function activeVariantId(
  type: string,
  options: Readonly<Record<string, unknown>> | undefined,
): string | null {
  const variants = widgetVariants(type);
  if (variants.length === 0) return null;
  const opts = options ?? {};
  for (const variant of variants) {
    let match = true;
    for (const [key, value] of Object.entries(variant.options)) {
      if ((opts as Record<string, unknown>)[key] !== value) {
        match = false;
        break;
      }
    }
    if (match) return variant.id;
  }
  return null;
}
