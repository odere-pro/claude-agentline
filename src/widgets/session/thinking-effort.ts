/**
 * `thinking-effort` widget (§7.2). One of `low` / `medium` / `high`
 * / `xhigh`. Renders in the session family accent — no per-widget
 * colour, so every session widget reads as one family.
 */

import type { Cell } from "../cell/cell.js";
import { defineWidget } from "../widget.js";

type Effort = "low" | "medium" | "high" | "xhigh";

interface ThinkingEffortOptions {
  readonly label?: string;
}

function normaliseEffort(value: string): Effort | null {
  const v = value.toLowerCase().trim();
  if (v === "low" || v === "medium" || v === "high" || v === "xhigh") return v;
  return null;
}

export const thinkingEffortWidget = defineWidget<ThinkingEffortOptions>(
  "thinking-effort",
  (ctx, settings): Cell => {
    const raw = ctx.session?.thinkingEffort ?? ctx.stdin.thinkingEffort;
    if (!raw) return { text: "", hidden: true };
    const effort = normaliseEffort(raw);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${effort ?? raw}` };
  },
);
