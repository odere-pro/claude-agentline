/**
 * Wall-clock + uptime widgets — `clock`, `uptime-session`, `uptime-block`.
 */

import { entry, v, type WidgetMeta } from "./types.js";

export const TIME_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  clock: entry("Clock", "Wall-clock time; options.format accepts strftime", "time", [
    v("time-24h", "24-hour (14:30)", { format: "%H:%M" }),
    v("time-12h", "12-hour (2:30PM)", { format: "%I:%M%p" }),
    v("seconds", "With seconds (14:30:45)", { format: "%H:%M:%S" }),
    v("date", "Date (2026-05-13)", { format: "%Y-%m-%d" }),
    v("datetime", "Date + time (2026-05-13 14:30)", { format: "%Y-%m-%d %H:%M" }),
  ]),
  "uptime-session": entry(
    "Session uptime",
    "Uptime since the Claude Code session started",
    "time",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
    ],
  ),
  "uptime-block": entry("Block uptime", "Uptime of the active conversation block", "time", [
    v("short", "Short (1h 23m)", { format: "short" }),
    v("long", "Long (1 hour 23 minutes)", { format: "long" }),
    v("clock", "Clock (01:23:45)", { format: "clock" }),
  ]),
});
