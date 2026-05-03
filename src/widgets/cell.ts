/**
 * `Cell` — the unit a widget returns to the renderer (§7.1).
 *
 * Cells carry text, an optional colour pair, optional style flags,
 * a `merged` mode that controls the spacing on the cell's left edge
 * (§5.2), and a `hidden` flag that lets a widget short-circuit when
 * it has nothing to display.
 *
 * Cells are immutable. `Object.freeze` is applied at construction
 * helpers so accidental mutation by a widget upstream cannot leak
 * into the renderer's segment list.
 */

import type { Colour } from "../theme/colours.js";

export type MergeMode = "off" | "merge" | "merge-no-padding";

export interface Cell {
  readonly text: string;
  readonly fg?: Colour;
  readonly bg?: Colour;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly merged?: MergeMode;
  readonly hidden?: boolean;
}

export const HIDDEN_CELL: Cell = Object.freeze({ text: "", hidden: true });

export function plainCell(text: string): Cell {
  return Object.freeze({ text });
}

export function isHidden(cell: Cell): boolean {
  return Boolean(cell.hidden);
}
