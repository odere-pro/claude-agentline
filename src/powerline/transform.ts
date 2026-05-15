/**
 * Powerline transform (§5.1).
 *
 * Pure function: given a list of widget cells (one line) plus the
 * resolved Powerline configuration / theme / glyph set, produce the
 * sequence of `Segment`s the ANSI encoder consumes.
 *
 * Invariants:
 *
 *   - Hidden cells are skipped.
 *   - Cells with `flex: true` are skipped (flex-separator is a
 *     no-op in Powerline mode per spec).
 *   - The chevron between cell A and cell B uses
 *     `glyph.fg = A.bg`, `glyph.bg = B.bg` — adjoining-colour rule.
 *   - `caps.start` is emitted before the first cell with bg = first
 *     cell's bg, fg = `null` (terminal default fg).
 *   - `caps.end` is emitted after the last cell as a chevron whose
 *     fg = last cell's bg, bg = continuing fg from the next line
 *     (when `continueColors` is enabled and a `continueBg` is set);
 *     otherwise bg defaults to terminal background.
 *   - Cell padding: each cell text is padded with one space on each
 *     side unless `cell.merged` says otherwise.
 *
 * Background fallback: when a cell has no explicit `bg`, the
 * transform substitutes the theme's `bg-section` palette colour so
 * adjacent cells show a clean band. With no theme, the cell renders
 * without bg (terminal default).
 */

import { resolveRole, type Theme } from "../theme/index.js";
import type { Colour } from "../theme/colours.js";
import type { Cell } from "../widgets/cell.js";
import type { Segment } from "../render/segment.js";
import type { PowerlineGlyphSet } from "./glyphs.js";

export interface PowerlineTransformOptions {
  readonly glyphs: PowerlineGlyphSet;
  readonly theme: Theme | null;
  readonly capStart?: string | readonly string[];
  readonly capEnd?: string | readonly string[];
  /** Background colour of the next line's first cell, when carried. */
  readonly continueBg?: Colour;
  /** 0-based line index; used to pick per-line entries from cap arrays. */
  readonly lineIndex?: number;
}

const SPACE = " ";

/**
 * Resolve a `string | readonly string[]` entry to the single glyph at
 * position `idx`. Two semantics share one helper:
 *
 *   - `"clamp"` (glyphs): once `idx ≥ entry.length`, the last entry
 *     repeats. Glyph arrays describe a fixed sequence of hard-vs-soft
 *     chevron variants — "hard then soft, soft, soft…" — so repetition
 *     of the tail glyph is the natural read.
 *   - `"cycle"` (caps): `idx % entry.length`, so a 2-element array
 *     alternates across lines 0/1, line 2 wraps to entry 0, etc. Caps
 *     cycle because the natural use case is alternating themes across
 *     several statuslines.
 *
 * They are deliberately asymmetric — do not fold them into one rule.
 */
function pickIndexed(
  entry: string | readonly string[],
  idx: number,
  mode: "clamp" | "cycle",
): string {
  if (typeof entry === "string") return entry;
  if (entry.length === 0) return "";
  const i = mode === "cycle" ? idx % entry.length : Math.min(idx, entry.length - 1);
  return entry[i] ?? "";
}

interface PaddedCell {
  readonly text: string;
  readonly fg: Colour | undefined;
  readonly bg: Colour;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly href: string | undefined;
}

function defaultBg(theme: Theme | null): Colour {
  return resolveRole(theme, "bg-section");
}

function padded(cell: Cell, theme: Theme | null): PaddedCell {
  const merged = cell.merged ?? "off";
  const left = merged === "merge-no-padding" ? "" : SPACE;
  const right = SPACE;
  return {
    text: `${left}${cell.text}${right}`,
    fg: cell.fg,
    bg: cell.bg ?? defaultBg(theme),
    bold: cell.bold ?? false,
    italic: cell.italic ?? false,
    /*
     * The OSC 8 wrap covers the padded text too — clicking the
     * surrounding whitespace inside the powerline chip should still
     * open the link, matching the user's mental model of "the chip
     * is the link".
     */
    href: typeof cell.href === "string" && cell.href.length > 0 ? cell.href : undefined,
  };
}

function styleSegment(cell: PaddedCell): Segment {
  const seg: Segment = { text: cell.text, bg: cell.bg };
  const withFg = cell.fg !== undefined ? { ...seg, fg: cell.fg } : seg;
  const withStyle = {
    ...withFg,
    ...(cell.bold ? { bold: true } : {}),
    ...(cell.italic ? { italic: true } : {}),
  };
  return cell.href !== undefined ? { ...withStyle, href: cell.href } : withStyle;
}

