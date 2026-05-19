/**
 * `git-branch` widget (§7.6). Renders the current branch name; on a
 * detached HEAD, the snapshot already substitutes the short SHA so
 * this widget renders `(SHA)` per spec. Hidden outside a git repo.
 *
 * The OSC-8 link toggle is honoured by the renderer if a future PR
 * adds it; for v0.1.0 the widget emits plain text.
 */

import { resolveRole } from "../../theme/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
}

export const gitBranchWidget = defineWidget<Options>("git-branch", (ctx, settings): Cell => {
  const snap = ctx.git;
  if (!snap || !snap.available) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const body = snap.detached ? `(${snap.branch})` : snap.branch;
  if (!body) return { text: "", hidden: true };
  const role =
    snap.status.staged + snap.status.unstaged + snap.status.untracked > 0
      ? "git-dirty"
      : "git-clean";
  const fg = resolveRole(ctx.theme, role);
  return { text: `${label}${body}`, fg, signal: true };
});
