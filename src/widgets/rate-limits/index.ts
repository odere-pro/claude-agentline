/**
 * Rate-limit widget family (§7.5). Mirrors the session/tokens/context
 * registration shape: a frozen `RATE_LIMIT_WIDGETS` array plus a
 * `registerRateLimitWidgets(registry)` helper for the default-registry
 * bootstrap.
 *
 * Widgets shipped:
 *   - session-weekly-usage        (combined session + weekly usage %)
 *   - current-session-reset-timer (countdown to the next session reset;
 *                                  wall-clock variants via clock-format tokens)
 *   - week-limit-timer            (countdown to the next weekly reset;
 *                                  wall-clock variants via clock-format tokens)
 *
 * The former `current-session-reset-at` and `weekly-reset-at` widgets were
 * folded into format variants of the corresponding timer widgets (PR #258).
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { currentSessionResetTimerWidget, weekLimitTimerWidget } from "./timers.js";
import { sessionWeeklyUsageWidget } from "./usage.js";

export const RATE_LIMIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(sessionWeeklyUsageWidget),
  eraseWidget(currentSessionResetTimerWidget),
  eraseWidget(weekLimitTimerWidget),
]);

export function registerRateLimitWidgets(registry: WidgetRegistry): void {
  for (const def of RATE_LIMIT_WIDGETS) {
    registry.register(def);
  }
}
