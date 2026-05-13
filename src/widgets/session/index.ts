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
import { sessionIdWidget } from "./session-id.js";
import { sessionNameWidget } from "./session-name.js";
import { skillsWidget } from "./skills.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { versionWidget } from "./version.js";

export {
  accountEmailWidget,
  modelWidget,
  sessionIdWidget,
  sessionNameWidget,
  skillsWidget,
  thinkingEffortWidget,
  versionWidget,
};

export const SESSION_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  accountEmailWidget,
  modelWidget,
  sessionIdWidget,
  sessionNameWidget,
  skillsWidget,
  thinkingEffortWidget,
  versionWidget,
] as readonly WidgetDef<unknown>[]);

export function registerSessionWidgets(registry: WidgetRegistry): void {
  registry.registerAll(SESSION_WIDGETS);
}
