/**
 * Widget picker overlay for the `agentline config` editor.
 *
 * Shown while the reducer's mode is `"picker"` (opened by `a` / `r`). Lists
 * the built-in widgets filtered by a live substring query against name and
 * type; each row shows the widget's type and what it renders against the
 * synthetic demo session (`previewWidget`). Pure component — `App` owns the
 * query / highlight state and all key handling; this just draws.
 *
 * Imported only from the lazily-loaded TUI bundle.
 */

import { Box, Text } from "ink";
import React from "react";

import { previewWidget } from "../render/demo-fixture.js";
import type { WidgetMetaEntry } from "../widgets/index.js";

/** How many widget rows to show at once; the slice scrolls with the highlight. */
export const PICKER_PAGE = 8;

/** Substring-filter the catalogue by `type` and `name` (case-insensitive). */
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

/** The entry the picker would confirm at the given query/highlight, if any. */
export function selectedEntry(
  entries: readonly WidgetMetaEntry[],
  query: string,
  highlight: number,
): WidgetMetaEntry | undefined {
  const matches = filterWidgets(entries, query);
  if (matches.length === 0) return undefined;
  return matches[clampIndex(highlight, matches.length)];
}

function clampIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  if (value < 0) return 0;
  if (value > length - 1) return length - 1;
  return value;
}

/** The visible slice of `matches`, windowed so `highlight` stays on screen. */
function windowSlice<T>(matches: readonly T[], highlight: number): { start: number; rows: readonly T[] } {
  if (matches.length <= PICKER_PAGE) return { start: 0, rows: matches };
  const half = Math.floor(PICKER_PAGE / 2);
  const maxStart = matches.length - PICKER_PAGE;
  const start = Math.max(0, Math.min(highlight - half, maxStart));
  return { start, rows: matches.slice(start, start + PICKER_PAGE) };
}

export interface PickerProps {
  /** "Insert a widget" / "Replace the widget with…". */
  readonly title: string;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  /** Index into the *filtered* list. */
  readonly highlight: number;
}

export function Picker(props: PickerProps): React.ReactElement {
  const matches = filterWidgets(props.entries, props.query);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widest = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  const countLabel = `${matches.length} match${matches.length === 1 ? "" : "es"}`;

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, "  (no widgets match)")]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previewWidget(e.type).text || "(hidden)";
          return React.createElement(
            Text,
            { key: e.type, color: selected ? "cyan" : undefined },
            `  ${selected ? "▸ " : "  "}${e.type.padEnd(widest, " ")}  ${preview}`,
          );
        });

  return React.createElement(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginTop: 1 },
    React.createElement(Text, { bold: true }, props.title),
    React.createElement(Text, null, `filter: ${props.query}▏`),
    React.createElement(
      Text,
      { dimColor: true },
      `${countLabel} · type to filter · ↑↓ navigate · ↵ confirm · Esc cancel`,
    ),
    ...body,
  );
}
