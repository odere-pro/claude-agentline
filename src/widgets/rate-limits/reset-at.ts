/**
 * `current-session-reset-at` and `weekly-reset-at` widgets (§7.5).
 *
 * Render the absolute wall-clock time at which the next reset
 * happens — complementary to the countdown form (`*-timer`). Default
 * label `"resets "` for the session, `"week resets "` for the weekly;
 * session default format is `HH:mm` (24-hour), weekly default is
 * `EEE D HH:mm`, configurable via `options.format` using the
 * wall-clock format tokens in `./clock-format.js`.
 *
 * Both prefer the host's `rate_limits.{five_hour,seven_day}.resets_at`
 * off Claude Code stdin (epoch seconds → ms), so the wall-clock agrees
 * with the host's `/usage` screen. The local `blockEnd` / `weekStart`
 * derivation is a *fallback only*, used when the host omits the window
 * (older Claude Code, golden fixtures without `rate_limits`). The weekly
 * fallback anchors to local Monday 00:00; `options.resetWeekday`
 * (0=Sun…6=Sat) and `options.resetHour` (0–23) pin only that fallback —
 * the host's `resets_at` wins when present. A host `resets_at` already
 * in the past renders that past wall-clock verbatim (no clamp — the
 * host instant is authoritative and self-corrects on the next render).
 *
 * Pure functions of `ctx.clock` + `ctx.stdin` (+ `ctx.tokens` for the
 * fallback block anchor).
 */

import { identityTranslator, widgetLabelId } from "../../i18n/index.js";
import { blockEnd, weekStart } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatClock } from "./clock-format.js";
import { hostResetMs } from "./host-reset.js";
import { resolveWeekReset } from "./week-reset.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
  /** Override timezone for tests; defaults to host local time. */
  readonly tz?: string;
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). Weekly only. */
  readonly resetWeekday?: number;
  /** Hour of day 0–23; minutes pinned to 0. Weekly only. */
  readonly resetHour?: number;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_FORMAT = "HH:mm";
const DEFAULT_WEEKLY_FORMAT = "EEE D HH:mm";

function blockResetTime(ctx: WidgetContext): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = blockEnd({ now, blockAnchor: ctx.tokens?.blockAnchor });
  return new Date(hostResetMs(ctx, "five-hour") ?? localEnd);
}

function weeklyResetTime(ctx: WidgetContext, options: Options): Date {
  const now = ctx.clock.now().getTime();
  const localEnd = weekStart(now, resolveWeekReset(options)) + ONE_WEEK_MS;
  return new Date(hostResetMs(ctx, "seven-day") ?? localEnd);
}

function atCell(
  ctx: WidgetContext,
  resetAt: Date,
  settings: WidgetSettings<Options>,
  defaultLabel: string,
  defaultFormat: string = DEFAULT_FORMAT,
): Cell {
  const format =
    typeof settings.options.format === "string" && settings.options.format.length > 0
      ? settings.options.format
      : defaultFormat;
  const text = formatClock(frozenClock(resetAt), format, settings.options.tz);
  const t = ctx.t ?? identityTranslator;
  const label = settings.rawValue
    ? ""
    : (settings.options.label ?? t(widgetLabelId("reset-at"), defaultLabel));
  return { text: `${label}${text}` };
}

export const currentSessionResetAtWidget = defineWidget<Options>(
  "current-session-reset-at",
  (ctx, settings) => atCell(ctx, blockResetTime(ctx), settings, "resets "),
);

export const weeklyResetAtWidget = defineWidget<Options>("weekly-reset-at", (ctx, settings) =>
  atCell(
    ctx,
    weeklyResetTime(ctx, settings.options),
    settings,
    "week resets ",
    DEFAULT_WEEKLY_FORMAT,
  ),
);
