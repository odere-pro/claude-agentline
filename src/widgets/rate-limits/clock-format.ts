/**
 * Wall-clock token formatter used by the timer widgets
 * (`current-session-reset-timer`, `week-limit-timer`) when an at-*
 * clock-format variant is selected. Renders a `Clock`'s `now()` through
 * a small strftime-like token vocabulary:
 *
 *   - `HH:mm`         (default) → 14:32
 *   - `HH:mm:ss`                  → 14:32:05
 *   - `H:mm`                      → 4:32
 *   - `h:mm`                      → 4:32 (12-hour, no AM/PM)
 *   - `h:mma`                     → 4:32pm
 *   - `EEE`                       → Mon (abbreviated weekday)
 *   - `D`                         → 17 (day of month, no leading zero)
 *   - any literal not matching a known token is left as-is
 *
 * Pure: reads only the `Clock` passed in, so callers stay deterministic
 * under a frozen clock.
 */

import type { Clock } from "../clock/clock.js";

/** Abbreviated weekday names (vocabulary). Index 0 = Sunday. */
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatClock(clock: Clock, format: string, tz?: string): string {
  const date = clock.now();
  const parts = extractParts(date, tz);
  return applyTokens(format, parts);
}

interface DateParts {
  readonly hours24: number;
  readonly hours12: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly ampm: "am" | "pm";
  readonly ampmUpper: "AM" | "PM";
  readonly weekdayAbbr: string;
  readonly dayOfMonth: number;
}

function extractParts(date: Date, tz: string | undefined): DateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    day: "numeric",
    hour12: false,
    ...(tz !== undefined ? { timeZone: tz } : {}),
  });
  const map = new Map<string, string>();
  for (const part of fmt.formatToParts(date)) map.set(part.type, part.value);
  const h24Raw = map.get("hour") ?? "0";
  const hours24 = (Number.parseInt(h24Raw, 10) || 0) % 24;
  const minutes = Number.parseInt(map.get("minute") ?? "0", 10) || 0;
  const seconds = Number.parseInt(map.get("second") ?? "0", 10) || 0;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const ampm = hours24 < 12 ? "am" : "pm";
  /*
   * `weekday: "short"` via en-US Intl gives "Sun", "Mon", etc. — matches
   * WEEKDAY_ABBR exactly. Day is the numeric day-of-month string.
   */
  const weekdayAbbr = map.get("weekday") ?? WEEKDAY_ABBR[date.getDay()] ?? "Sun";
  const dayOfMonth = Number.parseInt(map.get("day") ?? "1", 10) || 1;
  return {
    hours24,
    hours12,
    minutes,
    seconds,
    ampm,
    ampmUpper: ampm === "am" ? "AM" : "PM",
    weekdayAbbr,
    dayOfMonth,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function applyTokens(format: string, parts: DateParts): string {
  /*
   * Tokens longest-first to avoid partial replacement
   * (e.g. `HH` before `H`, `EEE` before any single-char token).
   */
  const tokens: ReadonlyArray<readonly [string, string]> = [
    ["EEE", parts.weekdayAbbr],
    ["HH", pad2(parts.hours24)],
    ["mm", pad2(parts.minutes)],
    ["ss", pad2(parts.seconds)],
    ["hh", pad2(parts.hours12)],
    ["AA", parts.ampmUpper],
    ["aa", parts.ampm],
    ["H", String(parts.hours24)],
    ["h", String(parts.hours12)],
    ["A", parts.ampmUpper],
    ["a", parts.ampm],
    ["D", String(parts.dayOfMonth)],
  ];
  const placeholders: string[] = [];
  let work = format;
  for (let i = 0; i < tokens.length; i += 1) {
    const entry = tokens[i];
    if (!entry) continue;
    const [token] = entry;
    const placeholder = `\x00${i}\x00`;
    work = work.split(token).join(placeholder);
    placeholders.push(placeholder);
  }
  for (let i = 0; i < tokens.length; i += 1) {
    const entry = tokens[i];
    if (!entry) continue;
    const [, value] = entry;
    const placeholder = placeholders[i];
    if (placeholder === undefined) continue;
    work = work.split(placeholder).join(value);
  }
  return work;
}
