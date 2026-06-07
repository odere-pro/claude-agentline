/**
 * `thinking-enabled` widget (session family).
 *
 * Renders an on/off indicator from `ctx.stdin.thinkingEnabled` (the
 * host's `thinking.enabled`). Complements `thinking-effort` (which
 * *level*): this is the on/off switch. Shows `thinking` when on; hides
 * the off state by default (`showOff: true` renders `no-thinking`).
 * Hidden when the host did not report the field. Pure
 * `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface ThinkingEnabledOptions {
  readonly label?: string;
  /** Render an explicit off state instead of hiding when disabled. */
  readonly showOff?: boolean;
}

export const thinkingEnabledWidget = defineWidget<ThinkingEnabledOptions>(
  "thinking-enabled",
  (ctx: WidgetContext, settings): Cell => {
    const enabled = ctx.stdin.thinkingEnabled;
    if (enabled === undefined) return { text: "", hidden: true };
    if (!enabled && settings.options.showOff !== true) return { text: "", hidden: true };
    const state = enabled ? "thinking" : "no-thinking";
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${state}` };
  },
);
