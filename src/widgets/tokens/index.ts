/**
 * Token / speed widgets registration entry-point. Mirrors the
 * session-widgets pattern: a frozen `TOKEN_WIDGETS` array plus a
 * `registerTokenWidgets(registry)` helper used by the default
 * registry bootstrap.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import {
  tokensCachedWidget,
  tokensInputWidget,
  tokensOutputWidget,
  tokensTotalWidget,
} from "./fields.js";
import { inputSpeedWidget, outputSpeedWidget, totalSpeedWidget } from "./speed.js";

export {
  tokensCachedWidget,
  tokensInputWidget,
  tokensOutputWidget,
  tokensTotalWidget,
} from "./fields.js";
export { inputSpeedWidget, outputSpeedWidget, totalSpeedWidget } from "./speed.js";
export { resolveResetAxis } from "./options.js";
export { formatCount, formatSpeed, tokenRole } from "./format.js";

export const TOKEN_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(tokensTotalWidget),
  eraseWidget(tokensInputWidget),
  eraseWidget(tokensOutputWidget),
  eraseWidget(tokensCachedWidget),
  eraseWidget(inputSpeedWidget),
  eraseWidget(outputSpeedWidget),
  eraseWidget(totalSpeedWidget),
]);

export function registerTokenWidgets(registry: WidgetRegistry): void {
  for (const def of TOKEN_WIDGETS) {
    registry.register(def);
  }
}
