/**
 * Reset-time helpers shared by the `reset-timer` widget (§7.5).
 *
 * The two former widgets `current-session-reset-timer` and
 * `week-limit-timer` were merged into a single `reset-timer` that renders
 * BOTH windows on one cell (PR #224, the 6-family change). This module
 * keeps the per-window math + formatting helpers; the merged widget lives
 * in `./reset-timer.ts`.
 *
 * Both windows prefer the host's `rate_limits.{five_hour,seven_day}
 * .resets_at` off Claude Code stdin (epoch seconds → ms), so the
 * countdown agrees with the host's `/usage` screen. The local
 * `blockEnd` / `weekStart` derivation is a *fallback only*, used when the
 * host omits the window (older Claude Code, golden fixtures without
 * `rate_limits`). `options.resetWeekday` / `options.resetHour` pin only
 * that weekly fallback — the host's `resets_at` wins when present.
 *
 * `formatDuration` clamps negative remaining to zero, so a stale
 * `resets_at` (or block anchor) renders "0m" rather than a negative
 * count. Pure functions of `ctx.clock` + `ctx.stdin` (+ `ctx.tokens` for
 * the fallback block anchor).
 *
 * Wall-clock format tokens are the same vocabulary as `clock-format.ts`:
 *   `HH:mm` (default session), `EEE D HH:mm` (default weekly), `h:mma`, etc.
 */

import { ONE_WEEK_MS } from "../../core/lib/time.js";
import { blockEnd, weekStart } from "../../data/tokens/index.js";
import type { WidgetContext } from "../types.js";
import { formatClock } from "./clock-format.js";
import { formatDuration, resolveDurationFormat } from "./duration/duration.js";
import { frozenClock } from "../clock/clock.js";
import { hostResetMs } from "./host-reset.js";
import { resolveWeekReset } from "./week-reset.js";

/**
 * Duration formats handled by `formatDuration`. Any format string that is
 * NOT one of these is treated as a wall-clock format token and routed to
 * `formatClock` instead.
 */
const DURATION_FORMATS: ReadonlySet<string> = new Set(["short", "long", "clock", "compact"]);

/** Default wall-clock format for the session reset-at path. */
export const DEFAULT_SESSION_CLOCK_FORMAT = "HH:mm";
/** Default wall-clock format for the weekly reset-at path. */
export const DEFAULT_WEEKLY_CLOCK_FORMAT = "EEE D HH:mm";

export interface TimerOptions {
  readonly label?: string;
  readonly format?: string;
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). Weekly window only. */
  readonly resetWeekday?: number;
  /** Hour of day 0–23; minutes pinned to 0. Weekly window only. */
  readonly resetHour?: number;
  /**
   * Override timezone for wall-clock rendering (wall-clock format only).
   * Defaults to the host local time.
   */
  readonly tz?: string;
}

export function blockRemainingMs(ctx: WidgetContext): number {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return (hostResetMs(ctx, "five-hour") ?? localEnd) - now;
}

export function blockResetTime(ctx: WidgetContext): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return new Date(hostResetMs(ctx, "five-hour") ?? localEnd);
}

export function weeklyRemainingMs(ctx: WidgetContext, options: TimerOptions): number {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return (hostResetMs(ctx, "seven-day") ?? localEnd) - now;
}

export function weeklyResetTime(ctx: WidgetContext, options: TimerOptions): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return new Date(hostResetMs(ctx, "seven-day") ?? localEnd);
}

/**
 * Returns `true` when `format` is a wall-clock format string (e.g.
 * `"HH:mm"`, `"EEE D HH:mm"`). Any non-empty string that is not a known
 * duration format routes to the wall-clock path.
 */
export function isClockFormat(format: string | undefined): boolean {
  return typeof format === "string" && format.length > 0 && !DURATION_FORMATS.has(format);
}

/** Format one window's remaining-time countdown, e.g. `1h 30m`. */
export function countdownText(remainingMs: number, format: string | undefined): string {
  return formatDuration(remainingMs, resolveDurationFormat(format, "compact"));
}

/** Format one window's absolute reset time, e.g. `18:30`. */
export function resetAtText(
  resetAt: Date,
  format: string | undefined,
  fallbackFormat: string,
  tz: string | undefined,
): string {
  const fmt = typeof format === "string" && format.length > 0 ? format : fallbackFormat;
  return formatClock(frozenClock(resetAt), fmt, tz);
}
