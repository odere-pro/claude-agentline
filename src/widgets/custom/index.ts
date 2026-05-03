/**
 * Custom widget family (§7.8): `separator`, `flex-separator`,
 * `command`. Same registration shape as the other families — a
 * frozen `CUSTOM_WIDGETS` array plus a `registerCustomWidgets(registry)`
 * helper for the default-registry bootstrap.
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { clearCommandCache, commandWidget } from "./command.js";
import { flexSeparatorWidget, separatorWidget, SEPARATOR_CYCLE } from "./separator.js";

export { clearCommandCache, commandWidget } from "./command.js";
export { flexSeparatorWidget, separatorWidget, SEPARATOR_CYCLE } from "./separator.js";

export const CUSTOM_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  commandWidget as WidgetDef<unknown>,
  flexSeparatorWidget as WidgetDef<unknown>,
  separatorWidget as WidgetDef<unknown>,
]);

export function registerCustomWidgets(registry: WidgetRegistry): void {
  for (const def of CUSTOM_WIDGETS) {
    registry.register(def);
  }
}

// Re-exported so the TUI editor / tests can reset state without
// importing the inner module path.
export { clearCommandCache as resetCommandCache };
// Re-export so consumers can import either name; the cycle list
// itself stays a single source of truth in `separator.ts`.
export { SEPARATOR_CYCLE as separatorCycle };
