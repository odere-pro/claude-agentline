/**
 * `reset-timer` widget (§7.5) — both rate-limit reset windows on one cell.
 *
 * Replaces the former `current-session-reset-timer` + `week-limit-timer`
 * (PR #224). Like `session-weekly-usage` shows session AND weekly usage on
 * one cell, this shows session AND weekly reset on one cell:
 *
 *   - countdown (default)  `reset in 1h 30m · weekly 3d 4h`
 *   - reset-at (wall-clock format)  `resets 18:30 · weekly Mon 17 00:00`
 *
 * A single `format` drives BOTH windows: a duration format
 * (`short`/`long`/`clock`) gives the countdown; a wall-clock token
 * (`HH:mm` / `h:mma` / `HH:mm:ss`) gives the absolute reset time. The
 * weekly window uses its own default wall-clock format when the chosen
 * token is the session default, so it still shows the day.
 *
 * Reads host scalars (`rateLimits.{fiveHour,sevenDay}.resetsAt`), not the
 * transcript — NO reset axis. Each window is included only when it
 * resolves; both absent → hidden. `options.resetWeekday`/`resetHour`/`tz`
 * pin the weekly fallback / wall-clock zone. Pure `(ctx, settings) → Cell`.
 */

import { identityTranslator, widgetLabelId } from "../../core/i18n/index.js";
import type { Cell } from "../cell/cell.js";
import { joinValues } from "../separator/separator.js";
import type { WidgetContext } from "../types.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import {
  DEFAULT_SESSION_CLOCK_FORMAT,
  DEFAULT_WEEKLY_CLOCK_FORMAT,
  blockRemainingMs,
  blockResetTime,
  countdownText,
  isClockFormat,
  resetAtText,
  weeklyRemainingMs,
  weeklyResetTime,
  type TimerOptions,
} from "./timers.js";

const WEEKLY_PREFIX = "weekly ";

/** True when the host reported a `resets_at` for the named window. */
function hasHostWindow(ctx: WidgetContext, window: "fiveHour" | "sevenDay"): boolean {
  return typeof ctx.stdin.rateLimits?.[window]?.resetsAt === "number";
}

/**
 * Whether each window is renderable. The session window always resolves
 * (host value or the local 5-hour block fallback). The weekly window
 * resolves from the host value, or from the fallback only when the user
 * pinned a reset anchor (`resetWeekday`/`resetHour`) — otherwise an
 * un-pinned weekly fallback would invent a Monday-00:00 the host never
 * confirmed. A `tokens` snapshot is needed for the session fallback.
 */
function resolveWindows(
  ctx: WidgetContext,
  options: TimerOptions,
): { session: boolean; weekly: boolean } {
  const session = hasHostWindow(ctx, "fiveHour") || ctx.tokens !== undefined;
  const weekly =
    hasHostWindow(ctx, "sevenDay") ||
    options.resetWeekday !== undefined ||
    options.resetHour !== undefined;
  return { session, weekly };
}

export const resetTimerWidget = defineWidget<TimerOptions>(
  "reset-timer",
  (ctx, settings: WidgetSettings<TimerOptions>): Cell => {
    const { options } = settings;
    const windows = resolveWindows(ctx, options);
    if (!windows.session && !windows.weekly) return { text: "", hidden: true };

    const clockMode = isClockFormat(options.format);
    const parts: string[] = [];

    if (windows.session) {
      const text = clockMode
        ? resetAtText(blockResetTime(ctx), options.format, DEFAULT_SESSION_CLOCK_FORMAT, options.tz)
        : countdownText(blockRemainingMs(ctx), options.format);
      parts.push(text);
    }
    if (windows.weekly) {
      const text = clockMode
        ? resetAtText(
            weeklyResetTime(ctx, options),
            // Keep the weekly window's day when the user left the session
            // default; an explicit non-default token applies to both.
            options.format === DEFAULT_SESSION_CLOCK_FORMAT ? undefined : options.format,
            DEFAULT_WEEKLY_CLOCK_FORMAT,
            options.tz,
          )
        : countdownText(weeklyRemainingMs(ctx, options), options.format);
      parts.push(`${WEEKLY_PREFIX}${text}`);
    }

    const body = joinValues(ctx, parts);
    if (settings.rawValue) return { text: body };

    const t = ctx.t ?? identityTranslator;
    const defaultLabel = clockMode
      ? t(widgetLabelId("reset-at"), "resets ")
      : t(widgetLabelId("reset-in"), "reset in ");
    const label = options.label ?? defaultLabel;
    return { text: `${label}${body}` };
  },
);
