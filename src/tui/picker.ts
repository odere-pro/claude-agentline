/**
 * Widget picker overlay — four views, one per picker mode in the reducer:
 *
 *   `picker-group`   → `PickerGroup`   — browse widget families ("session",
 *                      "git", …) with per-family counts; the default
 *                      view when the picker opens. `/` switches to the
 *                      flat search view.
 *   `picker-widget`  → `PickerWidget`  — after selecting a family,
 *                      the in-family widget list with a live filter and
 *                      per-row mini-preview.
 *   `picker-search`  → `PickerSearch`  — flat, searchable list across
 *                      every catalogued widget; each row carries a family
 *                      badge. Already-placed widgets are hidden via
 *                      `exclude` in every view.
 *   `picker-variant` → `PickerVariant` — pick a variant for widgets that
 *                      have them; skipped otherwise.
 *
 * Each component is a thin Ink projection over pure helpers; `App` owns the
 * per-step query / highlight transient state and all key handling. Imported
 * only from the lazily-loaded TUI bundle (§1.2 N3).
 */

import { Box, Text } from "ink";
import React from "react";

import { previewWidget } from "./preview-fixture.js";
import {
  identityTranslator,
  widgetDescId,
  widgetVariantId,
  type Translator,
} from "../i18n/index.js";
import {
  WIDGET_FAMILIES,
  widgetMeta,
  widgetVariants,
  type WidgetFamily,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "../widgets/catalog.js";
import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { AgentlineConfig } from "../config/types.js";
import type { Colour } from "../theme/colours.js";
import type { Theme } from "../theme/index.js";
import { resolveFamilyIdentity } from "../widgets/family-identity.js";

import type { EditorGlyphs } from "./glyphs.js";

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
 * statusline uses — `resolveFamilyIdentity` layered with the user's
 * `config.families` patch. With no override this is byte-identical to the
 * built-in default, so an unconfigured editor looks unchanged while a
 * customised one matches `agentline render` exactly.
 */
function familyAccent(
  family: WidgetFamily,
  config: AgentlineConfig,
  env: NodeJS.ProcessEnv,
): Colour {
  return resolveFamilyIdentity(family, { env }, config.families?.[family]).colour;
}

// ────────────────────────────────────────────────────────────────────────────
// pure helpers — every step's "what would Enter commit?" answer
// ────────────────────────────────────────────────────────────────────────────

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
      ? { id: null, label: "Keep current options" }
      : { id: null, label: "Default options" };
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

function windowSlice<T>(
  matches: readonly T[],
  highlight: number,
): { start: number; rows: readonly T[] } {
  if (matches.length <= PICKER_PAGE) return { start: 0, rows: matches };
  const half = Math.floor(PICKER_PAGE / 2);
  const maxStart = matches.length - PICKER_PAGE;
  const start = Math.max(0, Math.min(highlight - half, maxStart));
  return { start, rows: matches.slice(start, start + PICKER_PAGE) };
}

// ────────────────────────────────────────────────────────────────────────────
// step 1a — pick a family (default view)
// ────────────────────────────────────────────────────────────────────────────

export interface PickerGroupProps extends PickerBasis {
  readonly title?: string;
  readonly entries: readonly WidgetMetaEntry[];
  readonly highlight: number;
  readonly glyphs: EditorGlyphs;
  /** Widget types already placed elsewhere — they don't count toward
   *  per-group totals and groups that become empty are hidden. */
  readonly exclude?: ReadonlySet<string>;
  readonly t?: Translator;
}

export function PickerGroup(props: PickerGroupProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const config = props.config ?? DEFAULT_CONFIG;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const cats = familiesWithWidgets(props.entries, exclude);
  const highlight = clampIndex(props.highlight, cats.length);
  const widestName = cats.reduce((n, c) => Math.max(n, c.length), 0);
  const counts = cats.map(
    (cat) => props.entries.filter((e) => e.family === cat && !exclude.has(e.type)).length,
  );
  const widestCount = counts.reduce((n, c) => Math.max(n, String(c).length), 1);
  /*
   * Box-per-column layout: family icons differ in terminal cell-width
   * (some fonts render `⚙` as two cells, others as one), and counts vary
   * between one and two digits. Painting each column into its own
   * `Box` with an explicit `width` lets Yoga handle the cell math so
   * the name and count columns line up regardless of glyph or count
   * width.
   */
  const MARKER_WIDTH = 2;
  const ICON_WIDTH = 3;
  const COLUMN_GAP = 2;
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Text,
      { bold: true },
      props.title ?? t("picker.group.title", "Pick a group"),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      t("picker.group.hint", "{n} group{s} · ↑↓ navigate · ↵ select · / search · Esc cancel", {
        n: cats.length,
        s: cats.length === 1 ? "" : "s",
      }),
    ),
    ...cats.map((cat, idx) => {
      const selected = idx === highlight;
      const count = counts[idx] ?? 0;
      const icon = props.glyphs.family[cat] ?? " ";
      const accent = familyAccent(cat, config, env);
      return React.createElement(
        Box,
        { key: cat, flexDirection: "row" },
        React.createElement(
          Box,
          { width: MARKER_WIDTH, flexShrink: 0 },
          React.createElement(Text, { color: accent, bold: selected }, selected ? "▸ " : "  "),
        ),
        React.createElement(
          Box,
          { width: ICON_WIDTH, flexShrink: 0 },
          React.createElement(Text, { color: accent }, icon),
        ),
        React.createElement(
          Box,
          { width: widestName + COLUMN_GAP, flexShrink: 0 },
          React.createElement(
            Text,
            { color: accent, bold: selected },
            t(`family.${cat}.name`, cat),
          ),
        ),
        React.createElement(
          Box,
          { width: widestCount, flexShrink: 0, justifyContent: "flex-end" },
          React.createElement(Text, { dimColor: true }, String(count)),
        ),
        React.createElement(
          Text,
          { dimColor: true },
          t("picker.group.widgets-suffix", " widget{s}", { s: count === 1 ? "" : "s" }),
        ),
      );
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// step 1b — pick a widget within the chosen family
// ────────────────────────────────────────────────────────────────────────────

export interface PickerWidgetProps extends PickerBasis {
  readonly family: WidgetFamily;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
  readonly t?: Translator;
}

export function PickerWidget(props: PickerWidgetProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const matches = widgetsInFamily(props.entries, props.family, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  /*
   * Pad preview text so descriptions line up in their own column. Capture
   * `fg` from the cell so self-hiding widgets still render with their family
   * accent colour (via the glyph-prefixed label the fixture now returns).
   */
  const previews = rows.map((e) => {
    const cell = previewWidget(e.type, undefined, { config, theme, env });
    return { text: cell.text || e.type, fg: cell.fg };
  });
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.text.length), 0);
  const countLabel = t("picker.match-count", "{n} match{es}", {
    n: matches.length,
    es: matches.length === 1 ? "" : "es",
  });
  const accent = familyAccent(props.family, config, env);

  const body =
    matches.length === 0
      ? [
          React.createElement(
            Text,
            { key: "none", dimColor: true },
            t("picker.no-match", "  (no widgets match)"),
          ),
        ]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? { text: "", fg: undefined };
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          return React.createElement(
            Box,
            { key: e.type, flexDirection: "row" },
            React.createElement(Text, { color: accent, bold: selected }, head),
            React.createElement(
              Text,
              { color: preview.fg },
              `  ${preview.text.padEnd(widestPreview, " ")}`,
            ),
            React.createElement(
              Text,
              { dimColor: true },
              `  ${t(widgetDescId(e.type), e.description)}`,
            ),
          );
        });

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Text,
      { bold: true },
      t("picker.widget.title", "Pick a widget — group "),
      React.createElement(Text, { color: accent, bold: true }, `‹${props.family}›`),
    ),
    React.createElement(Text, null, `${t("picker.filter", "filter")}: ${props.query}▏`),
    React.createElement(
      Text,
      { dimColor: true },
      t("picker.widget.hint", "{c} · type to filter · ↑↓ navigate · ↵ select · Esc back", {
        c: countLabel,
      }),
    ),
    ...body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// step 1c — flat search across every catalogued widget (entered via `/`)
