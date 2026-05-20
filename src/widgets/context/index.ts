/**
 * Context-related widgets registration entry-point.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { contextBarWidget } from "./context-bar/context-bar.js";
import { contextLengthWidget } from "./context-length/context-length.js";
import { contextPercentageWidget } from "./percentage/percentage.js";

export const CONTEXT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(contextBarWidget),
  eraseWidget(contextLengthWidget),
  eraseWidget(contextPercentageWidget),
]);

export function registerContextWidgets(registry: WidgetRegistry): void {
  for (const def of CONTEXT_WIDGETS) {
    registry.register(def);
  }
}
