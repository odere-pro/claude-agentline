/**
 * `git-sha` and `git-worktree` widgets (§7.6).
 *
 * `git-sha` renders the 7-character short SHA; `options.length` may
 * widen it (clamped to the 40-char full SHA). `git-worktree` renders
 * the worktree directory name when the snapshot reports we're inside
 * a `.git/worktrees/<name>` checkout; hidden everywhere else.
 */

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface ShaOptions {
  readonly label?: string;
  readonly length?: number;
}

interface WorktreeOptions {
  readonly label?: string;
}

function clampLength(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 7;
  return Math.min(Math.floor(value), 40);
}

export const gitShaWidget = defineWidget<ShaOptions>("git-sha", (ctx, settings): Cell => {
  const s = ctx.git && ctx.git.available ? ctx.git : null;
  if (!s) return { text: "", hidden: true };
  if (!s.sha) return { text: "", hidden: true };
  const len = clampLength(settings.options.length);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${s.sha.slice(0, len)}` };
});

export const gitWorktreeWidget = defineWidget<WorktreeOptions>(
  "git-worktree",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.inWorktree || !s.worktreeName) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${s.worktreeName}` };
  },
);
