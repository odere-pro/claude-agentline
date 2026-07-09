/**
 * Line composition (§5.2 + §7.8.2).
 *
 * Two interchangeable strategies — `plainCompose` and `powerlineCompose` —
 * implement the same `ComposeStrategy` contract. `pickComposeStrategy`
 * selects between them from `options.powerline.enabled`; `composeLines`
 * is the public facade that drives the picked strategy.
 *
 *   - **Plain mode** — concatenates cells with the configured
 *     separator + per-side padding (or `merge` / `merge-no-padding`
 *     overrides), then expands flex-separator slots so they fill
 *     remaining width. When a line's total visible width would exceed
 *     `options.width`, trailing cells are **elided at a cell boundary**
 *     (never mid-cell) and an ellipsis marks the elision (issue #304).
 *     A configured line therefore always occupies exactly one physical
 *     row: the host paints one terminal row per `\n`-separated segment
 *     of our stdout, so a row count that varied with content width made
 *     the host's erase-and-redraw accounting flap between refreshes and
 *     leak stale statusline copies into the scrollback.
 *   - **Powerline mode** — delegates to `applyPowerlineLines`. Flex
 *     slots are no-op'd; padding / separator are ignored; chevrons
 *     are inserted with adjoining colours. Powerline mode does not
 *     wrap — chevron continuity across lines is a separate problem
 *     and v0.1.0 keeps it out of scope.
 *
 * Both strategies emit `Segment[]` lists per line. Encoding into ANSI
 * happens upstream via `renderLine` (§8.2 step 4).
 */

import { applyPowerlineLines, resolveGlyphs, type GlyphSupport } from "../../powerline/index.js";
import type { GlobalConfig, PowerlineConfig } from "../../../data/config/types.js";
import { MAX_LINES } from "../../../data/config/mutate/mutate.js";
import type { Theme } from "../../../data/theme/index.js";
import type { Cell } from "../../../widgets/cell/cell.js";
import { sanitizeCellText } from "../sanitize/sanitize.js";
import type { Segment } from "../segment/segment.js";

export interface ComposeOptions {
  readonly global: GlobalConfig;
  readonly powerline: PowerlineConfig;
  readonly theme: Theme | null;
  readonly width: number;
  /**
   * When true, `width` is not a real terminal width (it could not be
   * detected). Each configured line stays on a single row — no
   * width-based wrapping — and flex slots collapse instead of filling,
   * since there is no known width to fill to. The host clips
   * horizontally. See `width.ts · NO_WRAP_WIDTH`.
   */
  readonly noWrap?: boolean;
  /** Active glyph set selector for Powerline mode. */
  readonly glyphSupport: GlyphSupport;
}

export type ComposeStrategy = (
  lines: readonly (readonly Cell[])[],
  options: ComposeOptions,
) => Segment[][];

export const plainCompose: ComposeStrategy = (lines, options) => {
  /*
   * `MAX_LINES` bounds the number of *configured* lines (the editor caps
   * line count there too). Since a configured line now always yields at
   * most one physical row, configured lines and rows coincide.
   */
  const out: Segment[][] = [];
  let lineCount = 0;
  for (const line of lines) {
    if (lineCount >= MAX_LINES) break;
    for (const composed of composePlainLine(line, options)) {
      out.push(composed);
    }
    lineCount += 1;
  }
  return out;
};

export const powerlineCompose: ComposeStrategy = (lines, options) => {
  const glyphs = resolveGlyphs(options.powerline.glyphs, options.glyphSupport === "ascii");
  return applyPowerlineLines(lines, {
    glyphs,
    theme: options.theme,
    capStart: options.powerline.caps.start,
    capEnd: options.powerline.caps.end,
    autoAlign: options.powerline.autoAlign,
    continueColors: options.powerline.continueColors,
  });
};

export function pickComposeStrategy(options: ComposeOptions): ComposeStrategy {
  return options.powerline.enabled ? powerlineCompose : plainCompose;
}

export function composeLines(
  lines: readonly (readonly Cell[])[],
  options: ComposeOptions,
): Segment[][] {
  return pickComposeStrategy(options)(lines, options);
}

/**
 * Plain-mode composer for one config line. Returns an array (of length 0 or
 * 1) so `plainCompose` can skip a wholly-hidden line; a visible line always
 * composes to exactly one physical row.
 */
function composePlainLine(cells: readonly Cell[], options: ComposeOptions): Segment[][] {
  const visible = cells.filter((c) => !c.hidden);
  if (visible.length === 0) return [];
  return [composeOneLine(fitToWidth(visible, options), options)];
}

/** Elision marker, degraded for hosts that cannot render unicode. */
function ellipsisFor(options: ComposeOptions): Cell {
  const text = options.glyphSupport === "ascii" ? "..." : "…";
  // `merge` joins with a single space rather than the configured separator —
  // the ellipsis stands for the dropped cells, it is not another widget.
  return { text, merged: "merge" };
}

/**
 * Greedy fit: keep as many leading cells as fit within `options.width`, drop
 * the rest at a cell boundary, and append an ellipsis marking the elision.
 *
 * The first cell is never dropped — even a single oversized cell is kept and
 * left for the host to clip, since an empty row is worse than a clipped one.
 * Whenever anything *was* dropped the marker is appended, even if that pushes
 * the row past `options.width` (only reachable when a lone oversized cell ate
 * the budget). Elision must never be silent; the host clips the tail either
 * way, so the marker costs nothing.
 *
 * Flex cells contribute 0 measured width (they fill on demand in
 * `composeOneLine`), so they never trigger elision on their own.
 */
