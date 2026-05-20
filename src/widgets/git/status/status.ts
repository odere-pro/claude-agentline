/**
 * `git-untracked` widget (§7.6). Reads the porcelain count off the
 * snapshot and renders the bare count; it hides on zero (default),
 * opt-out via `options.hideZero: false`.
 */

import type { Cell } from "../../cell/cell.js";
import type { WidgetContext } from "../../types.js";
import { defineWidget } from "../../widget.js";

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

export const gitUntrackedWidget = countWidget("git-untracked", (s) => (s ? s.status.untracked : 0));
