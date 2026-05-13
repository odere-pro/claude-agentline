/**
 * Rate-limit widget family (§7.5). Mirrors the session/tokens/context
 * registration shape: a frozen `RATE_LIMIT_WIDGETS` array plus a
 * `registerRateLimitWidgets(registry)` helper for the default-registry
 * bootstrap.
 *
 * Widgets shipped:
 *   - session-usage          (block token usage)
 *   - block-reset-timer      (countdown to the next block reset)
 *   - weekly-reset-timer     (countdown to the next weekly reset)
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { blockResetTimerWidget, weeklyResetTimerWidget } from "./timers.js";
import { sessionUsageWidget } from "./usage.js";

export { blockResetTimerWidget, weeklyResetTimerWidget } from "./timers.js";
export { sessionUsageWidget } from "./usage.js";
export {
  formatDuration,
  resolveDurationFormat,
  type DurationFormat,
} from "./duration.js";

export const RATE_LIMIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  blockResetTimerWidget as WidgetDef<unknown>,
  sessionUsageWidget as WidgetDef<unknown>,
  weeklyResetTimerWidget as WidgetDef<unknown>,
]);

export function registerRateLimitWidgets(registry: WidgetRegistry): void {
  for (const def of RATE_LIMIT_WIDGETS) {
    registry.register(def);
  }
}
