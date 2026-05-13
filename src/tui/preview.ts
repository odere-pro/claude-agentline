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
 *
 * Wrapping is computed in user-space rather than via Yoga's `flexWrap`:
 * the outer Box has no defined width, so Yoga would let the row grow
 * past the terminal edge instead of wrapping cells. Here we pack each
 * row's widget slots into visual sub-lines against `process.stdout.columns`
 * and, when a row's widgets overflow, spill the continuation visual lines
 * into the *next empty display rows* — each spilled line then carries the
 * empty row's own line number and "+ add widget" affordance in the gutter,
 * instead of cramming the overflow under the source row with a blank
 * continuation gutter. Truly excess sub-lines (when there's no empty row
 * to absorb them) still fall back to a shared-gutter continuation line.
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
  /**
   * Override the terminal width used for wrap calculations. Defaults to
   * `process.stdout.columns` (or 80 if unavailable). Primarily a test hook.
   */
  readonly columns?: number;
}

/** Slot + its original index within `row.slots`, preserved through packing
 * so React keys and cursor selection stay stable when slots are split
 * across visual sub-lines. */
interface PackedSlot {
  readonly slot: PreviewSlot;
  readonly originalIndex: number;
}

export function Preview(props: PreviewProps): React.ReactElement {
  const rows = buildPreview({ base: props.base, lines: props.lines });
  const cols = resolveColumns(props.columns);
  const gutterWidth = computeGutterWidth(rows, props.glyphs);
  // Reserve: 2 for the round border, 2 for `paddingX: 1`, plus the gutter
  // width. Clamp to a minimum so wrap doesn't degenerate when the terminal
  // is unusually narrow.
  const available = Math.max(20, cols - 4 - gutterWidth);

  const elements: React.ReactElement[] = [];

  // Pack each row's widget+join slots into visual sub-lines (excluding the
  // add-cell — it's rendered separately so empty rows below can absorb
  // overflow visual lines while keeping their own affordance).
  const packed = rows.map((row) => ({
    row,
    visualLines: packWidgetSlots(row, props.cursor, props.glyphs, available),
  }));

  let spillLines: PackedSlot[][] = [];
  let spillRow: PreviewRow | null = null;
  let keyCounter = 0;

  for (let d = 0; d < packed.length; d += 1) {
    const entry = packed[d]!;
    const { row, visualLines } = entry;
    const hasOwnWidgets = visualLines.length > 0;

    if (hasOwnWidgets) {
      // Any leftover spill from the previous logical row couldn't fit into
      // this row (which has its own widgets) — drop it under that row as
      // shared-gutter continuation lines before drawing this row.
      for (const line of spillLines) {
        elements.push(
          renderContinuationLine(
            line,
            spillRow!,
            props.cursor,
            props.glyphs,
            gutterWidth,
            `cont-${keyCounter++}`,
          ),
        );
      }
      spillLines = [];
      spillRow = null;

      elements.push(
        renderDisplayRow(
          { displayRow: row, contentRow: row, contentSlots: visualLines[0]! },
          props.cursor,
          props.glyphs,
          `disp-${keyCounter++}`,
        ),
      );

      // Stash overflow sub-lines so subsequent empty rows can claim them.
      spillLines = visualLines.slice(1);
      spillRow = row;
    } else {
      if (spillLines.length > 0 && spillRow !== null) {
        const absorbed = spillLines.shift()!;
        elements.push(
          renderDisplayRow(
            { displayRow: row, contentRow: spillRow, contentSlots: absorbed },
            props.cursor,
            props.glyphs,
            `disp-${keyCounter++}`,
          ),
        );
      } else {
        elements.push(
          renderDisplayRow(
            { displayRow: row, contentRow: row, contentSlots: [] },
            props.cursor,
            props.glyphs,
            `disp-${keyCounter++}`,
          ),
        );
      }
    }
  }

  // Any spill still left after all display rows are filled becomes
  // shared-gutter continuation lines under the last display row.
  for (const line of spillLines) {
    elements.push(
      renderContinuationLine(
        line,
        spillRow!,
        props.cursor,
        props.glyphs,
        gutterWidth,
        `cont-${keyCounter++}`,
      ),
    );
  }

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 1,
    },
    ...elements,
  );
}

function resolveColumns(override: number | undefined): number {
  if (typeof override === "number" && override > 0) return override;
  const real = process.stdout && process.stdout.columns;
  return typeof real === "number" && real > 0 ? real : 80;
}

function computeGutterWidth(rows: readonly PreviewRow[], glyphs: EditorGlyphs): number {
  // The first-line gutter is `{marker} {line#} {gutter} ` — marker is 1
  // glyph, line# takes `digits` columns, gutter is 1 glyph, plus three
  // single-space separators.
  const maxLine = rows.reduce((m, r) => Math.max(m, r.line), 0);
  const digits = String(maxLine).length;
  return 1 + 1 + digits + 1 + codePointLength(glyphs.gutter) + 1;
}

