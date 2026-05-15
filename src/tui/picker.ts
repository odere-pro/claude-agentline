/**
 * Widget picker overlay — three steps. Shown while the reducer's mode is
 * `picker-group`, `picker-widget`, or `picker-variant`:
 *
 *   step 1 — empty search → `PickerGroup` (pick a family).
 *            non-empty   → `PickerSearch` (flat list across every family,
 *                          substring-filtered by the search field on top).
 *   step 2 (`PickerWidget`)  — pick a widget in that family (live filter).
 *   step 3 (`PickerVariant`) — pick a variant for widgets that have them.
 *
 * Each component is a thin Ink projection over pure helpers; `App` owns the
 * per-step query / highlight transient state and all key handling. Imported
 * only from the lazily-loaded TUI bundle (§1.2 N3).
 */

import { Box, Text } from "ink";
import React from "react";

import { previewWidget } from "./preview-fixture.js";
import {
  FAMILY_COLOR,
  WIDGET_FAMILIES,
  widgetVariants,
  type WidgetFamily,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "../widgets/catalog.js";

import type { EditorGlyphs } from "./glyphs.js";

export { FAMILY_COLOR };

/** How many rows the picker windows show at once. */
export const PICKER_PAGE = 8;

// ────────────────────────────────────────────────────────────────────────────
// pure helpers — every step's "what would Enter commit?" answer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Families the registered widgets actually populate, in catalogue order.
 * `exclude` drops any widget already added to the editor so groups that
 * have no remaining widgets disappear from step 1 of the picker.
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
 * Token-boundary characters used by `matchesInitialism`. Both display
 * names ("Git branch") and widget types ("git-branch", "tokens_total")
 * tokenise on whitespace, hyphen, and underscore.
 */
const INITIALISM_BOUNDARY = /[-\s_]+/;

/**
 * Initialism match — `gb` matches `git-branch`, `tt` matches
 * `tokens-total`, `su` matches `session-usage`. Single-letter queries
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
 * All entries in `family`, filtered (case-insensitive) by initialism
 * or substring match against `type` and `name`, with any widget types
 * in `exclude` removed (used to hide already-added widgets from the
 * picker).
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
    matchesInitialism(q, type) ||
    matchesInitialism(q, name) ||
    type.includes(q) ||
    name.includes(q)
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
// step 1 — pick a family
// ────────────────────────────────────────────────────────────────────────────

export interface PickerGroupProps {
  readonly title?: string;
  readonly entries: readonly WidgetMetaEntry[];
  readonly highlight: number;
  readonly glyphs: EditorGlyphs;
  /** Widget types already placed elsewhere — they don't count toward
   *  per-group totals and groups that become empty are hidden. */
  readonly exclude?: ReadonlySet<string>;
}

