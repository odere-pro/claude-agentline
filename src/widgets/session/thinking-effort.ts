/**
 * `thinking-effort` widget (§7.2). One of `low` / `medium` / `high`
 * / `xhigh`; semantic colour is resolved against the theme palette
 * (low → success, medium → info, high → warning, xhigh → danger).
 */

import type { Colour } from "../../theme/colours.js";
import { resolveRole, type Theme } from "../../theme/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

type Effort = "low" | "medium" | "high" | "xhigh";

interface ThinkingEffortOptions {
  readonly label?: string;
}

const EFFORT_ROLE: Readonly<Record<Effort, "success" | "info" | "warning" | "danger">> = {
  low: "success",
  medium: "info",
  high: "warning",
  xhigh: "danger",
};

function normaliseEffort(value: string): Effort | null {
  const v = value.toLowerCase().trim();
  if (v === "low" || v === "medium" || v === "high" || v === "xhigh") return v;
  return null;
}

function effortFg(effort: Effort | null, theme: Theme | null): Colour | undefined {
  if (!effort) return undefined;
  return resolveRole(theme, EFFORT_ROLE[effort]);
}

export const thinkingEffortWidget = defineWidget<ThinkingEffortOptions>(
  "thinking-effort",
  (ctx, settings): Cell => {
    const raw = ctx.session?.thinkingEffort ?? ctx.stdin.thinkingEffort;
    if (!raw) return { text: "", hidden: true };
    const effort = normaliseEffort(raw);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const fg = effortFg(effort, ctx.theme);
    return fg ? { text: `${label}${effort ?? raw}`, fg } : { text: `${label}${effort ?? raw}` };
  },
);
