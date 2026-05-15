/**
 * Custom widget family (§7.8): `separator` and `osc-link`. The other
 * custom widgets (`flex-separator`, `command`, `key-hints`) were
 * retired with the catalogue trim. Same registration shape as the
 * other families — a frozen `CUSTOM_WIDGETS` array plus a
 * `registerCustomWidgets(registry)` helper for the default-registry
 * bootstrap.
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { separatorWidget, SEPARATOR_CYCLE } from "./separator.js";
import { oscLinkWidget } from "./osc-link.js";

export { separatorWidget, SEPARATOR_CYCLE } from "./separator.js";
export { oscLinkWidget } from "./osc-link.js";

export const CUSTOM_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(separatorWidget),
  eraseWidget(oscLinkWidget),
]);

export function registerCustomWidgets(registry: WidgetRegistry): void {
  for (const def of CUSTOM_WIDGETS) {
    registry.register(def);
  }
}

/*
 * Re-export so consumers can import either name; the cycle list
 * itself stays a single source of truth in `separator.ts`.
 */
export { SEPARATOR_CYCLE as separatorCycle };