export function PickerGroup(props: PickerGroupProps): React.ReactElement {
  const exclude = props.exclude ?? new Set<string>();
  const cats = familiesWithWidgets(props.entries, exclude);
  const highlight = clampIndex(props.highlight, cats.length);
  const widest = cats.reduce((n, c) => Math.max(n, c.length), 0);
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(Text, { bold: true }, props.title ?? "Pick a group"),
    React.createElement(
      Text,
      { dimColor: true },
      `${cats.length} group${cats.length === 1 ? "" : "s"} · ↑↓ navigate · ↵ select · Esc cancel`,
    ),
    ...cats.map((cat, idx) => {
      const selected = idx === highlight;
      const count = props.entries.filter((e) => e.family === cat && !exclude.has(e.type)).length;
      const icon = props.glyphs.family[cat] ?? " ";
      const accent = FAMILY_COLOR[cat];
      const body = `${selected ? "▸ " : "  "}${icon}  ${cat.padEnd(widest, " ")}`;
      return React.createElement(
        Box,
        { key: cat, flexDirection: "row" },
        React.createElement(Text, { color: accent, bold: selected }, `  ${body}`),
        React.createElement(Text, { dimColor: true }, `  ${count} widget${count === 1 ? "" : "s"}`),
      );
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// step 2 — pick a widget
// ────────────────────────────────────────────────────────────────────────────

export interface PickerWidgetProps {
  readonly family: WidgetFamily;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
}

export function PickerWidget(props: PickerWidgetProps): React.ReactElement {
  const exclude = props.exclude ?? new Set<string>();
  const matches = widgetsInFamily(props.entries, props.family, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  // Pad preview text so descriptions line up in their own column. When a
  // widget returns no data (real mode, source absent) we fall back to its
  // type name so the picker still demonstrates *which* widget is on offer
  // — `(hidden)` here would be misleading because the widget itself is
  // not configured as hidden, it just can't produce data right now.
  const previews = rows.map((e) => previewWidget(e.type).text || e.type);
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.length), 0);
  const countLabel = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
  const accent = FAMILY_COLOR[props.family];

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, "  (no widgets match)")]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? "";
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          // Only the group label carries the family accent — individual
          // widget rows stay neutral so the accent doesn't bleed onto every
          // line. Selection emphasis is bold + cyan on the highlighted row.
          return React.createElement(
            Box,
            { key: e.type, flexDirection: "row" },
            React.createElement(
              Text,
              { color: selected ? "cyan" : undefined, bold: selected },
              head,
            ),
            React.createElement(Text, null, `  ${preview.padEnd(widestPreview, " ")}`),
            React.createElement(Text, { dimColor: true }, `  ${e.description}`),
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
      "Pick a widget — group ",
      React.createElement(Text, { color: accent, bold: true }, `‹${props.family}›`),
    ),
    React.createElement(Text, null, `filter: ${props.query}▏`),
    React.createElement(
      Text,
      { dimColor: true },
      `${countLabel} · type to filter · ↑↓ navigate · ↵ select · Esc back`,
    ),
    ...body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// step 1b — flat search across every family (when the search field is non-empty)
// ────────────────────────────────────────────────────────────────────────────

export interface PickerSearchProps {
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
}

export function PickerSearch(props: PickerSearchProps): React.ReactElement {
  const exclude = props.exclude ?? new Set<string>();
  const matches = filterWidgets(props.entries, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  const widestFamily = rows.reduce((n, e) => Math.max(n, e.family.length), 0);
  const previews = rows.map((e) => previewWidget(e.type).text || e.type);
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.length), 0);
  const countLabel = `${matches.length} match${matches.length === 1 ? "" : "es"}`;

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, "  (no widgets match)")]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? "";
          const accent = FAMILY_COLOR[e.family];
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          const familyBadge = `[${e.family.padEnd(widestFamily, " ")}]`;
          return React.createElement(
            Box,
            { key: e.type, flexDirection: "row" },
            React.createElement(Text, { color: accent, bold: selected }, head),
            React.createElement(Text, null, `  ${preview.padEnd(widestPreview, " ")}`),
            React.createElement(Text, { color: accent, dimColor: !selected }, `  ${familyBadge}`),
            React.createElement(Text, { dimColor: true }, `  ${e.description}`),
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
    React.createElement(Text, { bold: true }, "Pick a widget — search"),
    React.createElement(Text, null, `search: ${props.query}▏`),
    React.createElement(
      Text,
      { dimColor: true },
      `${countLabel} · type to filter · ⌫ clear · ↑↓ navigate · ↵ select · Esc cancel`,
    ),
    ...body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// step 3 — pick a variant
// ────────────────────────────────────────────────────────────────────────────

export interface PickerVariantProps {
  readonly widgetType: string;
  /** `"update"` shows "Keep current"; `"fresh"` (insert/replace) shows "Default options". */
  readonly mode: "update" | "fresh";
  readonly highlight: number;
}

export function PickerVariant(props: PickerVariantProps): React.ReactElement {
  const rows = variantRows(props.widgetType, props.mode);
  const highlight = clampIndex(props.highlight, rows.length);
  const widest = rows.reduce((n, r) => Math.max(n, r.label.length), 0);
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(Text, { bold: true }, `Pick a variant — ‹${props.widgetType}›`),
    React.createElement(Text, { dimColor: true }, `↑↓ navigate · ↵ select · Esc back`),
    ...rows.map((row, idx) => {
      const selected = idx === highlight;
      const preview = previewForVariant(props.widgetType, row);
      return React.createElement(
        Text,
        { key: row.id ?? "__default__", color: selected ? "cyan" : undefined },
        `  ${selected ? "▸ " : "  "}${row.label.padEnd(widest, " ")}  ${preview}`,
      );
    }),
  );
}

function previewForVariant(widgetType: string, row: VariantRow): string {
  if (row.id === null) return previewWidget(widgetType).text || widgetType;
  const variant = widgetVariants(widgetType).find((v) => v.id === row.id);
  const cell = previewWidget(widgetType, variant ? { ...variant.options } : undefined);
  return cell.text || widgetType;
}

