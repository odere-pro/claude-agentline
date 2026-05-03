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
import { loginMethodWidget } from "./login-method.js";
import { modelWidget } from "./model.js";
import { orgWidget } from "./org.js";
import { outputStyleWidget } from "./output-style.js";
import { sessionIdWidget } from "./session-id.js";
import { sessionNameWidget } from "./session-name.js";
import { skillsWidget } from "./skills.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { versionWidget } from "./version.js";
import { vimModeWidget } from "./vim-mode.js";

export {
  accountEmailWidget,
  loginMethodWidget,
  modelWidget,
  orgWidget,
  outputStyleWidget,
  sessionIdWidget,
  sessionNameWidget,
  skillsWidget,
  thinkingEffortWidget,
  versionWidget,
  vimModeWidget,
};

export const SESSION_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  accountEmailWidget,
  loginMethodWidget,
  modelWidget,
  orgWidget,
  outputStyleWidget,
  sessionIdWidget,
  sessionNameWidget,
  skillsWidget,
  thinkingEffortWidget,
  versionWidget,
  vimModeWidget,
] as readonly WidgetDef<unknown>[]);

export function registerSessionWidgets(registry: WidgetRegistry): void {
  registry.registerAll(SESSION_WIDGETS);
}
