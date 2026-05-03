/**
 * Duration formatters shared by rate-limit timer widgets (§7.5).
 *
 * Three formats:
 *   - `short`  → `3h12m`, `45m`, `0m`
 *   - `long`   → `3h 12m`, `45m`, `0m`
 *   - `clock`  → `03:12:00`, `00:45:00`
 *
 * Inputs are clamped at zero — a negative remaining duration renders
 * the same as zero so a stale block anchor never produces `-1m`.
 */

export type DurationFormat = "short" | "long" | "clock";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function formatDuration(ms: number, format: DurationFormat = "short"): string {
  const clamped = Math.max(0, Math.floor(ms));
  const hours = Math.floor(clamped / HOUR_MS);
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((clamped % MINUTE_MS) / 1000);
  switch (format) {
    case "clock":
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    case "long":
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    case "short":
    default:
      return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
  }
}

const VALID: ReadonlySet<DurationFormat> = new Set<DurationFormat>(["short", "long", "clock"]);

export function resolveDurationFormat(value: unknown, fallback: DurationFormat = "short"): DurationFormat {
  if (typeof value !== "string") return fallback;
  return VALID.has(value as DurationFormat) ? (value as DurationFormat) : fallback;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
