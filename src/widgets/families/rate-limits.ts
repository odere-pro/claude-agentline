/**
 * Quota + reset-time widgets — one combined session+weekly usage cell
 * and each reset timer with both countdown and wall-clock variants.
 * Mirrors the host's usage-limits screen: current-session and weekly
 * usage on a single cell, plus their resets. Per-model splits were
 * dropped — the host shows one bar.
 *
 * The former `current-session-reset-at` and `weekly-reset-at` widgets
 * were folded as wall-clock format variants into the corresponding
 * timer widgets (PR #258). Pass a wall-clock format token
 * (`"HH:mm"`, `"h:mma"`, `"EEE D HH:mm"`, etc.) as `options.format`
 * to get the absolute-time display.
 *
 * The weekly widgets accept `resetWeekday` (0=Sun…6=Sat) and `resetHour`
 * (0–23) to pin the reset to the account's real anchor; unset → local
 * Monday 00:00. Those are free-form options (not variants) to avoid a
 * format × weekday combinatorial blow-up in the picker.
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const RATE_LIMITS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "session-weekly-usage": entry(
    "Session + weekly usage",
    "Live session + weekly usage % from Claude Code's /usage (52% / weekly 33%)",
    "rate-limits",
  ),
  "current-session-reset-timer": entry(
    "Current session reset timer",
    "Time remaining until the current session resets",
    "rate-limits",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
      v("at-24h", "Resets at 24-hour (resets 18:30)", { format: "HH:mm" }),
      v("at-12h", "Resets at 12-hour (resets 6:30pm)", { format: "h:mma" }),
      v("at-seconds", "Resets at with seconds (resets 18:30:45)", { format: "HH:mm:ss" }),
    ],
  ),
  "week-limit-timer": entry(
    "Week limit timer",
    "Time remaining until the weekly limit resets",
    "rate-limits",
    [
      v("short", "Short (3d 4h)", { format: "short" }),
      v("long", "Long (3 days 4 hours)", { format: "long" }),
      v("clock", "Clock", { format: "clock" }),
      v("at-day-time", "Week resets day + time (week resets Mon 17 00:00)", {
        format: "EEE D HH:mm",
      }),
      v("at-24h", "Week resets time 24-hour (week resets 00:00)", { format: "HH:mm" }),
      v("at-12h", "Week resets time 12-hour (week resets 12:00am)", { format: "h:mma" }),
    ],
  ),
});
