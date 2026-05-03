/**
 * `Segment` — the unit consumed by the ANSI encoder.
 *
 * The widget contract (§7.1) returns `Cell`s with text + colour pair
 * + flags. Once cells are concatenated through Powerline, padding,
 * and merging, the renderer reduces the line to a flat sequence of
 * `Segment`s and hands them to `encodeSegments`.
 *
 * Keeping `Segment` distinct from the future `Cell` type lets the
 * widget surface evolve without disturbing the encoder.
 */

import type { Colour } from "../theme/colours.js";

export interface Segment {
  readonly text: string;
  readonly fg?: Colour;
  readonly bg?: Colour;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export function plainSegment(text: string): Segment {
  return { text };
}
