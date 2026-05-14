/**
 * Quota + reset-time widgets — session usage, weekly per-model usage,
 * and each reset paired (countdown + wall-clock).
 */

import { entry, v, type WidgetMeta } from "./types.js";

export const RATE_LIMITS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "session-usage": entry(
    "Session usage",
    "Percentage of the session quota consumed",
    "rate-limits",
    [
      v("percent", "Percent (65%)", { display: "percent" }),
      v("bar", "Bar (12 cells)", { display: "bar" }),
      v("short-bar", "Short bar (6 cells)", { display: "short-bar" }),
    ],
  ),
  "weekly-sonnet-usage": entry(
    "Weekly Sonnet usage",
    "Sonnet tokens consumed this week (set options.limit for a %)",
    "rate-limits",
    [
      v("percent", "Percent (65%)", { display: "percent" }),
      v("bar", "Bar (12 cells)", { display: "bar" }),
      v("short-bar", "Short bar (6 cells)", { display: "short-bar" }),
    ],
  ),
  "weekly-opus-usage": entry(
    "Weekly Opus usage",
    "Opus tokens consumed this week (set options.limit for a %)",
    "rate-limits",
    [
      v("percent", "Percent (65%)", { display: "percent" }),
      v("bar", "Bar (12 cells)", { display: "bar" }),
      v("short-bar", "Short bar (6 cells)", { display: "short-bar" }),
    ],
  ),
  "block-reset-timer": entry(
    "Block reset timer",
    "Time remaining until the next block resets",
    "rate-limits",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
    ],
  ),
  "block-reset-at": entry(
    "Block reset at",
    "Wall-clock time of the next block reset (e.g. resets 18:30)",
    "rate-limits",
    [
      v("time-24h", "24-hour (18:30)", { format: "HH:mm" }),
      v("time-12h", "12-hour (6:30pm)", { format: "h:mma" }),
      v("seconds", "With seconds (18:30:45)", { format: "HH:mm:ss" }),
    ],
  ),
  "weekly-reset-timer": entry(
    "Weekly reset timer",
    "Time remaining until the weekly quota resets",
    "rate-limits",
    [
      v("short", "Short (3d 4h)", { format: "short" }),
      v("long", "Long (3 days 4 hours)", { format: "long" }),
      v("clock", "Clock", { format: "clock" }),
    ],
  ),
  "weekly-reset-at": entry(
    "Weekly reset at",
    "Wall-clock time of the next weekly reset (e.g. resets 18:30)",
    "rate-limits",
    [
      v("time-24h", "24-hour (18:30)", { format: "HH:mm" }),
      v("time-12h", "12-hour (6:30pm)", { format: "h:mma" }),
      v("seconds", "With seconds (18:30:45)", { format: "HH:mm:ss" }),
    ],
  ),
});
