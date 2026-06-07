/**
 * Quota + reset-time widgets — one combined session+weekly usage cell and
 * one combined session+weekly reset-timer cell. Mirrors the host's
 * usage-limits screen: current-session and weekly on a single cell each.
 *
 * The two former timers (`current-session-reset-timer` + `week-limit-timer`)
 * were merged into a single `reset-timer` that renders BOTH windows on one
 * cell (PR #224). A single `format` variant drives both windows: countdown
 * (`short`/`long`/`clock`) or reset-at (`at-24h`/`at-12h`/`at-seconds`).
 *
 * `reset-timer` also accepts `resetWeekday` (0=Sun…6=Sat) and `resetHour`
 * (0–23) to pin the weekly reset to the account's real anchor; unset →
 * local Monday 00:00. Those are free-form options (not variants) to avoid a
 * format × weekday combinatorial blow-up in the picker.
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const RATE_LIMITS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "session-weekly-usage": entry(
    "Session + weekly usage",
    "Live session + weekly usage % from Claude Code's /usage (52% / weekly 33%)",
    "rate-limits",
  ),
  "reset-timer": entry(
    "Reset timer",
    "Session + weekly reset on one cell (reset in 1h 30m · weekly 3d 4h 0m)",
    "rate-limits",
    [
      v("short", "Countdown short (1h30m · weekly 3d4h)", { format: "short" }),
      v("long", "Countdown long (1 hour 30 minutes …)", { format: "long" }),
      v("clock", "Countdown clock (01:30:00 …)", { format: "clock" }),
      v("at-24h", "Resets at 24-hour (resets 18:30 · weekly …)", { format: "HH:mm" }),
      v("at-12h", "Resets at 12-hour (resets 6:30pm · weekly …)", { format: "h:mma" }),
      v("at-seconds", "Resets at with seconds (resets 18:30:45 …)", { format: "HH:mm:ss" }),
    ],
  ),
});
