/**
 * Session-widget family registration (§7.2).
 *
 * Exports each widget def for direct import (tests, custom registries)
 * and a `registerSessionWidgets(registry)` helper for the default
 * registry bootstrap.
 *
 * `claude-doctor` and `claude-update` were removed in v0.1.x (PR #258).
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { accountEmailWidget } from "./account-email.js";
import { modelWidget } from "./model.js";
import { planWidget } from "./plan.js";
import { projectWidget } from "./project.js";
import { sessionIdWidget } from "./session-id.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { versionWidget } from "./version.js";

export const SESSION_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  accountEmailWidget,
  modelWidget,
  planWidget,
  projectWidget,
  sessionIdWidget,
  thinkingEffortWidget,
  versionWidget,
] as readonly WidgetDef<unknown>[]);

export function registerSessionWidgets(registry: WidgetRegistry): void {
  registry.registerAll(SESSION_WIDGETS);
}
