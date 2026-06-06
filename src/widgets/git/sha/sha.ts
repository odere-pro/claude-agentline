/**
 * `git-worktree` widget (§7.6).
 *
 * Renders the worktree directory name when the snapshot reports we're inside
 * a `.git/worktrees/<name>` checkout; hidden everywhere else.
 *
 * The `git-sha` widget was removed in PR #258 (catalogue trim). Use
 * `git-branch` when the branch name in detached-HEAD mode (which already
 * falls back to the short SHA) is sufficient.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

interface WorktreeOptions {
  readonly label?: string;
}

export const gitWorktreeWidget = defineWidget<WorktreeOptions>(
  "git-worktree",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.inWorktree || !s.worktreeName) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${s.worktreeName}` };
  },
);
