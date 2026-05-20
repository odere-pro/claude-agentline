/**
 * `context-percentage` widget (§7.4). Used / window ratio, followed by
 * the model's context-window size (e.g. `37% · 200k`). Renders in the
 * context family accent — no per-widget colour, so every context widget
 * reads as one family.
 *
 * The `{ used, window }` resolution lives in `./usage.ts` and is shared
 * with `context-bar`.
 */

import type { Cell } from "../../cell/cell.js";
import { valueSeparator } from "../../separator/separator.js";
import { MAX_DISPLAY_PERCENTAGE } from "../../types.js";
import { defineWidget } from "../../widget.js";

import { formatWindowLabel, resolveContextUsage } from "../usage.js";

interface Options {
  readonly label?: string;
}

export const contextPercentageWidget = defineWidget<Options>(
  "context-percentage",
  (ctx, settings): Cell => {
    const usage = resolveContextUsage(ctx);
    if (usage === null) return { text: "", hidden: true };
    const ratio = usage.window > 0 ? usage.used / usage.window : 0;
    const pct = Math.min(MAX_DISPLAY_PERCENTAGE, Math.round(ratio * 100));
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const windowLabel = formatWindowLabel(usage.window);
    const postfix = windowLabel ? ` ${valueSeparator(ctx)} ${windowLabel}` : "";
    return { text: `${label}${pct}%${postfix}` };
  },
);
