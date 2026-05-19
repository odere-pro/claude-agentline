/**
 * Session-widget family registration (§7.2).
 *
 * Exports each widget def for direct import (tests, custom registries)
 * and a `registerSessionWidgets(registry)` helper for the default
 * registry bootstrap.
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { accountEmailWidget } from "./account-email.js";
import { modelWidget } from "./model.js";
import { planWidget } from "./plan.js";
import { sessionIdWidget } from "./session-id.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { versionWidget } from "./version.js";

export {
  accountEmailWidget,
  modelWidget,
  planWidget,
  sessionIdWidget,
  thinkingEffortWidget,
  versionWidget,
};

export const SESSION_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  accountEmailWidget,
  modelWidget,
  planWidget,
  sessionIdWidget,
  thinkingEffortWidget,
  versionWidget,
] as readonly WidgetDef<unknown>[]);

export function registerSessionWidgets(registry: WidgetRegistry): void {
  registry.registerAll(SESSION_WIDGETS);
}
