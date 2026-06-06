/**
 * Git widget family (§7.6, §8.6). Mirrors the registration shape of
 * the session / tokens / context / rate-limit families: a frozen
 * `GIT_WIDGETS` array plus a `registerGitWidgets(registry)` helper
 * that the default-registry bootstrap calls.
 *
 * All git widgets read from the `ctx.git` snapshot (loaded once per
 * render tick) — no widget shells out from `render()` itself.
 *
 * `git-sha` and `git-untracked` were removed in v0.1.x (PR #258).
 */

import { eraseWidget, type WidgetDef } from "../widget.js";
import type { WidgetRegistry } from "../registry/registry.js";

import { gitAheadBehindWidget, gitConflictsWidget } from "./ahead-behind/ahead-behind.js";
import { gitBranchWidget } from "./branch.js";
import { gitChangesWidget } from "./changes.js";
import { gitPrWidget } from "./pr/pr.js";
import { gitOriginRepoWidget, gitUpstreamWidget } from "./remote/remote.js";
import { gitWorktreeWidget } from "./sha/sha.js";

export const GIT_WIDGETS: readonly WidgetDef<unknown>[] = Object.freeze([
  eraseWidget(gitBranchWidget),
  eraseWidget(gitWorktreeWidget),
  eraseWidget(gitChangesWidget),
  eraseWidget(gitConflictsWidget),
  eraseWidget(gitAheadBehindWidget),
  eraseWidget(gitUpstreamWidget),
  eraseWidget(gitOriginRepoWidget),
  eraseWidget(gitPrWidget),
]);

export function registerGitWidgets(registry: WidgetRegistry): void {
  for (const def of GIT_WIDGETS) {
    registry.register(def);
  }
}
