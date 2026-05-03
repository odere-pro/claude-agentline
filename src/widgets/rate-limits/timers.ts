/**
 * `block-timer`, `block-reset-timer`, and `weekly-reset-timer` widgets
 * (§7.5).
 *
 *   - `block-timer`        Time remaining in the current 5-h block.
 *                          Default format `short` (`3h12m`).
 *   - `block-reset-timer`  Same arithmetic as block-timer, framed as
 *                          a countdown (default label `"resets "`).
 *                          Honours the same `format` option.
 *   - `weekly-reset-timer` Time until next local Monday 00:00.
 *
 * All timers are pure functions of `ctx.clock` + `ctx.tokens` (for the
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

export const blockTimerWidget = defineWidget<Options>("block-timer", (ctx, settings) =>
  timerCell(blockRemainingMs(ctx), settings),
);

export const blockResetTimerWidget = defineWidget<Options>(
  "block-reset-timer",
  (ctx, settings) => timerCell(blockRemainingMs(ctx), settings, "resets "),
);

export const weeklyResetTimerWidget = defineWidget<Options>(
  "weekly-reset-timer",
  (ctx, settings) => timerCell(weeklyRemainingMs(ctx), settings, "week resets "),
);
