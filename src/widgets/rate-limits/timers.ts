/**
 * `current-session-reset-timer` and `week-limit-timer` widgets (§7.5).
 *
 *   - `current-session-reset-timer`  Time remaining until the active 5-h
 *                          session window resets. Default label
 *                          `"reset in "`, default format `compact`
 *                          (`1h 30m` / `30m`). Honours `options.format`.
 *                          Wall-clock variants (`at-24h`, `at-12h`,
 *                          `at-seconds`) render the absolute reset time
 *                          (e.g. `"resets 18:30"`) via `formatClock`.
 *   - `week-limit-timer`   Time remaining until the next weekly reset.
 *                          The reset anchor defaults to local Monday
 *                          00:00; `options.resetWeekday` (0=Sun…6=Sat)
 *                          and `options.resetHour` (0–23) pin it to the
 *                          account's real reset. `compact` renders the
 *                          multi-day remainder as `2d 1h 30m`.
 *                          Wall-clock variants (`at-day-time`, `at-24h`,
 *                          `at-12h`) render the absolute reset time
 *                          (e.g. `"week resets Mon 17 00:00"`).
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
 *
 * Wall-clock format tokens are the same vocabulary as `clock-format.ts`:
 *   `HH:mm` (default session), `EEE D HH:mm` (default weekly), `h:mma`, etc.
 */

import { identityTranslator, widgetLabelId } from "../../core/i18n/index.js";
import { ONE_WEEK_MS } from "../../core/lib/time.js";
import { blockEnd, weekStart } from "../../data/tokens/index.js";
import type { Cell } from "../cell/cell.js";
import { frozenClock } from "../clock/clock.js";
import type { WidgetContext } from "../types.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatClock } from "./clock-format.js";
import { formatDuration, resolveDurationFormat } from "./duration/duration.js";
import { hostResetMs } from "./host-reset.js";
import { resolveWeekReset } from "./week-reset.js";

/**
 * Duration formats handled by `formatDuration`. Any format string
 * that is NOT one of these is treated as a wall-clock format token
 * and routed to `formatClock` instead.
 */
const DURATION_FORMATS: ReadonlySet<string> = new Set(["short", "long", "clock", "compact"]);

/** Default wall-clock format for the session reset-at path. */
const DEFAULT_SESSION_CLOCK_FORMAT = "HH:mm";
/** Default wall-clock format for the weekly reset-at path. */
const DEFAULT_WEEKLY_CLOCK_FORMAT = "EEE D HH:mm";

interface Options {
  readonly label?: string;
  readonly format?: string;
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). Week timer only. */
  readonly resetWeekday?: number;
  /** Hour of day 0–23; minutes pinned to 0. Week timer only. */
  readonly resetHour?: number;
  /**
   * Override timezone for wall-clock rendering (wall-clock format variants
   * only). Defaults to the host local time.
   */
  readonly tz?: string;
}

function blockRemainingMs(ctx: WidgetContext): number {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return (hostResetMs(ctx, "five-hour") ?? localEnd) - now;
}

function blockResetTime(ctx: WidgetContext): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return new Date(hostResetMs(ctx, "five-hour") ?? localEnd);
}

function weeklyRemainingMs(ctx: WidgetContext, options: Options): number {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return (hostResetMs(ctx, "seven-day") ?? localEnd) - now;
}

function weeklyResetTime(ctx: WidgetContext, options: Options): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return new Date(hostResetMs(ctx, "seven-day") ?? localEnd);
}

/**
 * Returns `true` when `format` is a wall-clock format string (e.g.
 * `"HH:mm"`, `"EEE D HH:mm"`). Any non-empty string that is not a
 * known duration format routes to the wall-clock path.
 */
function isClockFormat(format: string | undefined): boolean {
  return typeof format === "string" && format.length > 0 && !DURATION_FORMATS.has(format);
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

function sessionAtCell(ctx: WidgetContext, settings: WidgetSettings<Options>): Cell {
  const resetAt = blockResetTime(ctx);
  const fmt =
    typeof settings.options.format === "string" && settings.options.format.length > 0
      ? settings.options.format
      : DEFAULT_SESSION_CLOCK_FORMAT;
  const text = formatClock(frozenClock(resetAt), fmt, settings.options.tz);
  const t = ctx.t ?? identityTranslator;
  const label = settings.rawValue
    ? ""
    : (settings.options.label ?? t(widgetLabelId("reset-at"), "resets "));
  return { text: `${label}${text}` };
}

function weekAtCell(ctx: WidgetContext, settings: WidgetSettings<Options>): Cell {
  const resetAt = weeklyResetTime(ctx, settings.options);
  const fmt =
    typeof settings.options.format === "string" && settings.options.format.length > 0
      ? settings.options.format
      : DEFAULT_WEEKLY_CLOCK_FORMAT;
  const text = formatClock(frozenClock(resetAt), fmt, settings.options.tz);
  const t = ctx.t ?? identityTranslator;
  const label = settings.rawValue
    ? ""
    : (settings.options.label ?? t(widgetLabelId("week-resets-at"), "week resets "));
  return { text: `${label}${text}` };
}

export const currentSessionResetTimerWidget = defineWidget<Options>(
  "current-session-reset-timer",
  (ctx, settings) => {
    if (isClockFormat(settings.options.format)) {
      return sessionAtCell(ctx, settings);
    }
    return timerCell(ctx, blockRemainingMs(ctx), settings);
  },
);

export const weekLimitTimerWidget = defineWidget<Options>(
  "week-limit-timer",
  (ctx, settings) => {
    if (isClockFormat(settings.options.format)) {
      return weekAtCell(ctx, settings);
    }
    return timerCell(ctx, weeklyRemainingMs(ctx, settings.options), settings);
  },
);
