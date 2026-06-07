/**
 * `added-dirs` widget (session family).
 *
 * Renders a count of extra workspace roots added via `/add-dir`, from
 * `ctx.stdin.addedDirs.length`, e.g. `+2 dirs`. `rawValue` renders the
 * bare count. Hidden when the list is absent or empty. Pure
 * `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface AddedDirsOptions {
  readonly label?: string;
}

export const addedDirsWidget = defineWidget<AddedDirsOptions>(
  "added-dirs",
  (ctx: WidgetContext, settings): Cell => {
    const dirs = ctx.stdin.addedDirs;
    if (!dirs || dirs.length === 0) return { text: "", hidden: true };
    const count = dirs.length;
    if (settings.rawValue) return { text: String(count) };
    const noun = count === 1 ? "dir" : "dirs";
    const label = settings.options.label ?? "";
    return { text: `${label}+${count} ${noun}` };
  },
);
