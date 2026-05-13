/**
 * Git widget family (§7.6, §8.6). Mirrors the registration shape of
 * the session / tokens / context / rate-limit families: a frozen
 * `GIT_WIDGETS` array plus a `registerGitWidgets(registry)` helper
 * that the default-registry bootstrap calls.
 *
 * All git widgets read from the `ctx.git` snapshot (loaded once per
 * render tick) — no widget shells out from `render()` itself.
 */

import type { WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry.js";

import { gitAheadBehindWidget, gitConflictsWidget } from "./ahead-behind.js";
import { gitBranchWidget } from "./branch.js";
import { gitChangesWidget } from "./changes.js";
import { gitPrWidget } from "./pr.js";
import { gitOriginRepoWidget, gitUpstreamWidget } from "./remote.js";
import { gitShaWidget, gitWorktreeWidget } from "./sha.js";
import {
  gitStagedWidget,
  gitUnstagedWidget,
  gitUntrackedWidget,
} from "./status.js";

export { gitAheadBehindWidget, gitConflictsWidget } from "./ahead-behind.js";
export { gitBranchWidget } from "./branch.js";
export { gitChangesWidget } from "./changes.js";
export { gitPrWidget } from "./pr.js";
export { gitOriginRepoWidget, gitUpstreamWidget } from "./remote.js";
export { gitShaWidget, gitWorktreeWidget } from "./sha.js";
export { gitStagedWidget, gitUnstagedWidget, gitUntrackedWidget } from "./status.js";

export const GIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  gitBranchWidget as WidgetDef<unknown>,
  gitShaWidget as WidgetDef<unknown>,
  gitWorktreeWidget as WidgetDef<unknown>,
  gitChangesWidget as WidgetDef<unknown>,
  gitStagedWidget as WidgetDef<unknown>,
  gitUnstagedWidget as WidgetDef<unknown>,
  gitUntrackedWidget as WidgetDef<unknown>,
  gitConflictsWidget as WidgetDef<unknown>,
  gitAheadBehindWidget as WidgetDef<unknown>,
  gitUpstreamWidget as WidgetDef<unknown>,
  gitOriginRepoWidget as WidgetDef<unknown>,
  gitPrWidget as WidgetDef<unknown>,
]);

export function registerGitWidgets(registry: WidgetRegistry): void {
  for (const def of GIT_WIDGETS) {
    registry.register(def);
  }
}
