/**
 * Rate-limit widget family (§7.5). Mirrors the session/tokens/context
 * registration shape: a frozen `RATE_LIMIT_WIDGETS` array plus a
 * `registerRateLimitWidgets(registry)` helper for the default-registry
 * bootstrap.
 *
 * Widgets shipped:
 *   - session-weekly-usage        (combined session + weekly usage %)
 *   - current-session-reset-timer (countdown to the next session reset)
 *   - current-session-reset-at    (wall-clock of the next session reset)
 *   - week-limit-timer            (countdown to the next weekly reset)
 *   - weekly-reset-at             (wall-clock of the next weekly reset)
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { currentSessionResetAtWidget, weeklyResetAtWidget } from "./reset-at.js";
import { currentSessionResetTimerWidget, weekLimitTimerWidget } from "./timers.js";
import { sessionWeeklyUsageWidget } from "./usage.js";

export const RATE_LIMIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(sessionWeeklyUsageWidget),
  eraseWidget(currentSessionResetTimerWidget),
  eraseWidget(currentSessionResetAtWidget),
  eraseWidget(weekLimitTimerWidget),
  eraseWidget(weeklyResetAtWidget),
]);

export function registerRateLimitWidgets(registry: WidgetRegistry): void {
  for (const def of RATE_LIMIT_WIDGETS) {
    registry.register(def);
  }
}
