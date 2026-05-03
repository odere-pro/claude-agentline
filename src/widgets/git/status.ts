/**
 * `git-status`, `git-staged`, `git-unstaged`, `git-untracked` widgets
 * (§7.6). All four read the porcelain counts off the snapshot.
 *
 * `git-status` produces a compact `M2 A1 ?3` summary, eliding any
 * segment that is zero. The single-count widgets render the bare
 * count and hide on zero (default); opt-out via `options.hideZero: false`.
 */

import { resolveRole } from "../../theme/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
  readonly hideZero?: boolean;
}

function snap(ctx: WidgetContext) {
  return ctx.git && ctx.git.available ? ctx.git : null;
}

export const gitStatusWidget = defineWidget<Options>("git-status", (ctx, settings): Cell => {
  const s = snap(ctx);
  if (!s) return { text: "", hidden: true };
  const segs: string[] = [];
  if (s.status.modified > 0) segs.push(`M${s.status.modified}`);
  if (s.status.added > 0) segs.push(`A${s.status.added}`);
  if (s.status.untracked > 0) segs.push(`?${s.status.untracked}`);
  if (s.status.conflicts > 0) segs.push(`U${s.status.conflicts}`);
  const hideZero = settings.options.hideZero !== false;
  if (segs.length === 0 && hideZero) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const role = segs.length > 0 ? "git-dirty" : "git-clean";
  const fg = resolveRole(ctx.theme, role);
  return { text: `${label}${segs.length > 0 ? segs.join(" ") : "clean"}`, fg };
});

function countWidget(name: string, pick: (s: ReturnType<typeof snap>) => number) {
  return defineWidget<Options>(name, (ctx, settings): Cell => {
    const s = snap(ctx);
    if (!s) return { text: "", hidden: true };
    const count = pick(s);
    const hideZero = settings.options.hideZero !== false;
    if (count === 0 && hideZero) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${count}` };
  });
}

export const gitStagedWidget = countWidget("git-staged", (s) => (s ? s.status.staged : 0));
export const gitUnstagedWidget = countWidget("git-unstaged", (s) => (s ? s.status.unstaged : 0));
export const gitUntrackedWidget = countWidget("git-untracked", (s) => (s ? s.status.untracked : 0));
