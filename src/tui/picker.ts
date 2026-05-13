/**
 * Widget picker overlay — three steps. Shown while the reducer's mode is
 * `picker-group`, `picker-widget`, or `picker-variant`:
 *
 *   step 1 (`PickerGroup`)   — pick a category.
 *   step 2 (`PickerWidget`)  — pick a widget in that category (live filter).
 *   step 3 (`PickerVariant`) — pick a variant for widgets that have them.
 *
 * Each component is a thin Ink projection over pure helpers; `App` owns the
 * per-step query / highlight transient state and all key handling. Imported
 * only from the lazily-loaded TUI bundle (§1.2 N3).
 */

import { Box, Text } from "ink";
import React from "react";

import { previewWidget } from "../render/preview-fixture.js";
import {
  CATEGORY_COLOR,
  WIDGET_CATEGORIES,
  widgetVariants,
  type WidgetCategory,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "../widgets/catalog.js";

import type { EditorGlyphs } from "./glyphs.js";

export { CATEGORY_COLOR };

/** How many rows the picker windows show at once. */
export const PICKER_PAGE = 8;

// ────────────────────────────────────────────────────────────────────────────
// pure helpers — every step's "what would Enter commit?" answer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Categories the registered widgets actually populate, in catalogue order.
 * `exclude` drops any widget already added to the editor so groups that
 * have no remaining widgets disappear from step 1 of the picker.
 */
export function categoriesWithWidgets(
  entries: readonly WidgetMetaEntry[],
  exclude: ReadonlySet<string> = new Set(),
): readonly WidgetCategory[] {
  const present = new Set<WidgetCategory>(
    entries.filter((e) => !exclude.has(e.type)).map((e) => e.category),
  );
  return WIDGET_CATEGORIES.filter((c) => present.has(c));
}

/**
 * All entries in `category`, substring-filtered (case-insensitive), with
 * any widget types in `exclude` removed (used to hide already-added
 * widgets from the picker).
 */
export function widgetsInCategory(
  entries: readonly WidgetMetaEntry[],
  category: WidgetCategory,
  query: string,
  exclude: ReadonlySet<string> = new Set(),
): readonly WidgetMetaEntry[] {
  const q = query.trim().toLowerCase();
  const scoped = entries.filter((e) => e.category === category && !exclude.has(e.type));
  if (q === "") return scoped;
  return scoped.filter((e) => e.type.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
}

/**
 * Substring filter over all entries (kept for ad-hoc consumers; the editor
 * itself drives the per-step filters via `widgetsInCategory`).
 */
export function filterWidgets(
  entries: readonly WidgetMetaEntry[],
  query: string,
): readonly WidgetMetaEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return entries;
  return entries.filter(
    (e) => e.type.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
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

function clampIndex(value: number, length: number): number {
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
// step 1 — pick a category
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
  const cats = categoriesWithWidgets(props.entries, exclude);
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
      const count = props.entries.filter((e) => e.category === cat && !exclude.has(e.type)).length;
      const icon = props.glyphs.category[cat] ?? " ";
      const accent = CATEGORY_COLOR[cat];
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
  readonly category: WidgetCategory;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
}

export function PickerWidget(props: PickerWidgetProps): React.ReactElement {
  const exclude = props.exclude ?? new Set<string>();
  const matches = widgetsInCategory(props.entries, props.category, props.query, exclude);
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
  const accent = CATEGORY_COLOR[props.category];

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, "  (no widgets match)")]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? "";
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          // Only the group label carries the category accent — individual
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
      React.createElement(Text, { color: accent, bold: true }, `‹${props.category}›`),
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

// ────────────────────────────────────────────────────────────────────────────
// legacy export — kept for `Picker`-using ad-hoc callers (none in-tree now)
// ────────────────────────────────────────────────────────────────────────────

export interface PickerProps {
  readonly title: string;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
}

/** @deprecated Use the three-step picker (`PickerGroup`/`PickerWidget`/`PickerVariant`). */
export function Picker(props: PickerProps): React.ReactElement {
  return PickerWidget({
    category: "session",
    entries: props.entries,
    query: props.query,
    highlight: props.highlight,
  });
}

/** @deprecated Use `selectedAt(widgetsInCategory(...), highlight)`. */
export function selectedEntry(
  entries: readonly WidgetMetaEntry[],
  query: string,
  highlight: number,
): WidgetMetaEntry | undefined {
  const matches = filterWidgets(entries, query);
  return selectedAt(matches, highlight);
}
