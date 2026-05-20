/**
 * Pure helpers and shared types for the four picker views (PickerGroup,
 * PickerWidget, PickerSearch, PickerVariant). The view components live in
 * sibling files and consume only these helpers — no UI state in here.
 *
 * `picker.ts` re-exports the public surface so existing imports
 * (`from "./picker.js"`) keep resolving.
 */

import { previewWidget } from "../preview/preview-fixture.js";
import { EN_DICTIONARY } from "../../core/i18n/index.js";
import {
  WIDGET_FAMILIES,
  widgetVariants,
  type WidgetFamily,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "../../widgets/families/catalog.js";
import type { AgentlineConfig } from "../../data/config/types.js";
import type { Colour } from "../../data/theme/colours/colours.js";
import type { Theme } from "../../data/theme/index.js";
import { createThemeFactory } from "../../widgets/families/family-factory.js";

/** How many rows the picker windows show at once. */
export const PICKER_PAGE = 8;

/**
 * The resolved render basis every picker view paints through — the same
 * `{ config, theme, env }` the live statusline (`renderFromInputs`) and
 * the editor preview (`previewWidget`) use. Optional so unit tests can
 * construct a view bare; each field falls back to the catalogue/default
 * the same way `previewWidget` does, keeping picker chrome and the live
 * render in lock-step.
 */
export interface PickerBasis {
  /** User's resolved config — drives family identity via `config.families`. */
  readonly config?: AgentlineConfig;
  /** Resolved theme — drives preview value colours. */
  readonly theme?: Theme | null;
  /** Resolved process env — drives family-glyph degradation. */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * A family's accent colour, resolved through the *same* path the live
 * statusline uses — the `ThemeFactory` funnel layered with the user's
 * `config.families` patch. With no override this is byte-identical to the
 * built-in default, so an unconfigured editor looks unchanged while a
 * customised one matches `agentline render` exactly.
 */
export function familyAccent(
  family: WidgetFamily,
  config: AgentlineConfig,
  env: NodeJS.ProcessEnv,
): Colour {
  return createThemeFactory({ env }, config.families).forFamily(family).colour;
}

/**
 * Families the registered widgets actually populate, in catalogue order.
 * `exclude` drops any widget already added to the editor so groups that
 * have no remaining widgets disappear from the group browser.
 */
export function familiesWithWidgets(
  entries: readonly WidgetMetaEntry[],
  exclude: ReadonlySet<string> = new Set(),
): readonly WidgetFamily[] {
  const present = new Set<WidgetFamily>(
    entries.filter((e) => !exclude.has(e.type)).map((e) => e.family),
  );
  return WIDGET_FAMILIES.filter((c) => present.has(c));
}

/**
 * All entries in `family`, filtered (case-insensitive) by initialism
 * or substring match against `type` and `name`, with any widget types
 * in `exclude` removed.
 */
export function widgetsInFamily(
  entries: readonly WidgetMetaEntry[],
  family: WidgetFamily,
  query: string,
  exclude: ReadonlySet<string> = new Set(),
): readonly WidgetMetaEntry[] {
  const q = query.trim().toLowerCase();
  const scoped = entries.filter((e) => e.family === family && !exclude.has(e.type));
  if (q === "") return scoped;
  return scoped.filter((e) => matches(e, q));
}

/**
 * Token-boundary characters used by `matchesInitialism`. Both display
 * names ("Git branch") and widget types ("git-branch", "tokens_total")
 * tokenise on whitespace, hyphen, and underscore.
 */
const INITIALISM_BOUNDARY = /[-\s_]+/;

/**
 * Initialism match — `gb` matches `git-branch`, `ts` matches
 * `token-speed`, `swu` matches `session-weekly-usage`. Single-letter queries
 * fall through to the substring path (matching every entry starting
 * with that letter would be surprising); we only kick in at length ≥ 2.
 *
 * The implementation is intentionally simple: split on token
 * boundaries, take the first letter of each non-empty token, then
 * check `startsWith` so prefix-matches still find a widget while you
 * are still typing (e.g. `g` after `gb` keeps `git-branch` selected
 * via the substring fallback in the caller). No fuzzy scoring — that
 * is a separate concern and out of scope here.
 */
function matchesInitialism(query: string, text: string): boolean {
  if (query.length < 2) return false;
  let initials = "";
  for (const token of text.split(INITIALISM_BOUNDARY)) {
    if (token.length === 0) continue;
    initials += token[0]!.toLowerCase();
  }
  return initials.startsWith(query);
}

/**
 * Initialism + substring filter over all entries — matches against the
 * widget's `type` and human `name`, optionally dropping entries whose
 * `type` is in `exclude` (used to hide already-added widgets from the
 * flat search).
 */
export function filterWidgets(
  entries: readonly WidgetMetaEntry[],
  query: string,
  exclude: ReadonlySet<string> = new Set(),
): readonly WidgetMetaEntry[] {
  const q = query.trim().toLowerCase();
  const scoped = exclude.size === 0 ? entries : entries.filter((e) => !exclude.has(e.type));
  if (q === "") return scoped;
  return scoped.filter((e) => matches(e, q));
}

function matches(entry: WidgetMetaEntry, q: string): boolean {
  const type = entry.type.toLowerCase();
  const name = entry.name.toLowerCase();
  return (
    matchesInitialism(q, type) || matchesInitialism(q, name) || type.includes(q) || name.includes(q)
  );
}

/** A row in the variant step — either the synthetic "default" entry, or a real variant. */
export interface VariantRow {
  /** `null` ⇒ commit without applying any options patch (the synthetic row). */
  readonly id: string | null;
  readonly label: string;
}

/**
 * Variant rows for `type`. Synthetic first entry:
 *   - mode `"update"`  → `"Keep current options"` (cancels the variant change).
 *   - mode `"fresh"`   → `"Default options"` (insert/replace without a patch).
 */
export function variantRows(type: string, mode: "update" | "fresh"): readonly VariantRow[] {
  const head: VariantRow =
    mode === "update"
      ? { id: null, label: EN_DICTIONARY["picker.variant.keep"] }
      : { id: null, label: EN_DICTIONARY["picker.variant.default"] };
  const tail: VariantRow[] = widgetVariants(type).map((v: WidgetVariant) => ({
    id: v.id,
    label: v.label,
  }));
  return [head, ...tail];
}

export function selectedAt<T>(rows: readonly T[], highlight: number): T | undefined {
  if (rows.length === 0) return undefined;
  return rows[clampIndex(highlight, rows.length)];
}

/**
 * Clamp `value` to the half-open range `[0, max(0, length - 1)]`. Returns
 * `0` for an empty list. Used both by `selectedAt` to pick the row under
 * the cursor and by `main.ts`'s picker key handlers to bound the next
 * highlight after an arrow-key move.
 */
export function clampIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  if (value < 0) return 0;
  if (value > length - 1) return length - 1;
  return value;
}

/**
 * Wrap `value` into `[0, length - 1]` (modular). Used by the picker key
 * handlers so ↑ past the top lands on the last row and ↓ past the bottom
 * lands on the first. Distinct from `clampIndex`, which the render
 * components keep using so a list that *shrinks* clamps the stored
 * highlight back into range instead of teleporting.
 */
export function wrapIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

export function windowSlice<T>(
  matches: readonly T[],
  highlight: number,
): { start: number; rows: readonly T[] } {
  if (matches.length <= PICKER_PAGE) return { start: 0, rows: matches };
  const half = Math.floor(PICKER_PAGE / 2);
  const maxStart = matches.length - PICKER_PAGE;
  const start = Math.max(0, Math.min(highlight - half, maxStart));
  return { start, rows: matches.slice(start, start + PICKER_PAGE) };
}

/**
 * Render a single variant's preview cell — shared by `PickerVariant` and
 * the variant-aware picker rows. `row.id === null` is the synthetic
 * "default/keep" row, which previews with no options patch.
 */
export function previewForVariant(
  widgetType: string,
  row: VariantRow,
  config: AgentlineConfig,
  theme: Theme | null,
  env: NodeJS.ProcessEnv,
): string {
  if (row.id === null) {
    return previewWidget(widgetType, undefined, { config, theme, env }).text || widgetType;
  }
  const variant = widgetVariants(widgetType).find((v) => v.id === row.id);
  const cell = previewWidget(widgetType, variant ? { ...variant.options } : undefined, {
    config,
    theme,
    env,
  });
  return cell.text || widgetType;
}
