/**
 * `block-reset-timer` and `weekly-reset-timer` widgets (§7.5).
 *
 *   - `block-reset-timer`  Time remaining until the active 5-h block
 *                          resets. Default label `"resets "`. Honours
 *                          `options.format` for the duration format.
 *   - `weekly-reset-timer` Time remaining until next local Monday 00:00.
 *
 * Both timers are pure functions of `ctx.clock` + `ctx.tokens` (for the
 * block anchor) and `weekStart` from the tokens module (for the weekly
 * boundary). When the snapshot is missing, block timers fall back to
 * "0m" rather than hiding — the renderer is still useful even with no
 * transcript.
 */

import { blockEnd, weekStart } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatDuration, resolveDurationFormat } from "./duration.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function blockRemainingMs(ctx: WidgetContext): number {
  const now = ctx.clock.now().getTime();
  const anchor = ctx.tokens?.blockAnchor;
  return blockEnd({ now, blockAnchor: anchor }) - now;
}

function weeklyRemainingMs(ctx: WidgetContext): number {
  const now = ctx.clock.now().getTime();
  return weekStart(now) + ONE_WEEK_MS - now;
}

function timerCell(remainingMs: number, settings: WidgetSettings<Options>, defaultLabel = ""): Cell {
  const format = resolveDurationFormat(settings.options.format, "short");
  const text = formatDuration(remainingMs, format);
  const label = settings.rawValue ? "" : (settings.options.label ?? defaultLabel);
  return { text: `${label}${text}` };
}

export const blockResetTimerWidget = defineWidget<Options>(
  "block-reset-timer",
  (ctx, settings) => timerCell(blockRemainingMs(ctx), settings, "resets "),
);

export const weeklyResetTimerWidget = defineWidget<Options>(
  "weekly-reset-timer",
  (ctx, settings) => timerCell(weeklyRemainingMs(ctx), settings, "week resets "),
);
