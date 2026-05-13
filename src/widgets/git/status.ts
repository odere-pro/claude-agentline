/**
 * `git-staged`, `git-unstaged`, `git-untracked` widgets (§7.6). All
 * three read the porcelain counts off the snapshot and render the bare
 * count; they hide on zero (default), opt-out via `options.hideZero: false`.
 */

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
