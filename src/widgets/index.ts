/**
 * Public surface of the widget base layer (§7.1).
 *
 * Re-exports the contract types (`Cell`, `WidgetDef`, …), the registry, the
 * dispatcher, and the catalogue lookup helpers. `registerAllBuiltins` wires
 * every built-in family (session, tokens, context, rate-limits, git) into a
 * given registry; the render pipeline calls it once during boot against
 * `defaultRegistry()`.
 */

export { WidgetRegistry, defaultRegistry } from "./registry/registry.js";
export { WIDGET_FAMILIES, type WidgetMetaEntry } from "./families/catalog.js";

import type { WidgetRegistry } from "./registry/registry.js";
import { registerSessionWidgets } from "./session/index.js";
import { registerTokenWidgets } from "./tokens/index.js";
import { registerContextWidgets } from "./context/index.js";
import { registerRateLimitWidgets } from "./rate-limits/index.js";
import { registerGitWidgets } from "./git/index.js";

/** Register every built-in widget family against the given registry. */
export function registerAllBuiltins(registry: WidgetRegistry): void {
  registerSessionWidgets(registry);
  registerTokenWidgets(registry);
  registerContextWidgets(registry);
  registerRateLimitWidgets(registry);
  registerGitWidgets(registry);
}