function fitToWidth(visible: readonly Cell[], options: ComposeOptions): Cell[] {
  // Width unknown — keep everything; the host clips the row horizontally.
  if (options.noWrap === true) return [...visible];

  const kept: Cell[] = [];
  let used = 0;
  let elided = false;

  for (const cell of visible) {
    const cellWidth = cell.flex === true ? 0 : codePointLength(cell.text);
    if (kept.length === 0) {
      kept.push(cell);
      used = cellWidth;
      continue;
    }
    const candidate = used + codePointLength(computeJoin(cell, options.global)) + cellWidth;
    if (candidate > options.width) {
      elided = true;
      break;
    }
    kept.push(cell);
    used = candidate;
  }

  if (!elided) return kept;

  // Make room for the marker by dropping further trailing cells if needed.
  const marker = ellipsisFor(options);
  const markerCost =
    codePointLength(computeJoin(marker, options.global)) + codePointLength(marker.text);
  while (kept.length > 1 && used + markerCost > options.width) {
    const dropped = kept.pop() as Cell;
    const droppedWidth = dropped.flex === true ? 0 : codePointLength(dropped.text);
    used -= codePointLength(computeJoin(dropped, options.global)) + droppedWidth;
  }
  kept.push(marker);
  return kept;
}

function composeOneLine(cells: readonly Cell[], options: ComposeOptions): Segment[] {
  /*
   * Pass 1: build the segment list with separator / padding /
   * merging applied. Flex cells are emitted as marker segments
   * (text === "" + a sentinel object identity) so pass 2 can
   * measure remaining width and fill them.
   */
  const segments: ComposedSegment[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    if (i > 0) {
      const join = computeJoin(cell, options.global);
      if (join.length > 0) segments.push(plainText(join));
    }
    if (cell.flex === true) {
      segments.push({ ...cellToSegment(cell), flex: true });
    } else {
      segments.push(cellToSegment(cell));
    }
  }

  /*
   * Pass 2: flex expansion. Compute remaining width budget; share
   * equally among all flex segments (any leftover goes on the last).
   */
  const flexIndices = segments
    .map((s, idx) => ({ s, idx }))
    .filter((entry) => entry.s.flex === true)
    .map((entry) => entry.idx);
  if (flexIndices.length === 0) {
    return segments.map(toSegment);
  }
  if (options.noWrap === true) {
    /*
     * No known width to fill to. Collapse each flex slot to a single
     * fill char (its natural width) rather than expanding it against
     * the no-wrap sentinel, which would emit a ~1e6-char run.
     */
    for (const idx of flexIndices) {
      const seg = segments[idx];
      if (!seg) continue;
      segments[idx] = { ...seg, flex: false, text: seg.text || " " };
    }
    return segments.map(toSegment);
  }
  const usedWidth = segments.reduce(
    (sum, s) => sum + (s.flex === true ? 0 : codePointLength(s.text)),
    0,
  );
  const remaining = Math.max(0, options.width - usedWidth);
  const each = Math.floor(remaining / flexIndices.length);
  const leftover = remaining - each * flexIndices.length;
  for (let k = 0; k < flexIndices.length; k += 1) {
    const idx = flexIndices[k];
    if (idx === undefined) continue;
    const seg = segments[idx];
    if (!seg) continue;
    const slotWidth = each + (k === flexIndices.length - 1 ? leftover : 0);
    const fill = seg.text || " ";
    segments[idx] = {
      ...seg,
      flex: false,
      text: slotWidth > 0 ? fill.repeat(slotWidth) : "",
    };
  }
  return segments.map(toSegment);
}

interface ComposedSegment extends Segment {
  flex?: boolean;
}

function plainText(text: string): ComposedSegment {
  return { text };
}

function cellToSegment(cell: Cell): ComposedSegment {
  return {
    /*
     * Strip control characters from host- and git-derived text once,
     * at the cell→segment boundary. Width measurement (`width.ts`)
     * runs over the sanitised text, so the visible-width math matches
     * the bytes the encoder eventually writes. See `sanitize.ts` for
     * the policy and the threat model.
     */
    text: sanitizeCellText(cell.text),
    ...(cell.fg !== undefined ? { fg: cell.fg } : {}),
    ...(cell.bg !== undefined ? { bg: cell.bg } : {}),
    ...(cell.bold === true ? { bold: true } : {}),
    ...(cell.italic === true ? { italic: true } : {}),
    ...(typeof cell.href === "string" && cell.href.length > 0 ? { href: cell.href } : {}),
  };
}

function toSegment(s: ComposedSegment): Segment {
  if (s.flex !== undefined) {
    const { flex: _flex, ...rest } = s;
    return rest;
  }
  return s;
}

function computeJoin(cell: Cell, global: GlobalConfig): string {
  const merged = cell.merged ?? "off";
  if (merged === "merge-no-padding") return "";
  if (merged === "merge") return " ";
  // off: padding + separator + padding
  const pad = " ".repeat(Math.max(0, global.padding));
  return `${pad}${global.separator}${pad}`;
}

function codePointLength(s: string): number {
  let count = 0;
  for (const _ of s) count += 1;
  return count;
}
