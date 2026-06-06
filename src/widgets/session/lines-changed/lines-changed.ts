/**
 * `lines-changed` widget (session family, §7.2).
 *
 * Renders the host-reported lines added/removed for the session,
 * e.g. `+156 −23`. Uses a figure-dash minus (−, U+2212) consistent
 * with other widgets in this codebase.
 *
 * Reads `ctx.stdin.cost.linesAdded` / `ctx.stdin.cost.linesRemoved`
 * directly — the host pre-computes these; no transcript aggregation,
 * no reset axis.
 *
 * Hides when the cost block is absent or both line counts are absent.
 * Renders whichever segment is present when only one field is reported.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

interface LinesChangedOptions {
  readonly label?: string;
}

/** Figure-dash minus (U+2212) used throughout the git/tokens widget surface. */
const MINUS = "−";

export const linesChangedWidget = defineWidget<LinesChangedOptions>(
  "lines-changed",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost) return { text: "", hidden: true };
    const { linesAdded, linesRemoved } = cost;
    if (linesAdded === undefined && linesRemoved === undefined) {
      return { text: "", hidden: true };
    }
    const parts: string[] = [];
    if (linesAdded !== undefined) parts.push(`+${linesAdded}`);
    if (linesRemoved !== undefined) parts.push(`${MINUS}${linesRemoved}`);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${parts.join(" ")}` };
  },
);