// ────────────────────────────────────────────────────────────────────────────

export interface PickerSearchProps extends PickerBasis {
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
  readonly t?: Translator;
}

export function PickerSearch(props: PickerSearchProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const matches = filterWidgets(props.entries, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  const previews = rows.map((e) => {
    const cell = previewWidget(e.type, undefined, { config, theme, env });
    return { text: cell.text || e.type, fg: cell.fg };
  });
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.text.length), 0);
  const querying = props.query.length > 0;
  const countLabel = querying
    ? t("picker.match-count", "{n} match{es}", {
        n: matches.length,
        es: matches.length === 1 ? "" : "es",
      })
    : t("picker.widget-count", "{n} widget{s}", {
        n: matches.length,
        s: matches.length === 1 ? "" : "s",
      });
  const footerHint = querying
    ? t("picker.search.hint-querying", "{c} · ⌫ clear · ↑↓ navigate · ↵ select · Esc back", {
        c: countLabel,
      })
    : t("picker.search.hint", "{c} · type to filter · ↑↓ navigate · ↵ select · Esc back", {
        c: countLabel,
      });

  const allExcluded = exclude.size > 0 && exclude.size >= props.entries.length;
  const emptyMessage =
    !querying && allExcluded
      ? t("picker.all-placed", "  (every widget is already placed)")
      : t("picker.no-match", "  (no widgets match)");

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, emptyMessage)]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? { text: "", fg: undefined };
          const accent = familyAccent(e.family, config, env);
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          return React.createElement(
            Box,
            { key: e.type, flexDirection: "row" },
            React.createElement(Text, { color: accent, bold: selected }, head),
            React.createElement(
              Text,
              { color: preview.fg },
              `  ${preview.text.padEnd(widestPreview, " ")}`,
            ),
            React.createElement(
              Text,
              { dimColor: true },
              `  ${t(widgetDescId(e.type), e.description)}`,
            ),
          );
        });

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(Text, { bold: true }, t("picker.search.title", "Pick a widget")),
    React.createElement(Text, null, `${t("picker.search", "search")}: ${props.query}▏`),
    React.createElement(Text, { dimColor: true }, footerHint),
    ...body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// final step — pick a variant
