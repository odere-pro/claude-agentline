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
