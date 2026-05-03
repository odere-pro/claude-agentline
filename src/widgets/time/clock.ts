/**
 * `clock` widget (§7.7). Local time, format configurable via
 * `options.format`:
 *
 *   - `HH:mm`         (default) → 14:32
 *   - `HH:mm:ss`                  → 14:32:05
 *   - `H:mm`                      → 4:32
 *   - `h:mm`                      → 4:32 (12-hour, no AM/PM)
 *   - `h:mma`                     → 4:32pm
 *   - any literal not matching a known token is left as-is
 *
 * Reads `ctx.clock.now()` so goldens stay deterministic.
 */

import type { Cell } from "../cell.js";
import type { Clock } from "../clock.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
  /** Override timezone for tests; defaults to host local time. */
  readonly tz?: string;
}

const DEFAULT_FORMAT = "HH:mm";

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
}

function extractParts(date: Date, tz: string | undefined): DateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
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
  return {
    hours24,
    hours12,
    minutes,
    seconds,
    ampm,
    ampmUpper: ampm === "am" ? "AM" : "PM",
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function applyTokens(format: string, parts: DateParts): string {
  // Tokens longest-first to avoid partial replacement
  // (e.g. `HH` before `H`).
  const tokens: ReadonlyArray<readonly [string, string]> = [
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

export const clockWidget = defineWidget<Options>("clock", (ctx, settings): Cell => {
  const format = typeof settings.options.format === "string" && settings.options.format.length > 0
    ? settings.options.format
    : DEFAULT_FORMAT;
  const text = formatClock(ctx.clock, format, settings.options.tz);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${text}` };
});
