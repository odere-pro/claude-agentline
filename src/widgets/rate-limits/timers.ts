/**
 * `current-session-reset-timer` and `week-limit-timer` widgets (§7.5).
 *
 *   - `current-session-reset-timer`  Time remaining until the active 5-h
 *                          session window resets. Default label
 *                          `"reset in "`, default format `compact`
 *                          (`1h 30m` / `30m`). Honours `options.format`.
 *   - `week-limit-timer`   Time remaining until the next weekly reset.
 *                          The reset anchor defaults to local Monday
 *                          00:00; `options.resetWeekday` (0=Sun…6=Sat)
 *                          and `options.resetHour` (0–23) pin it to the
 *                          account's real reset. `compact` renders the
 *                          multi-day remainder as `2d 1h 30m`.
 *
 * Both timers prefer the host's `rate_limits.{five_hour,seven_day}
 * .resets_at` off Claude Code stdin (epoch seconds → ms), so the
 * countdown agrees with the host's `/usage` screen. The local
 * `blockEnd` / `weekStart` derivation is a *fallback only*, used when
 * the host omits the window (older Claude Code, golden fixtures without
 * `rate_limits`). `options.resetWeekday` / `options.resetHour` pin only
 * that weekly fallback — the host's `resets_at` wins when present.
 *
 * `formatDuration` clamps negative remaining to zero, so a stale
 * `resets_at` (or block anchor) renders "0m" rather than a negative
 * count. Pure functions of `ctx.clock` + `ctx.stdin` (+ `ctx.tokens`
 * for the fallback block anchor).
 */

import { identityTranslator, widgetLabelId } from "../../core/i18n/index.js";
import { ONE_WEEK_MS } from "../../core/lib/time.js";
import { blockEnd, weekStart } from "../../data/tokens/index.js";
import type { Cell } from "../cell/cell.js";
import type { WidgetContext } from "../types.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatDuration, resolveDurationFormat } from "./duration/duration.js";
import { hostResetMs } from "./host-reset.js";
import { resolveWeekReset } from "./week-reset.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). Week timer only. */
  readonly resetWeekday?: number;
  /** Hour of day 0–23; minutes pinned to 0. Week timer only. */
  readonly resetHour?: number;
}

function blockRemainingMs(ctx: WidgetContext): number {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return (hostResetMs(ctx, "five-hour") ?? localEnd) - now;
}

function weeklyRemainingMs(ctx: WidgetContext, options: Options): number {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return (hostResetMs(ctx, "seven-day") ?? localEnd) - now;
}

function timerCell(
  ctx: WidgetContext,
  remainingMs: number,
  settings: WidgetSettings<Options>,
): Cell {
  const format = resolveDurationFormat(settings.options.format, "compact");
  const text = formatDuration(remainingMs, format);
  const t = ctx.t ?? identityTranslator;
  const label = settings.rawValue
    ? ""
    : (settings.options.label ?? t(widgetLabelId("reset-in"), "reset in "));
  return { text: `${label}${text}` };
}

export const currentSessionResetTimerWidget = defineWidget<Options>(
  "current-session-reset-timer",
  (ctx, settings) => timerCell(ctx, blockRemainingMs(ctx), settings),
);

export const weekLimitTimerWidget = defineWidget<Options>("week-limit-timer", (ctx, settings) =>
  timerCell(ctx, weeklyRemainingMs(ctx, settings.options), settings),
);
