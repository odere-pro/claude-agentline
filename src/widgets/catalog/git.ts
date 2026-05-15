/**
 * Git widgets — branch / SHA / worktree, change counts, upstream and
 * pull-request signals.
 */

import { entry, v, type WidgetMeta } from "./types.js";

export const GIT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "git-branch": entry("Git branch", "Current branch, or short SHA when detached", "git"),
  "git-sha": entry("Git SHA", "Short commit SHA of HEAD", "git"),
  "git-worktree": entry("Git worktree", "Basename of the current worktree", "git"),
  "git-changes": entry("Git changes", "Staged, unstaged, and untracked file counts", "git"),
  "git-staged": entry("Git staged", "Staged-file count", "git"),
  "git-unstaged": entry("Git unstaged", "Unstaged-file count", "git"),
  "git-untracked": entry("Git untracked", "Untracked-file count", "git"),
  "git-conflicts": entry("Git conflicts", "Merge-conflict file count", "git"),
  "git-ahead-behind": entry("Git ahead/behind", "Commits ahead of and behind upstream", "git"),
  "git-upstream": entry("Git upstream", "Upstream branch, e.g. origin/main", "git"),
  "git-origin-repo": entry("Git origin repo", "Repo segment of the origin remote URL", "git"),
  "git-pr": entry(
    "Git pull request",
    "PR for HEAD's branch (opt-in network: requires options.allowNetwork)",
    "git",
    [
      v("number", "Number (#42)", { variant: "number" }),
      v("url", "URL (https://…/pull/42)", { variant: "url" }),
      v("title", "Title (feat: …)", { variant: "title" }),
      v("number-title", "Number + title (#42 feat: …)", { variant: "number-title" }),
    ],
  ),
});