export function applyPowerline(
  cells: readonly Cell[],
  options: PowerlineTransformOptions,
): Segment[] {
  const visible = cells.filter((c) => !c.hidden && !c.flex);
  if (visible.length === 0) return [];

  const padded_ = visible.map((c) => padded(c, options.theme));
  const segments: Segment[] = [];

  // Start cap (before first cell)
  const lineIdx = options.lineIndex ?? 0;
  const firstBg = padded_[0]?.bg;
  if (options.capStart && firstBg !== undefined) {
    const capStart = pickIndexed(options.capStart, lineIdx, "cycle");
    if (capStart.length > 0) {
      segments.push({ text: capStart, bg: firstBg });
    }
  }

  let chevronIdx = 0;
  for (let i = 0; i < padded_.length; i += 1) {
    const cell = padded_[i];
    if (!cell) continue;
    segments.push(styleSegment(cell));
    const next = padded_[i + 1];
    if (next) {
      // Same-bg cells: use cell.fg so the chevron stays visible on the continuous band.
      const chevronFg = cell.bg === next.bg ? (cell.fg ?? cell.bg) : cell.bg;
      segments.push({
        text: pickIndexed(options.glyphs.hardRight, chevronIdx, "clamp"),
        fg: chevronFg,
        bg: next.bg,
      });
      chevronIdx += 1;
    }
  }

  /*
   * End cap: chevron whose fg = last cell's bg. bg is either the
   * carried continueBg (multi-line auto-thread) or terminal default
   * (no bg set on the segment).
   */
  const lastBg = padded_[padded_.length - 1]?.bg;
  if (options.capEnd && lastBg !== undefined) {
    const capEnd = pickIndexed(options.capEnd, lineIdx, "cycle");
    if (capEnd.length > 0) {
      const cap: Segment = { text: capEnd, fg: lastBg };
      segments.push(options.continueBg !== undefined ? { ...cap, bg: options.continueBg } : cap);
    }
  }

  return segments;
}

/**
 * Multi-line variant. When `continueColors` is enabled, threads each
 * line's first-cell bg as the prior line's end-cap bg. When
 * `autoAlign` is enabled, pads each line on the right with a single
 * trailing whitespace slot using the line's last bg colour, sized so
 * every line ends at the maximum visible width. Visible width is
 * code-point count, which is sufficient for ASCII / Latin / Nerd
 * glyphs; full grapheme width is deferred.
 */
export function applyPowerlineLines(
  lines: readonly (readonly Cell[])[],
  options: PowerlineTransformOptions & {
    readonly autoAlign: boolean;
    readonly continueColors: boolean;
  },
): Segment[][] {
  /*
   * First pass: figure out each line's first-cell bg (for continueBg
   * wiring) and last-cell bg (for autoAlign padding).
   */
  const firstBgPerLine: (Colour | undefined)[] = [];
  const lastBgPerLine: (Colour | undefined)[] = [];
  for (const line of lines) {
    const visible = line.filter((c) => !c.hidden && !c.flex);
    firstBgPerLine.push(
      visible[0]?.bg ?? (visible.length > 0 ? defaultBg(options.theme) : undefined),
    );
    lastBgPerLine.push(
      visible[visible.length - 1]?.bg ??
        (visible.length > 0 ? defaultBg(options.theme) : undefined),
    );
  }

  const out: Segment[][] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? [];
    const continueBg = options.continueColors ? firstBgPerLine[i + 1] : undefined;
    const lineSegments = applyPowerline(line, {
      ...options,
      lineIndex: i,
      ...(continueBg !== undefined ? { continueBg } : {}),
    });
    out.push(lineSegments);
  }

  if (options.autoAlign) {
    const widths = out.map((segs) => segmentsWidth(segs));
    const max = widths.reduce((a, b) => (b > a ? b : a), 0);
    for (let i = 0; i < out.length; i += 1) {
      const segs = out[i];
      const w = widths[i];
      const lastBg = lastBgPerLine[i];
      if (!segs || w === undefined || lastBg === undefined) continue;
      const pad = max - w;
      if (pad > 0) {
        segs.push({ text: SPACE.repeat(pad), bg: lastBg });
      }
    }
  }

  return out;
}

function segmentsWidth(segs: readonly Segment[]): number {
  let w = 0;
  for (const seg of segs) w += codePointLength(seg.text);
  return w;
}

function codePointLength(s: string): number {
  let count = 0;
  for (const _ of s) count += 1;
  return count;
}
