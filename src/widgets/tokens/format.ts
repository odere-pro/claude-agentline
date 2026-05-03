/**
 * Shared formatting helpers for token / cost widgets.
 */

const ROLE_THRESHOLDS = {
  low: 0.6,
  high: 0.8,
} as const;

function trim1(value: number): string {
  const s = value.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatCount(n: number): string {
  if (n < 1000) return Math.round(n).toString();
  if (n < 10_000) return `${trim1(n / 1000)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${trim1(n / 1_000_000)}M`;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return "$0.00";
  if (usd < 10) return `$${usd.toFixed(2)}`;
  if (usd < 100) return `$${usd.toFixed(1)}`;
  return `$${Math.round(usd)}`;
}

export function formatSpeed(perSec: number): string {
  if (perSec < 1) return `0`;
  if (perSec < 100) return `${trim1(perSec)}/s`;
  if (perSec < 1000) return `${Math.round(perSec)}/s`;
  return `${trim1(perSec / 1000)}k/s`;
}

export function tokenRole(ratio: number): "tokens-low" | "tokens-mid" | "tokens-high" {
  if (ratio < ROLE_THRESHOLDS.low) return "tokens-low";
  if (ratio < ROLE_THRESHOLDS.high) return "tokens-mid";
  return "tokens-high";
}
