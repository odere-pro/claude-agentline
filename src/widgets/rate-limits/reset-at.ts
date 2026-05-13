/**
 * `block-reset-at` and `weekly-reset-at` widgets (§7.5).
 *
 * Render the absolute wall-clock time at which the next reset
 * happens — complementary to the existing countdown form
 * (`*-reset-timer`). Default label `"resets "`; default format is
 * `HH:mm`, configurable via `options.format` using the same tokens
 * the `clock` widget supports.
 *
 * Pure functions of `ctx.clock` + `ctx.tokens` (for the block
 * anchor) and `weekStart` from the tokens module (for the weekly
 * boundary). When the tokens snapshot is missing, the block reset
 * falls back to "5 hours from now" — same arithmetic the
 * `block-reset-timer` widget uses.
 */

import { blockEnd, weekStart } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatClock } from "../time/clock.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
  /** Override timezone for tests; defaults to host local time. */
  readonly tz?: string;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_FORMAT = "HH:mm";

function blockResetTime(ctx: WidgetContext): Date {
  const now = ctx.clock.now().getTime();
  const anchor = ctx.tokens?.blockAnchor;
  return new Date(blockEnd({ now, blockAnchor: anchor }));
}

function weeklyResetTime(ctx: WidgetContext): Date {
  const now = ctx.clock.now().getTime();
  return new Date(weekStart(now) + ONE_WEEK_MS);
}

function atCell(resetAt: Date, settings: WidgetSettings<Options>, defaultLabel: string): Cell {
  const format =
    typeof settings.options.format === "string" && settings.options.format.length > 0
      ? settings.options.format
      : DEFAULT_FORMAT;
  const text = formatClock(frozenClock(resetAt), format, settings.options.tz);
  const label = settings.rawValue ? "" : (settings.options.label ?? defaultLabel);
  return { text: `${label}${text}` };
}

export const blockResetAtWidget = defineWidget<Options>("block-reset-at", (ctx, settings) =>
  atCell(blockResetTime(ctx), settings, "resets "),
);

export const weeklyResetAtWidget = defineWidget<Options>("weekly-reset-at", (ctx, settings) =>
  atCell(weeklyResetTime(ctx), settings, "week resets "),
);
