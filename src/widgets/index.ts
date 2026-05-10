/**
 * Public surface of the widget base layer (§7.1).
 *
 * PR 9 ships the contract; built-in widgets register themselves
 * against `defaultRegistry()` in subsequent PRs (10–14).
 */

export { HIDDEN_CELL, isHidden, plainCell, type Cell, type MergeMode } from "./cell.js";
export { realClock, frozenClock, type Clock } from "./clock.js";
export { type WidgetContext } from "./context.js";
export {
  defineWidget,
  type WidgetDef,
  type WidgetRender,
  type WidgetSettings,
} from "./widget.js";
export {
  WidgetRegistry,
  WidgetTypeAlreadyRegistered,
  WidgetTypeNotRegistered,
  defaultRegistry,
  resetDefaultRegistry,
} from "./registry.js";
export {
  renderWidget,
  WidgetTypeMissingError,
  type RenderWidgetOptions,
} from "./render-widget.js";

import type { WidgetRegistry } from "./registry.js";
import { registerSessionWidgets } from "./session/index.js";
import { registerTokenWidgets } from "./tokens/index.js";
import { registerContextWidgets } from "./context/index.js";
import { registerRateLimitWidgets } from "./rate-limits/index.js";
import { registerGitWidgets } from "./git/index.js";
import { registerTimeWidgets } from "./time/index.js";
import { registerCustomWidgets } from "./custom/index.js";

/** Register every built-in widget family against the given registry. */
export function registerAllBuiltins(registry: WidgetRegistry): void {
  registerSessionWidgets(registry);
  registerTokenWidgets(registry);
  registerContextWidgets(registry);
  registerRateLimitWidgets(registry);
  registerGitWidgets(registry);
  registerTimeWidgets(registry);
  registerCustomWidgets(registry);
}
