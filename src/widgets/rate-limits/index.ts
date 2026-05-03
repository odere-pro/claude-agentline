/**
 * Rate-limit widget family (§7.5). Mirrors the session/tokens/context
 * registration shape: a frozen `RATE_LIMIT_WIDGETS` array plus a
 * `registerRateLimitWidgets(registry)` helper for the default-registry
 * bootstrap.
 *
 * Widgets shipped:
 *   - session-usage / weekly-usage  (block / week token usage)
 *   - block-timer / block-reset-timer / weekly-reset-timer
 *   - model-usage / effort-usage    (per-axis token aggregates)
 *   - compaction-counter            (transcript JSONL compaction marker)
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import {
  compactionCounterWidget,
  effortUsageWidget,
  modelUsageWidget,
} from "./aggregates.js";
import {
  blockResetTimerWidget,
  blockTimerWidget,
  weeklyResetTimerWidget,
} from "./timers.js";
import { sessionUsageWidget, weeklyUsageWidget } from "./usage.js";

export {
  compactionCounterWidget,
  effortUsageWidget,
  modelUsageWidget,
} from "./aggregates.js";
export {
  blockResetTimerWidget,
  blockTimerWidget,
  weeklyResetTimerWidget,
} from "./timers.js";
export { sessionUsageWidget, weeklyUsageWidget } from "./usage.js";
export {
  formatDuration,
  resolveDurationFormat,
  type DurationFormat,
} from "./duration.js";

export const RATE_LIMIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  blockResetTimerWidget as WidgetDef<unknown>,
  blockTimerWidget as WidgetDef<unknown>,
  compactionCounterWidget as WidgetDef<unknown>,
  effortUsageWidget as WidgetDef<unknown>,
  modelUsageWidget as WidgetDef<unknown>,
  sessionUsageWidget as WidgetDef<unknown>,
  weeklyResetTimerWidget as WidgetDef<unknown>,
  weeklyUsageWidget as WidgetDef<unknown>,
]);

export function registerRateLimitWidgets(registry: WidgetRegistry): void {
  for (const def of RATE_LIMIT_WIDGETS) {
    registry.register(def);
  }
}
