/**
 * `plan` widget (§7.2). Renders the active plan name — the basename
 * (sans `.md`) of the most-recently-modified file in the plans
 * directory (`${CLAUDE_CONFIG_DIR:-~/.claude}/plans`).
 *
 * Source: `ctx.plan`, resolved once per render tick by
 * `loadPlanSnapshot` (`src/session/plan.ts`); the widget itself does no
 * filesystem I/O during `render()` (§7.1). Hidden when there is no
 * active plan.
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface PlanOptions {
  readonly label?: string;
}

export const planWidget = defineWidget<PlanOptions>("plan", (ctx, settings): Cell => {
  const name = ctx.plan?.name;
  if (!name) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, "accent");
  const href = ctx.plan?.href;
  return { text: `${label}${name}`, fg, ...(href ? { href } : {}) };
});