// ────────────────────────────────────────────────────────────────────────────

export interface PickerVariantProps extends PickerBasis {
  readonly widgetType: string;
  /** `"update"` shows "Keep current"; `"fresh"` (insert/replace) shows "Default options". */
  readonly mode: "update" | "fresh";
  readonly highlight: number;
  readonly t?: Translator;
}

export function PickerVariant(props: PickerVariantProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const rows = variantRows(props.widgetType, props.mode);
  const highlight = clampIndex(props.highlight, rows.length);
  const syntheticId = props.mode === "update" ? "picker.variant.keep" : "picker.variant.default";
  const rowLabel = (row: VariantRow): string =>
    row.id === null
      ? t(syntheticId, row.label)
      : t(widgetVariantId(props.widgetType, row.id), row.label);
  const widest = rows.reduce((n, r) => Math.max(n, rowLabel(r).length), 0);
  const meta = widgetMeta(props.widgetType);
  const accent = meta ? familyAccent(meta.family, config, env) : undefined;
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Text,
      { bold: true },
      t("picker.variant.title", "Pick a variant — ‹{type}›", { type: props.widgetType }),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      t("picker.variant.hint", "↑↓ navigate · ↵ select · Esc back"),
    ),
    ...rows.map((row, idx) => {
      const selected = idx === highlight;
      const preview = previewForVariant(props.widgetType, row, config, theme, env);
      return React.createElement(
        Box,
        { key: row.id ?? "__default__", flexDirection: "row" },
        React.createElement(
          Text,
          { color: accent, bold: selected },
          `  ${selected ? "▸ " : "  "}${rowLabel(row).padEnd(widest, " ")}  `,
        ),
        React.createElement(Text, { color: accent, bold: selected }, preview),
      );
    }),
  );
}

function previewForVariant(
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
