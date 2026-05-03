/**
 * Token / cost / speed widgets registration entry-point. Mirrors the
 * session-widgets pattern: a frozen `TOKEN_WIDGETS` array plus a
 * `registerTokenWidgets(registry)` helper used by the default
 * registry bootstrap.
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { costWidget } from "./cost.js";
import { inputSpeedWidget, outputSpeedWidget, totalSpeedWidget } from "./speed.js";
import { tokensCachedWidget } from "./tokens-cached.js";
import { tokensInputWidget } from "./tokens-input.js";
import { tokensOutputWidget } from "./tokens-output.js";
import { tokensTotalWidget } from "./tokens-total.js";

export { costWidget } from "./cost.js";
export { inputSpeedWidget, outputSpeedWidget, totalSpeedWidget } from "./speed.js";
export { tokensCachedWidget } from "./tokens-cached.js";
export { tokensInputWidget } from "./tokens-input.js";
export { tokensOutputWidget } from "./tokens-output.js";
export { tokensTotalWidget } from "./tokens-total.js";
export { resolveResetAxis } from "./options.js";
export { formatCount, formatCost, formatSpeed, tokenRole } from "./format.js";

export const TOKEN_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  costWidget as WidgetDef<unknown>,
  inputSpeedWidget as WidgetDef<unknown>,
  outputSpeedWidget as WidgetDef<unknown>,
  tokensCachedWidget as WidgetDef<unknown>,
  tokensInputWidget as WidgetDef<unknown>,
  tokensOutputWidget as WidgetDef<unknown>,
  tokensTotalWidget as WidgetDef<unknown>,
  totalSpeedWidget as WidgetDef<unknown>,
]);

export function registerTokenWidgets(registry: WidgetRegistry): void {
  for (const def of TOKEN_WIDGETS) {
    registry.register(def);
  }
}