interface DisplayLine {
  /** Row whose line number + add-cell appear in this display slot. */
  readonly displayRow: PreviewRow;
  /** Row whose widgets are drawn here (may differ when absorbing overflow). */
  readonly contentRow: PreviewRow;
  readonly contentSlots: readonly PackedSlot[];
}

function renderDisplayRow(
  d: DisplayLine,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
  key: string,
): React.ReactElement {
  const onRow = isCursorOnDisplay(d, cursor);
  const prefix = `${onRow ? glyphs.activeRow : " "} ${d.displayRow.line} ${glyphs.gutter} `;
  return React.createElement(
    Box,
    { key, flexDirection: "row" },
    React.createElement(
      Box,
      { key: "gutter", flexShrink: 0 },
      React.createElement(Text, { dimColor: !onRow, color: onRow ? "cyan" : undefined }, prefix),
    ),
    ...d.contentSlots.map((packed) =>
      renderSlot(d.contentRow, packed.slot, packed.originalIndex, cursor, glyphs),
    ),
    renderAddCell(d.displayRow, cursor, glyphs),
  );
}

function renderContinuationLine(
  line: readonly PackedSlot[],
  sourceRow: PreviewRow,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
  gutterWidth: number,
  key: string,
): React.ReactElement {
  return React.createElement(
    Box,
    { key, flexDirection: "row" },
    React.createElement(
      Box,
      { key: "gutter", flexShrink: 0 },
      React.createElement(Text, { dimColor: true }, " ".repeat(gutterWidth)),
    ),
    ...line.map((packed) =>
      renderSlot(sourceRow, packed.slot, packed.originalIndex, cursor, glyphs),
    ),
  );
}

function isCursorOnDisplay(d: DisplayLine, cursor: PreviewProps["cursor"]): boolean {
  if (cursor.line === d.displayRow.line && cursor.widget === d.displayRow.widgetCount) {
    return true;
  }
  if (cursor.line === d.contentRow.line) {
    for (const packed of d.contentSlots) {
      if (packed.slot.kind === "widget" && packed.slot.widgetIndex === cursor.widget) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Greedy first-fit packer: walk widget + join slots left-to-right and start
 * a new visual line whenever the next slot would push past `available`. A
 * leading `"join"` slot on a wrapped line (the `" | "` separator between
 * widgets) is dropped so continuation lines don't begin with a stray pipe.
 * The trailing `"add"` slot is skipped — it's rendered separately by the
 * display-row code so empty rows below can absorb overflow visual lines
 * without losing their own "+ add widget" affordance.
 */
function packWidgetSlots(
  row: PreviewRow,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
  available: number,
): PackedSlot[][] {
  const lines: PackedSlot[][] = [[]];
  let used = 0;
  for (let i = 0; i < row.slots.length; i += 1) {
    const slot = row.slots[i];
    if (!slot) continue;
    if (slot.kind === "add") continue;
    const w = slotWidth(slot, row, cursor, glyphs);
    const current = lines[lines.length - 1];
    if (current && current.length > 0 && used + w > available) {
      lines.push([]);
      used = 0;
      if (slot.kind === "join") continue;
    }
    lines[lines.length - 1]!.push({ slot, originalIndex: i });
    used += w;
  }
  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) {
    lines.pop();
  }
  return lines;
}

function slotWidth(
  slot: PreviewSlot,
  row: PreviewRow,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
): number {
  if (slot.kind === "join") return codePointLength(slot.text);
  if (slot.kind === "add") {
    // Matches the literal rendered in `renderAddCell` ("  <addCell>").
    return 2 + codePointLength(glyphs.addCell);
  }
  const selected = cursor.line === row.line && cursor.widget === slot.widgetIndex;
  return selected
    ? codePointLength(glyphs.selectionOpen) +
        codePointLength(slot.text) +
        codePointLength(glyphs.selectionClose)
    : codePointLength(slot.text);
}

function codePointLength(s: string): number {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

function renderAddCell(
  row: PreviewRow,
  cursor: PreviewProps["cursor"],
  glyphs: EditorGlyphs,
): React.ReactElement {
  const selected = cursor.line === row.line && cursor.widget === row.widgetCount;
  return React.createElement(
    Box,
    { key: "add", flexShrink: 0 },
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
  const body = selected ? `${glyphs.selectionOpen}${slot.text}${glyphs.selectionClose}` : slot.text;
  return React.createElement(
    Box,
    { key, flexShrink: 0 },
    React.createElement(Text, textProps, body),
  );
}
