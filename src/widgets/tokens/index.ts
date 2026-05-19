/**
 * Token / speed widgets registration entry-point. Mirrors the
 * session-widgets pattern: a frozen `TOKEN_WIDGETS` array plus a
 * `registerTokenWidgets(registry)` helper used by the default
 * registry bootstrap.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { tokensCachedWidget, tokensWidget } from "./fields.js";
import { tokenSpeedWidget } from "./speed.js";

export const TOKEN_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(tokensWidget),
  eraseWidget(tokensCachedWidget),
  eraseWidget(tokenSpeedWidget),
]);

export function registerTokenWidgets(registry: WidgetRegistry): void {
  for (const def of TOKEN_WIDGETS) {
    registry.register(def);
  }
}
