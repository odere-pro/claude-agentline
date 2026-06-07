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
import { addedDirsWidget } from "./added-dirs/added-dirs.js";
import { agentNameWidget } from "./agent-name/agent-name.js";
import { clockWidget } from "./clock/clock-widget.js";
import { cwdPathWidget } from "./cwd-path/cwd-path.js";
import { linesChangedWidget } from "./lines-changed/lines-changed.js";
import { modelWidget } from "./model.js";
import { outputStyleWidget } from "./output-style/output-style.js";
import { planWidget } from "./plan.js";
import { projectWidget } from "./project.js";
import { projectDirWidget } from "./project-dir/project-dir.js";
import { sessionDurationWidget } from "./session-duration/session-duration.js";
import { sessionIdWidget } from "./session-id.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { thinkingEnabledWidget } from "./thinking-enabled/thinking-enabled.js";
import { versionWidget } from "./version.js";
import { vimModeWidget } from "./vim-mode/vim-mode.js";

export const SESSION_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  accountEmailWidget,
  addedDirsWidget,
  agentNameWidget,
  clockWidget,
  cwdPathWidget,
  linesChangedWidget,
  modelWidget,
  outputStyleWidget,
  planWidget,
  projectWidget,
  projectDirWidget,
  sessionDurationWidget,
  sessionIdWidget,
  thinkingEffortWidget,
  thinkingEnabledWidget,
  versionWidget,
  vimModeWidget,
] as readonly WidgetDef<unknown>[]);

export function registerSessionWidgets(registry: WidgetRegistry): void {
  registry.registerAll(SESSION_WIDGETS);
}
