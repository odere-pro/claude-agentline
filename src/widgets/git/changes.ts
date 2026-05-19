/**
 * `git-changes` widget (§7.6).
 *
 * Reads `git diff --shortstat` (working-tree changes) off the snapshot
 * and renders `+N -M`. Hides outside a git repo and when both counts
 * are zero (the default; opt-out via `options.hideZero: false`).
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import { joinValues } from "../separator.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
  readonly hideZero?: boolean;
}

function diffOf(ctx: WidgetContext): { ins: number; del: number } | null {
  const snap = ctx.git;
  if (!snap || !snap.available) return null;
  return { ins: snap.diff.insertions, del: snap.diff.deletions };
}

export const gitChangesWidget = defineWidget<Options>("git-changes", (ctx, settings): Cell => {
  const d = diffOf(ctx);
  if (!d) return { text: "", hidden: true };
  const total = d.ins + d.del;
  const hideZero = settings.options.hideZero !== false;
  if (total === 0 && hideZero) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, "git-dirty");
  return { text: `${label}${joinValues(ctx, [`+${d.ins}`, `-${d.del}`])}`, fg, signal: true };
});
