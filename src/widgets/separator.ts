/**
 * Shared intra-widget value separator (§7.1).
 *
 * The character that divides sub-values *inside* a single widget
 * (e.g. `65k · 1M`) is config-driven via `global.valueSeparator`.
 * Distinct from the whole-widget separator. Every multi-value widget
 * routes through these helpers so the gap is uniform and configurable.
 *
 * Pure: no I/O, no wall-clock — safe on the render hot path.
 */

import type { WidgetContext } from "./types.js";

/** The configured intra-widget value separator (default "·"). */
export function valueSeparator(ctx: WidgetContext): string {
  return ctx.config.global.valueSeparator;
}

/** Join sub-values with the configured separator, single-spaced each side. */
export function joinValues(ctx: WidgetContext, parts: readonly string[]): string {
  return parts.join(` ${valueSeparator(ctx)} `);
}
