/**
 * Quota + reset-time widgets — one combined session+weekly usage cell
 * and each reset paired (countdown + wall-clock). Mirrors the host's
 * usage-limits screen: current-session and weekly usage on a single
 * cell, plus their resets. Per-model splits were dropped — the host
 * shows one bar.
 *
 * The weekly widgets accept `resetWeekday` (0=Sun…6=Sat) and `resetHour`
 * (0–23) to pin the reset to the account's real anchor; unset → local
 * Monday 00:00. Those are free-form options (not variants) to avoid a
 * format × weekday combinatorial blow-up in the picker.
 */

import { entry, v, type WidgetMeta } from "./types.js";

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
    ],
  ),
  "current-session-reset-at": entry(
    "Current session reset at",
    "Wall-clock time of the next session reset (e.g. resets 18:30)",
    "rate-limits",
    [
      v("time-24h", "24-hour (18:30)", { format: "HH:mm" }),
      v("time-12h", "12-hour (6:30pm)", { format: "h:mma" }),
      v("seconds", "With seconds (18:30:45)", { format: "HH:mm:ss" }),
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
    ],
  ),
  "weekly-reset-at": entry(
    "Weekly reset at",
    "Day + time of the next weekly reset (e.g. week resets Mon 17 00:00)",
    "rate-limits",
    [
      v("day-time", "Day + time (Mon 17 00:00)", { format: "EEE D HH:mm" }),
      v("day-only", "Day only (Mon 17)", { format: "EEE D" }),
      v("time-24h", "Time only 24-hour (00:00)", { format: "HH:mm" }),
      v("time-12h", "Time only 12-hour (12:00am)", { format: "h:mma" }),
    ],
  ),
});
