/**
 * Git + project-location widgets — branch / worktree, change counts,
 * upstream and pull-request signals, plus the project name and launch
 * directory.
 *
 * `git-sha` and `git-untracked` were removed in v0.1.x (PR #258).
 * Use `git-branch` (which shows the short SHA on detached HEAD) and
 * `git-changes` (which includes untracked counts) instead.
 *
 * `project` / `project-dir` were catalogued under `session` before; only
 * the catalogue `family` field moved here (their render-fn folders stay
 * under `src/widgets/session/`). They sit with git because the project
 * name is git-repo-derived (origin remote, basename fallback).
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const GIT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  project: entry("Project", "Project name — git repo or working-directory folder", "git"),
  "project-dir": entry(
    "Project dir",
    "Launch-directory name (distinct from the git repo name)",
    "git",
  ),
  "git-branch": entry("Git branch", "Current branch, or short SHA when detached", "git"),
  "git-worktree": entry("Git worktree", "Basename of the current worktree", "git"),
  "git-changes": entry("Git changes", "Staged, unstaged, and untracked file counts", "git"),
  "git-conflicts": entry("Git conflicts", "Merge-conflict file count", "git"),
  "git-ahead-behind": entry("Git ahead/behind", "Commits ahead of and behind upstream", "git"),
  "git-upstream": entry("Git upstream", "Upstream branch, e.g. origin/main", "git"),
  "git-origin-repo": entry(
    "Git origin repo",
    "Repo segment of the origin remote URL, or host-provided repo name",
    "git",
    [
      v("owner-name", "Owner/name (odere-pro/agentline)", { variant: "owner-name" }),
    ],
  ),
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
  "git-pr-review": entry(
    "Git PR review",
    "Host-provided PR review state (approved, changes requested, pending, draft)",
    "git",
    [
      v("glyph", "Glyph (✓ / ✗ / … / ◌)", { variant: "glyph" }),
      v("word", "Word (approved / changes requested / pending / draft)", { variant: "word" }),
    ],
  ),
});
