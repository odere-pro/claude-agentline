/**
 * Rate-limit widget family (§7.5). Mirrors the session/tokens/context
 * registration shape: a frozen `RATE_LIMIT_WIDGETS` array plus a
 * `registerRateLimitWidgets(registry)` helper for the default-registry
 * bootstrap.
 *
 * Widgets shipped:
 *   - session-weekly-usage  (combined session + weekly usage %)
 *   - reset-timer           (combined session + weekly reset on one cell;
 *                            countdown or wall-clock via the `format` option)
 *
 * The former `current-session-reset-timer` + `week-limit-timer` were merged
 * into the single `reset-timer` (PR #224); the per-window math lives in
 * `timers.ts`. The earlier `current-session-reset-at` / `weekly-reset-at`
 * widgets were folded into the timer format variants (PR #258).
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { resetTimerWidget } from "./reset-timer.js";
import { sessionWeeklyUsageWidget } from "./usage.js";

export const RATE_LIMIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(sessionWeeklyUsageWidget),
  eraseWidget(resetTimerWidget),
]);

export function registerRateLimitWidgets(registry: WidgetRegistry): void {
  for (const def of RATE_LIMIT_WIDGETS) {
    registry.register(def);
  }
}
