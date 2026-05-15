/**
 * Time widget family (§7.7). Mirrors the registration pattern of the
 * other widget families — a frozen `TIME_WIDGETS` array plus a
 * `registerTimeWidgets(registry)` helper used by the default-registry
 * bootstrap.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { clockWidget } from "./clock.js";
import { uptimeBlockWidget, uptimeSessionWidget } from "./uptime.js";

export { clockWidget, formatClock } from "./clock.js";
export { uptimeBlockWidget, uptimeSessionWidget } from "./uptime.js";

export const TIME_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(clockWidget),
  eraseWidget(uptimeBlockWidget),
  eraseWidget(uptimeSessionWidget),
]);

export function registerTimeWidgets(registry: WidgetRegistry): void {
  for (const def of TIME_WIDGETS) {
    registry.register(def);
  }
}
