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
