/**
 * Line composition (§5.2 + §7.8.2).
 *
 * Two paths:
 *
 *   - **Plain mode** — concatenates cells with the configured
 *     separator + per-side padding (or `merge` / `merge-no-padding`
 *     overrides), then expands flex-separator slots so they fill
 *     remaining width. When a line's total visible width would exceed
 *     `options.width`, trailing cells wrap onto a new line rather than
 *     truncating mid-cell (Phase 2 item 8). Wrapping is capped at
 *     `MAX_LINES` so even a wildly-overflowed config stays bounded.
 *   - **Powerline mode** — delegates to `applyPowerlineLines`. Flex
 *     slots are no-op'd; padding / separator are ignored; chevrons
 *     are inserted with adjoining colours. Powerline mode does not
 *     wrap — chevron continuity across lines is a separate problem
 *     and v0.1.0 keeps it out of scope.
 *
 * Both paths emit `Segment[]` lists per line. Encoding into ANSI
 * happens upstream via `renderLine` (§8.2 step 4).
 */

import { applyPowerlineLines, resolveGlyphs, type GlyphSupport } from "../powerline/index.js";
import type { GlobalConfig, PowerlineConfig } from "../config/types.js";
import { MAX_LINES } from "../config/mutate.js";
import type { Theme } from "../theme/index.js";
import type { Cell } from "../widgets/cell.js";
import type { Segment } from "./segment.js";

export interface ComposeOptions {
  readonly global: GlobalConfig;
  readonly powerline: PowerlineConfig;
  readonly theme: Theme | null;
  readonly width: number;
  /** Active glyph set selector for Powerline mode. */
  readonly glyphSupport: GlyphSupport;
}

export function composeLines(
  lines: readonly (readonly Cell[])[],
  options: ComposeOptions,
): Segment[][] {
  if (options.powerline.enabled) {
    return composePowerline(lines, options);
  }
  const out: Segment[][] = [];
  for (const line of lines) {
    for (const composed of composePlainLine(line, options)) {
      if (out.length >= MAX_LINES) return out;
      out.push(composed);
    }
  }
  return out;
}

function composePowerline(
  lines: readonly (readonly Cell[])[],
  options: ComposeOptions,
): Segment[][] {
  const glyphs = resolveGlyphs(options.powerline.glyphs, options.glyphSupport === "ascii");
  return applyPowerlineLines(lines, {
    glyphs,
    theme: options.theme,
    capStart: options.powerline.caps.start,
    capEnd: options.powerline.caps.end,
    autoAlign: options.powerline.autoAlign,
    continueColors: options.powerline.continueColors,
  });
}

/**
 * Plain-mode composer for one config line. Returns an array because a
 * line whose composed width exceeds `options.width` wraps onto a new
 * line; callers concatenate the result respecting `MAX_LINES`.
 */
function composePlainLine(cells: readonly Cell[], options: ComposeOptions): Segment[][] {
  const visible = cells.filter((c) => !c.hidden);
  if (visible.length === 0) return [];
  const packed = packIntoLines(visible, options);
  return packed.map((line) => composeOneLine(line, options));
}

/**
 * Greedy packing: fit as many cells as possible into each output line
 * without exceeding `options.width`. The first cell on a line is never
 * dropped — even a single oversized cell stays on its own line (better
 * to overflow one cell than to silently lose it).
 *
 * Flex cells contribute 0 measured width (they fill on demand in
 * `composeOneLine`), so they never trigger wrapping on their own.
 */
function packIntoLines(visible: readonly Cell[], options: ComposeOptions): Cell[][] {
  const out: Cell[][] = [];
  let current: Cell[] = [];
  let used = 0;
  for (const cell of visible) {
    const cellWidth = cell.flex === true ? 0 : codePointLength(cell.text);
    if (current.length === 0) {
      current.push(cell);
      used = cellWidth;
      continue;
    }
    const joinWidth = codePointLength(computeJoin(cell, options.global));
    const candidate = used + joinWidth + cellWidth;
    if (candidate > options.width) {
      out.push(current);
      current = [cell];
      used = cellWidth;
      continue;
    }
    current.push(cell);
    used = candidate;
  }
  if (current.length > 0) out.push(current);
  return out;
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
    text: cell.text,
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
