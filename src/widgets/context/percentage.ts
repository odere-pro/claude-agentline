/**
 * `context-percentage` and `context-percentage-usable` widgets
 * (§7.4). Used / window ratio; colour grades at 60 / 80 % via the
 * `tokens-low / tokens-mid / tokens-high` palette roles.
 *
 * `context-percentage-usable` divides by `0.8 × window` to mirror the
 * effective working size before auto-compaction kicks in.
 */

import { resolveRole } from "../../theme/index.js";
import { aggregate } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";
import { tokenRole } from "../tokens/format.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";

interface Options {
  readonly label?: string;
}

const USABLE_RATIO = 0.8;

function used(ctx: WidgetContext): number | null {
  const snapshot = ctx.tokens;
  if (!snapshot) return null;
  const totals = aggregate({
    events: snapshot.events,
    axis: "session",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  return totals.input + totals.cached;
}

function renderPercentage(
  ctx: WidgetContext,
  settings: WidgetSettings<Options>,
  divisor: number,
): Cell {
  const u = used(ctx);
  if (u === null) return { text: "", hidden: true };
  const ratio = divisor > 0 ? u / divisor : 0;
  const pct = Math.min(999, Math.round(ratio * 100));
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, tokenRole(ratio));
  const cell: Cell = { text: `${label}${pct}%` };
  return fg ? { ...cell, fg } : cell;
}

export const contextPercentageWidget = defineWidget<Options>(
  "context-percentage",
  (ctx, settings) => {
    const snapshot = ctx.tokens;
    if (!snapshot) return { text: "", hidden: true };
    return renderPercentage(ctx, settings, snapshot.contextWindow);
  },
);

export const contextPercentageUsableWidget = defineWidget<Options>(
  "context-percentage-usable",
  (ctx, settings) => {
    const snapshot = ctx.tokens;
    if (!snapshot) return { text: "", hidden: true };
    return renderPercentage(ctx, settings, snapshot.contextWindow * USABLE_RATIO);
  },
);
