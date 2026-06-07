/**
 * `context-200k-flag` widget (context family).
 *
 * Shows a badge when `ctx.stdin.exceeds200kTokens` is true — the current
 * prompt has crossed the 200k-token threshold, where long-context
 * pricing/behaviour applies. Hidden when false or absent (the common
 * case), so the badge only appears when it matters. Pure
 * `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface Context200kFlagOptions {
  readonly label?: string;
}

const BADGE = ">200k";

export const context200kFlagWidget = defineWidget<Context200kFlagOptions>(
  "context-200k-flag",
  (ctx: WidgetContext, settings): Cell => {
    if (ctx.stdin.exceeds200kTokens !== true) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${BADGE}` };
  },
);
