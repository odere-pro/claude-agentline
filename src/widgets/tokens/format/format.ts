/**
 * Shared formatting helpers for token widgets.
 */


/** Magnitude breakpoints for count + rate formatting. */
const KILO = 1_000;
const TEN_KILO = 10_000;
const MEGA = 1_000_000;

/** Rate magnitudes: <DECIMAL_RATE uses 1-decimal, <INTEGER_RATE uses rounded, then k/s. */
const DECIMAL_RATE = 100;
const INTEGER_RATE = 1_000;

const ROLE_THRESHOLDS = {
  low: 0.6,
  high: 0.8,
} as const;

function trim1(value: number): string {
  const s = value.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatCount(n: number): string {
  if (n < KILO) return Math.round(n).toString();
  if (n < TEN_KILO) return `${trim1(n / KILO)}k`;
  if (n < MEGA) {
    const rounded = Math.round(n / KILO);
    if (rounded >= KILO) return `${trim1(n / MEGA)}M`;
    return `${rounded}k`;
  }
  return `${trim1(n / MEGA)}M`;
}

export function formatSpeed(perSec: number): string {
  if (perSec < 1) return `0`;
  if (perSec < DECIMAL_RATE) return `${trim1(perSec)}/s`;
  if (perSec < INTEGER_RATE) {
    const rounded = Math.round(perSec);
    if (rounded >= INTEGER_RATE) return `${trim1(perSec / INTEGER_RATE)}k/s`;
    return `${rounded}/s`;
  }
  return `${trim1(perSec / INTEGER_RATE)}k/s`;
}

export function tokenRole(ratio: number): "tokens-low" | "tokens-mid" | "tokens-high" {
  if (ratio < ROLE_THRESHOLDS.low) return "tokens-low";
  if (ratio < ROLE_THRESHOLDS.high) return "tokens-mid";
  return "tokens-high";
}

/**
 * Format a USD cost for display in the `cost-usd` widget.
 *
 * Rules (toFixed-based, parallel to `trim1`/`formatCount`):
 *   - < $1000  → `$<n.nn>` (2 decimal places, e.g. `$1.23`, `$12.30`, `$0`)
 *   - < $10000 → `$<n.n>k` (1 decimal, trimmed trailing .0, e.g. `$1.2k`)
 *   - ≥ $10000 → `$<n>k` or `$<n.n>M` following `formatCount` magnitudes
 *
 * Whole-dollar amounts below $1000 drop the decimal point
 * (e.g. `$12` not `$12.00`) for compactness.
 */
export function formatUsd(n: number): string {
  if (n >= MEGA) return `$${trim1(n / MEGA)}M`;
  if (n >= TEN_KILO) {
    const rounded = Math.round(n / KILO);
    if (rounded >= KILO) return `$${trim1(n / MEGA)}M`;
    return `$${rounded}k`;
  }
  if (n >= KILO) return `$${trim1(n / KILO)}k`;
  // Below $1000: show two decimal places, but trim ".00" to keep it compact.
  const fixed = n.toFixed(2);
  return fixed.endsWith(".00") ? `$${fixed.slice(0, -3)}` : `$${fixed}`;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Format a cost-block duration (ms) for the API-time widgets.
 *
 * Unlike the rate-limit timer formatters (which floor to whole minutes —
 * an API call of 2.3s would read as `0m`), this keeps sub-minute
 * precision because API durations are routinely seconds:
 *   - < 1 min  → `<n.n>s` (1 decimal, trimmed `.0`, e.g. `2.3s`, `5s`)
 *   - < 1 hour → `<m>m <s>s` (seconds rounded, e.g. `1m 5s`)
 *   - ≥ 1 hour → `<h>h <m>m` (seconds dropped, e.g. `1h 5m`)
 *
 * Negative / non-finite inputs clamp to `0s` so a malformed host scalar
 * never produces `NaNs`.
 */
export function formatCostDuration(ms: number): string {
  const clamped = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  if (clamped < MINUTE_MS) {
    return `${trim1(clamped / 1000)}s`;
  }
  if (clamped < HOUR_MS) {
    const minutes = Math.floor(clamped / MINUTE_MS);
    const seconds = Math.round((clamped % MINUTE_MS) / 1000);
    // Carry a rounded-up 60s into the next minute so we never print `Xm 60s`.
    if (seconds === 60) return `${minutes + 1}m 0s`;
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(clamped / HOUR_MS);
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS);
  return `${hours}h ${minutes}m`;
}
