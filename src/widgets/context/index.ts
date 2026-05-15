/**
 * Context-related widgets registration entry-point.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { contextBarWidget } from "./context-bar.js";
import { contextLengthWidget } from "./context-length.js";
import {
  contextPercentageUsableWidget,
  contextPercentageWidget,
} from "./percentage.js";

export { contextBarWidget } from "./context-bar.js";
export { contextLengthWidget } from "./context-length.js";
export {
  contextPercentageUsableWidget,
  contextPercentageWidget,
} from "./percentage.js";

export const CONTEXT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(contextBarWidget),
  eraseWidget(contextLengthWidget),
  eraseWidget(contextPercentageUsableWidget),
  eraseWidget(contextPercentageWidget),
]);

export function registerContextWidgets(registry: WidgetRegistry): void {
  for (const def of CONTEXT_WIDGETS) {
    registry.register(def);
  }
}
