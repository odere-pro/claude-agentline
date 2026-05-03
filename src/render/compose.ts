/**
 * Line composition (§5.2 + §7.8.2).
 *
 * Two paths:
 *
 *   - **Plain mode** — concatenates cells with the configured
 *     separator + per-side padding (or `merge` / `merge-no-padding`
 *     overrides), then expands flex-separator slots so they fill
 *     remaining width. Multiple flex slots share remainder equally.
 *   - **Powerline mode** — delegates to `applyPowerlineLines`. Flex
 *     slots are no-op'd; padding / separator are ignored; chevrons
 *     are inserted with adjoining colours.
 *
 * Both paths emit `Segment[]` lists per line. Encoding into ANSI
 * happens upstream via `renderLine` (§8.2 step 4).
 */

import { applyPowerlineLines, resolveGlyphs, type GlyphSupport } from "../powerline/index.js";
import type { GlobalConfig, PowerlineConfig } from "../config/types.js";
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
  return lines.map((line) => composePlainLine(line, options));
}

function composePowerline(
  lines: readonly (readonly Cell[])[],
  options: ComposeOptions,
): Segment[][] {
  const glyphs = resolveGlyphs(
    options.powerline.glyphs,
    options.glyphSupport === "ascii",
  );
  return applyPowerlineLines(lines, {
    glyphs,
    theme: options.theme,
    capStart: options.powerline.caps.start,
    capEnd: options.powerline.caps.end,
    autoAlign: options.powerline.autoAlign,
    continueColors: options.powerline.continueColors,
  });
}

function composePlainLine(
  cells: readonly Cell[],
  options: ComposeOptions,
): Segment[] {
  const visible = cells.filter((c) => !c.hidden);
  if (visible.length === 0) return [];

  // Pass 1: build the segment list with separator / padding /
  // merging applied. Flex cells are emitted as marker segments
  // (text === "" + a sentinel object identity) so pass 2 can
  // measure remaining width and fill them.
  const segments: ComposedSegment[] = [];
  for (let i = 0; i < visible.length; i += 1) {
    const cell = visible[i];
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

  // Pass 2: flex expansion. Compute remaining width budget; share
  // equally among all flex segments (any leftover goes on the last).
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
