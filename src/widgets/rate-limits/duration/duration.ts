/**
 * Duration formatters shared by rate-limit timer widgets (§7.5).
 *
 * Four formats:
 *   - `short`   → `3h12m`, `45m`, `0m`
 *   - `long`    → `3h 12m`, `45m`, `0m`
 *   - `clock`   → `03:12:00`, `00:45:00`
 *   - `compact` → `2d 1h 59m`, `1h 30m`, `30m` (day-aware; always
 *                 keeps minutes so a countdown never collapses to a
 *                 bare `1h` — the default for the `*-reset-timer`
 *                 widgets)
 *
 * Inputs are clamped at zero — a negative remaining duration renders
 * the same as zero so a stale block anchor never produces `-1m`.
 */

import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../core/lib/time.js";

export type DurationFormat = "short" | "long" | "clock" | "compact";

export function formatDuration(ms: number, format: DurationFormat = "short"): string {
  // A non-finite duration (e.g. an overflowed host reset) renders as zero
  // rather than `Infinityd NaNh NaNm`; the formatter stays total.
  const clamped = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const hours = Math.floor(clamped / HOUR_MS);
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((clamped % MINUTE_MS) / 1000);
  switch (format) {
    case "clock":
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    case "long":
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    case "compact": {
      const days = Math.floor(clamped / DAY_MS);
      if (days > 0) {
        const remHours = Math.floor((clamped % DAY_MS) / HOUR_MS);
        return `${days}d ${remHours}h ${minutes}m`;
      }
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    case "short":
    default:
      return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
  }
}

const VALID: ReadonlySet<DurationFormat> = new Set<DurationFormat>([
  "short",
  "long",
  "clock",
  "compact",
]);

export function resolveDurationFormat(
  value: unknown,
  fallback: DurationFormat = "short",
): DurationFormat {
  if (typeof value !== "string") return fallback;
  return VALID.has(value as DurationFormat) ? (value as DurationFormat) : fallback;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
