/**
 * `context-bar` widget (§7.4). Renders a fixed-width bar (default 12)
 * showing the used / window ratio, coloured by the same low / mid /
 * high role thresholds as `context-percentage`.
 */

import { resolveRole } from "../../theme/index.js";
import { aggregate } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";
import { tokenRole } from "../tokens/format.js";

interface Options {
  readonly label?: string;
  readonly width?: number;
  readonly filled?: string;
  readonly empty?: string;
}

const DEFAULT_WIDTH = 12;
const DEFAULT_FILLED = "█";
const DEFAULT_EMPTY = "░";

function clampWidth(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return DEFAULT_WIDTH;
  return Math.min(Math.floor(value), 80);
}

export const contextBarWidget = defineWidget<Options>("context-bar", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const totals = aggregate({
    events: snapshot.events,
    axis: "session",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  const used = totals.input + totals.cached;
  const ratio = snapshot.contextWindow > 0 ? used / snapshot.contextWindow : 0;
  const width = clampWidth(settings.options.width);
  const filledChar = settings.options.filled ?? DEFAULT_FILLED;
  const emptyChar = settings.options.empty ?? DEFAULT_EMPTY;
  const filledCount = Math.min(width, Math.max(0, Math.round(ratio * width)));
  const bar = filledChar.repeat(filledCount) + emptyChar.repeat(width - filledCount);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, tokenRole(ratio));
  const cell: Cell = { text: `${label}${bar}` };
  return fg ? { ...cell, fg } : cell;
});
