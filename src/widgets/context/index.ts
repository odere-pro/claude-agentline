/**
 * Context-related widgets registration entry-point.
 *
 * `context-bar` and `context-length` were removed in v0.1.x (PR #258).
 * `context-percentage` remains.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { contextPercentageWidget } from "./percentage/percentage.js";

export const CONTEXT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(contextPercentageWidget),
]);

export function registerContextWidgets(registry: WidgetRegistry): void {
  for (const def of CONTEXT_WIDGETS) {
    registry.register(def);
  }
}
