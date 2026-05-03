/**
 * `git-changes`, `git-insertions`, `git-deletions` widgets (§7.6).
 *
 * Sourced from `git diff --shortstat` (working-tree changes) on the
 * snapshot. `git-changes` renders `+N -M`; `git-insertions` and
 * `git-deletions` render only their half. All three hide outside a
 * git repo and when their value is zero (the default; opt-out via
 * `options.hideZero: false`).
 */

import { resolveRole } from "../../theme/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
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

function shouldHide(value: number, hideZero: boolean): boolean {
  return value === 0 && hideZero;
}

export const gitChangesWidget = defineWidget<Options>("git-changes", (ctx, settings): Cell => {
  const d = diffOf(ctx);
  if (!d) return { text: "", hidden: true };
  const total = d.ins + d.del;
  const hideZero = settings.options.hideZero !== false;
  if (shouldHide(total, hideZero)) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, "git-dirty");
  return { text: `${label}+${d.ins} -${d.del}`, fg };
});

export const gitInsertionsWidget = defineWidget<Options>(
  "git-insertions",
  (ctx, settings): Cell => {
    const d = diffOf(ctx);
    if (!d) return { text: "", hidden: true };
    const hideZero = settings.options.hideZero !== false;
    if (shouldHide(d.ins, hideZero)) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const fg = resolveRole(ctx.theme, "success");
    return { text: `${label}+${d.ins}`, fg };
  },
);

export const gitDeletionsWidget = defineWidget<Options>(
  "git-deletions",
  (ctx, settings): Cell => {
    const d = diffOf(ctx);
    if (!d) return { text: "", hidden: true };
    const hideZero = settings.options.hideZero !== false;
    if (shouldHide(d.del, hideZero)) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const fg = resolveRole(ctx.theme, "danger");
    return { text: `${label}-${d.del}`, fg };
  },
);
