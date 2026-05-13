/**
 * The interactive preview surface for `agentline config` (§1.1 F10).
 *
 * The preview *is* the editing surface: every grid row (up to `MAX_LINES`)
 * is rendered live, the selected widget is highlighted in place (Ink's
 * `inverse`), and each row ends in a navigable "+ add widget" cell. The
 * old separate "layout list" view that mirrored the same data is gone.
 *
 * The structure of each row comes from a pure helper — `buildPreview`
 * in `./preview-model.ts` — so the layout is unit-testable without Ink.
 * This file is the thin Ink projection on top.
 */

import { Box, Text } from "ink";
import React from "react";

import type { AgentlineConfig, LineConfig } from "../config/types.js";
import type { Theme } from "../theme/index.js";

import type { EditorGlyphs } from "./glyphs.js";
import { buildPreview, type PreviewRow, type PreviewSlot } from "./preview-model.js";

export interface PreviewProps {
  /** The full loaded config — everything except `lines` is taken from here. */
  readonly base: AgentlineConfig;
  /** The editor's current (mutable) line list. */
  readonly lines: readonly LineConfig[];
  /**
   * Cursor for in-place highlighting. The widget at `(cursor.line,
   * cursor.widget)` is rendered with `inverse`; if `cursor.widget` equals
   * the row's `widgetCount`, the add-cell is highlighted instead.
   */
  readonly cursor: { readonly line: number; readonly widget: number };
  /** Resolved theme — not used by the editor preview directly (slot colours
   * are baked in by `buildPreview` via `previewWidget` against the cached
   * stdin context — or the label-only fallback when no cache exists). */
  readonly theme?: Theme | null;
  /** Editor glyph set (Unicode/ASCII) for the gutter, add-cell, etc. */
  readonly glyphs: EditorGlyphs;
}

export function Preview(props: PreviewProps): React.ReactElement {
  const rows = buildPreview({ base: props.base, lines: props.lines });
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 1,
    },
    React.createElement(Text, { dimColor: true }, "preview — ‹ ↑ ↓ ← → › to navigate"),
    ...rows.map((row) => renderRow(row, props.cursor, props.glyphs)),
  );
}

function renderRow(
  row: PreviewRow,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
): React.ReactElement {
  const onRow = cursor.line === row.line;
  // `flexWrap: "wrap"` so an overflowing widget moves to a new visual line
  // (Yoga pushes the next child to a new wrap line). Each slot lives in a
  // `flexShrink: 0` Box so it keeps its natural width — without that Yoga
  // would shrink cells in place rather than wrapping them, which is what
  // produced the "thinking-effo / t" two-line squeeze the user reported.
  return React.createElement(
    Box,
    { key: `row-${row.line}`, flexDirection: "row", flexWrap: "wrap" },
    React.createElement(
      Box,
      { flexShrink: 0 },
      React.createElement(
        Text,
        { dimColor: !onRow, color: onRow ? "cyan" : undefined },
        `${onRow ? glyphs.activeRow : " "} ${row.line} ${glyphs.gutter} `,
      ),
    ),
    ...row.slots.map((slot, idx) => renderSlot(row, slot, idx, cursor, glyphs)),
  );
}

function renderSlot(
  row: PreviewRow,
  slot: PreviewSlot,
  idx: number,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
): React.ReactElement {
  const key = `row-${row.line}-slot-${idx}`;
  if (slot.kind === "join") {
    return React.createElement(
      Box,
      { key, flexShrink: 0 },
      React.createElement(Text, { dimColor: true }, slot.text),
    );
  }
  if (slot.kind === "add") {
    const selected = cursor.line === row.line && cursor.widget === slot.column;
    return React.createElement(
      Box,
      { key, flexShrink: 0 },
      React.createElement(
        Text,
        {
          dimColor: !selected,
          inverse: selected,
          color: selected ? undefined : "gray",
        },
        `  ${glyphs.addCell}`,
      ),
    );
  }
  // widget
  const selected = cursor.line === row.line && cursor.widget === slot.widgetIndex;
  const textProps: Record<string, unknown> = {};
  if (selected) textProps.inverse = true;
  if (slot.hidden) textProps.dimColor = true;
  if (slot.fg) textProps.color = slot.fg;
  if (slot.bg) textProps.backgroundColor = slot.bg;
  if (slot.bold) textProps.bold = true;
  if (slot.italic) textProps.italic = true;
  // The selection brackets wrap the cell so the highlight is also
  // legible without inverse support (e.g. some `NO_COLOR` paths).
  const body = selected
    ? `${glyphs.selectionOpen}${slot.text}${glyphs.selectionClose}`
    : slot.text;
  return React.createElement(
    Box,
    { key, flexShrink: 0 },
    React.createElement(Text, textProps, body),
  );
}
